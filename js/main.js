"use strict";
AudioSystem.init();
ui.tests = runRegressionTests();
document.documentElement.dataset.engineTests = ui.tests.failed.length ? "failed" : "passed";
window.Fourfold = Object.freeze({Engine:FourfoldEngine,cards:CARDS,runTests:runRegressionTests,get diagnostics() { return ui.tests; }});
if (ui.tests.failed.length) console.error("Fourfold regression checks:",ui.tests.failed);
if (new URLSearchParams(location.search).has("selftest")) console.table(ui.tests.results);

hydrateIcons();
$("setupEmblem").innerHTML = icon("operator1");
renderSetup(true);
$("catalog").onclick = event => {
  const tile = event.target.closest("[data-card]");
  if (!tile) return;
  if (tile.dataset.longPress === "yes") { delete tile.dataset.longPress; return; }
  hideTooltip(); toggleCard(tile.dataset.card);
};
$("selectedLoadout").onclick = event => { const button = event.target.closest("[data-remove]"); if (button) toggleCard(button.dataset.remove); };
document.querySelectorAll("[data-filter]").forEach(button => { button.onclick = () => { ui.filter = button.dataset.filter; updateFilters(); renderCatalog(true); }; });
$("cardSearch").addEventListener("input",event => { ui.query = event.target.value; renderCatalog(); });
$("setupNext").onclick = () => {
  if (!ui.loadouts[ui.player].length) return;
  if (ui.net) { netConfirm(); return; }
  if (ui.player === 1) {
    ui.player = 2; ui.filter = "all"; ui.query = "";
    $("cardSearch").value = ""; updateFilters(); resetIntel(); renderSetup(true);
    announce("Loadout Player 01 dikonfirmasi. Sekarang pilih kartu untuk Player 02.");
    $("setupHeading").setAttribute("tabindex","-1"); $("setupHeading").focus({preventScroll:true});
    window.scrollTo({top:0,behavior:"auto"});
  } else startOperation();
};
$("board").onclick = event => { const cell = event.target.closest(".cell"); if (cell) takeAction(() => ui.game.actOnCell(Number(cell.dataset.r),Number(cell.dataset.c))); };
$("board").addEventListener("pointerover",event => { const cell = event.target.closest(".cell"); if (cell && !cell.contains(event.relatedTarget)) hoverLane(Number(cell.dataset.r),Number(cell.dataset.c)); });
$("board").addEventListener("focusin",event => { const cell = event.target.closest(".cell"); if (cell) { ui.focusCell = {r:Number(cell.dataset.r),c:Number(cell.dataset.c)}; $("board").querySelectorAll(".cell").forEach(el => { el.tabIndex = el === cell ? 0 : -1; }); hoverLane(ui.focusCell.r,ui.focusCell.c); } });
$("board").addEventListener("pointerleave",clearHover);
$("board").addEventListener("focusout",event => { if (!$("board").contains(event.relatedTarget)) clearHover(); });
$("board").addEventListener("keydown",event => {
  const cell = event.target.closest(".cell"), delta = {ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[event.key];
  if (!cell || !delta || !ui.game) return;
  event.preventDefault();
  const r = Math.max(0,Math.min(ui.game.height-1,Number(cell.dataset.r)+delta[0])), c = Math.max(0,Math.min(ui.game.width-1,Number(cell.dataset.c)+delta[1]));
  $("board").querySelector(`[data-r="${r}"][data-c="${c}"]`)?.focus({preventScroll:true});
});
["columnHeaders","rowHeaders","sideHeaders"].forEach(id => {
  $(id).onclick = event => {
    const button = event.target.closest("[data-lane]");
    if (!button || button.disabled) return;
    const lane = Number(button.dataset.lane);
    takeAction(() => ui.game.s.pending?.values ? ui.game.chooseLane(lane) : ui.game.drop(lane));
  };
  $(id).addEventListener("pointerover",event => { const button = event.target.closest("[data-lane]"); if (button && !button.disabled) hoverLane(button.dataset.axis === "row" ? Number(button.dataset.lane) : 0,button.dataset.axis === "col" ? Number(button.dataset.lane) : 0); });
  $(id).addEventListener("pointerleave",clearHover);
});
$("dropAction").onclick = () => {
  if (!ui.game || ui.busy) return;
  const g = ui.game, lane = Array.from({length:g.laneCount},(_,i) => i).find(i => g.canDrop(i)), land = g.landing(lane);
  if (land) $("board").querySelector(`[data-r="${land.r}"][data-c="${land.c}"]`)?.focus({preventScroll:true});
};
$("cardAction").onclick = () => takeAction(() => ui.game.drawOffer());
$("passAction").onclick = () => takeAction(() => ui.game.pass());
$("sizeControl").onclick = event => {
  const button = event.target.closest("[data-size]");
  if (!button) return;
  applyBoardSize(button.dataset.size);
  announce(`Ukuran papan: ${button.textContent}.`);
};
applyBoardSize();
$("hand").onclick = event => {
  const tile = event.target.closest("[data-card]");
  if (!tile) return;
  if (tile.dataset.longPress === "yes") { delete tile.dataset.longPress; return; }
  showTooltip(tile,CARD_BY_ID[tile.dataset.card],tile.classList.contains("removed"));
};
["guideButton","navGuide","battleRules","railMotion"].forEach(id => { $(id).onclick = showGuide; });
["newMatch","navLoadout","brandHome"].forEach(id => { $(id).onclick = () => { if (!$("setupView").hidden) window.scrollTo({top:0,behavior:"smooth"}); else requestNewOperation(); }; });
$("navBattle").onclick = () => {
  if (ui.busy || ui.modal) return;
  if (!ui.game) toast("Konfirmasi loadout kedua pemain terlebih dahulu untuk memulai operasi.");
  else if ($("battleView").hidden) { setView("battle"); renderBattle(); }
};
document.addEventListener("keydown",event => {
  if (event.key === "Escape") {
    hideTooltip();
    if (ui.modal && ui.closeable) { closeDialog(); if (ui.game?.s.ended && !ui.resultShown) later(showWinner,50); }
    else if (ui.modal) toast("Selesaikan pilihan ini untuk melanjutkan.");
  }
  if (event.key !== "Tab" || !ui.modal) return;
  const dialog = $("modalRoot").querySelector(".dialog"), controls = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el => !el.hidden);
  if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
  const first = controls[0], last = controls[controls.length-1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
});
document.addEventListener("pointerdown",event => { if (!event.target.closest("[data-card]")) hideTooltip(); });
window.addEventListener("scroll",hideTooltip,{passive:true,capture:true});
window.addEventListener("resize",hideTooltip,{passive:true});
