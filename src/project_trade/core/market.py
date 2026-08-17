"""Market data access via yfinance (free, no API key)."""
from __future__ import annotations

from dataclasses import dataclass

import yfinance as yf

# Predefined screener ids yfinance supports out of the box.
MOVER_CATEGORIES = {
    "gainers": "day_gainers",
    "losers": "day_losers",
    "active": "most_actives",
}


@dataclass
class Quote:
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float
    prev_close: float
    day_high: float
    day_low: float
    volume: int
    market_cap: float | None
    pe_ratio: float | None


def get_quote(symbol: str) -> Quote:
    t = yf.Ticker(symbol)
    info = t.fast_info
    slow = {}
    try:
        slow = t.info
    except Exception:
        pass

    price = float(info.get("lastPrice") or 0)
    prev_close = float(info.get("previousClose") or 0)
    change = price - prev_close
    change_pct = (change / prev_close * 100) if prev_close else 0.0

    return Quote(
        symbol=symbol.upper(),
        name=slow.get("longName") or slow.get("shortName") or symbol.upper(),
        price=price,
        change=change,
        change_pct=change_pct,
        prev_close=prev_close,
        day_high=float(info.get("dayHigh") or 0),
        day_low=float(info.get("dayLow") or 0),
        volume=int(info.get("lastVolume") or 0),
        market_cap=slow.get("marketCap") or info.get("marketCap"),
        pe_ratio=slow.get("trailingPE"),
    )


def get_movers(category: str = "gainers", count: int = 10) -> list[dict]:
    """Return top movers for a category: gainers, losers, active."""
    screen_id = MOVER_CATEGORIES.get(category, category)
    result = yf.screen(screen_id, count=count)
    quotes = result.get("quotes", []) if isinstance(result, dict) else []
    rows = []
    for q in quotes:
        rows.append(
            {
                "symbol": q.get("symbol"),
                "name": q.get("shortName") or q.get("longName") or "",
                "price": q.get("regularMarketPrice"),
                "change": q.get("regularMarketChange"),
                "change_pct": q.get("regularMarketChangePercent"),
                "volume": q.get("regularMarketVolume"),
            }
        )
    return rows


def get_history(symbol: str, period: str = "6mo", interval: str = "1d"):
    """Return a pandas DataFrame of OHLCV history."""
    t = yf.Ticker(symbol)
    return t.history(period=period, interval=interval)
