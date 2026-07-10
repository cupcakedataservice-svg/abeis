"""
feature_selector.py
====================
Automatic behavioral-feature discovery for the ABEIS Baseline Generation
Module.

No feature name is ever hardcoded in this file. Instead, this module
inspects the actual DataFrame at runtime and classifies every column as
either:

    - METADATA   (userId, assessmentType, timestamps, IDs, URLs, ...)
    - BEHAVIORAL (any remaining numeric column)

Classification pipeline (each column runs through, in order):

    1. Exact-match against `config.KNOWN_METADATA_COLUMNS`         -> metadata
    2. Non-numeric dtype (string / object / datetime / bool)       -> metadata
    3. Name contains a metadata substring (config.METADATA_NAME_SUBSTRINGS)
       AND does not contain a whitelisted behavioral substring     -> metadata
    4. Everything else that is numeric                             -> behavioral

This keeps the module reusable: if the dataset gains new behavioral columns
tomorrow (e.g. "eyeGazeVarianceV2"), they are picked up automatically with
zero code changes, as long as they are numeric and don't collide with a
metadata naming pattern.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

import pandas as pd

import config

logger = logging.getLogger("baseline.feature_selector")

# Matches "id" only as a standalone camelCase/snake_case TOKEN at the end of
# (or as the whole of) a column name — e.g. "userId", "session_id",
# "assessmentID" all match; but "confidence", "idleTimeMs", "provided",
# "avoided" must NOT match, since "id" there is buried inside an unrelated
# word rather than acting as its own identifier token.
_ID_TOKEN_PATTERN = re.compile(r"(?:^|_)id$", re.IGNORECASE)


def _split_camel_and_snake(col: str) -> list[str]:
    """
    Split a column name into lowercase tokens, handling both camelCase
    ('userId' -> ['user', 'id']) and snake_case ('session_id' ->
    ['session', 'id']) so that token-level matching (not raw substring
    matching) can be used to detect metadata-like names.
    """
    # Insert a boundary before each uppercase letter that follows a
    # lowercase letter or digit (camelCase boundary), then split on any
    # non-alphanumeric separator.
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", col)
    return [tok.lower() for tok in re.split(r"[^A-Za-z0-9]+", spaced) if tok]


@dataclass
class FeatureSelectionResult:
    """Result of running feature selection against a DataFrame."""

    metadata_columns: list[str] = field(default_factory=list)
    behavioral_feature_columns: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"{len(self.metadata_columns)} metadata column(s), "
            f"{len(self.behavioral_feature_columns)} behavioral feature column(s)"
        )


def _normalize_col_name(col: str) -> str:
    """
    Normalize a column name for robust, separator-insensitive comparison.

    'user_id', 'userId', 'user-id', 'USER ID' all normalize to 'userid'.
    """
    return (
        str(col)
        .strip()
        .lower()
        .replace("_", "")
        .replace("-", "")
        .replace(" ", "")
    )


def _is_known_metadata_column(col: str) -> bool:
    return _normalize_col_name(col) in config.KNOWN_METADATA_COLUMNS


def _matches_metadata_substring(col: str) -> bool:
    """
    True if the column name contains a metadata-like TOKEN (e.g. "id",
    "url", "email", "name" as whole camelCase/snake_case words) AND does
    not contain a whitelisted behavioral substring (e.g. "speed", "latency")
    that would indicate it's actually a real behavioral metric.

    Uses token-level matching (via _split_camel_and_snake), NOT raw
    substring search, specifically so that "id" matches "userId" /
    "session_id" but does NOT match "confidence", "idleTimeMs", "provided",
    or "avoided" — words that merely happen to contain the letters "i" and
    "d" next to each other without "id" being its own identifier token.
    """
    normalized = _normalize_col_name(col)

    contains_whitelisted_term = any(
        term in normalized for term in config.FEATURE_NAME_WHITELIST_SUBSTRINGS
    )
    if contains_whitelisted_term:
        return False

    tokens = _split_camel_and_snake(col)
    metadata_terms = {t.lower() for t in config.METADATA_NAME_SUBSTRINGS}
    return any(token in metadata_terms for token in tokens)


def _is_numeric_dtype(series: pd.Series) -> bool:
    """
    True for any pandas numeric dtype (int, float, and their nullable
    variants like Int64/Float64). Explicitly False for bool, since boolean
    flag columns (e.g. "consentAccepted") are not meaningful behavioral
    statistics targets even though pandas considers bool numeric-adjacent.
    """
    if pd.api.types.is_bool_dtype(series):
        return False
    return pd.api.types.is_numeric_dtype(series)


def classify_columns(df: pd.DataFrame) -> FeatureSelectionResult:
    """
    Classify every column in `df` as metadata or behavioral-feature.

    Parameters
    ----------
    df : pd.DataFrame
        The full (or filtered) dataset.

    Returns
    -------
    FeatureSelectionResult
        Two mutually-exclusive, exhaustive lists of column names.
    """
    metadata_columns: list[str] = []
    behavioral_columns: list[str] = []

    for col in df.columns:
        if _is_known_metadata_column(col):
            metadata_columns.append(col)
            continue

        if not _is_numeric_dtype(df[col]):
            metadata_columns.append(col)
            continue

        if _matches_metadata_substring(col):
            metadata_columns.append(col)
            continue

        # Optional sparsity guard (disabled by default via config value 0.0).
        if config.MIN_NON_NULL_RATIO_FOR_FEATURE > 0.0:
            non_null_ratio = df[col].notna().mean() if len(df) else 0.0
            if non_null_ratio < config.MIN_NON_NULL_RATIO_FOR_FEATURE:
                logger.warning(
                    "Column '%s' is numeric but only %.1f%% populated; "
                    "excluding from behavioral features.",
                    col,
                    non_null_ratio * 100,
                )
                metadata_columns.append(col)
                continue

        behavioral_columns.append(col)

    result = FeatureSelectionResult(
        metadata_columns=metadata_columns,
        behavioral_feature_columns=behavioral_columns,
    )
    logger.info("Feature classification complete: %s", result.summary())
    logger.debug("Metadata columns: %s", metadata_columns)
    logger.debug("Behavioral feature columns: %s", behavioral_columns)
    return result
