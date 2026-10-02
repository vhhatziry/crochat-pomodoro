import { invoke } from "@tauri-apps/api/core";
import fontUrl from "../assets/fonts/noto/NotoSans-Regular.ttf?url";
import { buildPatternPdf, type PatternDesign, type PatternDocument } from "./document";

let fontPromise: Promise<string> | undefined;
async function loadFont(): Promise<string> {
  const response = await fetch(fontUrl);
  if (!response.ok) throw new Error("No se pudo cargar la fuente del PDF.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function exportPattern(pattern: PatternDocument, useAi: boolean): Promise<string | null> {
  if (!pattern.title.trim() || !pattern.body.trim()) throw new Error("Agrega un título y las instrucciones antes de finalizar.");
  const design = useAi ? await invoke<PatternDesign>("pattern_design", { title: pattern.title, body: pattern.body }) : undefined;
  fontPromise ??= loadFont().catch((error) => { fontPromise = undefined; throw error; });
  const bytes = buildPatternPdf(pattern, await fontPromise, design);
  return invoke<string | null>("export_pattern_pdf", { bytes: Array.from(bytes) });
}
