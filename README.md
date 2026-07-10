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
  siempre encima, fuera de la barra de tareas, no redimensionable, arrastrable desde la barra pixel.
- 📴 **100 % offline**: fuente y sprites empaquetados, sin CDNs ni fetch externos.

## Requisitos

- **Node.js** ≥ 18 y **npm**
- **Rust** (toolchain estable) — https://rustup.rs
- **WebView2 Runtime** — viene preinstalado en **Windows 10 21H2+** y **Windows 11**.
  Si hiciera falta: https://developer.microsoft.com/microsoft-edge/webview2/

## Puesta en marcha

```bash
npm install            # dependencias del frontend + CLI de Tauri
npm run tauri dev      # arranca el widget en modo desarrollo
```

La primera compilación de Rust descarga y construye Tauri, así que tarda unos minutos.

## Build portable (.exe)

```bash
npm run tauri build
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

- **Barra de título**: arrástrala para mover el widget. `_` minimiza · `▢` fija/desfija "siempre encima" · `✕` cierra.
- **Fila de controles**: la píldora cambia de **tema**, el círculo central es **play/pausa**,
  el botón rosa alterna entre **Temporizador** y **Patrones**.

## Créditos

- **Idea, diseño y creación:** [vhhatziry](https://github.com/vhhatziry) 💚🧶
- Diseño CrocHat en Figma (por vhhatziry).
- Fuente **Press Start 2P** por CodeMan38 — licencia **OFL** (`src/assets/fonts/OFL.txt`).
