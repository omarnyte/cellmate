# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension ("Better NYT Crossword Puzzles") that enhances the NYT Crossword game page (`https://www.nytimes.com/crosswords/game*`) via a single content script. There is no build step, package manager, or test suite — this is plain, unbundled JavaScript loaded directly by the browser.

## Development workflow

There are no build/lint/test commands (no `package.json`). To develop and verify changes:

1. Load the extension unpacked in Chrome: `chrome://extensions` → enable Developer Mode → "Load unpacked" → select the repo root.
2. After editing `scripts/content.js` or `manifest.json`, click the reload icon for the extension on `chrome://extensions`.
3. Test on an actual NYT Crossword game page (`https://www.nytimes.com/crosswords/game/...`) since the content script only injects there, and the DOM selectors it relies on (`.xwd__toolbar_icon--pencil`, `g[data-group="cells"]`, `rect.xwd__cell--selected`, etc.) only exist on that page.
4. Use the page's DevTools console to see `console.log`/`console.warn` output from the content script.

## Architecture

- `manifest.json` — MV3 manifest. Declares the content script injection target/match pattern and two `commands` (`toggle-pencil`, `cycle-alphabet`) with suggested keyboard shortcuts. Note: these `commands` entries are metadata only — Chrome's `commands` API requires a background service worker with a `chrome.commands.onCommand` listener to actually fire; this extension instead implements the shortcuts itself via a `keydown` listener inside `scripts/content.js`, so the manifest shortcuts and the in-page shortcuts must be kept in sync manually.
- `scripts/content.js` — the entire extension logic, injected into the crossword page. Everything is DOM-scraping and event-simulation against the NYT crossword's React/SVG UI, which is not a documented API surface, so selectors are brittle and may break if NYT changes class names or markup. Key pieces:
  - `togglePencilMode()` — clicks the NYT toolbar's pencil-mode button by finding whichever icon (`--pencil` vs `--pencil-active`) is currently in the DOM.
  - `getActiveSquare()` / `getActiveSquareTextElement()` — locate the currently focused/selected crossword cell in the SVG grid.
  - `setLetterInActiveSquare(letter)` — dispatches synthetic `keydown`/`keypress`/`keyup` `KeyboardEvent`s to type a letter into the focused cell.
  - `cycleAlphabet()` — async loop backing the "cycle-alphabet" feature; steps through A–Z in the active square with a delay between each, checking `isCompletionModalVisible()` after each guess and stopping early on success.
  - `addEventListeners()` — single `keydown` listener on `document` implementing both shortcuts: Ctrl+P/Alt+P for pencil-mode toggle, Ctrl+A for alphabet cycling. Called once at the bottom of the file (script runs at document load, per default content-script injection timing).
- `popup.js` — the toolbar popup script; currently a stub.
- `hello.html` / `hello_extensions.png` — leftover scaffolding, not part of the active extension logic.

## Notes from README

Upcoming/planned feature not yet implemented: remove the "How to Solve the New York Times Crossword" animation.
