"""API routes for the inventory system."""

import asyncio
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from schemas.models import DashboardDataResponse, MetadataResponse, UploadResponse
from services.processor import (
    clean_dataframe,
    get_dashboard_data,
    get_metadata,
    parse_csv_lightweight,
)
from services.storage import FileStorage

router = APIRouter()

# Initialize file storage (in-memory cache)
file_storage = FileStorage()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> UploadResponse:
    """
    FAST: Upload CSV file with minimal processing.
    
    Returns immediately with:
    - Row count
    - Column names
    - Upload ID for tracking
    
    Heavy processing happens asynchronously.
    """
    # 1. Validate file format
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    # 2. Read file bytes (async, non-blocking)
    try:
        file_content = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to read file.") from exc

    # 3. Quick parse to extract basic info (minimal parsing only)
    try:
        rows, columns = parse_csv_lightweight(file_content)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to parse CSV: {str(exc)[:100]}",
        ) from exc

    # 4. Store raw file for later processing
    upload_id = file_storage.store_raw_file(file_content, file.filename)

    # 5. Queue heavy processing in background (non-blocking)
    background_tasks.add_task(
        _process_file_background,
        upload_id,
        file_content,
    )

    # 6. Return FAST response
    return UploadResponse(
        rows=rows,
        columns=columns,
        upload_id=upload_id,
    )


async def _process_file_background(upload_id: str, file_content: bytes) -> None:
    """Process file asynchronously in background (non-blocking HTTP response)."""
    try:
        # Run CPU-intensive work in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        frame = await loop.run_in_executor(
            None,
            _process_file_sync,
            file_content,
        )
        file_storage.store_processed_dataframe(upload_id, frame)
    except Exception as exc:
        file_storage.store_error(upload_id, str(exc))


def _process_file_sync(file_content: bytes) -> Any:
    """Synchronous heavy processing (runs in thread pool)."""
    from services.processor import parse_csv_robust, clean_dataframe

    frame = parse_csv_robust(file_content)
    frame = clean_dataframe(frame)
    return frame


@router.get("/metadata", response_model=MetadataResponse)
async def metadata() -> MetadataResponse:
    """
    Get available projects and resources.
    
    Uses the most recently uploaded dataset.
    """
    frame = file_storage.get_latest_dataframe()
    if frame is None:
        raise HTTPException(
            status_code=404,
            detail="No data loaded. Please upload a CSV file first.",
        )

    meta = get_metadata(frame)
    return MetadataResponse(**meta)


@router.get("/data", response_model=DashboardDataResponse)
async def dashboard_data(
    variance: float = 100,
    resource: str | None = None,
) -> DashboardDataResponse:
    """
    Get computed dashboard data for a resource.
    
    HEAVY PROCESSING happens here (aggregation, computations).
    This endpoint is responsible for all data transformations.

    Query Parameters:
    - resource: Resource_on_Product value (optional for aggregated view)
    - variance: % variance for stock simulation (default 100)
    """
    frame = file_storage.get_latest_dataframe()
    if frame is None:
        raise HTTPException(
            status_code=404,
            detail="No data loaded. Please upload a CSV file first.",
        )

    if variance < 0 or variance > 100:
        raise HTTPException(
            status_code=422,
            detail="Variance must be between 0 and 100.",
        )

    try:
        # Run heavy computation in thread pool
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(
            None,
            get_dashboard_data,
            frame,
            variance,
            resource,
        )
        return DashboardDataResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
