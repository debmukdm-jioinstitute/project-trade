"""Orchestrates the full financial statement analysis over one PDF."""
from __future__ import annotations

from project_trade.core.statement_analyzer import audit, contingent_liabilities, lease_normalizer
from project_trade.core.statement_analyzer import other_income, related_party, revenue_quality
from project_trade.core.statement_analyzer.extract import extract_pages, extract_tables


def analyze(pdf_path: str) -> dict:
    pages = extract_pages(pdf_path)
    tables = extract_tables(pdf_path)

    return {
        "source": pdf_path,
        "page_count": len(pages),
        "audit": audit.analyze_audit_report(pages),
        "other_income": other_income.decompose_other_income(pages),
        "revenue_quality": revenue_quality.analyze_revenue_quality(pages),
        "lease_ifrs16": lease_normalizer.normalize_lease_ebitda(pages),
        "contingent_liabilities": contingent_liabilities.track_contingent_liabilities(pages),
        "related_party": related_party.screen_related_party_transactions(pages, tables),
    }
