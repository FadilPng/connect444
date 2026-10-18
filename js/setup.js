"use strict";
function tileMarkup(card, options = {}) {
  return `<button type="button" class="card-tile ${
    options.selected ? "selected" : ""
  } ${options.removed ? "removed" : ""} ${
    options.enter ? "card-enter" : ""
  }" data-card="${
    card.id
  }" aria-pressed="${!!options.selected}" aria-disabled="${!!options.unavailable}" aria-label="${safe(
    `${card.name}, ${card.weight} poin`
  )}" style="--card-color:${CATEGORY_COLOR[card.category]};--i:${
    options.index || 0
  }"><span class="card-points"><b>${card.weight}</b> PT</span>${icon(
    card.id,
    "card-icon"
  )}<span class="card-name">${card.name}</span></button>`;
}
function hideTooltip() {
  $("cardTooltip").hidden = true;
  document
    .querySelectorAll('[aria-describedby="cardTooltip"]')
    .forEach((el) => {
      if (el.dataset.detailId)
        el.setAttribute("aria-describedby", el.dataset.detailId);
      else el.removeAttribute("aria-describedby");
    });
}
function showTooltip(tile, card, removed = false) {
  hideTooltip();
  const tooltip = $("cardTooltip");
  tooltip.innerHTML = `<h3>${card.name}</h3><p>${safe(
    removed
      ? `Kartu ini telah dihapus oleh ${CARD_BY_ID.demotion.name} selama sisa match. ` +
          card.desc
      : card.desc
  )}</p><div class="mono">${card.weight} PT / ${card.duration}</div>`;
  tooltip.hidden = false;
  tile.setAttribute("aria-describedby", "cardTooltip");
  const rect = tile.getBoundingClientRect(),
    tip = tooltip.getBoundingClientRect();
  let left = rect.right + 12,
    top = rect.top;
  if (left + tip.width > innerWidth - 12) left = rect.left - tip.width - 12;
  if (left < 12) {
    left = Math.max(12, Math.min(rect.left, innerWidth - tip.width - 12));
    top = rect.bottom + 12;
  }
  if (top + tip.height > innerHeight - 12)
    top = Math.max(
      12,
      Math.min(rect.top - tip.height - 12, innerHeight - tip.height - 12)
    );
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
function bindCardInspect(root, mode) {
  root.querySelectorAll("[data-card]").forEach((tile) => {
    const card = CARD_BY_ID[tile.dataset.card];
    const description = document.createElement("span");
    description.className = "sr-only";
    description.id = `card-detail-${mode}-${card.id}`;
    description.textContent = card.desc;
    tile.appendChild(description);
    tile.dataset.detailId = description.id;
    tile.setAttribute("aria-describedby", description.id);
    const inspect = () => {
      if (mode === "setup") renderIntel(card);
      else if (mode === "offer") renderOfferIntel(card);
      else showTooltip(tile, card, tile.classList.contains("removed"));
    };
    tile.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") inspect();
    });
    tile.addEventListener("focus", inspect);
    tile.addEventListener("pointerleave", () => {
      if (mode === "hand") hideTooltip();
      clearTimeout(ui.touchTimer);
    });
    tile.addEventListener("blur", () => {
      if (mode === "hand") hideTooltip();
    });
    tile.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      clearTimeout(ui.touchTimer);
      ui.touchTimer = setTimeout(() => {
        tile.dataset.longPress = "yes";
        inspect();
        showTooltip(tile, card, tile.classList.contains("removed"));
      }, 450);
    });
    tile.addEventListener("pointerup", () => clearTimeout(ui.touchTimer));
    tile.addEventListener("pointercancel", () => clearTimeout(ui.touchTimer));
    tile.addEventListener("contextmenu", (event) => event.preventDefault());
  });
}
function renderIntel(card) {
  ui.inspected = card.id;
  const selected = ui.loadouts[ui.player].includes(card.id);
  $(
    "setupIntel"
  ).innerHTML = `<div class="intel-top"><span class="eyebrow">CARD INTEL</span><span class="mono">// ${card.category.toUpperCase()}</span></div><span class="intel-symbol" style="color:${
    CATEGORY_COLOR[card.category]
  }">${icon(card.id)}</span><h3>${card.name}</h3><p>${
    card.desc
  }</p><div class="intel-meta"><span>${card.duration}</span><span>${
    selected ? "SELECTED" : `${card.weight} PT`
  }</span></div>`;
}
function resetIntel() {
  ui.inspected = null;
  $(
    "setupIntel"
  ).innerHTML = `<div class="intel-top"><span class="eyebrow">CARD INTEL</span><span class="mono">// STANDBY</span></div><span class="intel-symbol">${icon(
    "crosshair"
  )}</span><h3>Knowledge is an edge.</h3><p>Arahkan kursor atau fokuskan kartu untuk melihat kemampuan dan durasinya.</p><div class="intel-meta"><span>23 TACTICAL CARDS</span><span>FF / 01</span></div>`;
}
function renderCatalog(enter = false) {
  const chosen = ui.loadouts[ui.player],
    spent = chosen.reduce((sum, id) => sum + CARD_BY_ID[id].weight, 0);
  const cards = CARDS.filter(
    (card) =>
      (ui.filter === "all" || card.category === ui.filter) &&
      `${card.name} ${card.category} ${card.desc}`
        .toLowerCase()
        .includes(ui.query.toLowerCase().trim())
  );
  $("catalog").innerHTML =
    cards
      .map((card, index) =>
        tileMarkup(card, {
          selected: chosen.includes(card.id),
          unavailable: !chosen.includes(card.id) && spent + card.weight > 15,
          enter,
          index,
        })
      )
      .join("") ||
    '<p class="empty-search">Tidak ada kartu yang cocok. Coba kata kunci atau kategori lain.</p>';
  bindCardInspect($("catalog"), "setup");
}
function renderSetup(enter = false) {
  const chosen = ui.loadouts[ui.player],
    spent = chosen.reduce((sum, id) => sum + CARD_BY_ID[id].weight, 0);
  const focusedCard = document.activeElement?.closest("#catalog [data-card]")
    ?.dataset.card;
  $("setupPlayer").textContent = `PLAYER ${pad(ui.player)}`;
  $("setupEmblem").innerHTML = icon(`operator${ui.player}`);
  $("setupEmblem").style.color =
    ui.player === 1 ? "var(--cyan)" : "var(--orange)";
  $("step1").className = `step ${ui.player === 1 ? "active" : "done"}`;
  $("step2").className = `step ${ui.player === 2 ? "active" : ""}`;
  $("budgetSpent").textContent = spent;
  $("budgetTrack").innerHTML = Array.from(
    { length: 15 },
    (_, i) => `<i class="budget-tick ${i < spent ? "filled" : ""}"></i>`
  ).join("");
  $("budgetTrack").setAttribute("aria-label", `${spent} dari 15 poin`);
  $("selectedLoadout").innerHTML = chosen.length
    ? chosen
        .map(
          (id) =>
            `<div class="selected-item">${icon(id)}<span>${
              CARD_BY_ID[id].name
            }</span><button data-remove="${id}" aria-label="Hapus ${
              CARD_BY_ID[id].name
            } dari loadout">${icon("close")}</button></div>`
        )
        .join("") +
      `<p class="selection-count">${pad(
        chosen.length
      )} CARDS SELECTED / NO DUPLICATES</p>`
    : '<p class="selected-empty">Belum ada kartu dipilih.</p>';
  $("setupNext").disabled = !chosen.length;
  $("setupNext").innerHTML = `<span>${
    ui.net || ui.player === 1 ? "CONFIRM LOADOUT" : "START OPERATION"
  }</span>${icon("arrow-right")}`;
  $("confirmNote").textContent = ui.net
    ? "Loadout-mu dirahasiakan dari lawan."
    : ui.player === 1
    ? "Player 02 memilih setelah konfirmasi."
    : "Kedua loadout siap. Player 01 bergerak dulu.";
  renderCatalog(enter);
  if (ui.inspected) renderIntel(CARD_BY_ID[ui.inspected]);
  if (focusedCard && !enter)
    $("catalog")
      .querySelector(`[data-card="${focusedCard}"]`)
      ?.focus({ preventScroll: true });
}
function toggleCard(id) {
  const chosen = ui.loadouts[ui.player],
    index = chosen.indexOf(id),
    card = CARD_BY_ID[id];
  if (index >= 0) chosen.splice(index, 1);
  else {
    const sum = chosen.reduce((total, x) => total + CARD_BY_ID[x].weight, 0);
    if (sum + card.weight > 15) {
      renderIntel(card);
      AudioSystem.sfx("error");
      toast(
        `Poin tidak cukup. Tersisa ${15 - sum} PT, ${card.name} memerlukan ${
          card.weight
        } PT.`
      );
      return;
    }
    chosen.push(id);
  }
  AudioSystem.sfx("select");
  ui.inspected = id;
  renderSetup();
  announce(
    `${card.name} ${
      index >= 0 ? "dihapus dari" : "ditambahkan ke"
    } loadout Player ${ui.player}.`
  );
}
function setView(name) {
  AudioSystem.setScene(name === "battle" ? "battle" : "menu");
  hideTooltip();
  $("setupView").hidden = name !== "setup";
  $("battleView").hidden = name !== "battle";
  $("lobbyView").hidden = name !== "lobby";
  for (const [id, active] of [
    ["navLoadout", name === "setup"],
    ["navBattle", name === "battle"],
  ]) {
    $(id).classList.toggle("active", active);
    if (active) $(id).setAttribute("aria-current", "page");
    else $(id).removeAttribute("aria-current");
  }
  // Kunci navigasi rail saat di lobi supaya tidak keluar room tanpa sengaja.
  const inLobby = name === "lobby";
  for (const id of ["navLoadout", "navBattle"]) $(id).disabled = inLobby;
  const view = $(
    name === "setup"
      ? "setupView"
      : name === "battle"
      ? "battleView"
      : "lobbyView"
  );
  view.classList.remove("view-enter");
  void view.offsetWidth;
  view.classList.add("view-enter");
}
function startOperation() {
  clearVisuals();
  closeDialog(false);
  ui.game = new FourfoldEngine(ui.loadouts);
  ui.resultShown = false;
  ui.focusCell = { r: 0, c: 0 };
  setView("battle");
  AudioSystem.sfx("start");
  renderBattle();
  window.scrollTo({ top: 0, behavior: "auto" });
  announce(
    "Operasi dimulai. Giliran Player 01. Deploy koin atau gunakan kartu."
  );
}
function beginSetup() {
  clearVisuals();
  closeDialog(false);
  ui.game = null;
  ui.player = 1;
  ui.loadouts = { 1: [], 2: [] };
  ui.filter = "all";
  ui.query = "";
  $("cardSearch").value = "";
  updateFilters();
  resetIntel();
  setView("setup");
  renderSetup(true);
  window.scrollTo({ top: 0, behavior: "auto" });
}
function updateFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === ui.filter);
    button.setAttribute(
      "aria-pressed",
      button.dataset.filter === ui.filter ? "true" : "false"
    );
  });
}
