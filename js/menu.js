"use strict";
/* ---------- MAIN MENU ---------- */
const menu = $("menuView"),
  shell = $("appShell");
function showMenu() {
  AudioSystem.setScene("menu");
  netClose();
  document.querySelector(".session-label").lastChild.textContent =
    "LOCAL / 2 OPERATORS";
  closeDialog(false);
  menu.hidden = false;
  shell.hidden = true;
  document.body.style.overflow = "hidden";
  menu.querySelector("[data-mode]").focus({ preventScroll: true });
}
function enterLocal() {
  menu.hidden = true;
  shell.hidden = false;
  document.body.style.overflow = "";
  beginSetup();
}
menu.querySelectorAll("[data-mode]").forEach((button) => {
  button.onclick = () =>
    button.dataset.mode === "local" ? enterLocal() : showOnline();
});
document.addEventListener("keydown", (event) => {
  if (menu.hidden || ui.modal || event.metaKey || event.ctrlKey || event.altKey)
    return;
  if (event.key === "1") enterLocal();
  else if (event.key === "2") showOnline();
});
$("menuButton").onclick = () => {
  if (ui.busy || ui.modal) return;
  if (!ui.game || ui.game.s.ended) {
    showMenu();
    return;
  }
  showDialog(
    `<button class="dialog-close" data-close aria-label="Batal">${icon(
      "close"
    )}</button><div class="eyebrow">OPERATION CONTROL</div><h2 id="modalTitle">BACK TO MAIN MENU?</h2><p class="dialog-intro">Match yang sedang berjalan akan hilang.</p><div class="option-grid"><button class="option-button" data-close>${icon(
      "arrow-left"
    )}<span><strong>CONTINUE</strong><small>Kembali ke operasi</small></span></button><button class="option-button" id="confirmMenu">${icon(
      "grid"
    )}<span><strong>MAIN MENU</strong><small>Keluar dari match</small></span></button></div>`,
    "confirm",
    true
  );
  $("confirmMenu").onclick = showMenu;
};
hydrateIcons(menu);
menu.querySelector("[data-mode]").focus({ preventScroll: true });
