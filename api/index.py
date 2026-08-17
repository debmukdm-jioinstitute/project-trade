"""Vercel serverless entry point — exports the FastAPI app.

Adds src/ to sys.path directly instead of relying on the package being pip
installed, since Vercel's Python build doesn't run our normal editable
install step.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from project_trade.web import app  # noqa: E402
