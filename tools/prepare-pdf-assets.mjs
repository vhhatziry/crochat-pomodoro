import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
mkdirSync("public/pdfjs", { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm"]) {
  cpSync(join(root, folder), join("public/pdfjs", folder), { recursive: true });
}
