"""Related-party transaction screener.

Pulls rows from tables on pages near the "Related Party" note and classifies
transaction nature. Loans, guarantees, investments and advances to related
parties are flagged as higher-risk — the classic vectors for value leakage.
"""
from __future__ import annotations

import re

from project_trade.core.statement_analyzer.extract import Page

RELATED_PARTY_HEADING = re.compile(r"related\s+part(y|ies)", re.IGNORECASE)

CATEGORY_KEYWORDS = [
    ("loan", ["loan given", "loan taken", "loan to", "loan from", "inter-corporate deposit", "icd given", "icd taken"]),
    ("guarantee", ["guarantee given", "guarantee received", "corporate guarantee", "collateral"]),
    ("investment", ["investment in", "investment made", "subscription to shares", "equity infusion"]),
    ("advance", ["advance given", "advance received", "advance to", "advance from"]),
    ("remuneration", ["remuneration", "managerial remuneration", "kmp compensation", "sitting fees", "commission to director"]),
    ("purchase_of_goods", ["purchase of goods", "purchase of material", "purchase of services"]),
    ("sale_of_goods", ["sale of goods", "sale of services", "sale of products"]),
    ("rent", ["rent paid", "rent received", "lease rent"]),
    ("sale_of_assets", ["sale of fixed assets", "sale of property", "sale of asset"]),
    ("dividend", ["dividend paid", "dividend received"]),
]
HIGH_RISK_CATEGORIES = {"loan", "guarantee", "investment", "advance"}

_NUMBER_RE = re.compile(r"^\(?-?[\d,]+\.?\d*\)?$")


def _parse_number(token: str) -> float | None:
    token = token.strip()
    if not token or not _NUMBER_RE.match(token):
        return None
    negative = token.startswith("(") and token.endswith(")")
    value = float(token.strip("()").replace(",", ""))
    return -value if negative else value


def _classify(text: str) -> str:
    low = text.lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(kw in low for kw in keywords):
            return category
    return "other"


def find_related_party_pages(pages: list[Page]) -> set[int]:
    hit_pages = set()
    for page in pages:
        if RELATED_PARTY_HEADING.search(page.text):
            hit_pages.update(range(page.number, page.number + 6))
    return hit_pages


def screen_related_party_transactions(pages: list[Page], tables: list[dict]) -> dict:
    relevant_pages = find_related_party_pages(pages)
    transactions = []

    for table in tables:
        if table["page"] not in relevant_pages:
            continue
        # a real RPT table has several rows and several columns; single-line or
        # narrow "tables" are usually text-strategy noise pulled from prose
        if len(table["rows"]) < 3:
            continue
        for row in table["rows"]:
            cells = [c.strip() if c else "" for c in row]
            if len(cells) < 3 or not any(cells):
                continue
            amounts = [v for c in cells if (v := _parse_number(c)) is not None]
            label_parts = [c for c in cells if c and _parse_number(c) is None]
            label = " | ".join(label_parts).strip()
            if not label or not amounts:
                continue
            transactions.append(
                {
                    "page": table["page"],
                    "label": label[:200],
                    "amount": amounts[0],
                    "category": _classify(label),
                }
            )

    for t in transactions:
        t["high_risk"] = t["category"] in HIGH_RISK_CATEGORIES

    by_category: dict[str, float] = {}
    for t in transactions:
        by_category[t["category"]] = by_category.get(t["category"], 0.0) + t["amount"]

    return {
        "transactions": transactions,
        "high_risk_transactions": [t for t in transactions if t["high_risk"]],
        "by_category": by_category,
        "note": "extraction relies on table detection — verify against the source note for completeness",
    }
