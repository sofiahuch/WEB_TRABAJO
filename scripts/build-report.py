"""Build docs/informe-tecnico.pdf from its Markdown source.

Requires Python 3 and reportlab: python -m pip install reportlab
"""
from html import escape
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
import reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/informe-tecnico.md"
OUTPUT = ROOT / "docs/informe-tecnico.pdf"
BLUE = colors.HexColor("#243fba")
font_dir = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("ReportSans", str(font_dir / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("ReportSansBold", str(font_dir / "VeraBd.ttf")))
pdfmetrics.registerFontFamily("ReportSans", normal="ReportSans", bold="ReportSansBold")
styles = getSampleStyleSheet()
styles.add(ParagraphStyle("ReportTitle", fontName="ReportSansBold", fontSize=27,
                          leading=32, textColor=BLUE, spaceAfter=13))
styles.add(ParagraphStyle("ReportHeading", fontName="ReportSansBold", fontSize=12,
                          leading=17, textColor=BLUE, spaceBefore=12,
                          spaceAfter=8, keepWithNext=True))
styles.add(ParagraphStyle("ReportBody", fontName="ReportSans", fontSize=9.8,
                          leading=14, spaceAfter=7, alignment=TA_LEFT))
styles.add(ParagraphStyle("ReportCell", fontName="ReportSans", fontSize=8.5,
                          leading=11.8, spaceAfter=0))
styles.add(ParagraphStyle("ReportCellHead", parent=styles["ReportCell"],
                          fontName="ReportSansBold", textColor=BLUE))
styles.add(ParagraphStyle("ReportReference", parent=styles["ReportBody"],
                          fontSize=8.7, leading=13))


def inline(text):
    safe = escape(text)
    safe = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", safe)
    safe = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', safe)
    return safe


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#dfe3e8"))
    canvas.line(20 * mm, 17 * mm, 190 * mm, 17 * mm)
    canvas.setFont("ReportSans", 8)
    canvas.setFillColor(colors.HexColor("#626a7a"))
    canvas.drawString(20 * mm, 12 * mm, "Entretiempo | Programación de Servidores Web")
    canvas.drawRightString(190 * mm, 12 * mm, str(doc.page))
    canvas.restoreState()


def build():
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story = []
    index = 0
    width = 170 * mm
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("# "):
            story.append(Paragraph(inline(line[2:]), styles["ReportTitle"]))
        elif line.startswith("## "):
            story.append(Paragraph(inline(line[3:]), styles["ReportHeading"]))
        elif line.startswith("|"):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                row = lines[index].strip()
                if not re.fullmatch(r"[|\s:-]+", row):
                    rows.append([cell.strip() for cell in row.strip("|").split("|")])
                index += 1
            count = len(rows[0])
            widths = [width * .27, width * .73] if count == 2 else [width * .22, width * .28, width * .5]
            cells = [[Paragraph(inline(cell), styles["ReportCellHead" if row == 0 else "ReportCell"])
                      for cell in values] for row, values in enumerate(rows)]
            table = Table(cells, colWidths=widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf0fc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, -1), .4, colors.HexColor("#dfe3e8")),
            ]))
            story.extend([table, Spacer(1, 8)])
            continue
        elif line.startswith("- "):
            story.append(Paragraph(inline(line[2:]), styles["ReportReference"], bulletText="-"))
        else:
            paragraph = [line]
            while index + 1 < len(lines) and lines[index + 1].strip() and not lines[index + 1].startswith(("#", "|", "- ")):
                index += 1
                paragraph.append(lines[index].strip())
            story.append(Paragraph(inline(" ".join(paragraph)), styles["ReportBody"]))
        index += 1
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=(210 * mm, 297 * mm),
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=19 * mm, bottomMargin=24 * mm,
                            title="Entretiempo - Informe técnico", author="Equipo Entretiempo")
    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
