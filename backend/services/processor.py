"""Data processing service for inventory analysis."""

from __future__ import annotations

import csv
import io
from pathlib import Path
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


def parse_csv_lightweight_file(file_path: str | Path) -> tuple[int, list[str]]:
    """
    LIGHTWEIGHT CSV parser for quick validation in /upload endpoint.

    Only extracts:
    - Column names
    - Row count (streaming, no full-file buffering)

    No heavy processing, minimal memory usage.
    """
    path = Path(file_path)
    if not path.exists():
        raise ValueError("Uploaded file not found on disk.")

    candidate_encodings = ["utf-8", "latin-1", "iso-8859-1", "cp1252"]
    candidate_delimiters = [",", ";", "\t", "|"]
    sniffer = csv.Sniffer()

    for encoding in candidate_encodings:
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                sample = handle.read(64 * 1024)
                if not sample:
                    raise ValueError("Uploaded file is empty.")
                try:
                    dialect = sniffer.sniff(sample, delimiters=candidate_delimiters)
                    delimiter = dialect.delimiter
                except Exception:
                    delimiter = ","

                handle.seek(0)
                reader = csv.reader(handle, delimiter=delimiter)
                header = next(reader, [])
                if not header:
                    raise ValueError("CSV header row not found.")
                columns = [str(col).strip() for col in header]
                row_count = sum(1 for _ in reader)
                return row_count, columns
        except Exception:
            continue

    raise ValueError("Unable to parse CSV with any encoding/delimiter combination.")


def clean_inventory_data(
    file_bytes: bytes | str | Path,
    delimiter: str = ";",
    encoding: str = "latin1",
) -> pd.DataFrame:
    """
    Clean inventory data during upload:
    1. Parse CSV and handle null values
    2. Parse dates and extract ISO weeks
    3. Convert numeric columns to float
    
    NOTE: Suffix calculation (a/b/c) is deferred to get_dashboard_data() 
    to avoid creating 1500+ weeks when displaying all resources.
    """
    # 1. Load Data
    if isinstance(file_bytes, (str, Path)):
        df = pd.read_csv(file_bytes, sep=delimiter, encoding=encoding, dtype=str)
    else:
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


def parse_csv_robust_path(file_path: str | Path) -> pd.DataFrame:
    """Parse CSV from disk with optimized handling for delimiter and encoding."""
    path = Path(file_path)
    if not path.exists():
        raise ValueError("Uploaded file not found on disk.")

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
            return clean_inventory_data(path, delimiter=delimiter, encoding=encoding)
        except Exception:
            continue

    all_delimiters = [";", ",", "\t", "|"]
    all_encodings = ["latin-1", "utf-8", "iso-8859-1", "cp1252"]

    for encoding in all_encodings:
        for delimiter in all_delimiters:
            try:
                return clean_inventory_data(path, delimiter=delimiter, encoding=encoding)
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


