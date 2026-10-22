"use strict";
function tileMarkup(card, options = {}) {
  const max = (card.cooldown || 0) * 2,
    cd =
      max > 0
        ? Math.min(max, Math.max(0, Math.round(options.cooldown || 0)))
        : 0;
  return `<button type="button" class="card-tile ${
    options.selected ? "selected" : ""
  } ${options.removed ? "removed" : ""} ${
    options.enter ? "card-enter" : ""
  }${cd > 0 ? " on-cooldown" : ""}${options.banned ? " banned" : ""}${
    options.ban && options.selected ? " ban-pick" : ""
  }" data-card="${card.id}" data-banned="${options.banned ? "1" : "0"}" aria-pressed="${
    !!options.selected
  }" aria-disabled="${!!options.unavailable || !!options.banned}" aria-label="${safe(
    `${card.name}, ${card.weight} poin${
      cd > 0 ? `, cooldown ${cd} giliran` : ""
    }`
  )}" style="--card-color:${CATEGORY_COLOR[card.category]};--i:${
    options.index || 0
  }"><span class="card-points"><b>${card.weight}</b> PT</span>${icon(
    card.id,
    "card-icon"
  )}<span class="card-name">${card.name}</span>${
    cd > 0 ? `<span class="cooldown-badge">${cd}T</span>` : ""
  }${options.banned ? '<span class="ban-badge">BANNED</span>' : ""}${
    options.ban && options.selected ? '<span class="ban-mark"></span>' : ""
  }</button>`;
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
  )}</p><div class="mono">${card.weight} PT / ${card.duration}${card.cooldown ? ` / COOLDOWN ${card.cooldown} RONDE` : ""}</div>`;
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
  const banPhase = ui.phase === "ban";
  const chosen = banPhase ? ui.banPick : ui.loadouts[ui.player],
    spent = chosen.reduce((sum, id) => sum + CARD_BY_ID[id].weight, 0);
  const banned = bannedSet();
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
          ban: banPhase,
          banned: !banPhase && banned.has(card.id),
          unavailable:
            !banPhase && !chosen.includes(card.id) && spent + card.weight > 15,
          enter,
          index,
        })
      )
      .join("") ||
    '<p class="empty-search">Tidak ada kartu yang cocok. Coba kata kunci atau kategori lain.</p>';
  bindCardInspect($("catalog"), "setup");
}
/* ------------------------------------------------------------
   CARD BAN (mode "ban")
   ------------------------------------------------------------
   Alur: lobby -> READY -> fase BAN (2 kartu per pemain) -> loadout -> main.
   Ban dikunci bersamaan; pilihan lawan baru dikirim setelah dia mengunci,
   jadi tidak bisa "membalas" ban lawan. Host yang menggabungkan hasilnya.
   Kartu yang di-ban hilang dari katalog loadout dan tidak masuk ke engine. */
const BAN_COUNT = 2;
function banUnion(bans) {
  const src = bans || {};
  return [...new Set([...(src[1] || []), ...(src[2] || [])])].filter(
    (id) => CARD_BY_ID[id]
  );
}
function bannedSet() {
  return new Set(banUnion(ui.bans));
}
function opponentBanLocked() {
  const n = ui.net;
  if (!n || n.host) return !!(n && n.bans && n.bans[2] && n.bans[2].length);
  return false;
}
function setSetupPhaseUI(ban) {
  const view = $("setupView");
  if (!view) return;
  view.classList.toggle("ban-mode", !!ban);
  const eyebrow = view.querySelector(".page-heading .eyebrow"),
    blurb = view.querySelector(".page-heading p");
  if (ban) {
    if (eyebrow) eyebrow.textContent = "01 / BAN PHASE";
    $("setupHeading").textContent = "BAN 2 CARDS.";
    if (blurb)
      blurb.textContent =
        "Pilih 2 kartu untuk dihapus dari pool kedua pemain. Pilihan lawan baru terlihat setelah keduanya mengunci.";
    $("step1").innerHTML = '<span class="step-number">01</span>BAN';
    $("step2").innerHTML = '<span class="step-number">02</span>LOADOUT';
  } else {
    if (eyebrow) eyebrow.textContent = "01 / PREPARATION PHASE";
    $("setupHeading").textContent = "BUILD YOUR LOADOUT.";
    if (blurb) blurb.textContent = "Pilih kemampuanmu. Ubah jalannya pertempuran.";
    $("step1").innerHTML = '<span class="step-number">01</span>PLAYER ONE';
    $("step2").innerHTML = '<span class="step-number">02</span>PLAYER TWO';
  }
}
function banSidebarMarkup() {
  const pick = ui.banPick || [];
  const items = pick.length
    ? pick
        .map(
          (id) =>
            `<div class="selected-item ban-item">${icon(id)}<span>${
              CARD_BY_ID[id].name
            }</span><button data-remove="${id}" aria-label="Batalkan ban ${
              CARD_BY_ID[id].name
            }">${icon("close")}</button></div>`
        )
        .join("")
    : '<p class="selected-empty">Belum ada kartu dipilih.</p>';
  const status = ui.banLocked
    ? opponentBanLocked()
      ? "BAN TERKUNCI. MENGHITUNG HASIL..."
      : "BAN-MU TERKUNCI. MENUNGGU LAWAN MEMILIH."
    : pick.length === BAN_COUNT
    ? "TEKAN LOCK BAN UNTUK MENGUNCI."
    : `PILIH ${BAN_COUNT - pick.length} KARTU LAGI.`;
  return `${items}<p class="selection-count">${pad(pick.length)} / ${BAN_COUNT} BAN TERPILIH</p><p class="ban-status mono">${status}</p>`;
}
function beginBanPhase() {
  clearVisuals();
  closeDialog(false);
  ui.game = null;
  ui.phase = "ban";
  ui.banPick = [];
  ui.banLocked = false;
  ui.bans = { 1: [], 2: [] };
  ui.player = (ui.net && ui.net.me) || 1;
  ui.filter = "all";
  ui.query = "";
  $("cardSearch").value = "";
  updateFilters();
  resetIntel();
  setView("setup");
  renderSetup(true);
  window.scrollTo({ top: 0, behavior: "auto" });
  announce(
    "Fase ban. Pilih dua kartu untuk dihapus dari pool kedua pemain, lalu kunci ban."
  );
}
function toggleBan(id) {
  if (ui.banLocked) {
    toast("Ban sudah dikunci. Tunggu lawan.");
    return;
  }
  const pick = ui.banPick,
    index = pick.indexOf(id);
  if (index >= 0) pick.splice(index, 1);
  else {
    if (pick.length >= BAN_COUNT) {
      AudioSystem.sfx("error");
      toast(`Maksimal ${BAN_COUNT} kartu. Batalkan satu dulu.`);
      return;
    }
    pick.push(id);
  }
  AudioSystem.sfx("select");
  ui.inspected = id;
  renderSetup();
}
function lockBan() {
  const n = ui.net;
  if (!n || ui.phase !== "ban" || ui.banLocked) return;
  if (ui.banPick.length !== BAN_COUNT) return;
  ui.banLocked = true;
  ui.bans[n.me] = [...ui.banPick];
  if (n.host) {
    n.bans = n.bans || {};
    n.bans[1] = [...ui.banPick];
    if (n.bans[2] && n.bans[2].length) finishBanPhase();
    else {
      renderSetup();
      toast("Ban dikunci. Menunggu lawan memilih...");
      announce("Banmu terkunci. Menunggu lawan.");
    }
  } else {
    netSend({ t: "ban", bans: [...ui.banPick] });
    renderSetup();
    toast("Ban dikunci. Menunggu lawan memilih...");
    announce("Banmu terkunci. Menunggu lawan.");
  }
}
/* HOST: kedua ban sudah terkumpul -> kirim ke tamu lalu masuk fase loadout. */
function finishBanPhase() {
  const n = ui.net;
  if (!n || !n.host) return;
  n.bans = {
    1: [...(n.bans[1] || ui.bans[1] || [])],
    2: [...(n.bans[2] || [])],
  };
  netSend({ t: "bans", bans: n.bans });
  applyBans(n.bans);
}
/* Kedua sisi: pasang daftar ban lalu pindah ke fase loadout. */
function applyBans(bans) {
  ui.bans = {
    1: [...((bans && bans[1]) || [])].filter((id) => CARD_BY_ID[id]),
    2: [...((bans && bans[2]) || [])].filter((id) => CARD_BY_ID[id]),
  };
  const list = banUnion(ui.bans);
  ui.phase = "loadout";
  ui.banPick = [];
  ui.banLocked = false;
  ui.loadouts = { 1: [], 2: [] };
  ui.filter = "all";
  ui.query = "";
  $("cardSearch").value = "";
  updateFilters();
  resetIntel();
  renderSetup(true);
  const names = list.map((id) => CARD_BY_ID[id].name).join(", ");
  if (list.length) toast(`Kartu di-ban: ${names}.`);
  announce(
    `Fase ban selesai. ${list.length} kartu dihapus dari pool: ${names}. Sekarang susun loadout.`
  );
}

