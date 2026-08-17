# project-trade

Bloomberg-terminal-style finance toolkit — DCF valuation, market quotes, movers, news,
and paper-portfolio simulation. One Python core, two front ends: a terminal CLI and a
web dashboard. Market data is free (Yahoo Finance via `yfinance`), no API key required.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Run — Terminal

```bash
project-trade
```

Bare invocation launches an interactive welcome menu — pick a module with the
arrow keys (DCF, quotes, movers, news, portfolio, Nifty 50 / Sensex 30 stock
pickers, the financial statement analyzer, or the live dashboard). It loops
back to the menu after each action; `Exit` or `Ctrl+C` quits.

Every module is also a direct command, for scripting or muscle memory:

```bash
project-trade quote AAPL
project-trade quote RELIANCE.NS            # NSE tickers: SYMBOL.NS
project-trade movers gainers               # gainers | losers | active
project-trade news AAPL                    # Yahoo Finance ticker news
project-trade googlenews "Reliance Industries"   # free Google News RSS, no API key
project-trade dcf AAPL --growth 0.08 --years 5 --discount-rate 0.09
project-trade portfolio buy AAPL 10
project-trade portfolio show
project-trade dashboard                    # live movers + portfolio, refreshing
```

## Run — Web

```bash
project-trade web --port 8000
```

Then open http://127.0.0.1:8000.

Both front ends share the same core logic in `src/project_trade/core/`
(`market.py`, `dcf.py`, `news.py`, `portfolio.py`) — anything added there is
instantly available from both the CLI and the web dashboard.

## Command bar (web) — Bloomberg-style function codes

The web dashboard's top-bar search recognizes Bloomberg-terminal-style
function codes — type a code alone, or `TICKER CODE` / `CODE TICKER`
(e.g. `AAPL DES`, `RV TCS`) to jump straight to that function loaded for
that security. Press Enter or click a dropdown result.

**Equity Market Navigation**
- `WEI` — world equity indices by region (Americas / Europe / Asia-Pacific)
- `MOV` — index constituent movers, customizable time range (1d–1y)
- `DES` — company snapshot: overview, key stats, news, sub-tabs
- `GP` — multi-security price chart, SMA 20/50/200, Fibonacci retracement,
  drawdown, correlation matrix, click-a-date for news
- `TECH` — formulas/explanations for the indicators actually computed here

**Fundamental & Estimate Analysis**
- `FA` — income statement / balance sheet / cash flow, quarterly or annual,
  plus a custom KPI/margin tab
- `EE` / `EEO` — Yahoo-aggregated consensus EPS and revenue estimates
- `ANR` — analyst buy/sell recommendation distribution + 12-month price targets
- `RV` — relative valuation, customizable peer comp set

`EEB` (per-broker estimate breakdown) is intentionally shown as unavailable
rather than faked — that level of detail is institutional data exclusive to
paid terminals (Bloomberg, Refinitiv, Capital IQ); no free API provides it.
Likewise, GP's "click a date for news" shows raw headlines only — there's no
LLM wired into this app, so no AI summary is offered.

## Financial Statement Analyzer

Text-mines an annual report PDF for forensic-accounting-style red flags:

```bash
project-trade analyze /path/to/annual-report.pdf --json out.json
```

or via the web dashboard's "Financial Statement Analyzer" upload panel.

- **Audit report parser** — Key Audit Matters, plus qualified/adverse/disclaimer
  opinions and going-concern language, with bold/italic styling captured
- **Other income decomposer** — splits the Other Income note into forex,
  interest income, tax-refund interest, one-offs, dividends
- **Revenue quality flags** — customer concentration %, constant-currency
  mentions, cutoff-risk language
- **IFRS16 / Ind AS 116 lease EBITDA normalizer** — reverses the lease-accounting
  EBITDA uplift (ROU depreciation + lease interest) back to a pre-IFRS16 estimate
- **Contingent liability tracker** — tax disputes, corporate guarantees,
  restricted cash
- **Related-party transaction screener** — classifies RPT note line items,
  flags loans/guarantees/investments/advances as high-risk

This is heuristic text-mining over inconsistently formatted PDFs, not a
guaranteed-correct parser — always verify flagged items against the source
document. Table and section extraction quality varies a lot with each report's
PDF layout (scanned/image pages and heavily columnar layouts extract worst).

## Roadmap

- Deal analysis (comps, precedent transactions)
- Excel/DCF model import
- Historical price charts in CLI (Textual) and web
