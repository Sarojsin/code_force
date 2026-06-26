"""Convenience runner: starts the backend with hot-reload.

Usage:
    python run.py
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="Localhost",
        port=8000,
        reload=True,
        log_level="info",
    )
