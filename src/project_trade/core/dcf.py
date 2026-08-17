"""Discounted cash flow valuation — historical financials, CAPM/WACC-derived
discount rate, full year-by-year projection, and a sensitivity matrix."""
from __future__ import annotations

from dataclasses import dataclass, replace

import pandas as pd
import yfinance as yf

# Macro assumptions for CAPM when a live risk-free rate isn't fetched. Documented
# rather than hidden — these are the two numbers most likely to go stale.
DEFAULT_RISK_FREE_RATE = 0.045   # approx long-run US 10Y yield
DEFAULT_EQUITY_RISK_PREMIUM = 0.055
DEFAULT_TAX_RATE = 0.25


@dataclass
class DCFInputs:
    base_fcf: float          # most recent free cash flow
    growth_rate: float       # annual FCF growth during projection, e.g. 0.08
    years: int                # projection horizon, e.g. 5
    discount_rate: float      # WACC, e.g. 0.09
    terminal_growth: float    # perpetuity growth rate, e.g. 0.025
    net_debt: float = 0.0
    shares_outstanding: float = 0.0
    base_year: int | None = None


@dataclass
class ProjectionYear:
    year: int | None
    fcf: float
    discount_factor: float
    pv: float
    cumulative_pv: float


@dataclass
class DCFResult:
    projection: list[ProjectionYear]
    projected_fcf: list[float]      # kept for backward compatibility
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

    cumulative = 0.0
    projection = []
    for i, (cf, pv) in enumerate(zip(projected, pv_fcf)):
        cumulative += pv
        projection.append(
            ProjectionYear(
                year=(inputs.base_year + i + 1) if inputs.base_year else None,
                fcf=cf,
                discount_factor=1 / (1 + inputs.discount_rate) ** (i + 1),
                pv=pv,
                cumulative_pv=cumulative,
            )
        )

    return DCFResult(
        projection=projection,
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


def _row(df: pd.DataFrame, key: str, col) -> float | None:
    try:
        v = df.loc[key, col]
        return None if pd.isna(v) else float(v)
    except Exception:
        return None


def fetch_historical_financials(symbol: str, years: int = 5) -> list[dict]:
    """Last N fiscal years of revenue/EBITDA/EBIT/net income/FCF, oldest first,
    with year-over-year growth rates — the "past" half of the DCF picture."""
    t = yf.Ticker(symbol)
    try:
        inc = t.income_stmt
        cf = t.cashflow
    except Exception:
        return []

    if inc is None or inc.empty:
        return []

    rows = []
    for col in list(inc.columns)[:years]:
        rows.append(
            {
                "year": col.year if hasattr(col, "year") else str(col),
                "revenue": _row(inc, "Total Revenue", col),
                "ebitda": _row(inc, "EBITDA", col),
                "ebit": _row(inc, "EBIT", col),
                "net_income": _row(inc, "Net Income", col),
                "free_cash_flow": _row(cf, "Free Cash Flow", col) if cf is not None else None,
            }
        )
    rows.reverse()  # oldest first

    for i in range(1, len(rows)):
        for metric in ("revenue", "ebitda", "net_income", "free_cash_flow"):
            prev, cur = rows[i - 1][metric], rows[i][metric]
            growth_key = f"{metric}_growth_pct"
            rows[i][growth_key] = ((cur / prev - 1) * 100) if prev and cur else None

    return rows


def fetch_wacc_inputs(symbol: str) -> dict:
    """CAPM cost of equity + after-tax cost of debt, capital-weighted into WACC.
    Uses documented macro defaults (risk-free rate, equity risk premium) rather
    than a live bond feed — override discount_rate directly if you have better
    numbers."""
    t = yf.Ticker(symbol)
    info = t.info or {}

    beta = info.get("beta") or 1.0
    market_cap = info.get("marketCap") or 0.0
    total_debt = info.get("totalDebt") or 0.0

    interest_expense = None
    try:
        inc = t.income_stmt
        if inc is not None and not inc.empty and "Interest Expense" in inc.index:
            interest_expense = abs(_row(inc, "Interest Expense", inc.columns[0]) or 0.0)
    except Exception:
        pass

    cost_of_debt = (interest_expense / total_debt) if (interest_expense and total_debt) else 0.05
    tax_rate = DEFAULT_TAX_RATE
    risk_free_rate = DEFAULT_RISK_FREE_RATE
    equity_risk_premium = DEFAULT_EQUITY_RISK_PREMIUM
    cost_of_equity = risk_free_rate + beta * equity_risk_premium

    total_capital = market_cap + total_debt
    equity_weight = (market_cap / total_capital) if total_capital else 1.0
    debt_weight = (total_debt / total_capital) if total_capital else 0.0
    wacc = equity_weight * cost_of_equity + debt_weight * cost_of_debt * (1 - tax_rate)

    return {
        "beta": beta,
        "market_cap": market_cap,
        "total_debt": total_debt,
        "risk_free_rate": risk_free_rate,
        "equity_risk_premium": equity_risk_premium,
        "cost_of_equity": cost_of_equity,
        "cost_of_debt": cost_of_debt,
        "tax_rate": tax_rate,
        "equity_weight": equity_weight,
        "debt_weight": debt_weight,
        "wacc": wacc,
    }


def sensitivity_matrix(
    inputs: DCFInputs, discount_rates: list[float], terminal_growths: list[float]
) -> list[list[float | None]]:
    """Implied share price across a grid of discount-rate / terminal-growth
    assumptions — the standard DCF sensitivity table."""
    matrix = []
    for dr in discount_rates:
        row = []
        for tg in terminal_growths:
            if dr <= tg:
                row.append(None)
                continue
            try:
                result = run_dcf(replace(inputs, discount_rate=dr, terminal_growth=tg))
                row.append(result.implied_share_price)
            except Exception:
                row.append(None)
        matrix.append(row)
    return matrix
