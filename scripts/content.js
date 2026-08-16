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

// Determine which (if any) modal is currently visible. NYT shows two
// different modals that both appear once the grid is fully filled:
//   - the genuine "you solved it" modal, once every square is correct
//   - a "wrong guess" modal (heading "Almost there.") when the grid is
//     full but at least one square is wrong
// Both use `[role="dialog"]`, so we can't tell them apart generically. The
// wrong-guess modal's body carries an extra `xwd__rats-modal` class that the
// real completion modal doesn't have, which is what we key off of here.
function getVisibleModalKind() {
  const modal = document.querySelector('[role="dialog"]');
  if (!modal || modal.offsetParent === null) return null; // not shown, or hidden

  if (modal.querySelector('.xwd__rats-modal')) return 'wrong-guess';

  return 'solved';
}

// Dismiss the "wrong guess" modal by clicking its "Keep trying" button.
// Unlike typing into the grid, a plain (non-trusted) click on this button
// works fine -- it's a normal DOM button, not part of NYT's synthetic-event-
// rejecting SVG grid -- so this doesn't need to go through chrome.debugger.
function dismissWrongGuessModal() {
  const dismissButton = document.querySelector(
    '[role="dialog"] .xwd__rats-modal .xwd__modal--button-container button'
  );
  if (dismissButton) {
    dismissButton.click();
    return true;
  }
  return false;
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

// Ask the background worker to send a trusted ArrowLeft keystroke.
async function pressArrowLeft() {
  const response = await sendMessageToBackground({ type: 'ARROW_LEFT' });
  if (!response?.ok) {
    console.warn('Failed to send ArrowLeft:', response?.error);
  }
}

// Typing a letter can auto-advance NYT's selection to the next cell in the
// word (like a normal crossword UI). If that happened, step the selection
// back to the cell the cycle started on with trusted ArrowLeft keystrokes so
// every letter of the cycle lands in the same square. If the typed letter
// was the last cell in the word, the selection won't have moved and this is
// a no-op.
async function restoreOriginalCell(originalCellId) {
  if (!originalCellId) return;

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (getActiveSquare()?.id === originalCellId) return;
    await pressArrowLeft();
    // Give the page a moment to process the keystroke and re-render.
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  if (getActiveSquare()?.id !== originalCellId) {
    console.warn('Could not restore focus to the original cell after typing a letter');
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

  // Captured once, before the loop starts, so every letter in the cycle can
  // be steered back to this exact cell even as typing tries to auto-advance
  // the selection.
  const originalCellId = activeSquare.id;

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

    // Undo any auto-advance so the next letter is tried in the same cell.
    await restoreOriginalCell(originalCellId);

    // Wait for the delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Check which modal (if any) appeared after this guess.
    const modalKind = getVisibleModalKind();
    if (modalKind === 'solved') {
      console.log(`Success! Puzzle completed with letter: ${letter}`);
      solved = true;
      break;
    }

    if (modalKind === 'wrong-guess') {
      console.log(`Letter "${letter}" filled the grid but was wrong; dismissing modal.`);
      dismissWrongGuessModal();
      // Give the modal a moment to close before trying the next letter.
      await new Promise(resolve => setTimeout(resolve, 100));
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
