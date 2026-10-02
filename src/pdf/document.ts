import { jsPDF } from "jspdf";

export interface PatternDocument {
  title: string; body: string; counter: number;
  materials?: string; abbreviations?: string; assembly?: string;
  size?: string; author?: string;
}
export interface PatternDesign { subtitle: string; accent: "lavender" | "mint" | "rose" }

export function buildPatternPdf(pattern: PatternDocument, font: string, design?: PatternDesign): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("NotoSans.ttf", font);
  doc.addFont("NotoSans.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans");
  const colors = { lavender: [226, 216, 246], mint: [210, 237, 221], rose: [248, 216, 229] } as const;
  const accent = colors[design?.accent ?? "lavender"];
  let y = 0;
  let page = 0;
  const newPage = () => {
    if (page) doc.addPage();
    page++;
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, 210, 14, "F");
    doc.setFontSize(9);
    doc.setTextColor(56, 45, 74);
    doc.text("CrocHat / Patrones del estudio", 18, 9);
    y = 26;
  };
  const text = (value: string, size: number, spacing: number) => {
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(value, 174);
    // Keep a short instruction together instead of orphaning its last line.
    if (lines.length * spacing <= 247 && y + (lines.length - 1) * spacing > 273) newPage();
    for (const line of lines) {
      if (y > 273) newPage();
      doc.setFontSize(size);
      doc.setTextColor(40, 38, 47);
      doc.text(line, 18, y);
      y += spacing;
    }
    y += 4;
  };
  newPage();
  text(pattern.title.trim(), 22, 10);
  if (pattern.author?.trim()) text(`Diseño: ${pattern.author.trim()}`, 10, 5);
  if (design?.subtitle) text(design.subtitle, 11, 6);
  text(`Registro de tejido: ${pattern.counter} vueltas`, 9, 5);
  if (pattern.size?.trim()) text(`Medidas: ${pattern.size.trim()}`, 10, 5);
  y += 3;
  const section = (heading: string, value?: string) => {
    if (!value?.trim()) return;
    if (y > 247) newPage();
    text(heading, 15, 8);
    for (const paragraph of value.replace(/\r\n/g, "\n").split("\n")) text(paragraph || " ", 11, 6);
  };
  section("Materiales", pattern.materials);
  section("Abreviaturas", pattern.abbreviations);
  if (y > 247) newPage();
  text("Instrucciones por pieza", 15, 8);
  // Source text stays intact, including explicit paragraphs and stitch counts.
  for (const paragraph of pattern.body.replace(/\r\n/g, "\n").split("\n")) {
    text(paragraph || " ", 11, 6);
  }
  section("Armado y acabados", pattern.assembly);
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 93, 115);
    doc.text(`CrocHat · ${i} / ${count}`, 18, 287);
  }
  doc.setProperties({ title: pattern.title, author: "CrocHat", subject: "Patrón de crochet" });
  return new Uint8Array(doc.output("arraybuffer"));
}
