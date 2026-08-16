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

- `manifest.json` — MV3 manifest. Declares the content script injection target/match pattern, the background service worker, the `debugger` permission, and two `commands` (`toggle-pencil`, `cycle-alphabet`) with suggested keyboard shortcuts. Note: these `commands` entries are metadata only — Chrome's `commands` API requires a background service worker with a `chrome.commands.onCommand` listener to actually fire; this extension instead implements the shortcuts itself via a `keydown` listener inside `scripts/content.js`, so the manifest shortcuts and the in-page shortcuts must be kept in sync manually.
- `scripts/content.js` — the bulk of the extension logic, injected into the crossword page. Everything is DOM-scraping against the NYT crossword's React/SVG UI, which is not a documented API surface, so selectors are brittle and may break if NYT changes class names or markup. Key pieces:
  - `togglePencilMode()` — clicks the NYT toolbar's pencil-mode button by finding whichever icon (`--pencil` vs `--pencil-active`) is currently in the DOM.
  - `getActiveSquare()` / `getActiveSquareTextElement()` — locate the currently focused/selected crossword cell in the SVG grid (a `rect[role="cell"]`, which genuinely receives DOM focus — there is no hidden `<input>`).
  - `setLetterInActiveSquare(letter)` — asks the background service worker (via `sendMessageToBackground`) to type a letter into the focused cell. **Important:** NYT's grid handler ignores synthetic (non-`isTrusted`) `KeyboardEvent`s dispatched from a content script, confirmed by direct testing — dispatching a matching `keydown`/`keypress`/`keyup` on the correctly-focused element returns `true` but has no effect. Trusted input can only come from `chrome.debugger` (CDP), hence the message hop into the background worker; do not "fix" this by reverting to `element.dispatchEvent(new KeyboardEvent(...))`, it will silently no-op.
  - `cycleAlphabet()` — async loop backing the "cycle-alphabet" feature: sends `CYCLE_START` to attach the debugger, steps through A–Z in the active square (via `setLetterInActiveSquare`) with a delay between each, checking `isCompletionModalVisible()` after each guess and stopping early on success, then sends `CYCLE_END` to detach.
  - `addEventListeners()` — single `keydown` listener on `document` implementing both shortcuts: Ctrl+P/Alt+P for pencil-mode toggle, Ctrl+A for alphabet cycling. Called once at the bottom of the file (script runs at document load, per default content-script injection timing).
- `scripts/background.js` — MV3 background service worker. Owns the `chrome.debugger` session (attach/detach per tab, tracked in an `attachedTabs` set) and dispatches trusted `Input.dispatchKeyEvent` CDP commands on behalf of the content script in response to `CYCLE_START` / `TYPE_LETTER` / `CYCLE_END` runtime messages. While attached, Chrome shows a persistent "This extension is debugging this browser" banner on the tab — this is expected and unavoidable for this approach.
- `popup.js` — the toolbar popup script; currently a stub.
- `hello.html` / `hello_extensions.png` — leftover scaffolding, not part of the active extension logic.

## Notes from README

Upcoming/planned feature not yet implemented: remove the "How to Solve the New York Times Crossword" animation.
