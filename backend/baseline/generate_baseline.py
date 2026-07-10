#!/usr/bin/env python3
"""
generate_baseline.py
=====================
Entry point for the ABEIS Coding Baseline Generation Module.

Usage
-----
    python generate_baseline.py
    python generate_baseline.py --input /path/to/filtered_dataset.csv
    python generate_baseline.py --input data.csv --store-mode mongodb
    python generate_baseline.py --input data.csv --assessment-type Coding

Pipeline
--------
    1. Load the dataset (CSV).
    2. Automatically classify columns into metadata vs. behavioral features
       (feature_selector.classify_columns) — no feature names hardcoded.
    3. Filter to rows where assessmentType == "Coding" (case-insensitive).
    4. Group the filtered rows by userId.
    5. For each user:
         a. Validate they have >= MIN_SESSIONS_PER_TYPE["Coding"] sessions.
            If not: log a warning, skip this user, continue with the rest.
         b. Compute the full statistical baseline for every behavioral
            feature (baseline_utils.compute_all_feature_statistics).
         c. Persist the resulting document via the configured storage
            backend(s) (baseline_storage.BaselineStorageRouter).
    6. Write baseline_generation_report.txt summarizing the run.

This script NEVER aborts the whole run because of a single bad user —
every per-user failure is caught, logged, and counted, and processing
continues with the next user (see the try/except inside the main loop).
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

import config
from baseline_storage import BaselineStorageError, BaselineStorageRouter
from baseline_utils import compute_all_feature_statistics, normalize_assessment_type
from feature_selector import classify_columns

logger = logging.getLogger("baseline.generate")


# --------------------------------------------------------------------------- #
# Logging setup
# --------------------------------------------------------------------------- #


def _configure_logging() -> None:
    root = logging.getLogger("baseline")
    root.setLevel(getattr(logging, config.LOG_LEVEL, logging.INFO))
    root.handlers.clear()

    formatter = logging.Formatter(config.LOG_FORMAT)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    try:
        file_handler = logging.FileHandler(config.LOG_FILE_PATH, encoding="utf-8")
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
    except OSError as exc:  # pragma: no cover
        console_handler.emit(
            logging.LogRecord(
                "baseline.generate",
                logging.WARNING,
                __file__,
                0,
                f"Could not open log file {config.LOG_FILE_PATH}: {exc}",
                None,
                None,
            )
        )


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate statistical Coding behavioral baselines for ABEIS."
    )
    parser.add_argument(
        "--input",
        type=str,
        default=str(config.DEFAULT_DATASET_PATH),
        help="Path to filtered_dataset.csv (default: %(default)s)",
    )
    parser.add_argument(
        "--store-mode",
        type=str,
        default=config.STORE_MODE,
        choices=sorted(BaselineStorageRouter.VALID_MODES),
        help="Where to persist generated baselines (default: %(default)s)",
    )
    parser.add_argument(
        "--assessment-type",
        type=str,
        default="Coding",
        help=(
            "Assessment type to generate baselines for (default: %(default)s). "
            "Current scope only validates 'Coding'; other values are accepted "
            "for forward compatibility but will use the same MIN_SESSIONS "
            "threshold unless config.MIN_SESSIONS_PER_TYPE is extended."
        ),
    )
    return parser.parse_args(argv)


# --------------------------------------------------------------------------- #
# Core pipeline steps
# --------------------------------------------------------------------------- #


def load_dataset(input_path: Path) -> pd.DataFrame:
    """
    Load the dataset CSV into a DataFrame.

    Raises
    ------
    FileNotFoundError
        If `input_path` does not exist (fatal — nothing can proceed without
        the dataset, so this is intentionally NOT swallowed).
    """
    if not input_path.exists():
        raise FileNotFoundError(
            f"Dataset not found at '{input_path}'. Pass --input to specify "
            f"its location."
        )
    logger.info("Loading dataset from %s", input_path)
    df = pd.read_csv(input_path)
    logger.info("Dataset loaded: %d rows, %d columns", len(df), len(df.columns))
    return df


def filter_to_assessment_type(df: pd.DataFrame, assessment_type: str) -> pd.DataFrame:
    """
    Return only rows where assessmentType matches `assessment_type`
    (case-insensitive, whitespace-tolerant).
    """
    if config.ASSESSMENT_TYPE_COLUMN not in df.columns:
        raise KeyError(
            f"Expected assessmentType column '{config.ASSESSMENT_TYPE_COLUMN}' "
            f"not found in dataset. Available columns: {list(df.columns)}"
        )

    target = normalize_assessment_type(assessment_type)
    normalized_col = df[config.ASSESSMENT_TYPE_COLUMN].map(normalize_assessment_type)
    filtered = df[normalized_col == target].copy()

    logger.info(
        "Filtered dataset to assessmentType='%s': %d / %d rows match.",
        assessment_type,
        len(filtered),
        len(df),
    )
    return filtered


def validate_user_sessions(
    user_id: str, session_count: int, assessment_type: str
) -> tuple[bool, str | None]:
    """
    Validate that a user has enough Coding calibration sessions to generate
    a baseline.

    Returns
    -------
    (is_valid, warning_message)
        warning_message is None when is_valid is True.
    """
    min_required = config.MIN_SESSIONS_PER_TYPE.get(
        assessment_type,
        config.MIN_SESSIONS_PER_TYPE.get("Coding", 5),
    )
    if session_count < min_required:
        message = (
            f"User '{user_id}' has only {session_count} '{assessment_type}' "
            f"session(s); minimum required is {min_required}. Skipping."
        )
        return False, message
    return True, None


def build_baseline_document(
    user_id: str,
    assessment_type: str,
    session_df: pd.DataFrame,
    feature_columns: list[str],
) -> dict[str, Any]:
    """Assemble the final per-user baseline JSON document."""
    features = compute_all_feature_statistics(session_df, feature_columns)
    return {
        "userId": user_id,
        "assessmentType": assessment_type,
        "sampleCount": int(len(session_df)),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "features": features,
    }


# --------------------------------------------------------------------------- #
# Report
# --------------------------------------------------------------------------- #


def write_report(
    report_path: Path,
    *,
    total_users: int,
    processed_users: int,
    skipped_users: int,
    sessions_used_per_user: int,
    feature_count: int,
    store_mode: str,
    elapsed_seconds: float,
    warnings: list[str],
    errors: list[str],
    output_location: str,
) -> None:
    lines = [
        "=" * 70,
        "ABEIS Coding Baseline Generation Report",
        "=" * 70,
        f"Generated At          : {datetime.now(timezone.utc).isoformat()}",
        f"Total Users           : {total_users}",
        f"Processed Users       : {processed_users}",
        f"Skipped Users         : {skipped_users}",
        f"Min Calibration Sessions Required : {sessions_used_per_user}",
        f"Number of Behavioral Features     : {feature_count}",
        f"Storage Mode          : {store_mode}",
        f"Execution Time (sec)  : {elapsed_seconds:.3f}",
        f"Output Location       : {output_location}",
        "",
        f"Warnings ({len(warnings)}):",
    ]
    lines.extend(f"  - {w}" for w in warnings) if warnings else lines.append("  (none)")

    lines.append("")
    lines.append(f"Errors ({len(errors)}):")
    if errors:
        lines.extend(f"  - {e}" for e in errors)
    else:
        lines.append("  (none)")

    lines.append("=" * 70)

    report_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Report written to %s", report_path)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #


def run(argv: list[str] | None = None) -> int:
    """
    Run the full baseline generation pipeline.

    Returns
    -------
    int
        Process exit code (0 on success — including partial success with
        some users skipped — non-zero only on a fatal, run-aborting error
        such as a missing dataset file).
    """
    _configure_logging()
    args = _parse_args(argv)
    start_time = time.monotonic()

    warnings: list[str] = []
    errors: list[str] = []

    input_path = Path(args.input)

    # --- Fatal, run-aborting failures (dataset missing / unreadable) ---
    try:
        df = load_dataset(input_path)
    except FileNotFoundError as exc:
        logger.error(str(exc))
        return 1
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as exc:
        logger.error("Failed to parse dataset '%s': %s", input_path, exc)
        return 1

    try:
        filtered_df = filter_to_assessment_type(df, args.assessment_type)
    except KeyError as exc:
        logger.error(str(exc))
        return 1

    if filtered_df.empty:
        logger.warning(
            "No rows found for assessmentType='%s'. Nothing to process.",
            args.assessment_type,
        )

    selection = classify_columns(df)
    feature_columns = selection.behavioral_feature_columns
    if not feature_columns:
        logger.error(
            "No behavioral feature columns were detected. Check that the "
            "dataset contains numeric columns beyond metadata. Aborting."
        )
        return 1

    if config.USER_ID_COLUMN not in filtered_df.columns:
        logger.error(
            "Expected user ID column '%s' not found in dataset.",
            config.USER_ID_COLUMN,
        )
        return 1

    try:
        storage_router = BaselineStorageRouter(store_mode=args.store_mode)
    except ValueError as exc:
        logger.error(str(exc))
        return 1

    grouped = filtered_df.groupby(config.USER_ID_COLUMN, dropna=True, sort=False)
    total_users = grouped.ngroups
    processed_users = 0
    skipped_users = 0

    logger.info(
        "Starting baseline generation for %d candidate user(s), "
        "%d behavioral feature(s), storage mode='%s'.",
        total_users,
        len(feature_columns),
        args.store_mode,
    )

    for user_id, session_df in grouped:
        try:
            is_valid, warning_message = validate_user_sessions(
                user_id=str(user_id),
                session_count=len(session_df),
                assessment_type=args.assessment_type,
            )
            if not is_valid:
                logger.warning(warning_message)
                warnings.append(warning_message)
                skipped_users += 1
                continue

            document = build_baseline_document(
                user_id=str(user_id),
                assessment_type=args.assessment_type,
                session_df=session_df,
                feature_columns=feature_columns,
            )
            storage_router.save(str(user_id), document)
            processed_users += 1

        except BaselineStorageError as exc:
            message = f"Storage failure for user '{user_id}': {exc}"
            logger.error(message)
            errors.append(message)
            skipped_users += 1
            continue

        except Exception as exc:  # noqa: BLE001 - deliberate: never abort the run
            message = f"Unexpected error processing user '{user_id}': {exc}"
            logger.exception(message)
            errors.append(message)
            skipped_users += 1
            continue

    storage_router.close()

    elapsed = time.monotonic() - start_time

    output_location = (
        str(config.GENERATED_OUTPUT_DIR)
        if args.store_mode in ("local", "both")
        else f"MongoDB collection '{config.MONGODB_COLLECTION_NAME}'"
    )

    write_report(
        config.REPORT_FILE_PATH,
        total_users=total_users,
        processed_users=processed_users,
        skipped_users=skipped_users,
        sessions_used_per_user=config.MIN_SESSIONS_PER_TYPE.get(
            args.assessment_type, config.MIN_SESSIONS_PER_TYPE.get("Coding", 5)
        ),
        feature_count=len(feature_columns),
        store_mode=args.store_mode,
        elapsed_seconds=elapsed,
        warnings=warnings,
        errors=errors,
        output_location=output_location,
    )

    logger.info(
        "Done. Processed=%d Skipped=%d Total=%d Elapsed=%.2fs",
        processed_users,
        skipped_users,
        total_users,
        elapsed,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run())
