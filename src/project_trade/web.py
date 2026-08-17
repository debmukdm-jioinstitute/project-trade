"""project-trade web app — same core logic as the CLI, served over HTTP."""
from __future__ import annotations

import datetime
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse

from project_trade.core import dcf as dcf_core
from project_trade.core import equity_research as eq
from project_trade.core import google_news, indices, market, news as news_core, portfolio as portfolio_core
from project_trade.core.statement_analyzer import report as statement_report

BASE_DIR = Path(__file__).parent

app = FastAPI(title="project-trade")

_INDEX_HTML = (BASE_DIR / "templates" / "index.html").read_text()


@app.get("/", response_class=HTMLResponse)
def dashboard():
    return _INDEX_HTML


@app.get("/api/quote/{symbol}")
def api_quote(symbol: str):
    q = market.get_quote(symbol)
    return q.__dict__


@app.get("/api/movers/{category}")
def api_movers(category: str):
    return market.get_movers(category)


@app.get("/api/search/{query}")
def api_search(query: str, count: int = 8):
    return market.search_symbols(query, count)


@app.get("/api/news/{symbol}")
def api_news(symbol: str, count: int = 8):
    return news_core.get_news(symbol, count)


@app.get("/api/googlenews/{query}")
def api_google_news(query: str, count: int = 8):
    return google_news.get_google_news(query, count)


@app.get("/api/indices/nifty50")
def api_nifty50():
    return [{"symbol": s, "name": n, "yahoo": indices.yahoo_symbol(s)} for s, n in indices.NIFTY50]


@app.get("/api/indices/sensex30")
def api_sensex30():
    return [{"symbol": s, "name": n, "yahoo": indices.yahoo_symbol(s)} for s, n in indices.SENSEX30]


TICKER_STRIP = [
    {"key": "nifty50", "symbol": "^NSEI", "label": "NIFTY 50"},
    {"key": "sensex30", "symbol": "^BSESN", "label": "SENSEX 30"},
    {"key": "usdinr", "symbol": "INR=X", "label": "USD/INR"},
    # yfinance has no free MCX feed; COMEX gold futures (USD/oz) is the honest
    # free substitute — labeled accordingly rather than mislabeled as MCX.
    {"key": "gold", "symbol": "GC=F", "label": "GOLD (COMEX)"},
]

HEATMAP_SYMBOLS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN"]

WATCHLIST = [
    {"key": "nifty50", "symbol": "^NSEI", "label": "NIFTY 50"},
    {"key": "sensex30", "symbol": "^BSESN", "label": "SENSEX 30"},
    {"key": "banknifty", "symbol": "^NSEBANK", "label": "BANK NIFTY"},
    {"key": "reliance", "symbol": "RELIANCE.NS", "label": "RELIANCE"},
    {"key": "tcs", "symbol": "TCS.NS", "label": "TCS"},
]


@app.get("/api/ticker-strip")
def api_ticker_strip():
    results = []
    for item in TICKER_STRIP:
        try:
            q = market.get_quote(item["symbol"])
            hist = market.get_history(item["symbol"], period="1d", interval="15m")
            spark = [round(float(v), 4) for v in hist["Close"].dropna().tolist()] if not hist.empty else []
        except Exception:
            q, spark = None, []
        results.append(
            {
                "key": item["key"],
                "label": item["label"],
                "symbol": item["symbol"],
                "price": q.price if q else None,
                "change_pct": q.change_pct if q else None,
                "spark": spark,
            }
        )
    return results


@app.get("/api/heatmap")
def api_heatmap():
    results = []
    for sym in HEATMAP_SYMBOLS:
        try:
            q = market.get_quote(indices.yahoo_symbol(sym))
            results.append({"symbol": sym, "price": q.price, "change_pct": q.change_pct})
        except Exception:
            results.append({"symbol": sym, "price": None, "change_pct": None})
    return results


@app.get("/api/watchlist")
def api_watchlist():
    results = []
    for item in WATCHLIST:
        try:
            q = market.get_quote(item["symbol"])
            results.append({"key": item["key"], "label": item["label"], "price": q.price, "change_pct": q.change_pct})
        except Exception:
            results.append({"key": item["key"], "label": item["label"], "price": None, "change_pct": None})
    return results


