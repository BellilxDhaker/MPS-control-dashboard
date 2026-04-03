"""Pydantic data models for validation and responses."""

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    """Response after successful file upload."""

    rows: int = Field(..., description="Number of rows processed")
    columns: list[str] = Field(..., description="Column names in dataset")
    upload_id: str = Field(..., description="Unique upload ID for tracking")


class DataPoint(BaseModel):
    """Single inventory data point."""

    technical_week: str
    projected_stock: float
    lower_bound: float
    critical_threshold: float
    is_current: bool


class DashboardDataResponse(BaseModel):
    """Complete dashboard data for a resource."""

    resource: str | None
    variance: float
    data: list[DataPoint]


class MetadataResponse(BaseModel):
    """Metadata about available resources."""

    resources: list[str]
