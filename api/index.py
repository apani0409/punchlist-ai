"""Vercel entry point: serves the FastAPI backend under /api/*."""

from backend.main import create_app

app = create_app(prefix="/api")
