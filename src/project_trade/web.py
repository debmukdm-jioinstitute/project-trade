"""project-trade web app — same core logic as the CLI, served over HTTP."""
from __future__ import annotations

import datetime
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse

from project_trade.core import dcf as dcf_core
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
