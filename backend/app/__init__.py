"""SheCare backend - modular FastAPI monolith.

Rule references (backend_rules.md):
- §1: package by feature, not by layer
- §5: single Pydantic settings source of truth
- §15: pluggable modules (init_module + try/except)
- §19: this folder layout is canonical
"""

__version__ = "0.1.0"
