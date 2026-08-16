# Cellmate: NYT Crossword Tools 

A Chrome extension that enhances the NYT Crossword page with quality-of-life shortcuts.

## Features

- **Pencil mode toggle** — `Ctrl+P` (Mac: `Ctrl+P`, Windows: `Alt+P`)
- **Alphabet cycling** — `Ctrl+A` tries each letter A-Z in the focused cell

## Developing locally

1. Go to `chrome://extensions`, enable Developer Mode, and click "Load unpacked" on the repo root.
2. Edit `manifest.json` / `scripts/content.js` / `scripts/background.js`, then click the extension's Reload button on `chrome://extensions`.
3. Test on an actual puzzle page (`https://www.nytimes.com/crosswords/game/...`) — the content script only injects there. After reloading the extension, also reload the puzzle tab, since its content script becomes orphaned.

## Contributing

Contributions are always welcome! 

1. Fork the repo.
2. Make and push your changes.
3. Open a PR against `main`. 

## Upcoming features

- **Remove 'How to Solve the New York Times Crossword' animation.**
