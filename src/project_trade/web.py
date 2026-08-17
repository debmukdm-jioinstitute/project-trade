"""project-trade web app — same core logic as the CLI, served over HTTP."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from project_trade.core import dcf as dcf_core
from project_trade.core import market, news as news_core, portfolio as portfolio_core

BASE_DIR = Path(__file__).parent

app = FastAPI(title="project-trade")

static_dir = BASE_DIR / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

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


@app.get("/api/news/{symbol}")
def api_news(symbol: str, count: int = 8):
    return news_core.get_news(symbol, count)


@app.get("/api/dcf/{symbol}")
def api_dcf(
    symbol: str,
    growth: float = 0.08,
    years: int = 5,
    discount_rate: float = 0.09,
    terminal_growth: float = 0.025,
):
    seed = dcf_core.fetch_dcf_base_inputs(symbol)
    inputs = dcf_core.DCFInputs(
        base_fcf=seed["base_fcf"],
        growth_rate=growth,
        years=years,
        discount_rate=discount_rate,
        terminal_growth=terminal_growth,
        net_debt=seed["net_debt"],
        shares_outstanding=seed["shares_outstanding"],
    )
    result = dcf_core.run_dcf(inputs)
    return {
        "symbol": symbol.upper(),
        "seed": seed,
        "enterprise_value": result.enterprise_value,
        "equity_value": result.equity_value,
        "implied_share_price": result.implied_share_price,
        "terminal_value": result.terminal_value,
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
