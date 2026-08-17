"""Headline news via yfinance (free, no API key)."""
from __future__ import annotations

from datetime import datetime, timezone

import yfinance as yf


def get_news(symbol: str, count: int = 10) -> list[dict]:
    t = yf.Ticker(symbol)
    items = t.news or []
    rows = []
    for item in items[:count]:
        content = item.get("content", item)
        ts = content.get("pubDate") or content.get("providerPublishTime")
        when = ""
        if isinstance(ts, str):
            when = ts
        elif isinstance(ts, (int, float)):
            when = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")

        rows.append(
            {
                "title": content.get("title") or item.get("title", ""),
                "publisher": (content.get("provider") or {}).get("displayName")
                or item.get("publisher", ""),
                "link": (content.get("canonicalUrl") or {}).get("url")
                or item.get("link", ""),
                "published": when,
            }
        )
    return rows
