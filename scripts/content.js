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
    if (event.key === "p") {
      togglePencilMode();
    }
  });
}

addEventListeners();
