"""Audit qualification and Key Audit Matter (KAM) flagging.

Auditors are required (SA 700/705/706, ISA 700/701) to state qualified/adverse/
disclaimer opinions and emphasis-of-matter paragraphs prominently — in practice
these are usually bolded. We anchor on both the required phrasing and styling.
"""
from __future__ import annotations

import re

from project_trade.core.statement_analyzer.extract import Page

QUALIFICATION_PATTERNS = [
    (r"qualified opinion", "qualified_opinion"),
    (r"adverse opinion", "adverse_opinion"),
    (r"disclaimer of opinion", "disclaimer_of_opinion"),
    (r"material uncertainty related to going concern", "going_concern"),
    (r"emphasis of matter", "emphasis_of_matter"),
    (r"except for the (?:possible )?effects?", "except_for_qualification"),
]

KAM_START = ["key audit matters", "key audit matter"]
KAM_END = [
    "information other than",
    "responsibilities of management",
    "responsibilities of the management",
    "auditor's responsibilities",
    "auditors' responsibilities",
    "report on other legal",
    "other matter",
]


def _tagged_text(pages: list[Page]) -> tuple[str, list[tuple[int, int]]]:
    parts, markers, offset = [], [], 0
    for p in pages:
        markers.append((offset, p.number))
        parts.append(p.text)
        offset += len(p.text) + 1
        parts.append("\n")
    return "".join(parts), markers


def _page_for_offset(markers: list[tuple[int, int]], offset: int) -> int:
    page = markers[0][1] if markers else 1
    for pos, num in markers:
        if pos <= offset:
            page = num
        else:
            break
    return page


def find_kams(pages: list[Page]) -> list[dict]:
    """Locate Key Audit Matters section(s). Filters out short table-of-contents
    style hits by requiring a substantial block of following text."""
    text, markers = _tagged_text(pages)
    lower = text.lower()
    kams: list[dict] = []
    idx = 0
    while True:
        pos = min(
            (p for kw in KAM_START if (p := lower.find(kw, idx)) != -1),
            default=-1,
        )
        if pos == -1:
            break
        end_pos = len(text)
        for kw in KAM_END:
            p = lower.find(kw, pos + 20)
            if p != -1:
                end_pos = min(end_pos, p)
        snippet = text[pos:end_pos].strip()
        if len(snippet) > 300:
            kams.append({"page": _page_for_offset(markers, pos), "snippet": snippet[:4000]})
            idx = end_pos
        else:
            idx = pos + 20
    return kams


def find_qualification_flags(pages: list[Page]) -> list[dict]:
    flags = []
    seen = set()
    for page in pages:
        for run in page.runs:
            low = run.text.lower()
            for pattern, tag in QUALIFICATION_PATTERNS:
                if re.search(pattern, low):
                    key = (page.number, tag)
                    if key in seen:
                        continue
                    seen.add(key)
                    flags.append(
                        {
                            "page": page.number,
                            "type": tag,
                            "styled": run.bold or run.italic,
                            "bold": run.bold,
                            "italic": run.italic,
                            "text": run.text[:400],
                        }
                    )
    return flags


def analyze_audit_report(pages: list[Page]) -> dict:
    return {
        "key_audit_matters": find_kams(pages),
        "qualification_flags": find_qualification_flags(pages),
    }
