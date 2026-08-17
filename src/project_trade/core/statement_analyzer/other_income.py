"""Other income decomposer: split the "Other Income" note into forex gains,
interest income, tax-refund interest, and one-off/non-recurring items."""
from __future__ import annotations

import re

from project_trade.core.statement_analyzer.extract import Page

CATEGORY_KEYWORDS = [
    ("tax_refund_interest", [
        "interest on income tax refund", "interest on refund of income tax",
        "interest on tax refund", "income tax refund",
    ]),
    ("forex", [
        "foreign exchange", "forex", "exchange gain", "exchange fluctuation",
        "exchange rate variation", "net gain on foreign currency",
    ]),
    ("interest_income", [
        "interest income", "interest on deposit", "interest on investment",
        "interest on fixed deposit", "interest on bank deposit", "interest on loan",
        "interest received", "interest earned",
    ]),
    ("one_off", [
        "profit on sale", "gain on sale", "profit on disposal", "gain on disposal",
        "provision written back", "provision no longer required",
        "liabilities no longer required", "liabilities written back",
        "excess provision", "insurance claim", "bad debts recovered",
        "sundry balances written back", "government grant", "duty drawback",
    ]),
    ("dividend_income", ["dividend income", "dividend received"]),
]

NOTE_HEADING = re.compile(r"other\s+income", re.IGNORECASE)
_NUMBER = r"\(?-?[\d,]+\.?\d*\)?"
ROW_RE = re.compile(rf"^(.{{3,80}}?)\s{{2,}}({_NUMBER})(?:\s+({_NUMBER}))?\s*$")

STOP_HEADINGS = [
    "note ", "other expenses", "finance costs", "employee benefit",
    "significant accounting", "notes to",
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
    """Count how many lines look like real note line items — the real note
    beats prose mentions (accounting policy text, MD&A commentary, TOC refs)."""
    return sum(1 for line in window.splitlines() if ROW_RE.match(line.strip()))


def _find_note_section(pages: list[Page], max_candidates: int = 8) -> str | None:
    best_window, best_score = None, 0
    checked = 0
    for page in pages:
        for match in NOTE_HEADING.finditer(page.text):
            start = match.start()
            window = page.text[start:start + 3000]
            if not re.search(r"interest|forex|exchange|dividend|profit on sale", window, re.IGNORECASE):
                continue
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
            if checked >= max_candidates and best_score >= 3:
                return best_window
    return best_window


def decompose_other_income(pages: list[Page]) -> dict:
    section = _find_note_section(pages)
    if not section:
        return {"found": False, "line_items": [], "by_category": {}, "total": 0.0}

    line_items = []
    for line in section.splitlines():
        m = ROW_RE.match(line.strip())
        if not m:
            continue
        label = m.group(1).strip()
        current = _parse_number(m.group(2))
        prior = _parse_number(m.group(3))
        if current is None or label.lower().startswith("total"):
            continue
        category = "uncategorized"
        low = label.lower()
        for cat, keywords in CATEGORY_KEYWORDS:
            if any(kw in low for kw in keywords):
                category = cat
                break
        line_items.append(
            {"label": label, "current_year": current, "prior_year": prior, "category": category}
        )

    by_category: dict[str, float] = {}
    for item in line_items:
        by_category[item["category"]] = by_category.get(item["category"], 0.0) + item["current_year"]

    total = sum(by_category.values())
    one_off_pct = (by_category.get("one_off", 0.0) / total * 100) if total else 0.0

    return {
        "found": True,
        "line_items": line_items,
        "by_category": by_category,
        "total": total,
        "one_off_pct_of_other_income": one_off_pct,
    }
