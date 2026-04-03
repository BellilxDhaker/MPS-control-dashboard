"""In-memory and persistent file storage management."""

import os
import time
import uuid
from pathlib import Path
from typing import Any

import pandas as pd


class FileStorage:
    """
    Manages file storage and caching.
    
    Optimized for Railway with:
    - In-memory caching for speed
    - Lazy processing (process on-demand)
    - Result caching with TTL
    """

    def __init__(self, cache_dir: str | None = None):
        """Initialize file storage."""
        self.cache_dir = Path(cache_dir or "/tmp/mps_uploads")
        self.cache_dir.mkdir(exist_ok=True, parents=True)

        # In-memory cache
        self._latest_dataframe: pd.DataFrame | None = None
        self._latest_file_path: str | None = None
        self._upload_metadata: dict[str, dict[str, Any]] = {}
        self._processed_frames: dict[str, pd.DataFrame] = {}
        self._data_cache: dict[str, tuple[Any, float]] = {}  # {key: (data, ttl_end_time)}

    def store_raw_file(self, file_path: str, filename: str, size_bytes: int | None = None) -> str:
        """Store raw file metadata and return upload ID."""
        upload_id = str(uuid.uuid4())

        # Cache latest file path in memory (for immediate processing)
        self._latest_file_path = file_path

        # Store metadata
        self._upload_metadata[upload_id] = {
            "filename": filename,
            "file_path": str(file_path),
            "size_bytes": size_bytes,
            "status": "PENDING",
            "error": None,
        }

        return upload_id

    def store_processed_dataframe(self, upload_id: str, frame: pd.DataFrame) -> None:
        """Store processed dataframe."""
        self._processed_frames[upload_id] = frame
        self._latest_dataframe = frame

        if upload_id in self._upload_metadata:
            self._upload_metadata[upload_id]["status"] = "SUCCESS"

    def set_latest_dataframe(self, frame: pd.DataFrame) -> None:
        """Set the latest processed dataframe."""
        self._latest_dataframe = frame

    def store_error(self, upload_id: str, error_msg: str) -> None:
        """Store processing error."""
        if upload_id in self._upload_metadata:
            self._upload_metadata[upload_id]["status"] = "ERROR"
            self._upload_metadata[upload_id]["error"] = error_msg

    def get_latest_dataframe(self) -> pd.DataFrame | None:
        """Retrieve the most recently loaded dataframe."""
        return self._latest_dataframe

    def get_latest_file_path(self) -> str | None:
        """Retrieve the latest raw file path for processing."""
        return self._latest_file_path

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

    def cache_data(self, key: str, data: dict[str, Any], ttl: int = 3600) -> None:
        """
        Cache data with TTL (time-to-live).
        
        Args:
            key: Cache key
            data: Data to cache
            ttl: Time to live in seconds (default 1 hour)
        """
        ttl_end_time = time.time() + ttl
        self._data_cache[key] = (data, ttl_end_time)

    def get_cached_data(self, key: str) -> dict[str, Any] | None:
        """
        Get cached data if not expired.
        
        Returns None if key doesn't exist or is expired.
        """
        if key not in self._data_cache:
            return None

        data, ttl_end_time = self._data_cache[key]

        # Check if expired
        if time.time() > ttl_end_time:
            del self._data_cache[key]
            return None

        return data

    def clear_cache(self) -> None:
        """Clear all caches."""
        self._data_cache.clear()

    def cleanup(self, upload_id: str, delete_disk: bool = False) -> None:
        """Clean up upload."""
        if delete_disk and upload_id in self._upload_metadata:
            file_path = self._upload_metadata[upload_id].get("file_path")
            if file_path and os.path.exists(file_path):
                os.remove(file_path)

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
