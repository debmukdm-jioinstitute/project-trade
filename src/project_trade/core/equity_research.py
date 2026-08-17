"""Bloomberg-terminal-style equity research functions: world indices (WEI),
index movers (MOV), company snapshots (DES), price-chart technicals (GP/TECH),
financial statements (FA), consensus estimates (EE/EEO/ANR), and relative
valuation (RV) — all on free Yahoo Finance data via yfinance.

Two things Bloomberg itself provides that no free source does, and that this
module deliberately does NOT fake:
  - Broker-by-broker estimate breakdowns (EEB) — institutional data, paywalled
    everywhere (Bloomberg, Refinitiv, Capital IQ). Yahoo only gives the
    aggregated consensus (get_estimates / get_recommendations below).
  - AI-generated news summaries — this app has no LLM integration wired up;
    claiming one would be fabricating a feature.
"""
from __future__ import annotations

import math

import pandas as pd
import yfinance as yf

WORLD_INDICES = {
    "Americas": [
        ("^GSPC", "S&P 500"),
        ("^DJI", "Dow Jones Industrial"),
        ("^IXIC", "Nasdaq Composite"),
        ("^GSPTSE", "S&P/TSX (Canada)"),
        ("^BVSP", "Bovespa (Brazil)"),
    ],
    "Europe": [
        ("^FTSE", "FTSE 100 (UK)"),
        ("^GDAXI", "DAX (Germany)"),
        ("^FCHI", "CAC 40 (France)"),
        ("^STOXX50E", "Euro Stoxx 50"),
    ],
    "Asia-Pacific": [
        ("^NSEI", "Nifty 50 (India)"),
        ("^BSESN", "Sensex (India)"),
        ("^N225", "Nikkei 225 (Japan)"),
        ("^HSI", "Hang Seng (Hong Kong)"),
        ("000001.SS", "Shanghai Composite"),
        ("^AXJO", "ASX 200 (Australia)"),
    ],
}

RANGE_PERIODS = {
    "1d": ("2d", "1d"),
    "1wk": ("7d", "1d"),
    "1mo": ("1mo", "1d"),
    "3mo": ("3mo", "1d"),
    "6mo": ("6mo", "1wk"),
    "1y": ("1y", "1wk"),
}


def get_world_indices() -> dict:
    from project_trade.core import market

    out = {}
    for region, members in WORLD_INDICES.items():
        rows = []
        for symbol, label in members:
            try:
                q = market.get_quote(symbol)
                rows.append({"symbol": symbol, "label": label, "price": q.price, "change_pct": q.change_pct})
            except Exception:
                rows.append({"symbol": symbol, "label": label, "price": None, "change_pct": None})
        out[region] = rows
    return out


def _all_index_symbol_lists() -> dict:
    from project_trade.core import indices

    lookup = {"nifty50": indices.NIFTY50, "sensex30": indices.SENSEX30}
    return lookup


def get_index_movers(index_key: str, range_key: str = "1d", top_n: int = 10) -> dict:
    """Top/bottom performers among an index's constituents over a time range."""
    from project_trade.core import indices

    lists = _all_index_symbol_lists()
    constituents = lists.get(index_key)
    if not constituents:
        return {"gainers": [], "losers": [], "range": range_key}

    period, interval = RANGE_PERIODS.get(range_key, RANGE_PERIODS["1d"])
    rows = []
    for base_symbol, name in constituents:
        symbol = indices.yahoo_symbol(base_symbol)
        try:
            t = yf.Ticker(symbol)
            hist = t.history(period=period, interval=interval)
            if hist.empty or len(hist) < 2:
                continue
            start = float(hist["Close"].iloc[0])
            end = float(hist["Close"].iloc[-1])
            change_pct = (end / start - 1) * 100 if start else None
            rows.append({"symbol": base_symbol, "name": name, "price": end, "change_pct": change_pct})
        except Exception:
            continue

    rows.sort(key=lambda r: r["change_pct"] if r["change_pct"] is not None else 0, reverse=True)
    return {
        "range": range_key,
        "gainers": rows[:top_n],
        "losers": list(reversed(rows[-top_n:])) if len(rows) > top_n else list(reversed(rows)),
    }


