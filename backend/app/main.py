from pathlib import Path
import logging

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse

from app.core.config import get_settings
from app.routes.ocr import router as ocr_router
from app.routes.fiducial import router as fiducial_router
from app.routes.predict import router as predict_router

# Enable debug logging for fiducial detection
logging.basicConfig(level=logging.DEBUG)
logging.getLogger("app.routes.fiducial").setLevel(logging.DEBUG)

settings = get_settings()

app = FastAPI(title="ML App Backend")


_CONFIRM_TEMPLATE_PATH = (
	Path(__file__).resolve().parent / "templates" / "auth_confirmed.html"
)
try:
	CONFIRMED_HTML = _CONFIRM_TEMPLATE_PATH.read_text(encoding="utf-8")
except FileNotFoundError:
	CONFIRMED_HTML = """<!DOCTYPE html><html><body><p>Email confirmed. You can close this page.</p></body></html>"""


@app.get("/health", tags=["health"])
def health_check() -> dict:
	return {"status": "ok"}


@app.get("/auth/confirmed", response_class=HTMLResponse, tags=["auth"])
async def email_confirmed(request: Request) -> HTMLResponse:
	"""Simple confirmation page Supabase can redirect to after email verification.

	This does not perform any auth logic; Supabase has already confirmed the user
	by the time it redirects. This just shows a friendly message.
	"""

	return HTMLResponse(content=CONFIRMED_HTML)


def get_app() -> FastAPI:
	"""Convenience accessor if you need the app instance elsewhere."""
	return app


app.include_router(ocr_router, prefix="/ocr", tags=["ocr"])
app.include_router(fiducial_router, prefix="/fiducial", tags=["fiducial"])
app.include_router(predict_router, prefix="/predict", tags=["predict"])

