"""API routes for the inventory system."""

import asyncio
import logging
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from schemas.models import (
    BacklogRiskResponse,
    DashboardDataResponse,
    MetadataResponse,
    UploadResponse,
)
from services.processor import (
    calculate_backlog_risk,
    clean_dataframe,
    get_dashboard_data,
    get_metadata,
    parse_csv_lightweight_file,
    parse_csv_robust_path,
)
from services.storage import FileStorage

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize file storage (in-memory cache)
file_storage = FileStorage()

# Thread pool executor for CPU-intensive work (3 workers for Railway)
executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="cpu_worker_")


def _process_csv_sync(file_path: str) -> dict[str, Any]:
    """Synchronous CSV processing (runs in thread pool)."""
    try:
        frame = parse_csv_robust_path(file_path)
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
    import time

    logger.info(f"📥 Upload started: {file.filename} (size: {file.size} bytes if known)")
    start_time = time.time()

    # 1. Validate file format
    if not file.filename or not file.filename.lower().endswith(".csv"):
        logger.warning(f"❌ Invalid file extension: {file.filename}")
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    # 2. Stream file to disk in chunks (avoid large in-memory reads)
    try:
        logger.info(f"📖 Streaming file to disk: {file.filename}")
        read_start = time.time()

        max_upload_mb = 60
        max_upload_bytes = max_upload_mb * 1024 * 1024
        chunk_size = 1024 * 1024  # 1 MB
        total_bytes = 0

        with tempfile.NamedTemporaryFile(
            mode="wb",
            delete=False,
            dir=str(file_storage.cache_dir),
            prefix="upload_",
            suffix=".csv",
        ) as temp_file:
            temp_path = temp_file.name
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_upload_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max allowed is {max_upload_mb} MB.",
                    )
                temp_file.write(chunk)

        read_time = time.time() - read_start
        size_mb = total_bytes / 1024 / 1024
        logger.info(
            f"✅ File streamed to disk in {read_time:.2f}s ({size_mb:.1f} MB, {total_bytes} bytes)"
        )
        if size_mb > 50:
            logger.warning(f"⚠️  Large file: {size_mb:.1f} MB - parsing may take time")
    except HTTPException:
        if "temp_path" in locals():
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass
        raise
    except Exception as exc:
        if "temp_path" in locals():
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass
        logger.error(f"❌ Failed to stream file: {exc}")
        raise HTTPException(status_code=400, detail="Unable to read file.") from exc

    # 3. Quick parse to extract basic info (streaming, no pandas)
    try:
        logger.info(f"🔍 Parsing CSV header and estimating row count...")
        parse_start = time.time()
        loop = asyncio.get_event_loop()
        rows, columns = await loop.run_in_executor(
            executor,
            parse_csv_lightweight_file,
            temp_path,
        )
        parse_time = time.time() - parse_start
        logger.info(f"✅ Parse completed in {parse_time:.2f}s: {rows} rows, {len(columns)} columns")
    except Exception as exc:
        try:
            Path(temp_path).unlink(missing_ok=True)
        except Exception:
            pass
        logger.error(f"❌ Parse failed: {exc}")
        raise HTTPException(
            status_code=400,
            detail=f"Unable to parse CSV: {str(exc)[:100]}",
        ) from exc

    # 4. Store raw file metadata for lazy processing (no in-memory bytes)
    try:
        logger.info(f"💾 Storing raw file...")
        upload_id = file_storage.store_raw_file(
            temp_path,
            file.filename,
            size_bytes=total_bytes,
        )
        logger.info(f"✅ File stored with upload_id: {upload_id}")
    except Exception as exc:
        try:
            Path(temp_path).unlink(missing_ok=True)
        except Exception:
            pass
        logger.error(f"❌ Failed to store file: {exc}")
        raise HTTPException(status_code=500, detail="Failed to store file.") from exc

    # 5. Return FAST response (no processing wait)
    total_time = time.time() - start_time
    logger.info(f"✅ Upload endpoint completed in {total_time:.2f}s")

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
    file_path = file_storage.get_latest_file_path()
    if file_path is None:
        raise HTTPException(
            status_code=404,
            detail="No data loaded. Please upload a CSV file first.",
        )

    # Process on-demand in thread pool (non-blocking)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, _process_csv_sync, file_path)

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
    
    # Validate required columns are present
    from services.processor import REQUIRED_COLUMNS
    missing = REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        logger.warning(f"⚠️ Missing required columns: {missing}")
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(sorted(missing))}"
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


