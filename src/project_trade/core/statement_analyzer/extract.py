"""PDF extraction: styled text runs (for bold/italic detection) and tables."""
from __future__ import annotations

from dataclasses import dataclass

import pymupdf as fitz
import pdfplumber

BOLD_FLAG = 1 << 4
ITALIC_FLAG = 1 << 1


@dataclass
class TextRun:
    page: int          # 1-indexed
    text: str
    bold: bool
    italic: bool


@dataclass
class Page:
    number: int         # 1-indexed
    text: str
    runs: list[TextRun]


def _span_is_bold(span: dict) -> bool:
    flags = span.get("flags", 0)
    font = (span.get("font") or "").lower()
    return bool(flags & BOLD_FLAG) or "bold" in font


def _span_is_italic(span: dict) -> bool:
    flags = span.get("flags", 0)
    font = (span.get("font") or "").lower()
    return bool(flags & ITALIC_FLAG) or "italic" in font or "oblique" in font


def extract_pages(pdf_path: str) -> list[Page]:
    """Extract per-page plain text plus style-coalesced text runs.

    Consecutive spans on the same line sharing bold/italic style are merged into
    one run, so a bolded sentence reads as a single run rather than word-by-word.
    """
    doc = fitz.open(pdf_path)
    pages: list[Page] = []
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            raw = page.get_text("dict")
            runs: list[TextRun] = []
            plain_parts: list[str] = []
            current_text = ""
            current_bold = None
            current_italic = None

            for block in raw.get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "")
                        if not text.strip():
                            continue
                        plain_parts.append(text)
                        bold = _span_is_bold(span)
                        italic = _span_is_italic(span)
                        if bold == current_bold and italic == current_italic:
                            current_text += text
                        else:
                            if current_text.strip():
                                runs.append(
                                    TextRun(page_index + 1, current_text.strip(), current_bold, current_italic)
                                )
                            current_text = text
                            current_bold = bold
                            current_italic = italic
                    plain_parts.append("\n")
                if current_text.strip():
                    runs.append(
                        TextRun(page_index + 1, current_text.strip(), current_bold, current_italic)
                    )
                current_text = ""
                current_bold = None
                current_italic = None

            pages.append(Page(number=page_index + 1, text="".join(plain_parts), runs=runs))
    finally:
        doc.close()
    return pages


_LINE_STRATEGY = {"vertical_strategy": "lines", "horizontal_strategy": "lines"}
_TEXT_STRATEGY = {"vertical_strategy": "text", "horizontal_strategy": "text"}


def extract_tables(pdf_path: str) -> list[dict]:
    """Return every extractable table as {page, rows}. Tries ruling-line detection
    first, then falls back to whitespace/text alignment — many financial-statement
    note tables have no visible borders. Best-effort either way."""
    tables = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            found = page.extract_tables(_LINE_STRATEGY) or []
            if not found:
                try:
                    found = page.extract_tables(_TEXT_STRATEGY) or []
                except Exception:
                    found = []
            for table in found:
                rows = [row for row in table if any(cell for cell in row)]
                if rows:
                    tables.append({"page": page_index + 1, "rows": rows})
    return tables


def full_text(pages: list[Page]) -> str:
    return "\n".join(p.text for p in pages)