@app.get("/api/dcf/{symbol}")
def api_dcf(
    symbol: str,
    growth: float = 0.08,
    years: int = 5,
    discount_rate: float | None = None,
    terminal_growth: float = 0.025,
):
    """Full detailed DCF: historical financials (past), WACC/CAPM breakdown and
    current fundamentals (present), year-by-year projection and a sensitivity
    matrix (future) — not just the summary numbers."""
    seed = dcf_core.fetch_dcf_base_inputs(symbol)
    wacc_inputs = dcf_core.fetch_wacc_inputs(symbol)
    historical = dcf_core.fetch_historical_financials(symbol)

    effective_discount_rate = discount_rate if discount_rate is not None else wacc_inputs["wacc"]
    base_year = datetime.date.today().year

    inputs = dcf_core.DCFInputs(
        base_fcf=seed["base_fcf"],
        growth_rate=growth,
        years=years,
        discount_rate=effective_discount_rate,
        terminal_growth=terminal_growth,
        net_debt=seed["net_debt"],
        shares_outstanding=seed["shares_outstanding"],
        base_year=base_year,
    )
    result = dcf_core.run_dcf(inputs)

    step = 0.01
    discount_rates = [round(effective_discount_rate + i * step, 4) for i in (-2, -1, 0, 1, 2)]
    terminal_growths = [round(terminal_growth + i * 0.005, 4) for i in (-2, -1, 0, 1, 2)]
    sensitivity = dcf_core.sensitivity_matrix(inputs, discount_rates, terminal_growths)

    implied_upside = None
    if result.implied_share_price and seed.get("current_price"):
        implied_upside = (result.implied_share_price / seed["current_price"] - 1) * 100

    return {
        "symbol": symbol.upper(),
        "seed": seed,
        "historical": historical,
        "wacc": wacc_inputs,
        "assumptions": {
            "base_fcf": inputs.base_fcf,
            "growth_rate": growth,
            "years": years,
            "discount_rate": effective_discount_rate,
            "discount_rate_is_wacc": discount_rate is None,
            "terminal_growth": terminal_growth,
            "net_debt": seed["net_debt"],
            "shares_outstanding": seed["shares_outstanding"],
            "base_year": base_year,
        },
        "projection": [
            {
                "year": p.year,
                "fcf": p.fcf,
                "discount_factor": p.discount_factor,
                "pv": p.pv,
                "cumulative_pv": p.cumulative_pv,
            }
            for p in result.projection
        ],
        "terminal_value": result.terminal_value,
        "pv_terminal_value": result.pv_terminal_value,
        "enterprise_value": result.enterprise_value,
        "equity_value": result.equity_value,
        "implied_share_price": result.implied_share_price,
        "current_price": seed.get("current_price"),
        "implied_upside_pct": implied_upside,
        "sensitivity": {
            "discount_rates": discount_rates,
            "terminal_growths": terminal_growths,
            "matrix": sensitivity,
        },
    }


@app.get("/api/portfolio")
def api_portfolio_show():
    return portfolio_core.get_summary()


@app.post("/api/portfolio/buy")
def api_portfolio_buy(symbol: str = Form(...), qty: float = Form(...)):
    return portfolio_core.buy(symbol, qty)


@app.post("/api/portfolio/sell")
def api_portfolio_sell(symbol: str = Form(...), qty: float = Form(...)):
    return portfolio_core.sell(symbol, qty)


@app.post("/api/portfolio/reset")
def api_portfolio_reset(cash: float = Form(100_000.0)):
    return portfolio_core.reset(cash)


@app.post("/api/analyze")
async def api_analyze(file: UploadFile = File(...)):
    """Financial statement analyzer — accepts an annual report PDF, returns the
    full flag report. Large reports (300+ pages) can take a minute or two."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        return statement_report.analyze(tmp_path)
    finally:
        os.unlink(tmp_path)


# ── Bloomberg-style equity research functions (WEI/MOV/DES/GP/FA/EE/ANR/RV) ──

@app.get("/api/wei")
def api_wei():
    return eq.get_world_indices()


@app.get("/api/mov/{index_key}")
def api_mov(index_key: str, range: str = "1d", top_n: int = 10):
    return eq.get_index_movers(index_key, range, top_n)


@app.get("/api/des/{symbol}")
def api_des(symbol: str):
    return eq.get_company_description(symbol)


@app.get("/api/gp/price")
def api_gp_price(symbols: str, period: str = "1y", interval: str = "1d"):
    """symbols is a comma-separated list, e.g. 'AAPL,MSFT'."""
    result = {}
    for symbol in symbols.split(","):
        symbol = symbol.strip()
        if symbol:
            result[symbol] = eq.get_price_series(symbol, period, interval)
    return result


@app.get("/api/gp/technicals")
def api_gp_technicals(symbols: str, period: str = "1y", interval: str = "1d"):
    closes_by_symbol = {}
    out = {}
    for symbol in symbols.split(","):
        symbol = symbol.strip()
        if not symbol:
            continue
        series = eq.get_price_series(symbol, period, interval)
        closes = [p["close"] for p in series]
        closes_by_symbol[symbol] = closes
        drawdowns, max_dd = eq.max_drawdown_series(closes)
        out[symbol] = {
            "dates": [p["date"] for p in series],
            "sma20": eq.sma(closes, 20),
            "sma50": eq.sma(closes, 50),
            "sma200": eq.sma(closes, 200),
            "drawdown": drawdowns,
            "max_drawdown_pct": max_dd,
            "fibonacci": eq.fibonacci_levels(closes),
        }
    out["_correlation"] = eq.correlation_matrix(closes_by_symbol)
    return out


@app.get("/api/fa/{symbol}")
def api_fa(symbol: str, quarterly: bool = False):
    stmts = eq.get_financial_statements(symbol, quarterly)
    stmts["kpi"] = eq.get_kpi_ratios(symbol)
    return stmts


@app.get("/api/ee/{symbol}")
def api_ee(symbol: str):
    return eq.get_estimates(symbol)


@app.get("/api/anr/{symbol}")
def api_anr(symbol: str):
    return eq.get_recommendations(symbol)


@app.get("/api/rv")
def api_rv(symbols: str):
    return eq.get_relative_valuation([s.strip() for s in symbols.split(",") if s.strip()])
