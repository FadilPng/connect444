"use strict";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const ui = {
  game: null,
  busy: false,
  epoch: 0,
  motion: true,
  filter: "all",
  query: "",
  player: 1,
  loadouts: { 1: [], 2: [] },
  // mode "ban": pemain memilih 2 kartu untuk di-ban sebelum loadout
  phase: "loadout",
  banPick: [],
  bans: { 1: [], 2: [] },
  banLocked: false,
  inspected: null,
  modal: null,
  closeable: false,
  returnFocus: null,
  offerSelected: null,
  resultShown: false,
  focusCell: { r: 0, c: 0 },
  touchTimer: null,
  announcementQueue: [],
  announcing: false,
  motionTimers: new Set(),
};
try {
  ui.motion = localStorage.getItem("fourfold.motion") !== "off";
} catch (_) {}
document.documentElement.dataset.motion = ui.motion ? "on" : "off";
const BOARD_SIZES = { s: 380, m: 480, l: 620 };
ui.boardSize = "m";
try {
  const saved = localStorage.getItem("fourfold.boardSize");
  if (BOARD_SIZES[saved]) ui.boardSize = saved;
} catch (_) {}
function applyBoardSize(size = ui.boardSize) {
  if (!BOARD_SIZES[size]) return;
  ui.boardSize = size;
  const frame = document.querySelector(".board-frame");
  frame.style.setProperty("--board-max", `${BOARD_SIZES[size]}px`);
  if (ui.game)
    frame.style.setProperty(
      "--board-ratio",
      (ui.game.width / ui.game.height).toFixed(4)
    );
  document.querySelectorAll("#sizeControl [data-size]").forEach((button) => {
    const active = button.dataset.size === size;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  try {
    localStorage.setItem("fourfold.boardSize", size);
  } catch (_) {}
}
function motionAllowed() {
  return ui.motion && !reducedMotion.matches && !!Element.prototype.animate;
}
function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("toastStack").appendChild(el);
  while ($("toastStack").children.length > 3)
    $("toastStack").firstElementChild.remove();
  setTimeout(() => el.remove(), 3800);
}
function announce(message) {
  $("liveRegion").textContent = message;
}
function later(callback, delay) {
  const epoch = ui.epoch;
  const timer = setTimeout(() => {
    ui.motionTimers.delete(timer);
    if (epoch === ui.epoch) callback();
  }, delay);
  ui.motionTimers.add(timer);
  return timer;
}
function clearVisuals() {
  ui.epoch++;
  for (const timer of ui.motionTimers) clearTimeout(timer);
  ui.motionTimers.clear();
  ui.announcementQueue = [];
  ui.announcing = false;
  ui.busy = false;
  $("fxLayer").replaceChildren();
  $("toastStack").replaceChildren();
  $("arena")
    .querySelectorAll(".skill-announcement")
    .forEach((el) => el.remove());
  $("board")
    .getAnimations?.({ subtree: true })
    .forEach((animation) => animation.cancel());
}
