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

function addEventListeners() {
  document.addEventListener("keydown", (event) => {
    const isMacShortcut = event.ctrlKey && event.key === "p" && !event.altKey;
    const isWindowsShortcut = event.altKey && event.key === "p" && !event.ctrlKey;

    if (isMacShortcut || isWindowsShortcut) {
      event.preventDefault();
      togglePencilMode();
    }
  });
}

addEventListeners();
