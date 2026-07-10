"""
baseline_utils.py
==================
Statistical computation helpers for the ABEIS Baseline Generation Module.

All functions here are pure (no I/O, no logging side effects beyond the
module logger) so they are easy to unit test in isolation from the
DataFrame-grouping / storage / CLI concerns handled elsewhere.
"""

from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np
import pandas as pd

import config

logger = logging.getLogger("baseline.utils")


def normalize_assessment_type(value: Any) -> str:
    """
    Normalize an assessmentType value for case-insensitive comparison.

    'Coding', 'coding', 'CODING', '  Coding  ' all normalize to 'coding'.
    Non-string / null values normalize to an empty string so they never
    accidentally match a real assessment type.
    """
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(value).strip().lower()


def _round(value: float | None) -> float | None:
    """Round a float to config.STATISTIC_DECIMAL_PLACES, passing None through."""
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return round(float(value), config.STATISTIC_DECIMAL_PLACES)


def safe_divide(numerator: float, denominator: float) -> float | None:
    """
    Divide numerator / denominator, returning config.SAFE_DIVISION_FALLBACK
    (default: None) instead of raising or producing inf/NaN when the
    denominator is zero (or effectively zero).

    Never raises ZeroDivisionError under any input.
    """
    try:
        if denominator == 0 or math.isclose(denominator, 0.0, abs_tol=1e-12):
            return config.SAFE_DIVISION_FALLBACK
        result = numerator / denominator
        if math.isnan(result) or math.isinf(result):
            return config.SAFE_DIVISION_FALLBACK
        return result
    except (ZeroDivisionError, TypeError, ValueError):
        return config.SAFE_DIVISION_FALLBACK


def compute_feature_statistics(values: pd.Series) -> dict[str, float | int | None]:
    """
    Compute the full ABEIS statistical baseline for a single behavioral
    feature across a student's Coding calibration sessions.

    Parameters
    ----------
    values : pd.Series
        Raw (possibly containing NaN) numeric values for one feature,
        across all of a single user's Coding sessions.

    Returns
    -------
    dict with keys:
        mean, std, median, min, max, q1, q3, iqr, cv,
        missing, available, sampleCount

    Notes
    -----
    - `std` uses sample standard deviation (ddof=1) when >= 2 available
      values exist; with exactly 1 available value, std is defined as 0.0
      (a single observation has no variance to speak of, but reporting
      None would break downstream weighted-Z-score consumers that expect
      a numeric std). With 0 available values every statistic is None.
    - `cv` (coefficient of variation) = std / mean, using safe_divide so a
      zero or near-zero mean never raises or produces inf/NaN.
    - Division safety: EVERY ratio in this function goes through
      safe_divide() or an explicit emptiness check first. Nothing here can
      raise ZeroDivisionError.
    """
    sample_count = int(len(values))
    numeric_values = pd.to_numeric(values, errors="coerce")

    missing = int(numeric_values.isna().sum())
    available_series = numeric_values.dropna()
    available = int(len(available_series))

    base_result: dict[str, float | int | None] = {
        "mean": None,
        "std": None,
        "median": None,
        "min": None,
        "max": None,
        "q1": None,
        "q3": None,
        "iqr": None,
        "cv": None,
        "missing": missing,
        "available": available,
        "sampleCount": sample_count,
    }

    if available == 0:
        logger.debug("Feature has zero available values; all stats set to None.")
        return base_result

    mean_val = float(available_series.mean())
    median_val = float(available_series.median())
    min_val = float(available_series.min())
    max_val = float(available_series.max())
    q1_val = float(available_series.quantile(0.25))
    q3_val = float(available_series.quantile(0.75))
    iqr_val = q3_val - q1_val

    if available >= 2:
        std_val = float(available_series.std(ddof=1))
    else:
        # Single observation: variance is undefined; report 0.0 rather than
        # None so downstream z-score math (Z = (x - mean) / std) has a
        # defined (if degenerate) value instead of crashing on None.
        std_val = 0.0

    cv_val = safe_divide(std_val, mean_val)

    base_result.update(
        {
            "mean": _round(mean_val),
            "std": _round(std_val),
            "median": _round(median_val),
            "min": _round(min_val),
            "max": _round(max_val),
            "q1": _round(q1_val),
            "q3": _round(q3_val),
            "iqr": _round(iqr_val),
            "cv": _round(cv_val),
        }
    )
    return base_result


def compute_all_feature_statistics(
    session_df: pd.DataFrame, feature_columns: list[str]
) -> dict[str, dict[str, float | int | None]]:
    """
    Compute statistics for every behavioral feature column across a single
    user's Coding calibration sessions.

    Parameters
    ----------
    session_df : pd.DataFrame
        Rows = this user's Coding sessions only. Already filtered by the
        caller (generate_baseline.py) before this function is called.
    feature_columns : list[str]
        The behavioral feature columns identified by feature_selector.py.

    Returns
    -------
    dict mapping feature_name -> statistics dict (see
    compute_feature_statistics for the shape of each value).
    """
    features: dict[str, dict[str, float | int | None]] = {}
    for col in feature_columns:
        features[col] = compute_feature_statistics(session_df[col])
    return features


def is_valid_numpy_scalar(value: Any) -> bool:
    """True if `value` is a numpy scalar type that needs conversion for JSON."""
    return isinstance(value, (np.integer, np.floating, np.bool_))


def to_json_safe(value: Any) -> Any:
    """
    Recursively convert numpy / pandas scalar types into native Python
    types so `json.dump` never raises TypeError on an np.float64, np.int64,
    pd.Timestamp, etc.
    """
    if value is None:
        return None
    if isinstance(value, dict):
        return {k: to_json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json_safe(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        f = float(value)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value
