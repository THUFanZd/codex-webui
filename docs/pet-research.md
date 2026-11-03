# Desktop pet research and the web companion

Checked on 2026-11-04. This records the evidence used for this implementation; it is not a promise of compatibility with future desktop builds.

## What was verified

- [Pets documentation](https://learn.chatgpt.com/docs/pets) currently describes a **ChatGPT desktop app** companion and separately discusses Codex CLI pets. It documents dragging, keyboard movement, persistent placement, reduced motion, and task activity. It says local desktop custom pets do not automatically sync to the web. These are documented product behaviors; this research did not exercise those desktop controls.
- [Commands documentation, Pets section](https://learn.chatgpt.com/docs/reference/commands#pets) documents the desktop install link `codex://pets/install?name=…&imageUrl=…`. It takes an HTTPS image URL, an optional description, and sprite version 1 or 2. An install deep link opens a desktop flow; it is not a web rendering API.
- On this machine the running desktop process is `C:\Program Files\WindowsApps\OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe`. Its resources directory contains `app.asar`, `app.asar.unpacked`, bundled plugins and skills. This is separate from the CLI executable under `%LOCALAPPDATA%\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe`.
- A read-only archive-index inspection found `webview/assets/pet-model-469a0cc03189.js`, `pet-content-67a53141446f.js`, and pet settings/install modules. A limited read of the first two confirmed sprite URL fields, expiration checks, and account-setting integration in that installed build. Those internal modules import private app runtime chunks. This inspection did not establish an independently supported web component or a license to redistribute bundled character artwork. No shipped artwork or code was copied.
- Local `%USERPROFILE%\.codex\skills\hatch-pet\references\codex-pet-contract.md` and `animation-rows.md` specify PNG/WebP v2 atlases: **1536 × 2288, 8 columns × 11 rows, 192 × 208 cells**. Rows 0–8 hold animation states; rows 9–10 hold sixteen gaze directions. The manifest has `spriteVersionNumber: 2` and `spritesheetPath`. This is a local skill format reference, not evidence that this web app can control the desktop window.
- The public Pets page also gives the web upload v1 dimensions, **1536 × 1872**, with a PNG/WebP file size limit of 20 MiB. The local reference documents the same first nine rows and the v2 extension.

## Decision and evidence boundary

This round did not find a public interface that embeds the existing desktop pet window into an arbitrary website. The install link and private app modules do not supply that interface. A browser viewport and the desktop floating window have different hosts and lifecycles. The web implementation therefore uses a self-contained React overlay and original SVG artwork.

Users who already have a compatible custom sprite can explicitly select their PNG/WebP file through the companion's import button. The app decodes it with a browser object URL, validates its dimensions, and renders the atlas. It neither reads desktop pet settings nor changes the chosen desktop pet. No account pet collection, network fetch, upload, model request, or background polling is involved.

The importer accepts v1 and v2 grids and uses the shared state rows below. It does not import manifests, fetch remote image URLs, validate every transparent cell, implement directional gaze, or provide a sprite editor. Original character artwork remains the default. Imported files last for the current page visit; only position and visibility are persisted.

| Web state | Sprite row | Used frames | Timing from local reference |
| --- | ---: | ---: | --- |
| Idle | 0 | still frame 0 | Quiet resting pose |
| Running | 7 | 6 | 120 ms per frame, final 220 ms |
| Attention | 6 | still frame 0 | Stable expectant pose |
| Completed | 4 | 5, once | 140 ms per frame, final 280 ms |

Reduced motion keeps imported sprites still. The original artwork uses a small running gesture and one completion jump; attention is a stable pose. Completion returns to idle after 2.1 seconds.

## Integration and behavior

Mount `<WebCompanion />` once inside `ActiveSessionProvider` and `LanguageProvider`. Its CSS module owns its styles and its root has `data-companion="visible"` (or `"restore"` for the restore button).

State is derived from the existing active session. Historical replay stays idle. A completion gesture requires an observed live running-to-completed transition for the same session and turn. Switching to completed history does not meet that condition. Attention looks at the current running turn, ignores warnings, and clears when execution resumes. Previously completed or failed turns are ignored when a new run starts.

The response card dispatches this event after a successful user-input response:

```ts
import { INTERACTION_RESOLVED_EVENT } from "@/lib/companion/state";

window.dispatchEvent(new CustomEvent(INTERACTION_RESOLVED_EVENT, {
  detail: { interactionId: item.interactionId },
}));
```

This local event bridges the response card's private submitted state into the companion without adding a server request. Matching resolved IDs remain in the mounted companion's memory; unrelated request IDs do not clear attention. The listener is removed on unmount.

Placement uses pointer capture and a four-pixel drag threshold. A finished drag suppresses the resulting click. Arrow keys move by 8 pixels; Shift moves by 32; Home/Escape and the home button restore the default position. Hiding retains a small restore button near the top edge. The default placement is below the top bar, above the composer. Position and visibility use versioned, validated localStorage data with read/write failure handling; viewport resizing clamps the complete control footprint back on screen.

## Validation

Node tests cover current-turn attention and resolutions, warnings and recovered errors, live versus historical completion transitions, valid/corrupt/unavailable storage, viewport clamping including narrow screens, and supported sprite dimensions. TypeScript and changed-file ESLint checks are run separately. Browser integration is validated in the main integration branch after the component is mounted.
