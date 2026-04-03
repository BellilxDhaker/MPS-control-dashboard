"""API routes for the inventory system."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from schemas.models import DashboardDataResponse, MetadataResponse, UploadResponse
from services.processor import (
    clean_dataframe,
    get_dashboard_data,
    get_metadata,
    parse_csv_lightweight,
    parse_csv_robust,
)
from services.storage import FileStorage

router = APIRouter()

# Initialize file storage (in-memory cache)
file_storage = FileStorage()

# Thread pool executor for CPU-intensive work (3 workers for Railway)
executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="cpu_worker_")


def _process_csv_sync(file_content: bytes) -> dict[str, Any]:
    """Synchronous CSV processing (runs in thread pool)."""
    try:
        frame = parse_csv_robust(file_content)
        frame = clean_dataframe(frame)
        return {"success": True, "frame": frame, "error": None}
    except Exception as e:
        return {"success": False, "frame": None, "error": str(e)}


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
) -> UploadResponse:
    """
    FAST: Upload CSV file and return immediately.
    
    Processing happens on-demand when data/metadata endpoints are called.
    This ensures Railway doesn't timeout waiting for background tasks.
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

    # 4. Store raw file for lazy processing
    upload_id = file_storage.store_raw_file(file_content, file.filename)

    # 5. Return FAST response (no processing wait)
    return UploadResponse(
        rows=rows,
        columns=columns,
        upload_id=upload_id,
    )


async def _get_or_process_dataframe() -> Any:
    """
    Get processed dataframe, processing on-demand if needed.
    
    This ensures data is always ready when accessed, avoiding
    the unreliability of background tasks on Railway.
    """
    # Check if already processed
    frame = file_storage.get_latest_dataframe()
    if frame is not None:
        return frame

    # Get raw file if not processed yet
    raw_file = file_storage.get_latest_raw_file()
    if raw_file is None:
        raise HTTPException(
            status_code=404,
            detail="No data loaded. Please upload a CSV file first.",
        )

    # Process on-demand in thread pool (non-blocking)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, _process_csv_sync, raw_file)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=f"Processing failed: {result['error']}")

    # Cache the result for future calls
    file_storage.set_latest_dataframe(result["frame"])

    return result["frame"]


@router.get("/metadata", response_model=MetadataResponse)
async def metadata() -> MetadataResponse:
    """
    Get available projects and resources.
    
    Processes data on-demand if not already processed.
    """
    frame = await _get_or_process_dataframe()
    meta = get_metadata(frame)
    return MetadataResponse(**meta)


@router.get("/data", response_model=DashboardDataResponse)
async def dashboard_data(
    variance: float = 100,
    resource: str | None = None,
) -> DashboardDataResponse:
    """
    Get computed dashboard data for a resource.
    
    Heavy processing happens here in thread pool (non-blocking).
    Results are cached for repeated queries.

    Query Parameters:
    - resource: Resource_on_Product value (optional for aggregated view)
    - variance: % variance for stock simulation (default 100)
    """
    frame = await _get_or_process_dataframe()

    if variance < 0 or variance > 100:
        raise HTTPException(
            status_code=422,
            detail="Variance must be between 0 and 100.",
        )

    try:
        # Check cache first (avoid recomputing same query)
        cache_key = f"data_{resource}_{variance}"
        cached = file_storage.get_cached_data(cache_key)
        if cached is not None:
            return DashboardDataResponse(**cached)

        # Run computation in thread pool (non-blocking)
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(
            executor,
            get_dashboard_data,
            frame,
            variance,
            resource,
        )

        # Cache result for 3600 seconds (1 hour)
        file_storage.cache_data(cache_key, data, ttl=3600)

        return DashboardDataResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
