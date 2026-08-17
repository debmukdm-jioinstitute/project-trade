"""Revenue quality flags: customer concentration, constant-currency reporting,
cutoff-risk language."""
from __future__ import annotations

import re

from project_trade.core.statement_analyzer.extract import Page

CONCENTRATION_PATTERNS = [
    re.compile(r"(top|largest|single)\s+(?:\d+\s+)?customers?[^.\n]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%", re.IGNORECASE),
    re.compile(r"(\d{1,3}(?:\.\d+)?)\s*%[^.\n]{0,80}?(revenue|turnover)[^.\n]{0,40}?(top|largest|single)\s+(?:\d+\s+)?customers?", re.IGNORECASE),
]

CUTOFF_KEYWORDS = [
    "cut-off", "cut off", "cutoff", "revenue recognition", "bill and hold",
    "channel stuffing", "percentage of completion", "stage of completion",
]


def _context(text: str, start: int, end: int, pad: int = 120) -> str:
    return text[max(0, start - pad):min(len(text), end + pad)].strip().replace("\n", " ")


def find_customer_concentration(pages: list[Page]) -> list[dict]:
    hits = []
    for page in pages:
        for pattern in CONCENTRATION_PATTERNS:
            for m in pattern.finditer(page.text):
                pct = next((g for g in m.groups() if re.match(r"^\d", g or "")), None)
                hits.append(
                    {
                        "page": page.number,
                        "percent": float(pct) if pct else None,
                        "context": _context(page.text, m.start(), m.end()),
                    }
                )
    return hits


def find_constant_currency_mentions(pages: list[Page]) -> list[dict]:
    hits = []
    for page in pages:
        for m in re.finditer(r"constant currency", page.text, re.IGNORECASE):
            hits.append({"page": page.number, "context": _context(page.text, m.start(), m.end())})
    return hits


def find_cutoff_risk_language(pages: list[Page]) -> list[dict]:
    hits = []
    seen = set()
    for page in pages:
        low = page.text.lower()
        for kw in CUTOFF_KEYWORDS:
            for m in re.finditer(re.escape(kw), low):
                key = (page.number, kw)
                if key in seen:
                    continue
                seen.add(key)
                hits.append(
                    {
                        "page": page.number,
                        "keyword": kw,
                        "context": _context(page.text, m.start(), m.end()),
                    }
                )
    return hits


def analyze_revenue_quality(pages: list[Page]) -> dict:
    return {
        "customer_concentration": find_customer_concentration(pages),
        "constant_currency_mentions": find_constant_currency_mentions(pages),
        "cutoff_risk_language": find_cutoff_risk_language(pages),
    }
