from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_supabase_client() -> Optional[Client]:
    """Return a cached Supabase client if credentials are configured."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.info("Supabase credentials not configured; skipping client init")
        return None

    try:
        return create_client(settings.supabase_url, settings.supabase_service_key)
    except Exception:  # pragma: no cover - network/runtime guard
        logger.exception("Failed to initialize Supabase client")
        return None
