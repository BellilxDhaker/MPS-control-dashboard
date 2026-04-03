"""In-memory and persistent file storage management."""

import os
import uuid
from pathlib import Path
from typing import Any

import pandas as pd


class FileStorage:
    """
    Manages file storage and caching.
    
    In production, replace with:
    - Redis for distributed caching
    - S3 for file storage
    - PostgreSQL for metadata
    """

    def __init__(self, cache_dir: str | None = None):
        """Initialize file storage."""
        self.cache_dir = Path(cache_dir or "/tmp/mps_uploads")
        self.cache_dir.mkdir(exist_ok=True, parents=True)

        # In-memory cache (latest dataset + metadata)
        self._latest_dataframe: pd.DataFrame | None = None
        self._upload_metadata: dict[str, dict[str, Any]] = {}
        self._processed_frames: dict[str, pd.DataFrame] = {}

    def store_raw_file(self, file_content: bytes, filename: str) -> str:
        """Store raw file and return upload ID."""
        upload_id = str(uuid.uuid4())

        # Save to disk for persistence
        file_path = self.cache_dir / f"{upload_id}_{filename}"
        file_path.write_bytes(file_content)

        # Store metadata
        self._upload_metadata[upload_id] = {
            "filename": filename,
            "file_path": str(file_path),
            "status": "PENDING",  # PENDING -> PROCESSING -> SUCCESS/ERROR
            "error": None,
        }

        return upload_id

    def store_processed_dataframe(self, upload_id: str, frame: pd.DataFrame) -> None:
        """Store processed dataframe after async processing."""
        # Cache in memory
        self._processed_frames[upload_id] = frame
        self._latest_dataframe = frame

        # Update metadata
        if upload_id in self._upload_metadata:
            self._upload_metadata[upload_id]["status"] = "SUCCESS"

    def store_error(self, upload_id: str, error_msg: str) -> None:
        """Store processing error."""
        if upload_id in self._upload_metadata:
            self._upload_metadata[upload_id]["status"] = "ERROR"
            self._upload_metadata[upload_id]["error"] = error_msg

    def get_latest_dataframe(self) -> pd.DataFrame | None:
        """Retrieve the most recently loaded dataframe."""
        return self._latest_dataframe

    def get_dataframe_by_id(self, upload_id: str) -> pd.DataFrame | None:
        """Retrieve specific dataframe by upload ID."""
        return self._processed_frames.get(upload_id)

    def get_upload_status(self, upload_id: str) -> dict[str, Any] | None:
        """Get processing status of an upload."""
        return self._upload_metadata.get(upload_id)

    def get_file_path(self, upload_id: str) -> str | None:
        """Get file path for an upload."""
        metadata = self._upload_metadata.get(upload_id)
        return metadata.get("file_path") if metadata else None

    def cleanup(self, upload_id: str, delete_disk: bool = False) -> None:
        """Clean up upload (optional disk cleanup for production)."""
        if delete_disk and upload_id in self._upload_metadata:
            file_path = self._upload_metadata[upload_id].get("file_path")
            if file_path and os.path.exists(file_path):
                os.remove(file_path)

        # Remove from cache
        self._processed_frames.pop(upload_id, None)
        self._upload_metadata.pop(upload_id, None)

    def cleanup_old_uploads(self, keep_latest: int = 5) -> None:
        """Clean up old uploads, keeping only the most recent N."""
        upload_ids = sorted(
            self._upload_metadata.keys(),
            key=lambda uid: self._upload_metadata[uid].get("status", ""),
            reverse=True,
        )

        for upload_id in upload_ids[keep_latest:]:
            self.cleanup(upload_id, delete_disk=True)
