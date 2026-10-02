# CrocHat 🧶🍅

Widget de escritorio **Pomodoro** para Windows con estética pixel-art *cozy / crochet*.
Ventana flotante siempre visible, sin barra nativa, con temas Verde y Morado, temporizador
Pomodoro y notas de patrones de crochet. Construido con **Tauri v2 + Rust + TypeScript vanilla**.

<p align="center">
  <img src="docs/preview-green.png" alt="CrocHat tema verde" width="45%">
  <img src="docs/preview-purple.png" alt="CrocHat tema morado" width="45%">
</p>

## Características

- ⏱️ **Temporizador Pomodoro** con máquina de estados (`Idle → Working → ShortBreak → LongBreak`).
  Ciclos por defecto **25 / 5 / 15 min** y descanso largo cada 4 pomodoros.
- 🔔 **Notificación nativa** de Windows al terminar cada ciclo, con cambio automático de fase.
- 🧶 **Patrones**: notas locales (título + texto + contador de vueltas) que **sobreviven al cierre**.
- 🎨 **Dos temas** (Verde con tréboles / Morado con flores). La preferencia se persiste.
- 🪟 **Comportamiento de widget**: sin decoraciones, transparente (esquinas redondeadas),
  siempre encima, recuperable desde la barra de tareas al minimizar. Abrirlo de nuevo restaura la instancia existente.
- 📄 **Visor PDF local**: PDF.js empaquetado, páginas anterior/siguiente, zoom y ajuste al ancho.
- ✨ **Finalizar → PDF**: exportación con tipografía, paleta pastel, márgenes y paginación. Conserva tus instrucciones originales.
- 📴 **Uso offline**: temporizador, notas, visor y exportación funcionan sin conexión. El diseño opcional con Gemini requiere Internet.

## Requisitos

- **Node.js** ≥ 22.13 y **pnpm** (PDF.js 6 requiere esta versión de Node).
- **Rust** (toolchain estable) — https://rustup.rs
- **WebView2 Runtime** — viene preinstalado en **Windows 10 21H2+** y **Windows 11**.
  Si hiciera falta: https://developer.microsoft.com/microsoft-edge/webview2/

## Puesta en marcha

```bash
pnpm install           # dependencias del frontend + CLI de Tauri
pnpm tauri dev         # arranca el widget en modo desarrollo
```

La primera compilación de Rust descarga y construye Tauri, así que tarda unos minutos.

## Build portable (.exe)

```bash
pnpm tauri build
```

Genera dos salidas:

| Salida | Ruta |
| --- | --- |
| **Binario portable** (un solo `.exe`, self-contained salvo WebView2) | `src-tauri/target/release/crochat.exe` |
| **Instalador NSIS** | `src-tauri/target/release/bundle/nsis/CrocHat_0.1.0_x64-setup.exe` |

Para distribuir el widget portable basta con copiar **`crochat.exe`**: los assets del frontend
van embebidos en el binario. El único requisito en la máquina destino es el **WebView2 Runtime**
(ya presente en Win10 21H2+ / Win11).

