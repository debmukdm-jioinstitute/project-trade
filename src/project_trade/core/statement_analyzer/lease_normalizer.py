"""IFRS 16 / Ind AS 116 lease EBITDA normalizer.

Under IFRS 16, operating lease rent moves out of opex and reappears as
depreciation on the right-of-use (ROU) asset plus interest on the lease
liability — both below the EBITDA line. This inflates reported EBITDA versus
the pre-IFRS16 world, which matters most for lease-heavy sectors (airlines,
restaurants, retail). We reverse that uplift: pre-IFRS16 EBITDA = reported
EBITDA - ROU depreciation - lease interest.
"""
from __future__ import annotations

import re

from project_trade.core.statement_analyzer.extract import Page

_NUMBER = r"\(?-?[\d,]+\.?\d*\)?"
ROW_RE = re.compile(rf"^(.{{3,90}}?)\s{{2,}}({_NUMBER})(?:\s+({_NUMBER}))?\s*$")

ROU_DEPRECIATION_KEYWORDS = [
    "depreciation on right-of-use", "depreciation of right-of-use",
    "depreciation on right of use", "amortisation of right-of-use",
    "depreciation - right-of-use", "depreciation on rou asset",
]
LEASE_INTEREST_KEYWORDS = [
    "interest on lease liabilit", "finance cost on lease",
    "interest expense on lease liabilit", "interest cost on lease",
]
LEASE_LIABILITY_KEYWORDS = ["lease liabilit"]

EBITDA_RE = re.compile(r"EBITDA[^\d\n]{0,25}?(" + _NUMBER + r")", re.IGNORECASE)


def _parse_number(token: str | None) -> float | None:
    if not token:
        return None
    token = token.strip()
    negative = token.startswith("(") and token.endswith(")")
    token = token.strip("()").replace(",", "")
    if not token or not re.match(r"^-?\d+\.?\d*$", token):
        return None
    value = float(token)
    return -value if negative else value


def _sum_matching_rows(pages: list[Page], keywords: list[str]) -> tuple[float | None, list[dict]]:
    matches = []
    for page in pages:
        for line in page.text.splitlines():
            low = line.lower()
            if not any(kw in low for kw in keywords):
                continue
            m = ROW_RE.match(line.strip())
            if not m:
                continue
            value = _parse_number(m.group(2))
            if value is None:
                continue
            matches.append({"page": page.number, "label": m.group(1).strip(), "amount": value})
    total = sum(m["amount"] for m in matches) if matches else None
    return total, matches


def _find_reported_ebitda(pages: list[Page]) -> dict | None:
    for page in pages:
        m = EBITDA_RE.search(page.text)
        if m:
            value = _parse_number(m.group(1))
            if value is not None:
                return {"page": page.number, "value": value, "context": page.text[max(0, m.start() - 60):m.end() + 20].replace("\n", " ").strip()}
    return None


def normalize_lease_ebitda(pages: list[Page]) -> dict:
    rou_dep_total, rou_dep_matches = _sum_matching_rows(pages, ROU_DEPRECIATION_KEYWORDS)
    lease_int_total, lease_int_matches = _sum_matching_rows(pages, LEASE_INTEREST_KEYWORDS)
    lease_liab_total, lease_liab_matches = _sum_matching_rows(pages, LEASE_LIABILITY_KEYWORDS)
    reported_ebitda = _find_reported_ebitda(pages)

    ifrs16_uplift = None
    pre_ifrs16_ebitda = None
    uplift_pct = None
    if rou_dep_total is not None or lease_int_total is not None:
        ifrs16_uplift = (rou_dep_total or 0.0) + (lease_int_total or 0.0)
        if reported_ebitda:
            pre_ifrs16_ebitda = reported_ebitda["value"] - ifrs16_uplift
            if reported_ebitda["value"]:
                uplift_pct = ifrs16_uplift / reported_ebitda["value"] * 100

    return {
        "rou_depreciation": rou_dep_total,
        "rou_depreciation_sources": rou_dep_matches,
        "lease_interest": lease_int_total,
        "lease_interest_sources": lease_int_matches,
        "lease_liability_mentions": lease_liab_matches,
        "reported_ebitda": reported_ebitda,
        "ifrs16_ebitda_uplift": ifrs16_uplift,
        "ifrs16_uplift_pct_of_ebitda": uplift_pct,
        "pre_ifrs16_ebitda_estimate": pre_ifrs16_ebitda,
        "note": "reported_ebitda is a best-effort text match — verify against the MD&A figure before relying on pre_ifrs16_ebitda_estimate",
    }
