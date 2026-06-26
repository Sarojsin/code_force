#!/usr/bin/env python
"""Pre-build check: ensure ONNX model and vocab exist before mobile bundle.

Run by CI before the mobile bundle step. Exits with code 1 if files missing.
"""

from __future__ import annotations

import sys
from pathlib import Path

REQUIRED = [
    "mobile/src/assets/models/wellness_classifier.onnx",
    "mobile/src/assets/vocab.json",
]

def main() -> int:
    missing = []
    for rel_path in REQUIRED:
        p = Path(__file__).resolve().parent.parent / rel_path
        if not p.exists():
            missing.append(str(p))

    if missing:
        print("BUILD FAILED: Missing required model artifacts:")
        for m in missing:
            print(f"  {m}")
        print("\nRun  python scripts/train_wellness_classifier.py --data data/training_data.jsonl --output mobile/assets/models/")
        return 1

    sizes = {rel_path: (Path(__file__).resolve().parent.parent / rel_path).stat().st_size for rel_path in REQUIRED}
    for path, size in sizes.items():
        print(f"  {path}: {size:,} bytes")
    print("All model artifacts present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
