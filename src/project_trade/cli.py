"""project-trade CLI — Bloomberg-terminal-style toolkit for the terminal.

Command bodies are kept as thin wrappers around plain `_xxx()` functions with
ordinary Python defaults. Typer's `typer.Option`/`typer.Argument` sentinels
only resolve to real values when Typer itself parses argv — calling a
decorated command function directly (as the interactive menu needs to) would
otherwise hand back the unresolved sentinel object instead of the default.
"""
from __future__ import annotations

import json
import signal
import time

import questionary
import typer
from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table

from project_trade.core import dcf as dcf_core
from project_trade.core import google_news, indices, market, news as news_core, portfolio as portfolio_core
from project_trade.core.statement_analyzer import report as statement_report

app = typer.Typer(
    help="project-trade: DCF, deal analysis, quotes, movers, news, portfolio sim — in your terminal.",
    invoke_without_command=True,
)
console = Console()

MENU_STYLE = questionary.Style([
    ("qmark", "fg:#ff9f0a bold"),
    ("question", "bold"),
    ("pointer", "fg:#ff9f0a bold"),
    ("highlighted", "fg:#ff9f0a bold"),
    ("selected", "fg:#3ddc84"),
])


@app.callback()
def main(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        _main_menu()


def _color(value: float) -> str:
    return "green" if value >= 0 else "red"


def _pause():
    questionary.text("Press Enter to return to the menu...", style=MENU_STYLE).ask()


# ── Quote ──────────────────────────────────────────────────────────────────

def _quote(symbol: str):
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
def quote(symbol: str):
    """Live quote for a ticker."""
    _quote(symbol)


# ── Movers ─────────────────────────────────────────────────────────────────

def _movers(category: str = "gainers"):
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
def movers(category: str = typer.Argument("gainers", help="gainers | losers | active")):
    """Top market movers."""
    _movers(category)


# ── News (Yahoo ticker news + free Google News RSS) ─────────────────────────

def _news(symbol: str, count: int = 8):
    items = news_core.get_news(symbol, count)
    table = Table(title=f"Yahoo News: {symbol.upper()}")
    table.add_column("Published")
    table.add_column("Publisher")
    table.add_column("Title")
    for it in items:
        table.add_row(it["published"], it["publisher"], it["title"])
    console.print(table)
    for it in items:
        if it["link"]:
            console.print(f"  [dim]{it['title'][:60]}...[/] -> {it['link']}")


def _google_news(query: str, count: int = 10):
    items = google_news.get_google_news(query, count)
    table = Table(title=f"Google News: {query}")
    table.add_column("Published")
    table.add_column("Source")
    table.add_column("Title")
    for it in items:
        table.add_row(it["published"], it["source"], it["title"])
    console.print(table)
    for it in items:
        if it["link"]:
            console.print(f"  [dim]{it['title'][:60]}...[/] -> {it['link']}")


@app.command()
def news(symbol: str, count: int = 8):
    """Latest Yahoo Finance headlines for a ticker."""
    _news(symbol, count)


@app.command()
def googlenews(query: str, count: int = 10):
    """Free Google News RSS search — no API key needed."""
    _google_news(query, count)


def _news_combined(symbol: str, company_name: str | None = None):
    _news(symbol)
    console.print()
    _google_news(company_name or symbol)


# ── DCF ────────────────────────────────────────────────────────────────────

def _dcf(
    symbol: str,
    growth: float = 0.08,
    years: int = 5,
    discount_rate: float | None = None,
    terminal_growth: float = 0.025,
    base_fcf: float | None = None,
):
    import datetime

    seed = dcf_core.fetch_dcf_base_inputs(symbol)
    wacc_inputs = dcf_core.fetch_wacc_inputs(symbol)
    historical = dcf_core.fetch_historical_financials(symbol)
    effective_discount_rate = discount_rate if discount_rate is not None else wacc_inputs["wacc"]

    inputs = dcf_core.DCFInputs(
        base_fcf=base_fcf if base_fcf is not None else seed["base_fcf"],
        growth_rate=growth,
        years=years,
        discount_rate=effective_discount_rate,
        terminal_growth=terminal_growth,
        net_debt=seed["net_debt"],
        shares_outstanding=seed["shares_outstanding"],
        base_year=datetime.date.today().year,
    )
    result = dcf_core.run_dcf(inputs)

    console.rule(f"[bold]DCF: {symbol.upper()}[/]")

    # ── Past ──
    if historical:
        hist_table = Table(title="Historical Financials (Past)")
        hist_table.add_column("Year")
        hist_table.add_column("Revenue", justify="right")
        hist_table.add_column("Rev Growth", justify="right")
        hist_table.add_column("EBITDA", justify="right")
        hist_table.add_column("Net Income", justify="right")
        hist_table.add_column("Free Cash Flow", justify="right")
        for row in historical:
            growth_pct = row.get("revenue_growth_pct")
            hist_table.add_row(
                str(row["year"]),
                f"{row['revenue']:,.0f}" if row["revenue"] else "-",
                f"[{_color(growth_pct)}]{growth_pct:+.1f}%[/]" if growth_pct is not None else "-",
                f"{row['ebitda']:,.0f}" if row["ebitda"] else "-",
                f"{row['net_income']:,.0f}" if row["net_income"] else "-",
                f"{row['free_cash_flow']:,.0f}" if row["free_cash_flow"] else "-",
            )
        console.print(hist_table)

    # ── Present: WACC / CAPM ──
    wacc_table = Table(title="WACC / CAPM (Present)")
    wacc_table.add_column("Component")
    wacc_table.add_column("Value", justify="right")
    wacc_table.add_row("Beta", f"{wacc_inputs['beta']:.2f}")
    wacc_table.add_row("Risk-Free Rate", f"{wacc_inputs['risk_free_rate']*100:.2f}%")
    wacc_table.add_row("Equity Risk Premium", f"{wacc_inputs['equity_risk_premium']*100:.2f}%")
    wacc_table.add_row("Cost of Equity", f"{wacc_inputs['cost_of_equity']*100:.2f}%")
    wacc_table.add_row("Cost of Debt (after-tax)", f"{wacc_inputs['cost_of_debt']*(1-wacc_inputs['tax_rate'])*100:.2f}%")
    wacc_table.add_row("Equity Weight", f"{wacc_inputs['equity_weight']*100:.1f}%")
    wacc_table.add_row("Debt Weight", f"{wacc_inputs['debt_weight']*100:.1f}%")
    wacc_table.add_row("WACC", f"[bold]{wacc_inputs['wacc']*100:.2f}%[/]")
    if discount_rate is not None:
        wacc_table.add_row("Discount Rate Used (override)", f"{effective_discount_rate*100:.2f}%")
    console.print(wacc_table)

    # ── Future: year-by-year projection ──
    proj_table = Table(title=f"Projection — {growth*100:.1f}% growth, {years}y (Future)")
    proj_table.add_column("Year")
    proj_table.add_column("FCF", justify="right")
    proj_table.add_column("Discount Factor", justify="right")
    proj_table.add_column("PV of FCF", justify="right")
    proj_table.add_column("Cumulative PV", justify="right")
    for p in result.projection:
        proj_table.add_row(
            str(p.year) if p.year else "-",
            f"{p.fcf:,.0f}",
            f"{p.discount_factor:.3f}",
            f"{p.pv:,.0f}",
            f"{p.cumulative_pv:,.0f}",
        )
    console.print(proj_table)

    # ── Valuation summary ──
    table = Table(title="Valuation Summary")
    table.add_column("Metric")
    table.add_column("Value", justify="right")
    table.add_row("Base FCF", f"{inputs.base_fcf:,.0f}")
    table.add_row("Sum PV of FCF", f"{sum(result.pv_fcf):,.0f}")
    table.add_row("Terminal Value", f"{result.terminal_value:,.0f}")
    table.add_row("PV of Terminal Value", f"{result.pv_terminal_value:,.0f}")
    table.add_row("Enterprise Value", f"[bold]{result.enterprise_value:,.0f}[/]")
    table.add_row("Net Debt", f"{inputs.net_debt:,.0f}")
    table.add_row("Equity Value", f"[bold]{result.equity_value:,.0f}[/]")
    if result.implied_share_price:
        table.add_row("Implied Share Price", f"[bold]{result.implied_share_price:,.2f}[/]")
    if seed.get("current_price"):
        table.add_row("Current Price", f"{seed['current_price']:,.2f}")
        if result.implied_share_price:
            upside = (result.implied_share_price / seed["current_price"] - 1) * 100
            table.add_row("Implied Upside", f"[{_color(upside)}]{upside:+.1f}%[/]")
    console.print(table)

    # ── Sensitivity ──
    step = 0.01
    discount_rates = [round(effective_discount_rate + i * step, 4) for i in (-2, -1, 0, 1, 2)]
    terminal_growths = [round(terminal_growth + i * 0.005, 4) for i in (-2, -1, 0, 1, 2)]
    matrix = dcf_core.sensitivity_matrix(inputs, discount_rates, terminal_growths)
    sens_table = Table(title="Sensitivity: Implied Share Price (rows=discount rate, cols=terminal growth)")
    sens_table.add_column("WACC \\ g")
    for tg in terminal_growths:
        sens_table.add_column(f"{tg*100:.1f}%", justify="right")
    for dr, row in zip(discount_rates, matrix):
        sens_table.add_row(
            f"{dr*100:.1f}%",
            *[f"{v:,.2f}" if v is not None else "-" for v in row],
        )
    console.print(sens_table)


@app.command()
def dcf(
    symbol: str = typer.Argument(..., help="Ticker to auto-seed base FCF/debt/shares"),
    growth: float = typer.Option(0.08, help="Annual FCF growth during projection"),
    years: int = typer.Option(5, help="Projection horizon"),
    discount_rate: float = typer.Option(None, help="WACC override — auto-computed via CAPM if omitted"),
    terminal_growth: float = typer.Option(0.025, help="Perpetuity growth rate"),
    base_fcf: float = typer.Option(None, help="Override auto-fetched base FCF"),
):
    """Detailed DCF valuation: historical financials, CAPM/WACC, full year-by-year
    projection, and a sensitivity matrix — auto-seeded from Yahoo Finance."""
    _dcf(symbol, growth, years, discount_rate, terminal_growth, base_fcf)


# ── Portfolio ────────────────────────────────────────────────────────────

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


def _portfolio_show():
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


@portfolio_app.command("show")
def portfolio_show():
    _portfolio_show()


@portfolio_app.command("reset")
def portfolio_reset(cash: float = 100_000.0):
    portfolio_core.reset(cash)
    console.print(f"[yellow]Portfolio reset with {cash:,.2f} cash[/]")


# ── Live movers/portfolio dashboard ─────────────────────────────────────────

def _build_dashboard() -> Layout:
    layout = Layout()
    layout.split_column(
        Layout(
            Panel(
                "[bold cyan]project-trade[/] — live dashboard   "
                "[dim](Ctrl+C to exit back to the menu)[/]",
            ),
            size=3,
        ),
        Layout(name="body"),
    )
    layout["body"].split_row(Layout(name="gainers"), Layout(name="losers"), Layout(name="portfolio"))

    def movers_table(title: str, rows: list[dict]) -> Table:
        t = Table(title=title)
        t.add_column("Sym")
        t.add_column("Price", justify="right")
        t.add_column("Chg %", justify="right")
        for r in rows:
            chg = r["change_pct"] or 0
            t.add_row(r["symbol"], f"{(r['price'] or 0):,.2f}", f"[{_color(chg)}]{chg:+.2f}%[/]")
        return t

    try:
        layout["gainers"].update(movers_table("Top Gainers", market.get_movers("gainers", count=8)))
    except Exception as e:
        layout["gainers"].update(Panel(f"[red]movers unavailable: {e}[/]"))

    try:
        layout["losers"].update(movers_table("Top Losers", market.get_movers("losers", count=8)))
    except Exception as e:
        layout["losers"].update(Panel(f"[red]movers unavailable: {e}[/]"))

    try:
        summary = portfolio_core.get_summary()
        if summary["positions"]:
            pf = Table(title=f"Portfolio (Equity {summary['total_equity']:,.0f})")
            pf.add_column("Sym")
            pf.add_column("Qty", justify="right")
            pf.add_column("P&L", justify="right")
            for p in summary["positions"][:8]:
                pf.add_row(p["symbol"], f"{p['qty']:.2f}", f"[{_color(p['unrealized_pnl'])}]{p['unrealized_pnl']:+,.2f}[/]")
            layout["portfolio"].update(pf)
        else:
            layout["portfolio"].update(
                Panel("[dim]No positions[/]\n\nbuy: project-trade portfolio buy SYM QTY", title="Portfolio")
            )
    except Exception as e:
        layout["portfolio"].update(Panel(f"[red]portfolio unavailable: {e}[/]"))

    return layout


def _run_dashboard(refresh: int = 30):
    # Installs its own SIGINT handler rather than relying on the default
    # KeyboardInterrupt propagation: when launched from the questionary menu,
    # prompt_toolkit's prior prompt session can leave SIGINT handling in a
    # state where the default translation no longer reaches this loop,
    # killing the whole process instead of just returning to the menu.
    stop = {"flag": False}

    def _handler(signum, frame):
        stop["flag"] = True

    old_handler = signal.signal(signal.SIGINT, _handler)
    try:
        with Live(_build_dashboard(), console=console, screen=True, refresh_per_second=1) as live:
            elapsed = 0
            while not stop["flag"]:
                time.sleep(1)
                elapsed += 1
                if stop["flag"]:
                    break
                if elapsed >= refresh:
                    live.update(_build_dashboard())
                    elapsed = 0
    finally:
        signal.signal(signal.SIGINT, old_handler)


@app.command()
def dashboard(refresh: int = typer.Option(30, help="Refresh interval in seconds")):
    """Live terminal dashboard: top movers + your portfolio."""
    _run_dashboard(refresh)


# ── Financial Statement Analyzer ────────────────────────────────────────────

def _analyze(pdf_path: str, json_out: str | None = None):
    with console.status(f"[bold cyan]Parsing {pdf_path}...[/]"):
        result = statement_report.analyze(pdf_path)

    console.rule(f"[bold]{pdf_path}[/] ({result['page_count']} pages)")

    audit = result["audit"]
    kam_count = len(audit["key_audit_matters"])
    qual_count = len(audit["qualification_flags"])
    console.print(Panel(
        f"Key Audit Matters found: {kam_count}\nQualification/going-concern flags: {qual_count}",
        title="Audit Report",
    ))
    for flag in audit["qualification_flags"]:
        style = "bold red" if flag["styled"] else "yellow"
        console.print(f"  [{style}]p{flag['page']} ({flag['type']})[/{style}] {flag['text'][:150]}")

    oi = result["other_income"]
    if oi["found"]:
        table = Table(title="Other Income Decomposition")
        table.add_column("Category")
        table.add_column("Amount", justify="right")
        for cat, amt in oi["by_category"].items():
            table.add_row(cat, f"{amt:,.2f}")
        console.print(table)
        console.print(f"  One-off share of other income: {oi['one_off_pct_of_other_income']:.1f}%")
    else:
        console.print("[dim]Other Income note not found[/]")

    rq = result["revenue_quality"]
    console.print(Panel(
        f"Customer concentration mentions: {len(rq['customer_concentration'])}\n"
        f"Constant-currency mentions: {len(rq['constant_currency_mentions'])}\n"
        f"Cutoff-risk language hits: {len(rq['cutoff_risk_language'])}",
        title="Revenue Quality",
    ))

    lease = result["lease_ifrs16"]
    lease_table = Table(title="IFRS16 Lease EBITDA Normalization")
    lease_table.add_column("Metric")
    lease_table.add_column("Value", justify="right")
    lease_table.add_row("ROU Depreciation", f"{lease['rou_depreciation']:,.2f}" if lease["rou_depreciation"] else "-")
    lease_table.add_row("Lease Interest", f"{lease['lease_interest']:,.2f}" if lease["lease_interest"] else "-")
    lease_table.add_row("Reported EBITDA (best-effort)", f"{lease['reported_ebitda']['value']:,.2f}" if lease["reported_ebitda"] else "-")
    lease_table.add_row("Pre-IFRS16 EBITDA (est.)", f"{lease['pre_ifrs16_ebitda_estimate']:,.2f}" if lease["pre_ifrs16_ebitda_estimate"] else "-")
    console.print(lease_table)

    cl = result["contingent_liabilities"]
    console.print(Panel(
        f"Total contingent liabilities (extracted): {cl['total_contingent_liabilities']:,.2f}\n"
        f"By category: {cl['by_category']}\n"
        f"Restricted cash mentions: {len(cl['restricted_cash_mentions'])}",
        title="Contingent Liabilities",
    ))

    rpt = result["related_party"]
    console.print(Panel(
        f"Transactions found: {len(rpt['transactions'])}\n"
        f"High-risk (loan/guarantee/investment/advance): {len(rpt['high_risk_transactions'])}",
        title="Related Party Screen",
    ))

    if json_out:
        with open(json_out, "w") as f:
            json.dump(result, f, indent=2, default=str)
        console.print(f"[green]Full report written to {json_out}[/]")


@app.command()
def analyze(
    pdf_path: str = typer.Argument(..., help="Path to an annual report PDF"),
    json_out: str = typer.Option(None, "--json", help="Write full report as JSON to this path"),
):
    """Financial statement analyzer: audit flags, other-income decomposition,
    revenue quality, IFRS16 lease normalization, contingent liabilities, RPT screen."""
    _analyze(pdf_path, json_out)


# ── Web ──────────────────────────────────────────────────────────────────

@app.command()
def web(host: str = "127.0.0.1", port: int = 8000, reload: bool = False):
    """Launch the project-trade web app."""
    import uvicorn

    console.print(f"[bold cyan]Starting project-trade web app on http://{host}:{port}[/]")
    uvicorn.run("project_trade.web:app", host=host, port=port, reload=reload)


# ── Interactive welcome menu ─────────────────────────────────────────────

BANNER = """[bold #ff9f0a]
 ____            _           _        _____              _
|  _ \\ _ __ ___ (_) ___  ___| |_     |_   _| __ __ _  __| | ___
| |_) | '__/ _ \\| |/ _ \\/ __| __|_____ | || '__/ _` |/ _` |/ _ \\
|  __/| | | (_) | |  __/ (__| ||_____|| || | | (_| | (_| |  __/
|_|   |_|  \\___// |\\___|\\___|\\__|     |_||_|  \\__,_|\\__,_|\\___|
              |__/
[/][dim]Bloomberg-terminal-style toolkit — DCF, statements, quotes, news, portfolio[/]"""

EXIT_CHOICE = "🚪  Exit"

MAIN_CHOICES = [
    "📊  Live Market Dashboard (movers)",
    "💰  Stock Quote",
    "📈  DCF Valuation",
    "🇮🇳  Nifty 50 Stocks",
    "🇮🇳  Sensex 30 Stocks",
    "📉  Market Movers",
    "📰  News (Yahoo + Google RSS)",
    "💼  Portfolio",
    "📄  Financial Statement Analyzer",
    "🌐  Launch Web Dashboard",
    EXIT_CHOICE,
]


def _ask_symbol(default: str = "AAPL") -> str | None:
    return questionary.text("Ticker symbol:", default=default, style=MENU_STYLE).ask()


def _menu_quote():
    symbol = _ask_symbol()
    if not symbol:
        return
    try:
        _quote(symbol)
    except Exception as e:
        console.print(f"[red]error: {e}[/]")
    _pause()


def _menu_dcf():
    symbol = _ask_symbol()
    if not symbol:
        return
    growth = questionary.text("Growth rate (e.g. 0.08):", default="0.08", style=MENU_STYLE).ask()
    years = questionary.text("Projection years:", default="5", style=MENU_STYLE).ask()
    discount = questionary.text("Discount rate / WACC (e.g. 0.09):", default="0.09", style=MENU_STYLE).ask()
    try:
        _dcf(symbol, float(growth), int(years), float(discount))
    except Exception as e:
        console.print(f"[red]error: {e}[/]")
    _pause()


def _menu_movers():
    category = questionary.select(
        "Category:", choices=["gainers", "losers", "active"], style=MENU_STYLE
    ).ask()
    if not category:
        return
    try:
        _movers(category)
    except Exception as e:
        console.print(f"[red]error: {e}[/]")
    _pause()


def _menu_news():
    query = questionary.text("Symbol or company name:", default="AAPL", style=MENU_STYLE).ask()
    if not query:
        return
    try:
        _news_combined(query)
    except Exception as e:
        console.print(f"[red]error: {e}[/]")
    _pause()


def _menu_portfolio():
    action = questionary.select(
        "Portfolio:",
        choices=["Show", "Buy", "Sell", "Reset", "🔙 Back"],
        style=MENU_STYLE,
    ).ask()
    if not action or action == "🔙 Back":
        return
    try:
        if action == "Show":
            _portfolio_show()
        elif action == "Buy":
            symbol = _ask_symbol()
            qty = questionary.text("Quantity:", default="1", style=MENU_STYLE).ask()
            if symbol and qty:
                portfolio_core.buy(symbol, float(qty))
                console.print(f"[green]Bought {qty} {symbol.upper()}[/]")
        elif action == "Sell":
            symbol = _ask_symbol()
            qty = questionary.text("Quantity:", default="1", style=MENU_STYLE).ask()
            if symbol and qty:
                portfolio_core.sell(symbol, float(qty))
                console.print(f"[red]Sold {qty} {symbol.upper()}[/]")
        elif action == "Reset":
            cash = questionary.text("Starting cash:", default="100000", style=MENU_STYLE).ask()
            if cash:
                portfolio_core.reset(float(cash))
                console.print(f"[yellow]Portfolio reset with {float(cash):,.2f} cash[/]")
    except Exception as e:
        console.print(f"[red]error: {e}[/]")
    _pause()


def _menu_analyze():
    pdf_path = questionary.path("Annual report PDF path:", style=MENU_STYLE).ask()
    if not pdf_path:
        return
    try:
        _analyze(pdf_path)
    except Exception as e:
        console.print(f"[red]error: {e}[/]")
    _pause()


def _menu_web():
    console.print("[cyan]Starting web app on http://127.0.0.1:8000 — Ctrl+C to stop and return here[/]")
    try:
        web(host="127.0.0.1", port=8000, reload=False)
    except KeyboardInterrupt:
        pass
    except SystemExit:
        pass


def _index_stock_picker(constituents: list[tuple[str, str]]):
    choice = questionary.select(
        "Pick a stock:",
        choices=[f"{sym} — {name}" for sym, name in constituents] + ["🔙 Back"],
        style=MENU_STYLE,
    ).ask()
    if not choice or choice == "🔙 Back":
        return
    nse_symbol = choice.split(" — ")[0]
    company_name = choice.split(" — ", 1)[1]
    yahoo_sym = indices.yahoo_symbol(nse_symbol)

    action = questionary.select(
        f"{nse_symbol} — {company_name}:",
        choices=["Quote", "DCF Valuation", "News", "🔙 Back"],
        style=MENU_STYLE,
    ).ask()
    if not action or action == "🔙 Back":
        return
    try:
        if action == "Quote":
            _quote(yahoo_sym)
        elif action == "DCF Valuation":
            _dcf(yahoo_sym)
        elif action == "News":
            _news_combined(yahoo_sym, company_name)
    except Exception as e:
        console.print(f"[red]error: {e}[/]")
    _pause()


def _main_menu():
    console.print(Panel(BANNER, border_style="#ff9f0a"))
    while True:
        choice = questionary.select(
            "Select a module:", choices=MAIN_CHOICES, style=MENU_STYLE
        ).ask()
        if not choice or choice == EXIT_CHOICE:
            console.print("[dim]Goodbye.[/]")
            break

        if choice.startswith("📊"):
            _run_dashboard(refresh=15)
        elif choice.startswith("💰"):
            _menu_quote()
        elif choice.startswith("📈"):
            _menu_dcf()
        elif choice.startswith("🇮🇳  Nifty"):
            _index_stock_picker(indices.NIFTY50)
        elif choice.startswith("🇮🇳  Sensex"):
            _index_stock_picker(indices.SENSEX30)
        elif choice.startswith("📉"):
            _menu_movers()
        elif choice.startswith("📰"):
            _menu_news()
        elif choice.startswith("💼"):
            _menu_portfolio()
        elif choice.startswith("📄"):
            _menu_analyze()
        elif choice.startswith("🌐"):
            _menu_web()


@app.command()
def menu():
    """Interactive welcome menu — same as running `project-trade` with no arguments."""
    _main_menu()


if __name__ == "__main__":
    app()
