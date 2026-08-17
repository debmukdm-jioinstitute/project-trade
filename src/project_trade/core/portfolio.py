"""Simple JSON-persisted paper portfolio: buy/sell, P&L, weights."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from project_trade.core.market import get_quote

DATA_DIR = Path.home() / ".project_trade"
PORTFOLIO_FILE = DATA_DIR / "portfolio.json"


@dataclass
class Lot:
    qty: float
    cost_basis: float  # price paid per share


def _load_raw() -> dict:
    if not PORTFOLIO_FILE.exists():
        return {"cash": 100_000.0, "positions": {}}
    return json.loads(PORTFOLIO_FILE.read_text())


def _save_raw(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PORTFOLIO_FILE.write_text(json.dumps(data, indent=2))


def buy(symbol: str, qty: float, price: float | None = None) -> dict:
    symbol = symbol.upper()
    data = _load_raw()
    price = price if price is not None else get_quote(symbol).price
    cost = qty * price
    if cost > data["cash"]:
        raise ValueError(f"insufficient cash: need {cost:.2f}, have {data['cash']:.2f}")

    pos = data["positions"].get(symbol, {"qty": 0.0, "avg_cost": 0.0})
    new_qty = pos["qty"] + qty
    pos["avg_cost"] = (pos["qty"] * pos["avg_cost"] + cost) / new_qty
    pos["qty"] = new_qty
    data["positions"][symbol] = pos
    data["cash"] -= cost
    _save_raw(data)
    return data


def sell(symbol: str, qty: float, price: float | None = None) -> dict:
    symbol = symbol.upper()
    data = _load_raw()
    pos = data["positions"].get(symbol)
    if not pos or pos["qty"] < qty:
        raise ValueError(f"cannot sell {qty} {symbol}: not enough held")

    price = price if price is not None else get_quote(symbol).price
    proceeds = qty * price
    pos["qty"] -= qty
    if pos["qty"] <= 0:
        del data["positions"][symbol]
    else:
        data["positions"][symbol] = pos
    data["cash"] += proceeds
    _save_raw(data)
    return data


def get_summary() -> dict:
    data = _load_raw()
    positions = []
    total_market_value = 0.0
    for symbol, pos in data["positions"].items():
        try:
            price = get_quote(symbol).price
        except Exception:
            price = pos["avg_cost"]
        market_value = pos["qty"] * price
        unrealized_pnl = market_value - pos["qty"] * pos["avg_cost"]
        total_market_value += market_value
        positions.append(
            {
                "symbol": symbol,
                "qty": pos["qty"],
                "avg_cost": pos["avg_cost"],
                "price": price,
                "market_value": market_value,
                "unrealized_pnl": unrealized_pnl,
                "unrealized_pnl_pct": (unrealized_pnl / (pos["qty"] * pos["avg_cost"]) * 100)
                if pos["avg_cost"]
                else 0.0,
            }
        )

    total_equity = data["cash"] + total_market_value
    for p in positions:
        p["weight_pct"] = (p["market_value"] / total_equity * 100) if total_equity else 0.0

    return {
        "cash": data["cash"],
        "positions": positions,
        "total_market_value": total_market_value,
        "total_equity": total_equity,
    }


def reset(starting_cash: float = 100_000.0) -> dict:
    data = {"cash": starting_cash, "positions": {}}
    _save_raw(data)
    return data
