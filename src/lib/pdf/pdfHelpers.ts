import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import { BOWLER_HAT, ALLTRU, REPORT_TITLE } from "../brand";
import { loadImageAsDataUrl } from "./loadImage";

export const PAGE = { width: 595.28, height: 841.89, margin: 40 }; // A4 in points
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
export const PAGE_BOTTOM = PAGE.height - 46;

const INK: [number, number, number] = [20, 24, 38];
const MUTED: [number, number, number] = [110, 120, 145];
const LINE: [number, number, number] = [225, 228, 236];

export function newDoc(): jsPDF {
  return new jsPDF({ unit: "pt", format: "a4" });
}

export function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  if (cursorY + needed > PAGE_BOTTOM) {
    doc.addPage();
    return PAGE.margin;
  }
  return cursorY;
}

// Draws the co-branded header used on the cover page of both reports. Falls
// back to text wordmarks if the logo images fail to load for any reason
// (e.g. offline build preview) rather than leaving a blank gap.
export async function drawCoverBrandHeader(doc: jsPDF, targetUrl: string, generatedAt: string): Promise<number> {
  let y = PAGE.margin;

  const [bowlerHatImg, alltruImg] = await Promise.all([
    loadImageAsDataUrl(BOWLER_HAT.logoUrl),
    loadImageAsDataUrl(ALLTRU.logoUrl),
  ]);

  const logoH = 28;
  if (bowlerHatImg) {
    const w = logoH * BOWLER_HAT.logoAspect;
    doc.addImage(bowlerHatImg, "PNG", PAGE.margin, y, w, logoH);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(...BOWLER_HAT.colorRgb);
    doc.text(BOWLER_HAT.name.toUpperCase(), PAGE.margin, y + 18);
  }

  doc.setFontSize(14);
  doc.setTextColor(...MUTED);
  doc.text("×", PAGE.margin + 130, y + 18);

  if (alltruImg) {
    const w = logoH * ALLTRU.logoAspect;
    // AllTru's logo is black-on-transparent - give it a small white backing
    // chip so it stays legible if this PDF is ever viewed with a dark theme,
    // and for visual consistency with the in-app header treatment.
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(PAGE.margin + 150, y - 4, w + 12, logoH + 8, 4, 4, "F");
    doc.addImage(alltruImg, "PNG", PAGE.margin + 156, y, w, logoH);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(...ALLTRU.colorRgb);
    doc.text(ALLTRU.name.toUpperCase(), PAGE.margin + 150, y + 18);
  }

  y += logoH + 26;

  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(REPORT_TITLE, PAGE.margin, y);
  y += 20;

  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(`Target: ${targetUrl}`, PAGE.margin, y);
  y += 15;
  doc.text(`Generated ${generatedAt}`, PAGE.margin, y);
  y += 18;

  doc.setDrawColor(...LINE);
  doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  y += 20;

  return y;
}

export function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(13.5);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text(title, PAGE.margin, y);
  doc.setFont("helvetica", "normal");
  return y + 14;
}

export function drawSubLabel(doc: jsPDF, label: string, y: number): number {
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), PAGE.margin, y);
  return y + 12;
}

export interface StatItem {
  label: string;
  value: string;
}

// Draws a row of label/value stat blocks (mirrors the .stat-card look) and
// returns the new cursor Y. Wraps to a fixed 4-column grid.
export function drawStatRow(doc: jsPDF, stats: StatItem[], y: number): number {
  const cols = 4;
  const gap = 10;
  const colW = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
  const boxH = 42;

  stats.forEach((stat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAGE.margin + col * (colW + gap);
    const by = y + row * (boxH + 8);

    doc.setDrawColor(...LINE);
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(x, by, colW, boxH, 4, 4, "FD");

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(stat.label, x + 8, by + 14, { maxWidth: colW - 16 });

    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(stat.value, x + 8, by + 32, { maxWidth: colW - 16 });
    doc.setFont("helvetica", "normal");
  });

  const rows = Math.ceil(stats.length / cols);
  return y + rows * (boxH + 8) + 10;
}

export function drawTable(doc: jsPDF, y: number, head: string[], body: RowInput[], accentRgb: [number, number, number] = [41, 54, 67]): number {
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    theme: "striped",
    margin: { left: PAGE.margin, right: PAGE.margin },
    styles: { fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: LINE },
    headStyles: { fillColor: accentRgb, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 248, 251] },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 18;
}

export function drawEmptyNote(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(text, PAGE.margin, y);
  return y + 16;
}

export function drawFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${BOWLER_HAT.name} × ${ALLTRU.name}`, PAGE.margin, PAGE.height - 22);
    doc.text(`Page ${i} of ${pageCount}`, PAGE.width - PAGE.margin - 60, PAGE.height - 22);
  }
}
