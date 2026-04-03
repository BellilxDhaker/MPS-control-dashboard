"""Data processing service for inventory analysis."""

from __future__ import annotations

import io
import string
from datetime import date
from typing import Any

import pandas as pd

REQUIRED_COLUMNS = {
    "SOP1_Project",
    "Resource_on_Product",
    "DATE",
    "Projected_Stock_Pipeline_Days",
    "Lower_Bound_Inventory_Target_Pipeline_Days",
    "Threshold_Insufficient_Stock",
}


def number_to_letters(n: int) -> str:
    """Convert 0 -> a, 1 -> b, ..., 25 -> z, 26 -> aa, etc."""
    result = ""
    while True:
        n, remainder = divmod(n, 26)
        result = string.ascii_lowercase[remainder] + result
        if n == 0:
            break
        n -= 1
    return result


def parse_csv_lightweight(file_content: bytes) -> tuple[int, list[str]]:
    """
    LIGHTWEIGHT CSV parser for quick validation in /upload endpoint.
    
    Only extracts:
    - Column names
    - Estimated row count (fast, without loading all data)
    
    No heavy processing, minimal memory usage.
    Returns immediately without data transformation.
    """
    # Try common formats quickly
    priority_formats = [
        (";", "latin-1"),
        (";", "iso-8859-1"),
        (",", "utf-8"),
        (",", "latin-1"),
        ("\t", "utf-8"),
        ("|", "utf-8"),
    ]

    for delimiter, encoding in priority_formats:
        try:
            # Read only header, don't load data rows
            df = pd.read_csv(
                io.BytesIO(file_content),
                sep=delimiter,
                encoding=encoding,
                nrows=0,  # Don't load data, just header
            )
            columns = df.columns.tolist()
            
            # Fast row count: count newlines instead of loading all data
            # This is much faster for large files
            try:
                row_count = file_content.decode(encoding).count('\n') - 1  # Subtract header line
                row_count = max(0, row_count)  # Ensure non-negative
            except Exception:
                # Fallback if decode fails
                row_count = 0
            
            return row_count, columns
        except Exception:
            continue

    # Fallback: slower but thorough
    all_delimiters = [";", ",", "\t", "|"]
    all_encodings = ["latin-1", "utf-8", "iso-8859-1", "cp1252"]

    for encoding in all_encodings:
        for delimiter in all_delimiters:
            try:
                df = pd.read_csv(
                    io.BytesIO(file_content),
                    sep=delimiter,
                    encoding=encoding,
                    nrows=0,  # Header only
                )
                columns = df.columns.tolist()
                # Fast count: use newlines
                try:
                    row_count = file_content.decode(encoding).count('\n') - 1
                    row_count = max(0, row_count)
                except Exception:
                    row_count = 0
                return row_count, columns
            except Exception:
                continue

    raise ValueError("Unable to parse CSV with any encoding/delimiter combination.")


def clean_inventory_data(file_bytes: bytes, delimiter: str = ";", encoding: str = "latin1") -> pd.DataFrame:
    """
    Clean inventory data during upload:
    1. Parse CSV and handle null values
    2. Parse dates and extract ISO weeks
    3. Convert numeric columns to float
    
    NOTE: Suffix calculation (a/b/c) is deferred to get_dashboard_data() 
    to avoid creating 1500+ weeks when displaying all resources.
    """
    # 1. Load Data
    df = pd.read_csv(io.BytesIO(file_bytes), sep=delimiter, encoding=encoding, dtype=str)

    # 2. Basic Cleaning
    df = df.replace("<Null>", "0")
    
    # 3. Date & ISO Week Extraction
    df["DATE"] = pd.to_datetime(
        df["DATE"],
        format="%Y.%m.%d %H:%M:%S",
        errors="coerce"
    )
    
    iso = df["DATE"].dt.isocalendar()
    df["ISO_Year"] = iso["year"]
    # Subtract 1 from ISO week to match expected numbering (0-51 instead of 1-52)
    df["ISO_Week"] = iso["week"] - 1

    # 4. Convert Columns to Numeric (Necessary for Recharts)
    numeric_cols = [
        "Projected_Stock_Pipeline_Days", 
        "Lower_Bound_Inventory_Target_Pipeline_Days", 
        "Threshold_Insufficient_Stock"
    ]
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # 4b. Apply Industry Standard: Threshold_Insufficient_Stock defaults to 3.0
    # If zero or NaN, use 3.0 (industry standard for critical floor in automotive/manufacturing)
    if "Threshold_Insufficient_Stock" in df.columns:
        df["Threshold_Insufficient_Stock"] = df["Threshold_Insufficient_Stock"].replace(0, 3.0)
        df["Threshold_Insufficient_Stock"] = df["Threshold_Insufficient_Stock"].fillna(3.0)

    # 5. Build TechnicalWeek without suffixes (will be added per-resource later)
    df["TechnicalWeek"] = df.apply(
        lambda row: f"TW{int(row['ISO_Week'])} {row['ISO_Year']}", 
        axis=1
    )

    # 6. Cleanup
    df = df.drop(columns=["ISO_Year", "ISO_Week"], errors="ignore")

    return df


