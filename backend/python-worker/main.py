#!/usr/bin/env python3
"""
CLI entrypoint for the ABEIS behavioral feature extraction worker.

Usage:
    python main.py --video <path> --type webcam|screen [--output <json_path>]

Always prints a single JSON object to stdout:
    { "ok": true, "features": {...} }
  or
    { "ok": false, "error": "..." }

Node's pythonBridge.js spawns this as a subprocess so the heavy CPU work
happens off the Express event loop entirely (separate OS process).
"""

import argparse
import json
import sys
import traceback


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True, help="Path to local video file")
    parser.add_argument("--type", required=True, choices=["webcam", "screen"])
    parser.add_argument("--output", required=False, help="Optional path to also write JSON to disk")
    args = parser.parse_args()

    try:
        if args.type == "webcam":
            from webcam_features import extract_webcam_features
            features = extract_webcam_features(args.video)
        else:
            from screen_features import extract_screen_features
            features = extract_screen_features(args.video)

        result = {"ok": True, "features": features}

    except Exception as exc:  # noqa: BLE001 - we want to report any failure, not crash silently
        result = {
            "ok": False,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }

    payload = json.dumps(result)

    if args.output:
        with open(args.output, "w") as f:
            f.write(payload)

    # stdout is the contract the Node bridge reads
    print(payload)
    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
