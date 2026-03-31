"""Date transformation utility for converting user dates to TechnicalWeek format."""

from __future__ import annotations

import io
import string

import pandas as pd


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


def add_technical_week(frame: pd.DataFrame) -> pd.DataFrame:
    """
    Transform the 'DATE' column (format: YYYY.MM.DD HH:MM:SS) into 'TechnicalWeek' (TW13 2026).

    Args:
        frame: DataFrame with a 'DATE' column

    Returns:
        DataFrame with new 'TechnicalWeek' column added (or replaced)
    """
    if "DATE" not in frame.columns:
        raise ValueError("DATE column not found in CSV.")

    frame = frame.copy()

    try:
        # Try parsing with the common format: 2026.03.23 HH:MM:SS
        frame["DATE"] = pd.to_datetime(
            frame["DATE"],
            format="%Y.%m.%d %H:%M:%S",
            errors="coerce",
        )
    except Exception:
        # Fallback to pandas auto-detection
        frame["DATE"] = pd.to_datetime(frame["DATE"], errors="coerce")

    # Calculate ISO Week (%V) and Year (%G)
    # Result example: 'TW13 2026'
    frame["TechnicalWeek"] = frame["DATE"].dt.strftime("TW%V %G")

    return frame


def clean_null_values(frame: pd.DataFrame) -> pd.DataFrame:
    """Replace <Null> and similar placeholders with 0 for all columns."""
    # Replace all null-like strings with 0
    frame = frame.replace(r"<Null>|NULL|null|None", 0)
    # Also handle actual NaN values
    frame = frame.fillna(0)
    return frame


def clean_inventory_data(file_bytes: bytes, delimiter: str = ";", encoding: str = "latin1") -> pd.DataFrame:
    """
    Clean and transform inventory CSV data with advanced TechnicalWeek assignment.

    Handles multiple data points per ISO week by adding letter suffixes (a, b, c, etc.).
    Example: If 3 records exist for ISO week 13 of 2026, they become:
    - TW13a 2026
    - TW13b 2026
    - TW13c 2026

    Args:
        file_bytes: Raw CSV file content
        delimiter: CSV delimiter (default: ";")
        encoding: File encoding (default: "latin1")

    Returns:
        Cleaned DataFrame with TechnicalWeek column
    """
    # Read CSV
    df = pd.read_csv(io.BytesIO(file_bytes), sep=delimiter, encoding=encoding, dtype=str)

    # Replace <Null> with 0 (work with string data)
    df = df.replace("<Null>", "0")

    # Parse DATE column
    df["DATE"] = pd.to_datetime(
        df["DATE"],
        format="%Y.%m.%d %H:%M:%S",
        errors="coerce"
    )

    # Extract ISO week/year
    iso = df["DATE"].dt.isocalendar()
    df["ISO_Year"] = iso["year"]
    df["ISO_Week"] = iso["week"]

    # Sort for deterministic suffix assignment
    df = df.sort_values(by=["ISO_Year", "ISO_Week", "DATE"]).reset_index(drop=True)

    # Assign TechnicalWeek with suffix logic
    def assign_week(group):
        week = group["ISO_Week"].iloc[0]
        year = group["ISO_Year"].iloc[0]

        if len(group) == 1:
            group = group.copy()
            group["TechnicalWeek"] = f"TW{week} {year}"
        else:
            group = group.copy()
            group["rank"] = range(len(group))
            group["suffix"] = group["rank"].apply(number_to_letters)
            group["TechnicalWeek"] = group.apply(
                lambda row: f"TW{week}{row['suffix']} {year}",
                axis=1
            )

        return group

    df = df.groupby(["ISO_Year", "ISO_Week"], group_keys=False).apply(assign_week)

    # Drop helper columns (keep DATE for audit trail)
    df = df.drop(
        columns=["ISO_Year", "ISO_Week", "rank", "suffix"],
        errors="ignore"
    )

    return df
