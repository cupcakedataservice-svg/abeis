"""
baseline_storage.py
====================
Storage backends for generated Coding baselines.

Two storage options are implemented, selected via `config.STORE_MODE`:

    "local"   -> one JSON file per user, written to config.GENERATED_OUTPUT_DIR
    "mongodb" -> one document per user, upserted into config.MONGODB_COLLECTION_NAME
    "both"    -> both of the above

The MongoDB connection is created lazily (only when actually needed) so
that `STORE_MODE = "local"` runs never require `pymongo` to be reachable
or even correctly configured, and so unit tests / dry runs of the local
path never pay a Mongo connection-timeout cost.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

import config
from baseline_utils import to_json_safe

logger = logging.getLogger("baseline.storage")


class BaselineStorageError(Exception):
    """Raised when a baseline document cannot be persisted."""


class LocalJSONStorage:
    """Writes one baseline JSON file per student under GENERATED_OUTPUT_DIR."""

    def __init__(self, output_dir: Path = config.GENERATED_OUTPUT_DIR) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def save(self, user_id: str, document: dict[str, Any]) -> Path:
        """
        Write `document` to <output_dir>/<user_id>.json (pretty-printed,
        UTF-8, JSON-safe types only).

        Raises
        ------
        BaselineStorageError
            If the file cannot be written (disk full, permissions, etc.).
        """
        safe_user_id = _sanitize_filename(user_id)
        file_path = self.output_dir / f"{safe_user_id}.json"
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(to_json_safe(document), f, indent=2, ensure_ascii=False)
        except OSError as exc:
            raise BaselineStorageError(
                f"Failed to write local baseline file for user '{user_id}': {exc}"
            ) from exc
        logger.info("Local baseline written: %s", file_path)
        return file_path


class MongoBaselineStorage:
    """
    Writes one baseline document per student into MongoDB, upserted on
    (userId, assessmentType) so re-running the generator updates rather
    than duplicates a student's Coding baseline.

    Reuses the project's existing MongoDB connection string (config.MONGODB_URI,
    read from the MONGODB_URI environment variable, the same variable the
    Node.js backend's config/db.js uses) rather than creating a second,
    separate database.
    """

    def __init__(
        self,
        uri: str = config.MONGODB_URI,
        collection_name: str = config.MONGODB_COLLECTION_NAME,
    ) -> None:
        self._uri = uri
        self._collection_name = collection_name
        self._client: Optional[Any] = None
        self._collection: Optional[Any] = None
        # Cache a connection failure so we fail fast on every subsequent
        # save() call instead of re-attempting a full network timeout for
        # each user in the batch (e.g. 8 users x 5s timeout = 40s wasted).
        self._connection_error: Optional[str] = None

    def _connect(self) -> None:
        if self._collection is not None:
            return
        if self._connection_error is not None:
            raise BaselineStorageError(
                f"MongoDB connection previously failed, not retrying: "
                f"{self._connection_error}"
            )
        try:
            from pymongo import MongoClient
            from pymongo.errors import PyMongoError
        except ImportError as exc:  # pragma: no cover
            raise BaselineStorageError(
                "pymongo is not installed. Install it with "
                "`pip install pymongo --break-system-packages` to use "
                "STORE_MODE='mongodb'."
            ) from exc

        try:
            self._client = MongoClient(
                self._uri,
                serverSelectionTimeoutMS=config.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
            )
            # Force a round-trip now so connection problems surface
            # immediately with a clear error, rather than on the first save().
            self._client.admin.command("ping")
            db = self._client.get_default_database()
            self._collection = db[self._collection_name]
            self._collection.create_index(
                [("userId", 1), ("assessmentType", 1)], unique=True
            )
            logger.info(
                "Connected to MongoDB collection '%s'.", self._collection_name
            )
        except PyMongoError as exc:
            self._connection_error = str(exc)
            raise BaselineStorageError(f"Failed to connect to MongoDB: {exc}") from exc

    def save(self, user_id: str, document: dict[str, Any]) -> None:
        """
        Upsert `document` into MongoDB, keyed on (userId, assessmentType).

        Raises
        ------
        BaselineStorageError
            If the connection or the write operation fails.
        """
        self._connect()
        assert self._collection is not None  # for type checkers

        from pymongo.errors import PyMongoError

        try:
            self._collection.update_one(
                {
                    "userId": document["userId"],
                    "assessmentType": document["assessmentType"],
                },
                {"$set": to_json_safe(document)},
                upsert=True,
            )
        except PyMongoError as exc:
            raise BaselineStorageError(
                f"Failed to upsert baseline for user '{user_id}' into MongoDB: {exc}"
            ) from exc
        logger.info("MongoDB baseline upserted for userId=%s", user_id)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
            self._collection = None


class BaselineStorageRouter:
    """
    Facade that dispatches `save()` to one or both configured backends,
    based on `config.STORE_MODE`. This is the only class `generate_baseline.py`
    needs to know about — it never talks to LocalJSONStorage / MongoBaselineStorage
    directly, which keeps the storage mode fully config-driven.
    """

    VALID_MODES = {"local", "mongodb", "both"}

    def __init__(self, store_mode: str = config.STORE_MODE) -> None:
        if store_mode not in self.VALID_MODES:
            raise ValueError(
                f"Invalid STORE_MODE '{store_mode}'. Must be one of {self.VALID_MODES}."
            )
        self.store_mode = store_mode
        self._local: Optional[LocalJSONStorage] = None
        self._mongo: Optional[MongoBaselineStorage] = None

        if store_mode in ("local", "both"):
            self._local = LocalJSONStorage()
        if store_mode in ("mongodb", "both"):
            self._mongo = MongoBaselineStorage()

    def save(self, user_id: str, document: dict[str, Any]) -> dict[str, Any]:
        """
        Persist `document` using the configured backend(s).

        Returns
        -------
        dict with keys 'local_path' (str | None) and 'mongodb_saved' (bool),
        describing what actually happened, for the caller's report/logging.
        """
        result: dict[str, Any] = {"local_path": None, "mongodb_saved": False}

        if self._local is not None:
            path = self._local.save(user_id, document)
            result["local_path"] = str(path)

        if self._mongo is not None:
            self._mongo.save(user_id, document)
            result["mongodb_saved"] = True

        return result

    def close(self) -> None:
        if self._mongo is not None:
            self._mongo.close()


def _sanitize_filename(user_id: str) -> str:
    """Strip characters that are unsafe in filenames across OSes."""
    keep = "-_."
    return "".join(c for c in str(user_id) if c.isalnum() or c in keep) or "unknown_user"
