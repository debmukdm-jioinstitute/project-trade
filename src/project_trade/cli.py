"""project-trade CLI — Bloomberg-terminal-style toolkit for the terminal."""
from __future__ import annotations

import typer
from rich.console import Console
from rich.table import Table

from project_trade.core import dcf as dcf_core
from project_trade.core import market, news as news_core, portfolio as portfolio_core

app = typer.Typer(help="project-trade: DCF, deal analysis, quotes, movers, news, portfolio sim — in your terminal.")
console = Console()


def _color(value: float) -> str:
    return "green" if value >= 0 else "red"


@app.command()
def quote(symbol: str):
    """Live quote for a ticker."""
    q = market.get_quote(symbol)
    table = Table(title=f"{q.name} ({q.symbol})")
    table.add_column("Field")
    table.add_column("Value")
    table.add_row("Price", f"{q.price:,.2f}")
    table.add_row("Change", f"[{_color(q.change)}]{q.change:+.2f} ({q.change_pct:+.2f}%)[/]")
    table.add_row("Prev Close", f"{q.prev_close:,.2f}")
    table.add_row("Day Range", f"{q.day_low:,.2f} - {q.day_high:,.2f}")
    table.add_row("Volume", f"{q.volume:,}")
    if q.market_cap:
        table.add_row("Market Cap", f"{q.market_cap:,.0f}")
    if q.pe_ratio:
        table.add_row("P/E", f"{q.pe_ratio:.2f}")
    console.print(table)


@app.command()
def movers(category: str = typer.Argument("gainers", help="gainers | losers | active")):
    """Top market movers."""
    rows = market.get_movers(category)
    table = Table(title=f"Top {category}")
    table.add_column("Symbol")
    table.add_column("Name")
    table.add_column("Price", justify="right")
    table.add_column("Change %", justify="right")
    table.add_column("Volume", justify="right")
    for r in rows:
        chg = r["change_pct"] or 0
        table.add_row(
            r["symbol"],
            (r["name"] or "")[:30],
            f"{(r['price'] or 0):,.2f}",
            f"[{_color(chg)}]{chg:+.2f}%[/]",
            f"{(r['volume'] or 0):,}",
        )
    console.print(table)


@app.command()
def news(symbol: str, count: int = 8):
    """Latest headlines for a ticker."""
    items = news_core.get_news(symbol, count)
    table = Table(title=f"News: {symbol.upper()}")
    table.add_column("Published")
    table.add_column("Publisher")
    table.add_column("Title")
    for it in items:
        table.add_row(it["published"], it["publisher"], it["title"])
    console.print(table)
    for it in items:
        if it["link"]:
            console.print(f"  [dim]{it['title'][:60]}...[/] -> {it['link']}")


@app.command()
def dcf(
    symbol: str = typer.Argument(..., help="Ticker to auto-seed base FCF/debt/shares"),
    growth: float = typer.Option(0.08, help="Annual FCF growth during projection"),
    years: int = typer.Option(5, help="Projection horizon"),
    discount_rate: float = typer.Option(0.09, help="WACC"),
    terminal_growth: float = typer.Option(0.025, help="Perpetuity growth rate"),
    base_fcf: float = typer.Option(None, help="Override auto-fetched base FCF"),
):
    """Run a DCF valuation, auto-seeded from Yahoo Finance fundamentals."""
    seed = dcf_core.fetch_dcf_base_inputs(symbol)
    inputs = dcf_core.DCFInputs(
        base_fcf=base_fcf if base_fcf is not None else seed["base_fcf"],
        growth_rate=growth,
        years=years,
        discount_rate=discount_rate,
        terminal_growth=terminal_growth,
        net_debt=seed["net_debt"],
        shares_outstanding=seed["shares_outstanding"],
    )
    result = dcf_core.run_dcf(inputs)

    table = Table(title=f"DCF: {symbol.upper()}")
    table.add_column("Metric")
    table.add_column("Value", justify="right")
    table.add_row("Base FCF", f"{inputs.base_fcf:,.0f}")
    table.add_row("Enterprise Value", f"{result.enterprise_value:,.0f}")
    table.add_row("Net Debt", f"{inputs.net_debt:,.0f}")
    table.add_row("Equity Value", f"{result.equity_value:,.0f}")
    if result.implied_share_price:
        table.add_row("Implied Share Price", f"{result.implied_share_price:,.2f}")
    if seed.get("current_price"):
        table.add_row("Current Price", f"{seed['current_price']:,.2f}")
        if result.implied_share_price:
            upside = (result.implied_share_price / seed["current_price"] - 1) * 100
            table.add_row("Implied Upside", f"[{_color(upside)}]{upside:+.1f}%[/]")
    console.print(table)


portfolio_app = typer.Typer(help="Paper portfolio simulation.")
app.add_typer(portfolio_app, name="portfolio")


@portfolio_app.command("buy")
def portfolio_buy(symbol: str, qty: float, price: float = typer.Option(None, help="Override live price")):
    portfolio_core.buy(symbol, qty, price)
    console.print(f"[green]Bought {qty} {symbol.upper()}[/]")


@portfolio_app.command("sell")
def portfolio_sell(symbol: str, qty: float, price: float = typer.Option(None, help="Override live price")):
    portfolio_core.sell(symbol, qty, price)
    console.print(f"[red]Sold {qty} {symbol.upper()}[/]")


@portfolio_app.command("show")
def portfolio_show():
    summary = portfolio_core.get_summary()
    table = Table(title="Portfolio")
    table.add_column("Symbol")
    table.add_column("Qty", justify="right")
    table.add_column("Avg Cost", justify="right")
    table.add_column("Price", justify="right")
    table.add_column("Mkt Value", justify="right")
    table.add_column("Unrealized P&L", justify="right")
    table.add_column("Weight %", justify="right")
    for p in summary["positions"]:
        table.add_row(
            p["symbol"],
            f"{p['qty']:,.2f}",
            f"{p['avg_cost']:,.2f}",
            f"{p['price']:,.2f}",
            f"{p['market_value']:,.2f}",
            f"[{_color(p['unrealized_pnl'])}]{p['unrealized_pnl']:+,.2f} ({p['unrealized_pnl_pct']:+.1f}%)[/]",
            f"{p['weight_pct']:.1f}%",
        )
    console.print(table)
    console.print(f"Cash: {summary['cash']:,.2f}   Total Equity: {summary['total_equity']:,.2f}")


@portfolio_app.command("reset")
def portfolio_reset(cash: float = 100_000.0):
    portfolio_core.reset(cash)
    console.print(f"[yellow]Portfolio reset with {cash:,.2f} cash[/]")


@app.command()
def web(host: str = "127.0.0.1", port: int = 8000, reload: bool = False):
    """Launch the project-trade web app."""
    import uvicorn

    console.print(f"[bold cyan]Starting project-trade web app on http://{host}:{port}[/]")
    uvicorn.run("project_trade.web:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    app()
