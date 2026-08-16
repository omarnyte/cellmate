function togglePencilMode() {
  const inactiveIcon = document.querySelector('.xwd__toolbar_icon--pencil');
  const inactivePencilModeButton = inactiveIcon?.closest('button');
  if (inactivePencilModeButton) {
    inactivePencilModeButton.click();
  }

  const activeIcon = document.querySelector('.xwd__toolbar_icon--pencil-active');
  const activePencilModeButton = activeIcon?.closest('button');
  if (activePencilModeButton) {
    activePencilModeButton.click();
  }
}

// Get the currently active/focused crossword square
function getActiveSquare() {
  // Try to find the currently selected cell
  const activeCell = document.querySelector('g[data-group="cells"] rect.xwd__cell--selected')
    || document.querySelector('g[data-group="cells"] rect.xwd__cell--focused')
    || document.activeElement?.closest('[role="cell"]');

  return activeCell;
}

// Get the text element for the active square
function getActiveSquareTextElement() {
  const activeSquare = getActiveSquare();
  if (!activeSquare) return null;

  // Find the associated text element
  // The structure is usually an SVG with rect and text elements
  const cellNumber = activeSquare.getAttribute('data-cell-index')
    || activeSquare.getAttribute('data-cell');

  if (cellNumber) {
    return document.querySelector(`text[data-cell-index="${cellNumber}"]`)
      || document.querySelector(`text[data-cell="${cellNumber}"]`);
  }

  // Alternative: find text element that's a sibling or nearby
  const parent = activeSquare.parentElement;
  return parent?.querySelector('text');
}

// Check if the completion modal has appeared
function isCompletionModalVisible() {
  // Look for common modal/dialog classes that indicate puzzle completion
  const modal = document.querySelector('[role="dialog"]')
    || document.querySelector('.xwd__modal')
    || document.querySelector('[class*="congratulations"]')
    || document.querySelector('[class*="complete"]');

  return modal !== null && modal.offsetParent !== null; // offsetParent null means hidden
}

// Send a message to the background service worker and await its response.
function sendMessageToBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

// Set a letter in the currently active square. NYT's grid ignores synthetic
// (non-trusted) KeyboardEvents, so the actual keystroke is dispatched by the
// background service worker via chrome.debugger (CDP), which the tab treats
// as trusted input.
async function setLetterInActiveSquare(letter) {
  const response = await sendMessageToBackground({ type: 'TYPE_LETTER', letter });
  if (!response?.ok) {
    console.warn(`Failed to type letter "${letter}":`, response?.error);
  }
}

// State variable to track if cycling is in progress
let isCycling = false;

// Cycle through A-Z in the current square
async function cycleAlphabet() {
  if (isCycling) {
    console.log('Alphabet cycling already in progress');
    return;
  }

  const activeSquare = getActiveSquare();
  if (!activeSquare) {
    console.warn('No active square found');
    return;
  }

  isCycling = true;
  console.log('Starting alphabet cycle...');

  const cycleStarted = await sendMessageToBackground({ type: 'CYCLE_START' });
  if (!cycleStarted?.ok) {
    console.warn('Could not attach debugger for alphabet cycling:', cycleStarted?.error);
    isCycling = false;
    return;
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const delay = 150; // milliseconds between letters
  let solved = false;

  for (let i = 0; i < alphabet.length; i++) {
    const letter = alphabet[i];
    console.log(`Trying letter: ${letter}`);

    await setLetterInActiveSquare(letter);

    // Wait for the delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Check if completion modal appeared
    if (isCompletionModalVisible()) {
      console.log(`Success! Puzzle completed with letter: ${letter}`);
      solved = true;
      break;
    }
  }

  if (!solved) {
    console.log('Cycled through all letters without completion');
  }

  await sendMessageToBackground({ type: 'CYCLE_END' });
  isCycling = false;
}

function addEventListeners() {
  document.addEventListener("keydown", (event) => {
    // Pencil mode toggle: Ctrl+P (Mac) or Alt+P (Windows)
    const isPencilShortcut = (event.ctrlKey && event.key === "p" && !event.altKey)
      || (event.altKey && event.key === "p" && !event.ctrlKey);

    if (isPencilShortcut) {
      event.preventDefault();
      togglePencilMode();
      return;
    }

    // Alphabet cycling: Ctrl+A (both platforms)
    const isAlphabetShortcut = event.ctrlKey && event.key === "a" && !event.altKey && !event.metaKey;

    if (isAlphabetShortcut) {
      event.preventDefault();
      cycleAlphabet();
      return;
    }
  });
}

addEventListeners();
