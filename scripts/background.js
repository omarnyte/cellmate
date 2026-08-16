// NYT's crossword grid ignores synthetic (non-trusted) KeyboardEvents, so the
// content script can't type letters directly. This service worker attaches
// chrome.debugger to the tab and dispatches trusted key events over CDP
// instead, driven by messages from the content script.

const attachedTabs = new Set();

function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    if (attachedTabs.has(tabId)) {
      resolve();
      return;
    }
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      attachedTabs.add(tabId);
      resolve();
    });
  });
}

function detachDebugger(tabId) {
  return new Promise((resolve) => {
    if (!attachedTabs.has(tabId)) {
      resolve();
      return;
    }
    chrome.debugger.detach({ tabId }, () => {
      attachedTabs.delete(tabId);
      resolve();
    });
  });
}

function sendCommand(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

async function typeLetter(tabId, letter) {
  const upper = letter.toUpperCase();
  const keyCode = upper.charCodeAt(0);
  const keyParams = {
    key: upper,
    code: `Key${upper}`,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  };

  await sendCommand(tabId, "Input.dispatchKeyEvent", {
    type: "keyDown",
    text: letter.toLowerCase(),
    unmodifiedText: letter.toLowerCase(),
    ...keyParams,
  });

  await sendCommand(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp",
    ...keyParams,
  });
}

// Typing a letter auto-advances NYT's grid selection to the next cell in the
// word. This dispatches a trusted ArrowLeft keystroke (the same mechanism a
// real user would use) so the content script can steer the selection back to
// the cell it started from between letters of an alphabet cycle.
async function pressArrowLeft(tabId) {
  const keyParams = {
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
    nativeVirtualKeyCode: 37,
  };

  await sendCommand(tabId, "Input.dispatchKeyEvent", {
    type: "keyDown",
    ...keyParams,
  });

  await sendCommand(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp",
    ...keyParams,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (message.type === "CYCLE_START") {
    attachDebugger(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "TYPE_LETTER") {
    typeLetter(tabId, message.letter)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "ARROW_LEFT") {
    pressArrowLeft(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CYCLE_END") {
    detachDebugger(tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Keep our attached-tab bookkeeping in sync if the debugger banner gets
// detached some other way (e.g. the user clicks "Cancel" on it).
chrome.debugger.onDetach.addListener(({ tabId }) => {
  attachedTabs.delete(tabId);
});