def calculate_backlog_risk(frame: pd.DataFrame) -> dict[str, Any]:
    """
    Calculate aggregated backlog risk data from projected stock levels.
    
    Risk classification:
    - Red (Critical): Projected_Stock < Threshold_Insufficient_Stock
    - Orange (Medium): Threshold <= Projected_Stock < Lower_Bound
    - Yellow (Low): Lower_Bound <= Projected_Stock (buffer)
    - White (Neutral): No data or null values
    """
    if frame.empty:
        raise ValueError("No data loaded.")
    
    filtered_frame = frame.copy()
    
    # Date parsing
    filtered_frame["DATE"] = pd.to_datetime(filtered_frame["DATE"], errors="coerce")
    filtered_frame = filtered_frame.sort_values("DATE").reset_index(drop=True)
    
    # Extract ISO week
    iso = filtered_frame["DATE"].dt.isocalendar()
    filtered_frame["ISO_Week"] = iso["week"]
    filtered_frame["ISO_Year"] = iso["year"]
    filtered_frame["TechnicalWeek"] = filtered_frame.apply(
        lambda r: f"TW{int(r['ISO_Week'])} {int(r['ISO_Year'])}", axis=1
    )
    
    # Fill missing values
    filtered_frame["Projected_Stock_Pipeline_Days"] = filtered_frame["Projected_Stock_Pipeline_Days"].fillna(0)
    filtered_frame["Threshold_Insufficient_Stock"] = filtered_frame["Threshold_Insufficient_Stock"].fillna(0)
    filtered_frame["Lower_Bound_Inventory_Target_Pipeline_Days"] = filtered_frame["Lower_Bound_Inventory_Target_Pipeline_Days"].fillna(0)
    
    def classify_risk(row):
        """Classify risk level based on stock vs thresholds."""
        stock = row["Projected_Stock_Pipeline_Days"]
        threshold = row["Threshold_Insufficient_Stock"]
        lower_bound = row["Lower_Bound_Inventory_Target_Pipeline_Days"]
        
        if pd.isna(stock) or stock is None:
            return "white"
        if stock < threshold:
            return "red"
        if stock < lower_bound:
            return "orange"
        return "yellow"
    
    filtered_frame["risk_level"] = filtered_frame.apply(classify_risk, axis=1)
    
    # Extract country code from Resource_on_Product (chars at positions 1-2 after underscore)
    def extract_country(resource):
        parts = resource.split("_")
        if len(parts) >= 2:
            code = parts[1][:2].upper()
            country_map = {
                # Europe
                "AT": "Austria", "BE": "Belgium", "BG": "Bulgaria", "HR": "Croatia",
                "CY": "Cyprus", "CZ": "Czech Republic", "DK": "Denmark", "EE": "Estonia",
                "FI": "Finland", "FR": "France", "DE": "Germany", "GR": "Greece",
                "HU": "Hungary", "IE": "Ireland", "IT": "Italy", "LV": "Latvia",
                "LT": "Lithuania", "LU": "Luxembourg", "MT": "Malta", "NL": "Netherlands",
                "PL": "Poland", "PT": "Portugal", "RO": "Romania", "SK": "Slovakia",
                "SI": "Slovenia", "ES": "Spain", "SE": "Sweden", "GB": "United Kingdom",
                "CH": "Switzerland", "NO": "Norway", "RS": "Serbia", "UA": "Ukraine",
                "RU": "Russia",
                # North Africa & Middle East
                "TN": "Tunisia", "MA": "Morocco", "EG": "Egypt", "DZ": "Algeria",
                # Americas
                "MX": "Mexico", "US": "United States", "CA": "Canada", "BR": "Brazil",
                "AR": "Argentina", "CL": "Chile", "CO": "Colombia", "PE": "Peru",
                "PY": "Paraguay", "VE": "Venezuela",
                # Asia
                "CN": "China", "JP": "Japan", "KR": "South Korea", "IN": "India",
                "TH": "Thailand", "VN": "Vietnam", "ID": "Indonesia", "MY": "Malaysia",
                "PH": "Philippines", "SG": "Singapore", "TW": "Taiwan", "HK": "Hong Kong",
                # Middle East
                "AE": "United Arab Emirates", "SA": "Saudi Arabia", "IL": "Israel",
                "TR": "Turkey"
            }
            return country_map.get(code, "Unknown")
        return "Unknown"
    
    filtered_frame["country"] = filtered_frame["Resource_on_Product"].apply(extract_country)
    
    # Extract plant (first part before underscore)
    def extract_plant(resource):
        parts = resource.split("_")
        return parts[0] if parts else "Unknown"
    
    filtered_frame["plant"] = filtered_frame["Resource_on_Product"].apply(extract_plant)
    
    # Use SOP1_Project as S&OP1
    filtered_frame["sop1"] = filtered_frame.get("SOP1_Project", "Unknown")
    
    # Extract customer data - ONLY from CSV, NO MOCK DATA
    # Log extraction method for debugging
    has_customer_column = "Customer" in filtered_frame.columns
    has_customer_account_column = "Customer_Account" in filtered_frame.columns
    
    import sys
    customer_extraction_method = "explicit_column"
    if not has_customer_column and not has_customer_account_column:
        customer_extraction_method = "extracted_from_resource"
        print(f"📝 Customer data will be extracted from Resource_on_Product (no Customer/Customer_Account column found)", file=sys.stderr)
    elif has_customer_column:
        print(f"📝 Using explicit 'Customer' column for customer mapping", file=sys.stderr)
    elif has_customer_account_column:
        print(f"📝 Using explicit 'Customer_Account' column for customer mapping", file=sys.stderr)
    
    def map_customer(row):
        """
        Extract customer data ONLY from CSV:
        1. If a Customer/Customer_Account column exists, use it
        2. If not, extract from Resource_on_Product using the correct format:
           PLANT_CUSTOMER_PART3_PART4_... → extract CUSTOMER (index 1)
        3. NO hardcoded patterns or mock data
        
        Format: PART1_CUSTOMER_PART3_PART4_PART5
        Customer is at index 1 after splitting by underscore
        """
        # Check if explicit Customer column exists in CSV
        if "Customer" in filtered_frame.columns:
            value = row.get("Customer")
            if pd.notna(value):
                return str(value).strip()
        
        if "Customer_Account" in filtered_frame.columns:
            value = row.get("Customer_Account")
            if pd.notna(value):
                return str(value).strip()
        
        # Otherwise extract from Resource_on_Product
        # Format: PLANT_CUSTOMER_PART3_PART4_PART5
        # We want the CUSTOMER which is at index 1
        resource = str(row.get("Resource_on_Product", "Unknown")).strip()
        if not resource or resource == "Unknown":
            return "Unknown"
        
        # Split by underscore and get the CUSTOMER part (index 1)
        parts = resource.split("_")
        if len(parts) >= 2:
            customer = parts[1].upper()  # Get second part (customer account)
            return customer if customer else "Unknown"
        
        # Fallback if format is unexpected
        return "Unknown"
    
    # Apply customer mapping row by row
    filtered_frame["customer"] = filtered_frame.apply(map_customer, axis=1)
    
    def count_risks(group):
        """Count risks by level."""
        risk_counts = group["risk_level"].value_counts()
        return {
            "red": int(risk_counts.get("red", 0)),
            "orange": int(risk_counts.get("orange", 0)),
            "yellow": int(risk_counts.get("yellow", 0)),
            "white": int(risk_counts.get("white", 0)),
        }
    
    # Aggregate by week
    weeks_data = []
    for week, group in filtered_frame.groupby("TechnicalWeek"):
        risks = count_risks(group)
        weeks_data.append({
            "week": week,
            **risks
        })
    
    # Aggregate by country
    countries_data = []
    for country, group in filtered_frame.groupby("country"):
        risks = count_risks(group)
        countries_data.append({
            "label": country,
            **risks
        })
    
    # Aggregate by plant
    plants_data = []
    for plant, group in filtered_frame.groupby("plant"):
        risks = count_risks(group)
        plants_data.append({
            "label": plant,
            **risks
        })
    
    # Aggregate by customer
    customers_data = []
    for customer, group in filtered_frame.groupby("customer"):
        risks = count_risks(group)
        customers_data.append({
            "label": customer,
            **risks
        })
    
    # Aggregate by S&OP1
    sop1_data = []
    for sop1, group in filtered_frame.groupby("sop1"):
        risks = count_risks(group)
        sop1_data.append({
            "label": sop1,
            **risks
        })
    
    # Aggregate by Resource_on_Product
    resources_data = []
    for resource, group in filtered_frame.groupby("Resource_on_Product"):
        risks = count_risks(group)
        resources_data.append({
            "resourceOnProduct": resource,
            **risks
        })
    
    # Sort by total risk descending
    for lst in [countries_data, plants_data, customers_data, sop1_data, resources_data]:
        lst.sort(key=lambda x: x["red"] + x["orange"] + x["yellow"] + x["white"], reverse=True)
    
    return {
        "weeks": weeks_data,
        "countries": countries_data,
        "plants": plants_data,
        "customers": customers_data,
        "sop1s": sop1_data,
        "resources": resources_data,
    }
