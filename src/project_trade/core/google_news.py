"""Google News via its public RSS feed — free, no API key.

Google exposes a search-results RSS feed at news.google.com/rss/search. It's
undocumented but stable and widely used; if Google changes the endpoint this
will need updating.
"""
from __future__ import annotations

from urllib.parse import quote_plus

import feedparser
import requests

RSS_URL = "https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; project-trade/0.1)"}


def get_google_news(query: str, count: int = 10) -> list[dict]:
    url = RSS_URL.format(query=quote_plus(query))
    response = requests.get(url, headers=HEADERS, timeout=10)
    feed = feedparser.parse(response.content)
    rows = []
    for entry in feed.entries[:count]:
        source = ""
        if hasattr(entry, "source") and entry.source:
            source = entry.source.get("title", "")
        rows.append(
            {
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "source": source,
            }
        )
    return rows
