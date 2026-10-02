import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { buildPatternPdf } from "../src/pdf/document.ts";
const font = readFileSync("src/assets/fonts/noto/NotoSans-Regular.ttf").toString("base64");
const body = Array.from({ length: 80 }, (_, i) => `Vuelta ${i + 1}: (2 pb, 1 aum) x 6 = 24 puntos. Algodón, tensión suave; después cerrar con disminución.`).join("\n");
const bytes = buildPatternPdf({ title: "Conejito de algodón · edición CrocHat", body, counter: 80,
  materials: "Algodón lavanda y crema. Gancho de 3 mm. Aguja lanera y relleno.",
  abbreviations: "pb: punto bajo\naum: aumento\ndism: disminución", author: "Estudio CrocHat",
  size: "18 cm de alto", assembly: "Unir las piezas con aguja lanera. Revisar la simetría antes de rematar.",
}, font, { subtitle: "Un compañero tejido a mano", accent: "lavender" });
assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
mkdirSync("tmp/pdf", { recursive: true });
writeFileSync("tmp/pdf/patron-prueba.pdf", bytes);
console.log("PDF de prueba generado: 80 vueltas, caracteres españoles y varias páginas.");
