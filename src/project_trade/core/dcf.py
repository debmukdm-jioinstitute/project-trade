"""Discounted cash flow valuation."""
from __future__ import annotations

from dataclasses import dataclass, field

import yfinance as yf


@dataclass
class DCFInputs:
    base_fcf: float          # most recent free cash flow
    growth_rate: float       # annual FCF growth during projection, e.g. 0.08
    years: int                # projection horizon, e.g. 5
    discount_rate: float      # WACC, e.g. 0.09
    terminal_growth: float    # perpetuity growth rate, e.g. 0.025
    net_debt: float = 0.0
    shares_outstanding: float = 0.0


@dataclass
class DCFResult:
    projected_fcf: list[float]
    pv_fcf: list[float]
    terminal_value: float
    pv_terminal_value: float
    enterprise_value: float
    equity_value: float
    implied_share_price: float | None


def run_dcf(inputs: DCFInputs) -> DCFResult:
    if inputs.discount_rate <= inputs.terminal_growth:
        raise ValueError("discount_rate must exceed terminal_growth")

    projected = []
    fcf = inputs.base_fcf
    for _ in range(inputs.years):
        fcf = fcf * (1 + inputs.growth_rate)
        projected.append(fcf)

    pv_fcf = [
        cf / (1 + inputs.discount_rate) ** (i + 1) for i, cf in enumerate(projected)
    ]

    terminal_value = (
        projected[-1] * (1 + inputs.terminal_growth)
        / (inputs.discount_rate - inputs.terminal_growth)
    )
    pv_terminal_value = terminal_value / (1 + inputs.discount_rate) ** inputs.years

    enterprise_value = sum(pv_fcf) + pv_terminal_value
    equity_value = enterprise_value - inputs.net_debt

    implied_price = (
        equity_value / inputs.shares_outstanding if inputs.shares_outstanding else None
    )

    return DCFResult(
        projected_fcf=projected,
        pv_fcf=pv_fcf,
        terminal_value=terminal_value,
        pv_terminal_value=pv_terminal_value,
        enterprise_value=enterprise_value,
        equity_value=equity_value,
        implied_share_price=implied_price,
    )


def fetch_dcf_base_inputs(symbol: str) -> dict:
    """Pull base FCF, net debt, shares outstanding from Yahoo Finance to seed a DCF."""
    t = yf.Ticker(symbol)
    info = t.info or {}

    fcf = info.get("freeCashflow")
    if not fcf:
        try:
            cf = t.cashflow
            op_cf = cf.loc["Operating Cash Flow"].iloc[0]
            capex = cf.loc["Capital Expenditure"].iloc[0]
            fcf = float(op_cf) + float(capex)  # capex is negative in yfinance
        except Exception:
            fcf = 0.0

    total_debt = info.get("totalDebt") or 0.0
    cash = info.get("totalCash") or 0.0
    net_debt = float(total_debt) - float(cash)

    return {
        "base_fcf": float(fcf or 0.0),
        "net_debt": net_debt,
        "shares_outstanding": float(info.get("sharesOutstanding") or 0.0),
        "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
    }
