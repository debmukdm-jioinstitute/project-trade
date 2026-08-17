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
project-trade quote AAPL
project-trade movers gainers        # gainers | losers | active
project-trade news AAPL
project-trade dcf AAPL --growth 0.08 --years 5 --discount-rate 0.09
project-trade portfolio buy AAPL 10
project-trade portfolio show
```

## Run — Web

```bash
project-trade web --port 8000
```

Then open http://127.0.0.1:8000.

Both front ends share the same core logic in `src/project_trade/core/`
(`market.py`, `dcf.py`, `news.py`, `portfolio.py`) — anything added there is
instantly available from both the CLI and the web dashboard.

## Roadmap

- Deal analysis (comps, precedent transactions)
- Excel/DCF model import
- Historical price charts in CLI (Textual) and web
