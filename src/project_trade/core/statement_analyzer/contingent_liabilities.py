"""Contingent liability tracker: tax disputes, corporate guarantees, restricted cash."""
from __future__ import annotations

import re

from project_trade.core.statement_analyzer.extract import Page

_NUMBER = r"\(?-?[\d,]+\.?\d*\)?"
ROW_RE = re.compile(rf"^(.{{3,100}}?)\s{{2,}}({_NUMBER})(?:\s+({_NUMBER}))?\s*$")

CL_HEADING = re.compile(r"contingent\s+liabilit", re.IGNORECASE)
STOP_HEADINGS = ["note ", "capital commitment", "significant accounting", "notes to"]

CATEGORY_KEYWORDS = [
    ("tax_dispute", [
        "income tax", "gst", "sales tax", "value added tax", "vat", "customs",
        "excise", "service tax", "entry tax", "tax demand", "tax matters",
    ]),
    ("corporate_guarantee", [
        "corporate guarantee", "guarantee given", "guarantee issued",
        "letter of guarantee", "bank guarantee",
    ]),
    ("legal_claims", ["litigation", "legal claim", "claims against", "suits", "arbitration"]),
]

RESTRICTED_CASH_KEYWORDS = [
    "restricted cash", "earmarked balances", "margin money", "balances held as security",
    "escrow account", "unpaid dividend account", "balances with banks held as",
]


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


def _score(window: str) -> int:
    return sum(1 for line in window.splitlines() if ROW_RE.match(line.strip()))


def _find_section(pages: list[Page], heading_re: re.Pattern, max_candidates: int = 8) -> str | None:
    best_window, best_score, checked = None, 0, 0
    for page in pages:
        m = heading_re.search(page.text)
        if not m:
            continue
        window = page.text[m.start():m.start() + 3000]
        end = len(window)
        for stop in STOP_HEADINGS:
            p = window.lower().find(stop, 50)
            if p != -1:
                end = min(end, p)
        window = window[:end]
        score = _score(window)
        if score > best_score:
            best_window, best_score = window, score
        checked += 1
        if checked >= max_candidates and best_score >= 2:
            return best_window
    return best_window


def find_contingent_liabilities(pages: list[Page]) -> list[dict]:
    section = _find_section(pages, CL_HEADING)
    if not section:
        return []
    items = []
    for line in section.splitlines():
        m = ROW_RE.match(line.strip())
        if not m:
            continue
        label = m.group(1).strip()
        amount = _parse_number(m.group(2))
        if amount is None or label.lower().startswith("total"):
            continue
        low = label.lower()
        category = "other"
        for cat, keywords in CATEGORY_KEYWORDS:
            if any(kw in low for kw in keywords):
                category = cat
                break
        items.append({"label": label, "amount": amount, "category": category})
    return items


def find_restricted_cash(pages: list[Page]) -> list[dict]:
    hits = []
    for page in pages:
        for line in page.text.splitlines():
            low = line.lower()
            if not any(kw in low for kw in RESTRICTED_CASH_KEYWORDS):
                continue
            m = ROW_RE.match(line.strip())
            amount = _parse_number(m.group(2)) if m else None
            hits.append({"page": page.number, "text": line.strip()[:200], "amount": amount})
    return hits


def track_contingent_liabilities(pages: list[Page]) -> dict:
    liabilities = find_contingent_liabilities(pages)
    restricted_cash = find_restricted_cash(pages)
    by_category: dict[str, float] = {}
    for item in liabilities:
        by_category[item["category"]] = by_category.get(item["category"], 0.0) + item["amount"]
    return {
        "contingent_liabilities": liabilities,
        "by_category": by_category,
        "total_contingent_liabilities": sum(by_category.values()),
        "restricted_cash_mentions": restricted_cash,
    }