def parse_csv_robust(file_content: bytes) -> pd.DataFrame:
    """Parse CSV with optimized handling for semicolon delimiter and latin1 encoding.
    
    Priority: semicolon + latin1 (most common for European CSVs)
    Fallback: other delimiters and encodings
    """
    # Try priority format first (most common for European data)
    priority_formats = [
        (";", "latin-1"),
        (";", "iso-8859-1"),
        (",", "utf-8"),
        (",", "latin-1"),
        ("\t", "utf-8"),
        ("|", "utf-8"),
    ]

    for delimiter, encoding in priority_formats:
        try:
            return clean_inventory_data(file_content, delimiter=delimiter, encoding=encoding)
        except Exception:
            continue

    # Fallback: try all combinations
    all_delimiters = [";", ",", "\t", "|"]
    all_encodings = ["latin-1", "utf-8", "iso-8859-1", "cp1252"]

    for encoding in all_encodings:
        for delimiter in all_delimiters:
            try:
                return clean_inventory_data(file_content, delimiter=delimiter, encoding=encoding)
            except Exception:
                continue

    raise ValueError(
        "Unable to parse CSV with any encoding/delimiter combination."
    )


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Standardize column names."""
    frame = frame.copy()
    frame.columns = [str(col).strip() for col in frame.columns]
    return frame


def validate_columns(frame: pd.DataFrame) -> list[str]:
    """Check for required columns, return missing ones."""
    missing = REQUIRED_COLUMNS - set(frame.columns)
    return sorted(missing)


def parse_week_label(value: Any) -> tuple[int | None, int | None]:
    """Extract year and week from various TechnicalWeek formats."""
    if value is None:
        return None, None
    text = str(value).strip()
    if not text:
        return None, None

    # Supports: TW14 2026, 2026-W14, 2026 TW14, TW14-2026
    week = None
    year = None
    digits = [
        int(chunk)
        for chunk in "".join(ch if ch.isdigit() else " " for ch in text).split()
    ]

    for number in digits:
        if number >= 1000:
            year = number
        elif 1 <= number <= 53 and week is None:
            week = number

    return year, week


def is_current_week(value: Any) -> bool:
    """Check if a TechnicalWeek label matches the current ISO week."""
    year, week = parse_week_label(value)
    if year is None or week is None:
        return False
    today = date.today().isocalendar()
    return today.year == year and today.week == week


def clean_dataframe(frame: pd.DataFrame) -> pd.DataFrame:
    """Clean and validate the dataframe.
    
    Note: CSV parsing and TechnicalWeek assignment already done by parse_csv_robust.
    This function handles:
    1. Column normalization
    2. Required column validation
    3. Numeric conversion
    4. Data cleanup
    """
    frame = normalize_columns(frame)

    missing = validate_columns(frame)
    if missing:
        raise ValueError(
            f"Missing required columns: {', '.join(missing)}. "
            f"Found: {', '.join(sorted(frame.columns))}"
        )

    numeric_columns = [
        "Projected_Stock_Pipeline_Days",
        "Lower_Bound_Inventory_Target_Pipeline_Days",
        "Threshold_Insufficient_Stock",
    ]

    for column in numeric_columns:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame = frame.dropna(
        subset=[
            "SOP1_Project",
            "Resource_on_Product",
            "TechnicalWeek",
        ]
    )

    if frame.empty:
        raise ValueError(
            "After cleaning, no valid rows remain. Check your data format."
        )

    return frame


def get_metadata(frame: pd.DataFrame) -> dict[str, Any]:
    """Extract unique resources."""
    resources = sorted(frame["Resource_on_Product"].dropna().unique().tolist())

    return {
        "resources": resources,
    }


def get_dashboard_data(
    frame: pd.DataFrame,
    variance: float = 100,
    resource: str | None = None,
) -> dict[str, Any]:
    """Aggregate and return dashboard data.
    
    Two modes:
    1. With resource filter: Show ALL individual rows (no aggregation) with a/b/c suffixes
    2. Without filter (all products): Sum all products' values per fixed week (aggregated)
    
    This ensures every row is displayed as a bar for specific resources (all 37 bars).
    """
    filtered_frame = frame.copy()

    if filtered_frame.empty:
        raise ValueError("No data loaded.")

    # SORT by date first
    filtered_frame["DATE"] = pd.to_datetime(filtered_frame["DATE"], errors="coerce")
    filtered_frame = filtered_frame.sort_values("DATE").reset_index(drop=True)

    # EXTRACT ISO WEEK for ALL data
    iso = filtered_frame["DATE"].dt.isocalendar()
    filtered_frame["ISO_Year"] = iso["year"]
    # Subtract 1 from ISO week to match expected numbering (0-51 instead of 1-52)
    filtered_frame["ISO_Week"] = iso["week"] - 1

    # MODE 1: SPECIFIC RESOURCE (with a/b/c suffixes)
    if resource:
        resource_data = filtered_frame[
            filtered_frame["Resource_on_Product"] == resource
        ].copy()

        if resource_data.empty:
            raise ValueError("No data found for the selected project/resource.")

        # Apply suffixes to this resource's weeks
        def assign_week_suffix(group):
            """Assign TechnicalWeek with a/b/c suffixes for multiple records per week."""
            week = int(group["ISO_Week"].iloc[0])
            year = int(group["ISO_Year"].iloc[0])

            if len(group) == 1:
                group = group.copy()
                group["TechnicalWeek"] = f"TW{week} {year}"
            else:
                group = group.copy()
                group["rank"] = range(len(group))
                group["suffix"] = group["rank"].apply(lambda n: chr(97 + n))
                group["TechnicalWeek"] = group.apply(
                    lambda r: f"TW{int(r['ISO_Week'])}{r['suffix']} {int(r['ISO_Year'])}",
                    axis=1
                )
            return group

        resource_data = resource_data.groupby(
            ["ISO_Year", "ISO_Week"], group_keys=False
        ).apply(assign_week_suffix)

        # NO AGGREGATION - Use raw data directly (preserves all 37 rows)
        grouped = resource_data.copy()
        grouped = grouped.rename(
            columns={
                "Projected_Stock_Pipeline_Days": "projected_stock",
                "Lower_Bound_Inventory_Target_Pipeline_Days": "lower_bound",
                "Threshold_Insufficient_Stock": "critical_threshold",
            }
        )

    # MODE 2: ALL PRODUCTS (fixed weeks, sum across products)
    else:
        # Create fixed week labels WITHOUT suffixes
        filtered_frame["TechnicalWeek"] = filtered_frame.apply(
            lambda r: f"TW{int(r['ISO_Week'])} {int(r['ISO_Year'])}", axis=1
        )

        # Sum (or mean) across all products per week
        grouped = (
            filtered_frame.groupby("TechnicalWeek", as_index=False)
            .agg(
                {
                    "Projected_Stock_Pipeline_Days": "sum",
                    "Lower_Bound_Inventory_Target_Pipeline_Days": "mean",
                    "Threshold_Insufficient_Stock": "mean",
                }
            )
            .rename(
                columns={
                    "Projected_Stock_Pipeline_Days": "projected_stock",
                    "Lower_Bound_Inventory_Target_Pipeline_Days": "lower_bound",
                    "Threshold_Insufficient_Stock": "critical_threshold",
                }
            )
        )

    # SORT: Order by TechnicalWeek (handles both aggregated and raw data)
    if "TechnicalWeek" in grouped.columns:
        grouped["_sort_key"] = grouped["TechnicalWeek"].apply(parse_week_label)
        grouped = grouped.sort_values(by="_sort_key").drop(columns=["_sort_key"])

    # APPLY VARIANCE: Multiply both projected stock and critical threshold
    variance_factor = variance / 100.0
    grouped["projected_stock"] = grouped["projected_stock"] * variance_factor
    
    # Ensure critical_threshold is never zero (minimum 3.0 industry standard)
    grouped["critical_threshold"] = grouped["critical_threshold"].replace(0, 3.0).fillna(3.0)
    # Ensure it's not below 3.0 if it's a small value
    grouped.loc[grouped["critical_threshold"] < 3.0, "critical_threshold"] = 3.0
    
    # Apply variance multiplier to critical_threshold (so orange line moves with slider)
    grouped["critical_threshold"] = grouped["critical_threshold"] * variance_factor

    # ROUND & FILL: Format numbers and ensure continuity
    grouped["projected_stock"] = grouped["projected_stock"].round(1)
    grouped["lower_bound"] = grouped["lower_bound"].ffill().bfill()
    grouped["critical_threshold"] = grouped["critical_threshold"].round(1)

    # CONVERT: Type conversion for JSON
    grouped["technical_week"] = grouped["TechnicalWeek"].astype(str)
    grouped["projected_stock"] = grouped["projected_stock"].astype(float)
    grouped["lower_bound"] = grouped["lower_bound"].astype(float)
    grouped["critical_threshold"] = grouped["critical_threshold"].astype(float)
    grouped["is_current"] = grouped["TechnicalWeek"].apply(is_current_week)

    # BUILD RESPONSE
    data = grouped[
        [
            "technical_week",
            "projected_stock",
            "lower_bound",
            "critical_threshold",
            "is_current",
        ]
    ].to_dict("records")

    return {
        "resource": resource,
        "variance": variance,
        "data": data,
    }