@router.get("/backlog-risk", response_model=BacklogRiskResponse)
async def backlog_risk() -> BacklogRiskResponse:
    """
    Get aggregated backlog risk data for insufficient stock monitoring dashboard.
    
    Calculates backlog risk from projected stock vs thresholds and returns
    aggregated data by week, country, plant, customer, S&OP1, and resource.
    """
    frame = await _get_or_process_dataframe()
    
    try:
        # Check cache first
        cache_key = "backlog_risk"
        cached = file_storage.get_cached_data(cache_key)
        if cached is not None:
            return BacklogRiskResponse(**cached)
        
        # Run computation in thread pool (non-blocking)
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(executor, calculate_backlog_risk, frame)
        
        # Cache result for 3600 seconds (1 hour)
        file_storage.cache_data(cache_key, data, ttl=3600)
        
        return BacklogRiskResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/csv-diagnostics")
async def csv_diagnostics() -> dict[str, Any]:
    """
    Diagnostic endpoint to verify CSV data quality and structure.
    
    Returns information about the loaded CSV file including:
    - Column names and count
    - Required vs optional columns
    - Data type info
    - Record counts by aggregation
    - Date range
    
    Use this to debug if data is not appearing in dashboard sections.
    """
    frame = await _get_or_process_dataframe()
    
    if frame.empty:
        raise HTTPException(status_code=404, detail="No data loaded. Please upload a CSV first.")
    
    from services.processor import REQUIRED_COLUMNS
    
    # Check which columns are present
    columns_present = set(frame.columns)
    required_missing = REQUIRED_COLUMNS - columns_present
    optional_important = {"Customer", "Customer_Account", "SOP1_Project"} - columns_present
    
    # Get unique counts
    unique_resources = frame["Resource_on_Product"].nunique() if "Resource_on_Product" in frame.columns else 0
    unique_sop1s = frame["SOP1_Project"].nunique() if "SOP1_Project" in frame.columns else 0
    unique_dates = frame["DATE"].nunique() if "DATE" in frame.columns else 0
    
    # Get date range
    try:
        frame["DATE"] = pd.to_datetime(frame["DATE"], errors="coerce")
        date_min = frame["DATE"].min()
        date_max = frame["DATE"].max()
        date_range = {
            "min": str(date_min) if pd.notna(date_min) else None,
            "max": str(date_max) if pd.notna(date_max) else None,
        }
    except Exception:
        date_range = {"min": None, "max": None}
    
    # Check for null percentages
    null_percentages = {}
    for col in REQUIRED_COLUMNS & columns_present:
        null_count = frame[col].isna().sum()
        null_percentage = (null_count / len(frame)) * 100 if len(frame) > 0 else 0
        null_percentages[col] = {
            "null_count": int(null_count),
            "null_percentage": round(null_percentage, 2),
        }
    
    diagnostics = {
        "status": "✅ Data loaded successfully" if not required_missing else "❌ Missing required columns",
        "total_rows": int(len(frame)),
        "total_columns": int(len(frame.columns)),
        "columns": sorted(list(columns_present)),
        "required_columns": {
            "present": sorted(list(REQUIRED_COLUMNS & columns_present)),
            "missing": sorted(list(required_missing)),
        },
        "optional_important_columns": {
            "present": sorted(list({"Customer", "Customer_Account", "SOP1_Project"} & columns_present)),
            "missing": sorted(list(optional_important)),
        },
        "data_quality": {
            "unique_resources": int(unique_resources),
            "unique_sop1s": int(unique_sop1s),
            "unique_dates": int(unique_dates),
            "null_percentages": null_percentages,
        },
        "date_range": date_range,
        "sample_rows": frame.head(3).to_dict("records") if len(frame) > 0 else [],
    }
    
    # Log any issues
    if required_missing:
        logger.error(f"❌ CSV missing required columns: {required_missing}")
    if optional_important:
        logger.warning(f"⚠️ CSV missing optional but important columns: {optional_important}")
    
    return diagnostics