function renderSetup(enter = false) {
  const banPhase = ui.phase === "ban";
  setSetupPhaseUI(banPhase);
  const chosen = banPhase ? ui.banPick : ui.loadouts[ui.player],
    spent = chosen.reduce((sum, id) => sum + CARD_BY_ID[id].weight, 0);
  const focusedCard = document.activeElement?.closest("#catalog [data-card]")
    ?.dataset.card;
  $("setupPlayer").textContent = banPhase
    ? `BAN / P${pad((ui.net && ui.net.me) || 1)}`
    : `PLAYER ${pad(ui.player)}`;
  $("setupEmblem").innerHTML = icon(`operator${ui.player}`);
  $("setupEmblem").style.color =
    ui.player === 1 ? "var(--cyan)" : "var(--orange)";
  if (banPhase) {
    // fase ban berjalan bersamaan -> indikator pemain tidak relevan
    $("step1").className = "step active";
    $("step2").className = "step";
  } else {
    $("step1").className = `step ${ui.player === 1 ? "active" : "done"}`;
    $("step2").className = `step ${ui.player === 2 ? "active" : ""}`;
  }
  $("budgetSpent").textContent = spent;
  $("budgetTrack").innerHTML = Array.from(
    { length: 15 },
    (_, i) => `<i class="budget-tick ${i < spent ? "filled" : ""}"></i>`
  ).join("");
  $("budgetTrack").setAttribute("aria-label", `${spent} dari 15 poin`);
  $("selectedLoadout").innerHTML = banPhase
    ? banSidebarMarkup()
    : chosen.length
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
  $("setupNext").disabled = banPhase
    ? chosen.length !== BAN_COUNT || ui.banLocked
    : !chosen.length;
  $("setupNext").innerHTML = `<span>${
    banPhase
      ? ui.banLocked
        ? "BAN LOCKED"
        : `LOCK BAN (${chosen.length}/${BAN_COUNT})`
      : ui.net || ui.player === 1
      ? "CONFIRM LOADOUT"
      : "START OPERATION"
  }</span>${icon(banPhase ? "close" : "arrow-right")}`;
  $("confirmNote").textContent = banPhase
    ? ui.banLocked
      ? "Ban terkunci. Menunggu lawan memilih."
      : "Kartu yang di-ban tidak bisa dipakai siapa pun di match ini."
    : ui.net
    ? bannedSet().size
      ? `${bannedSet().size} kartu di-ban: tidak muncul di katalog.`
      : "Loadout-mu dirahasiakan dari lawan."
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
  if (bannedSet().has(id)) {
    AudioSystem.sfx("error");
    toast(`${CARD_BY_ID[id].name} di-ban pada match ini.`);
    return;
  }
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
  // chibi hanya hidup di lobby; keluar lobby = bebaskan konteks WebGL
  if (name !== "lobby" && window.ChibiLobby) ChibiLobby.destroy();
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
  ui.phase = "loadout";
  ui.banPick = [];
  ui.banLocked = false;
  // Online: pemain mengikuti slot koneksi (tamu = 2). Kalau dipaksa 1,
  // pilihan tamu masuk ke loadout slot 1 dan netConfirm() tidak menemukan
  // apa pun -> tombol CONFIRM LOADOUT terasa mati. Offline: tetap 1.
  ui.player = (ui.net && ui.net.me) || 1;
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