El perfil `release` está optimizado para tamaño en `src-tauri/Cargo.toml`
(`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `strip = true`, `panic = "abort"`).

## Diseño opcional con Gemini

En una terminal PowerShell, configura las variables **antes** de iniciar la aplicación:

```powershell
$env:GEMINI_API_KEY = "tu-clave-de-API"
$env:GEMINI_MODEL = "modelo-disponible-en-tu-cuenta"
pnpm tauri dev
```

Obtén la clave y consulta los modelos de tu cuenta en [Google AI Studio](https://aistudio.google.com/).
La integración usa la [API oficial generateContent](https://ai.google.dev/api/generate-content).
La clave se lee en Rust y no se guarda en las notas ni se incorpora al ejecutable.
Activa «Diseño con Gemini» en un patrón y pulsa «Finalizar → PDF»: el título y las notas se
envían a Gemini para elegir un subtítulo y una paleta. El texto de tejido, las vueltas y
los puntos del PDF vienen de tus notas originales. Sin clave, puedes exportar desactivando
la casilla. Cancelar el selector no borra el patrón. Los PDFs se guardan donde elijas;
añádelos a la biblioteca con «Añadir PDFs».

## Integridad de datos y pruebas

### Ventana de patrones

En el panel, «↗ Ventana» abre los PDF y el editor en una ventana independiente de
900 × 720 px. Tiene los controles normales de Windows para maximizar, minimizar y
redimensionar desde los bordes. El temporizador conserva su tamaño de widget.
«↗ Ver ventana» enfoca la misma ventana, sin abrir más copias. Al cerrarla se espera
al guardado y se recarga el panel del temporizador. Solo la ventana independiente
puede editar la biblioteca mientras está abierta, para evitar sobrescribir cambios.

Los patrones propios admiten autoría, tamaño final, materiales, abreviaturas,
instrucciones por pieza y armado/acabados. Los campos nuevos son opcionales y se
incluyen en el PDF; las notas antiguas siguen funcionando. El visor también muestra
PDFs hechos de imágenes, aunque esos documentos no tengan texto seleccionable.

### Guardado

Los datos están en `crochat-store.json` dentro del directorio de datos de Tauri; este
repositorio no utiliza una base SQL. Los patrones nuevos usan UUID. Al cargar IDs antiguos
repetidos se asigna una identidad distinta a cada nota, sin borrar ni combinar contenidos.
El guardado escribe snapshots en orden y cerrar espera a que terminen. Un fallo de lectura
no habilita una biblioteca vacía para sobrescribir tus datos. Solo se admite una instancia.

```bash
pnpm test  # regresiones del guardado, IDs y rutas Windows
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Prueba manual en Windows: crea dos notas, cambia de pestaña inmediatamente después de
escribir, cierra y reabre; verifica sus textos y contadores. Minimiza y restaura desde
la barra de tareas; abrir otro ejecutable debe enfocar la ventana existente. Abre PDFs
de varias páginas, usa zoom y cambia de documento rápidamente. Exporta un patrón largo,
cancela otra exportación y prueba Gemini con/sin clave. La integración real con Gemini
requiere credenciales; no se ejecuta durante las pruebas offline.

## Regenerar sprites

Los sprites pixel-art se generan por código (sin dependencias nativas):

```bash
node tools/gen-sprites.mjs
```

Escribe los PNG en `src/assets/sprites/` y el icono fuente en `src-tauri/icons/icon-source.png`.
Para regenerar el set de iconos de la app tras cambiar el fuente:

```bash
npm run tauri icon src-tauri/icons/icon-source.png
```

> Son aproximaciones del diseño de Figma; puedes reemplazar cualquier PNG de `src/assets/sprites/`
> por el export exacto sin tocar código.

## Estructura

```
src/
  main.ts                 orquestador: monta vistas + controles de ventana
  timer/pomodoro.ts       máquina de estados del Pomodoro (toda la lógica de tiempo)
  store/persistence.ts    wrappers de los comandos Rust del store
  notify.ts               notificaciones nativas
  ui/
    titlebar.ts           barra pixel con arrastre + minimizar/fijar/cerrar
    timerView.ts          corazón + display MM:SS + contador
    patronesView.ts       CRUD de patrones (persistente)
    nav.ts                conmutador de vistas
    theme.ts              toggle Verde/Morado + persistencia
  styles/                 base (reset+fuente), themes (variables), widget (layout)
  assets/fonts|sprites    Press Start 2P (OFL) + PNGs pixel-art
src-tauri/
  src/lib.rs              comandos: save/load patrones, save/load tema, notify
  tauri.conf.json         ventana widget + bundle
  Cargo.toml              perfil release optimizado
tools/gen-sprites.mjs     generador de sprites (encoder PNG con zlib nativo)
```

## Controles

- **Barra de título**: arrástrala para mover el widget. `_` minimiza · `📌` fija/desfija "siempre encima" · `✕` cierra.
- **Fila de controles**: la píldora cambia de **tema**, el círculo central es **play/pausa**,
  el botón rosa alterna entre **Temporizador** y **Patrones**.

## Créditos

- **Idea, diseño y creación:** [vhhatziry](https://github.com/vhhatziry) 💚🧶
- Diseño CrocHat en Figma (por vhhatziry).
- Fuente **Press Start 2P** por CodeMan38 — licencia **OFL** (`src/assets/fonts/OFL.txt`).
