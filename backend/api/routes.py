"""API routes for the inventory system."""

from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from schemas.models import DashboardDataResponse, MetadataResponse, UploadResponse
from services.processor import (
    clean_dataframe,
    get_dashboard_data,
    get_metadata,
    parse_csv_robust,
)

router = APIRouter()

# Global state (in production, use a database or Redis)
_CURRENT_DATAFRAME: Any = None


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)) -> UploadResponse:
    """
    Upload and process a CSV file.

    Validates columns and cleans the data.
    """
    global _CURRENT_DATAFRAME

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    try:
        file_content = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to read file.") from exc

    try:
        frame = parse_csv_robust(file_content)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to parse CSV: {str(exc)[:100]}",
        ) from exc

    try:
        frame = clean_dataframe(frame)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    _CURRENT_DATAFRAME = frame

    return UploadResponse(
        rows=int(frame.shape[0]),
        columns=frame.columns.tolist(),
    )


@router.get("/metadata", response_model=MetadataResponse)
async def metadata() -> MetadataResponse:
    """
    Get available projects and resources.

    Requires prior file upload.
    """
    if _CURRENT_DATAFRAME is None:
        raise HTTPException(
            status_code=404,
            detail="No data loaded. Please upload a CSV file first.",
        )

    meta = get_metadata(_CURRENT_DATAFRAME)
    return MetadataResponse(**meta)


@router.get("/data", response_model=DashboardDataResponse)
async def dashboard_data(
    variance: float = 100,
    resource: str | None = None,
) -> DashboardDataResponse:
    """
    Get aggregated dashboard data for a resource.

    Query Parameters:
    - resource: Resource_on_Product value (optional for aggregated view)
    - variance: % variance for stock simulation (default 100)
    """
    if _CURRENT_DATAFRAME is None:
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
        data = get_dashboard_data(
            _CURRENT_DATAFRAME,
            variance=variance,
            resource=resource,
        )
        return DashboardDataResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