def get_company_description(symbol: str) -> dict:
    t = yf.Ticker(symbol)
    info = t.info or {}
    return {
        "symbol": symbol.upper(),
        "name": info.get("longName") or info.get("shortName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "summary": info.get("longBusinessSummary"),
        "employees": info.get("fullTimeEmployees"),
        "website": info.get("website"),
        "country": info.get("country"),
        "exchange": info.get("exchange"),
        "currency": info.get("currency"),
        "price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "market_cap": info.get("marketCap"),
        "trailing_pe": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "price_to_book": info.get("priceToBook"),
        "ev_to_ebitda": info.get("enterpriseToEbitda"),
        "dividend_yield": info.get("dividendYield"),
        "profit_margin": info.get("profitMargins"),
        "beta": info.get("beta"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
        "eps_trailing": info.get("trailingEps"),
        "eps_forward": info.get("forwardEps"),
    }


# ── GP: price chart + technicals ──────────────────────────────────────────

def get_price_series(symbol: str, period: str = "1y", interval: str = "1d") -> list[dict]:
    t = yf.Ticker(symbol)
    hist = t.history(period=period, interval=interval)
    if hist.empty:
        return []
    return [
        {"date": idx.strftime("%Y-%m-%d"), "close": float(row["Close"]), "volume": float(row.get("Volume", 0) or 0)}
        for idx, row in hist.iterrows()
        if not pd.isna(row["Close"])
    ]


def sma(series: list[float], window: int) -> list[float | None]:
    out = []
    for i in range(len(series)):
        if i + 1 < window:
            out.append(None)
        else:
            out.append(sum(series[i + 1 - window:i + 1]) / window)
    return out


def max_drawdown_series(series: list[float]) -> tuple[list[float], float]:
    """Running drawdown (%) from the running peak, plus the max drawdown."""
    peak = -math.inf
    drawdowns = []
    for v in series:
        peak = max(peak, v)
        dd = (v / peak - 1) * 100 if peak else 0.0
        drawdowns.append(dd)
    return drawdowns, min(drawdowns) if drawdowns else 0.0


def fibonacci_levels(series: list[float]) -> dict:
    if not series:
        return {}
    high, low = max(series), min(series)
    diff = high - low
    ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
    return {f"{r*100:.1f}%": round(high - diff * r, 4) for r in ratios}


def correlation_matrix(series_by_symbol: dict[str, list[float]]) -> dict:
    symbols = list(series_by_symbol.keys())
    if len(symbols) < 2:
        return {}
    df = pd.DataFrame({s: pd.Series(v) for s, v in series_by_symbol.items()})
    corr = df.pct_change().corr()
    return {a: {b: (None if pd.isna(corr.loc[a, b]) else round(float(corr.loc[a, b]), 3)) for b in symbols} for a in symbols}


# ── FA: financial statements ─────────────────────────────────────────────

def get_financial_statements(symbol: str, quarterly: bool = False) -> dict:
    t = yf.Ticker(symbol)
    inc = t.quarterly_income_stmt if quarterly else t.income_stmt
    bs = t.quarterly_balance_sheet if quarterly else t.balance_sheet
    cf = t.quarterly_cashflow if quarterly else t.cashflow

    def frame_to_rows(df: pd.DataFrame, keys: list[str]) -> list[dict]:
        if df is None or df.empty:
            return []
        cols = list(df.columns)[:6]
        rows = []
        for key in keys:
            if key not in df.index:
                continue
            values = {}
            for col in cols:
                v = df.loc[key, col]
                values[col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)] = (
                    None if pd.isna(v) else float(v)
                )
            rows.append({"item": key, "values": values})
        return rows

    income_keys = ["Total Revenue", "Cost Of Revenue", "Gross Profit", "Operating Expense",
                   "Operating Income", "EBITDA", "EBIT", "Interest Expense", "Tax Provision", "Net Income"]
    balance_keys = ["Total Assets", "Current Assets", "Total Liabilities Net Minority Interest",
                    "Current Liabilities", "Total Debt", "Cash And Cash Equivalents",
                    "Stockholders Equity", "Working Capital"]
    cashflow_keys = ["Operating Cash Flow", "Investing Cash Flow", "Financing Cash Flow",
                     "Capital Expenditure", "Free Cash Flow", "Cash Dividends Paid"]

    return {
        "symbol": symbol.upper(),
        "period_type": "quarterly" if quarterly else "annual",
        "income_statement": frame_to_rows(inc, income_keys),
        "balance_sheet": frame_to_rows(bs, balance_keys),
        "cashflow_statement": frame_to_rows(cf, cashflow_keys),
    }


def get_kpi_ratios(symbol: str) -> dict:
    t = yf.Ticker(symbol)
    info = t.info or {}
    revenue = info.get("totalRevenue")
    gross_profit = None
    try:
        inc = t.income_stmt
        if inc is not None and not inc.empty and "Gross Profit" in inc.index:
            gp = inc.loc["Gross Profit"].iloc[0]
            gross_profit = None if pd.isna(gp) else float(gp)
    except Exception:
        pass

    employees = info.get("fullTimeEmployees")
    return {
        "gross_margin_pct": (gross_profit / revenue * 100) if (gross_profit and revenue) else info.get("grossMargins", 0) * 100 if info.get("grossMargins") else None,
        "operating_margin_pct": (info.get("operatingMargins") or 0) * 100 if info.get("operatingMargins") is not None else None,
        "net_margin_pct": (info.get("profitMargins") or 0) * 100 if info.get("profitMargins") is not None else None,
        "revenue_per_employee": (revenue / employees) if (revenue and employees) else None,
        "return_on_equity_pct": (info.get("returnOnEquity") or 0) * 100 if info.get("returnOnEquity") is not None else None,
        "return_on_assets_pct": (info.get("returnOnAssets") or 0) * 100 if info.get("returnOnAssets") is not None else None,
        "current_ratio": info.get("currentRatio"),
        "debt_to_equity": info.get("debtToEquity"),
    }


# ── EE / EEO / ANR: consensus estimates and recommendations ────────────────

def get_estimates(symbol: str) -> dict:
    """Yahoo-aggregated consensus (many contributing banks, not attributed by
    name — that per-broker breakdown is Bloomberg/Refinitiv-exclusive data)."""
    t = yf.Ticker(symbol)

    def df_to_records(df: pd.DataFrame | None) -> list[dict]:
        if df is None or df.empty:
            return []
        records = []
        for period, row in df.iterrows():
            rec = {"period": str(period)}
            for col in df.columns:
                v = row[col]
                rec[col] = None if pd.isna(v) else (float(v) if isinstance(v, (int, float)) else str(v))
            records.append(rec)
        return records

    try:
        earnings = df_to_records(t.earnings_estimate)
    except Exception:
        earnings = []
    try:
        revenue = df_to_records(t.revenue_estimate)
    except Exception:
        revenue = []
    try:
        eps_trend = df_to_records(t.eps_trend)
    except Exception:
        eps_trend = []

    return {"symbol": symbol.upper(), "earnings_estimate": earnings, "revenue_estimate": revenue, "eps_trend": eps_trend}


def get_recommendations(symbol: str) -> dict:
    t = yf.Ticker(symbol)
    try:
        rec_df = t.recommendations
        recommendations = []
        if rec_df is not None and not rec_df.empty:
            for _, row in rec_df.iterrows():
                recommendations.append(
                    {
                        "period": row.get("period"),
                        "strong_buy": int(row.get("strongBuy", 0)),
                        "buy": int(row.get("buy", 0)),
                        "hold": int(row.get("hold", 0)),
                        "sell": int(row.get("sell", 0)),
                        "strong_sell": int(row.get("strongSell", 0)),
                    }
                )
    except Exception:
        recommendations = []

    try:
        targets = t.analyst_price_targets or {}
    except Exception:
        targets = {}

    return {"symbol": symbol.upper(), "recommendations": recommendations, "price_targets": targets}


# ── RV: relative valuation ─────────────────────────────────────────────────

def get_relative_valuation(symbols: list[str]) -> list[dict]:
    rows = []
    for symbol in symbols:
        try:
            t = yf.Ticker(symbol)
            info = t.info or {}
            rows.append(
                {
                    "symbol": symbol.upper(),
                    "name": info.get("longName") or info.get("shortName") or symbol.upper(),
                    "market_cap": info.get("marketCap"),
                    "trailing_pe": info.get("trailingPE"),
                    "forward_pe": info.get("forwardPE"),
                    "price_to_book": info.get("priceToBook"),
                    "ev_to_ebitda": info.get("enterpriseToEbitda"),
                    "ev_to_revenue": info.get("enterpriseToRevenue"),
                    "gross_margin_pct": (info.get("grossMargins") or 0) * 100 if info.get("grossMargins") is not None else None,
                    "operating_margin_pct": (info.get("operatingMargins") or 0) * 100 if info.get("operatingMargins") is not None else None,
                    "net_margin_pct": (info.get("profitMargins") or 0) * 100 if info.get("profitMargins") is not None else None,
                    "revenue_growth_pct": (info.get("revenueGrowth") or 0) * 100 if info.get("revenueGrowth") is not None else None,
                }
            )
        except Exception:
            rows.append({"symbol": symbol.upper(), "name": symbol.upper(), "error": True})
    return rows
