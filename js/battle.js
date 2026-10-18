"use strict";
function coinMarkup(coin, ghost = false) {
  const neutral = coin.owner === 0 || ui.game?.s.neutralTurns > 0;
  const glyph = neutral ? "decoy" : `operator${coin.owner}`;
  return `<span class="coin ${neutral ? "neutral" : `p${coin.owner}`} ${
    coin.kind === "heavy" ? "heavy" : ""
  } ${coin.shield ? "shielded" : ""} ${ghost ? "ghost" : ""}" ${
    ghost ? 'aria-hidden="true"' : `data-coin="${coin.id}"`
  }>${icon(glyph)}${coin.shield ? icon("shield", "shield-glyph") : ""}</span>`;
}
function cellEnabled(r, c) {
  const g = ui.game,
    p = g.s.pending,
    coin = g.s.board[r][c];
  if (!mine() || g.s.ended || g.s.offer) return false;
  if (p?.candidates) return !!coin && p.candidates.includes(coin.id);
  if (p?.values) return p.values.includes(g.laneForCell(r, c));
  return g.canAct("drop") && g.canDrop(g.sideways ? r : c);
}
function laneEnabled(lane, physicalColumn = false) {
  const g = ui.game,
    p = g.s.pending;
  if (
    ui.busy ||
    !mine() ||
    g.s.ended ||
    g.s.offer ||
    p?.candidates ||
    p?.type === "options"
  )
    return false;
  if (physicalColumn && p?.type === "column") return p.values.includes(lane);
  if (p?.type === "column") return false;
  if (p?.values) return p.values.includes(lane);
  return g.canAct("drop") && g.canDrop(lane);
}
function renderBattle() {
  const g = ui.game;
  if (!g) return;
  const s = g.s,
    beforeFocus = document.activeElement?.closest("#board .cell");
  if (beforeFocus)
    ui.focusCell = {
      r: Number(beforeFocus.dataset.r),
      c: Number(beforeFocus.dataset.c),
    };
  ui.focusCell.r = Math.min(ui.focusCell.r, g.height - 1);
  ui.focusCell.c = Math.min(ui.focusCell.c, g.width - 1);
  $("turnName").textContent = s.ended
    ? s.winner
      ? `${pname(s.winner)} WINS`
      : "OPERATION DRAW"
    : pname(s.turn);
  $("turnPrompt").textContent = s.ended
    ? "OPERATION COMPLETE"
    : ui.net && !mine()
    ? "WAITING FOR OPPONENT"
    : s.pending
    ? "SELECT A TARGET"
    : s.enforce
    ? `FORCED / ${s.enforce.toUpperCase()}`
    : s.phase
    ? `EXTRA ACTION / ${s.phase.toUpperCase()}`
    : s.overloadActive
    ? "OVERLOAD / TWO ACTIONS"
    : "AWAITING COMMAND";
  $("turnEmblem").textContent = pad(s.ended && s.winner ? s.winner : s.turn);
  $("turnEmblem").style.color = s.turn === 1 ? "var(--cyan)" : "var(--orange)";
  $("turnEmblem").style.borderColor =
    s.turn === 1 ? "var(--cyan)" : "var(--orange)";
  $("turnEmblem").style.background = s.turn === 1 ? "#82cbd915" : "#e99b7715";
  $("turnCount").textContent = pad(s.turns + 1, 3);
  $("targetCaption").textContent = `OBJECTIVE : CONNECT ${s.target}`;
  $("boardInfo").textContent = `${pad(g.width)} COL / ${pad(g.height)} ROW`;
  applyBoardSize();
  const direction = {
    down: "arrow-down",
    up: "arrow-up",
    left: "arrow-left",
    right: "arrow-right",
  }[s.gravity];
  $("gravityLabel").innerHTML = `${icon(
    direction
  )}GRAVITY / ${s.gravity.toUpperCase()}`;
  $("board").style.gridTemplateColumns = `repeat(${g.width},minmax(0,1fr))`;
  $("board").dataset.gravity = s.gravity;
  $("board").innerHTML = s.board
    .map((row, r) =>
      row
        .map((coin, c) => {
          const target = !!coin && !!s.pending?.candidates?.includes(coin.id);
          const first = !!coin && s.pending?.firstId === coin.id;
          const locked = g.locked(c, "col") || g.locked(r, "row");
          const winner = s.winningCells.includes(`${r},${c}`);
          const label = `Baris ${r + 1}, kolom ${String.fromCharCode(
            65 + c
          )}: ${
            coin
              ? s.neutralTurns
                ? "koin, warna disembunyikan"
                : coin.owner
                ? `koin Player ${coin.owner}`
                : "koin netral"
              : "kosong"
          }${locked ? ", jalur terkunci" : ""}${
            coin?.shield ? `, Shield ${Math.min(4, coin.shield)} giliran` : ""
          }`;
          return `<button class="cell ${cellEnabled(r, c) ? "clickable" : ""} ${
            target ? "selected" : ""
          } ${first ? "first-choice" : ""} ${locked ? "locked" : ""} ${
            winner ? "win" : ""
          }" data-r="${r}" data-c="${c}" type="button" aria-label="${safe(
            label
          )}" tabindex="${
            r === ui.focusCell.r && c === ui.focusCell.c ? "0" : "-1"
          }">${coin ? coinMarkup(coin) : ""}${
            locked ? icon("lock", "cell-lock") : ""
          }</button>`;
        })
        .join("")
    )
    .join("");
  renderCoordinates();
  const hp = ui.net ? ui.net.me : s.turn,
    removed = s.removed[hp];
  $("hand").innerHTML =
    s.loadouts[hp]
      .map((id) =>
        tileMarkup(CARD_BY_ID[id], {
          removed: removed.includes(id),
          cooldown: s.cooldowns[hp]?.[id] || 0,
        })
      )
      .join("") || '<p class="no-effects">LOADOUT EMPTY</p>';
  bindCardInspect($("hand"), "hand");
  $("handBudget").textContent = `${g
    .available(hp)
    .reduce((sum, id) => sum + CARD_BY_ID[id].weight, 0)} / 15 PT`;
  const protocols = g.protocols();
  $("effectCount").textContent = pad(protocols.length);
  $("effectList").innerHTML =
    protocols
      .map(
        (p) =>
          `<div class="effect-row">${icon(
            p.id
          )}<div><span class="effect-name">${
            p.name
          }</span><span class="effect-track"><i style="--progress:${Math.max(
            0,
            (p.remaining / p.max) * 100
          )}%"></i></span></div><span class="effect-time">${
            p.label || `${p.remaining}T`
          }</span></div>`
      )
      .join("") || '<p class="no-effects">NO ACTIVE PROTOCOLS</p>';
  $("log").innerHTML = s.log
    .slice(0, 9)
    .map(
      (entry) =>
        `<div class="log-entry ${
          entry.kind === "expiry" ? "expiry" : ""
        }"><span>${pad(entry.turn, 3)}</span><p>${safe(entry.text)}</p></div>`
    )
    .join("");
  $("score1").textContent = g.coins().filter((x) => x.coin.owner === 1).length;
  $("score2").textContent = g.coins().filter((x) => x.coin.owner === 2).length;
  syncControls();
  if (beforeFocus && !ui.modal)
    $("board")
      .querySelector(`[data-r="${ui.focusCell.r}"][data-c="${ui.focusCell.c}"]`)
      ?.focus({ preventScroll: true });
}
function renderCoordinates() {
  const g = ui.game,
    p = g.s.pending,
    vertical = !g.sideways || p?.type === "column";
  $(
    "columnHeaders"
  ).style.gridTemplateColumns = `repeat(${g.width},minmax(0,1fr))`;
  $("columnHeaders").innerHTML = Array.from({ length: g.width }, (_, c) =>
    vertical
      ? `<button class="coord lane-open" data-lane="${c}" data-axis="col" aria-label="Pilih kolom ${String.fromCharCode(
          65 + c
        )}">${icon(
          p?.type === "column" ? "crosshair" : "arrow-down"
        )}${String.fromCharCode(65 + c)}</button>`
      : `<span class="coord">${String.fromCharCode(65 + c)}</span>`
  ).join("");
  $("rowHeaders").style.gridTemplateRows = `repeat(${g.height},1fr)`;
  $("sideHeaders").style.gridTemplateRows = `repeat(${g.height},1fr)`;
  $("rowHeaders").innerHTML = Array.from({ length: g.height }, (_, r) =>
    g.s.gravity === "right" && p?.type !== "column"
      ? `<button class="coord lane-open" data-lane="${r}" data-axis="row" aria-label="Pilih baris ${
          r + 1
        }, masuk dari kiri">${icon("arrow-right")}</button>`
      : `<span>${pad(r + 1)}</span>`
  ).join("");
  $("sideHeaders").innerHTML = Array.from({ length: g.height }, (_, r) =>
    g.s.gravity === "left" && p?.type !== "column"
      ? `<button class="coord lane-open" data-lane="${r}" data-axis="row" aria-label="Pilih baris ${
          r + 1
        }, masuk dari kanan">${icon("arrow-left")}</button>`
      : "<span></span>"
  ).join("");
}
function syncControls() {
  const g = ui.game;
  if (!g) return;
  const s = g.s;
  $("dropAction").disabled =
    ui.busy || !mine() || !g.canAct("drop") || !g.hasDrop();
  $("cardAction").disabled =
    ui.busy ||
    !mine() ||
    !g.canAct("card") ||
    !g.available().some((id) => g.usable(id));
  $("passAction").hidden =
    !mine() || s.ended || !!s.pending || !!s.offer || g.hasLegalAction();
  $("passAction").disabled = ui.busy;
  $("newMatch").disabled = ui.busy;
  $("board").setAttribute("aria-busy", ui.busy ? "true" : "false");
  $("board")
    .querySelectorAll(".cell")
    .forEach((el) =>
      el.setAttribute(
        "aria-disabled",
        ui.busy || !cellEnabled(Number(el.dataset.r), Number(el.dataset.c))
          ? "true"
          : "false"
      )
    );
  document.querySelectorAll("[data-lane]").forEach((button) => {
    button.disabled = !laneEnabled(
      Number(button.dataset.lane),
      button.dataset.axis === "col"
    );
  });
  const message =
    !s.ended && !mine()
      ? "Menunggu giliran lawan..."
      : s.ended
      ? s.winner
        ? `Player ${pad(s.winner)} berhasil Connect ${s.target}.`
        : s.drawReason
      : s.pending?.title ||
        (s.recyclePending
          ? `${CARD_BY_ID.recycle.name}: deploy satu koin pengganti.`
          : s.enforce
          ? `${CARD_BY_ID.forced.name}: kamu wajib ${
              s.enforce === "drop" ? "deploy koin" : "menggunakan kartu"
            }.`
          : s.phase
          ? `${CARD_BY_ID.overload.name}: selesaikan aksi ${
              s.phase === "drop" ? "deploy" : "kartu"
            } tambahan.`
          : g.sideways
          ? "Gravitasi menyamping. Klik baris; panah menunjukkan sisi masuk."
          : "Klik kolom untuk deploy, atau gunakan satu kartu taktis.");
  $("gameNotice").innerHTML = `${icon(s.ended ? "check" : "info")}<span>${safe(
    message
  )}</span>`;
}
function clearHover() {
  $("board")
    .querySelectorAll(".lane-hover,.is-landing")
    .forEach((el) => el.classList.remove("lane-hover", "is-landing"));
  $("board")
    .querySelectorAll(".ghost")
    .forEach((el) => el.remove());
}
function hoverLane(r, c) {
  clearHover();
  const g = ui.game;
  if (
    !g ||
    ui.busy ||
    !mine() ||
    g.s.ended ||
    g.s.offer ||
    g.s.pending?.candidates ||
    g.s.pending?.type === "options"
  )
    return;
  const lane = g.laneForCell(r, c),
    p = g.s.pending;
  if (
    p?.values ? !p.values.includes(lane) : !g.canAct("drop") || !g.canDrop(lane)
  )
    return;
  $("board")
    .querySelectorAll(".cell")
    .forEach((el) => {
      if (g.laneForCell(Number(el.dataset.r), Number(el.dataset.c)) === lane)
        el.classList.add("lane-hover");
    });
  if (!p || p.type === "drop") {
    const land = g.landing(lane);
    if (!land) return;
    const cell = $("board").querySelector(
      `[data-r="${land.r}"][data-c="${land.c}"]`
    );
    cell.classList.add("is-landing");
    cell.insertAdjacentHTML(
      "beforeend",
      coinMarkup(
        {
          id: -1,
          owner: g.s.playing?.id === "decoy" ? 0 : g.s.turn,
          kind: "normal",
          shield: 0,
        },
        true
      )
    );
  }
}
function showDialog(content, kind, closeable = false) {
  hideTooltip();
  if (!ui.modal) ui.returnFocus = document.activeElement;
  ui.modal = kind;
  ui.closeable = closeable;
  $("modalRoot").innerHTML = `<div class="overlay"><section class="dialog ${
    kind === "winner" ? "winner-dialog" : ""
  }" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">${content}</section></div>`;
  document.querySelector(".app-shell").inert = true;
  document.body.style.overflow = "hidden";
  $("modalRoot").querySelector(".dialog").focus({ preventScroll: true });
  $("modalRoot")
    .querySelectorAll("[data-close]")
    .forEach((button) => (button.onclick = () => closeDialog()));
}
function closeDialog(restoreFocus = true) {
  if (!ui.modal) return;
  $("modalRoot").replaceChildren();
  document.querySelector(".app-shell").inert = false;
  document.body.style.overflow = "";
  ui.modal = null;
  hideTooltip();
  if (
    restoreFocus &&
    ui.returnFocus?.isConnected &&
    !ui.returnFocus.disabled &&
    !ui.returnFocus.closest("[hidden]")
  )
    ui.returnFocus.focus({ preventScroll: true });
  ui.returnFocus = null;
}
function showOffer() {
  const g = ui.game;
  if (!g?.s.offer) return;
  ui.offerSelected = null;
  showDialog(
    `
    <div class="eyebrow">TACTICAL SUPPORT / P${pad(g.s.turn)}</div>
    <h2 id="modalTitle">CHOOSE YOUR NEXT MOVE.</h2>
    <p class="dialog-intro">${
      g.s.offer.length
    } kartu tersedia dari loadout. Hover untuk intel, pilih lalu aktifkan.</p>
    <div class="offer-layout">
      <div class="offer-grid" id="offerGrid">${g.s.offer
        .map((id, index) => tileMarkup(CARD_BY_ID[id], { index, enter: true }))
        .join("")}</div>
      <aside class="offer-intel" id="offerIntel"><span class="intel-symbol">${icon(
        "crosshair"
      )}</span><h3>Assess the options.</h3><p>Arahkan kursor atau fokuskan kartu untuk membaca efeknya. Tap untuk memilih.</p><div class="mono">SELECT ONE TACTICAL CARD</div></aside>
    </div>
    <div class="dialog-footer"><p class="mono">COMMITTED ACTION / Penawaran tidak bisa dibatalkan. Bobot lebih tinggi lebih jarang muncul.</p><button class="primary-button" id="activateCard" disabled><span>ACTIVATE CARD</span>${icon(
      "arrow-right"
    )}</button></div>
  `,
    "offer"
  );
  bindCardInspect($("offerGrid"), "offer");
  $("offerGrid").onclick = (event) => {
    const tile = event.target.closest("[data-card]");
    if (!tile) return;
    if (tile.dataset.longPress === "yes") {
      delete tile.dataset.longPress;
      return;
    }
    ui.offerSelected = tile.dataset.card;
    $("offerGrid")
      .querySelectorAll("[data-card]")
      .forEach((button) => {
        button.classList.toggle("selected", button === tile);
        button.setAttribute("aria-pressed", button === tile ? "true" : "false");
      });
    renderOfferIntel(CARD_BY_ID[ui.offerSelected]);
    $("activateCard").disabled = false;
    $("activateCard").innerHTML = `<span>ACTIVATE ${CARD_BY_ID[
      ui.offerSelected
    ].name.toUpperCase()}</span>${icon("arrow-right")}`;
    $("activateCard").setAttribute(
      "aria-label",
      `Aktifkan ${CARD_BY_ID[ui.offerSelected].name}`
    );
    announce(
      `${
        CARD_BY_ID[ui.offerSelected].name
      } dipilih. Aktifkan untuk melanjutkan.`
    );
  };
  $("activateCard").onclick = () => {
    const id = ui.offerSelected;
    if (!id) return;
    closeDialog(false);
    takeAction(() => ui.game.chooseCard(id));
  };
}
function renderOfferIntel(card) {
  const root = $("offerIntel");
  if (!root) return;
  root.innerHTML = `<span class="intel-symbol">${icon(card.id)}</span><h3>${
    card.name
  }</h3><p>${card.desc}</p><div class="mono">${card.weight} PT / ${
    card.duration
  }</div>`;
}
function showOptions() {
  const pending = ui.game?.s.pending;
  if (pending?.type !== "options") return;
  const card = CARD_BY_ID[ui.game.s.playing.id];
  showDialog(
    `<div class="eyebrow">${card.name.toUpperCase()} / CONFIGURATION</div><h2 id="modalTitle">${
      pending.title
    }</h2><p class="dialog-intro">${
      card.desc
    }</p><div class="option-grid">${pending.options
      .map(
        ([value, label, note, glyph]) =>
          `<button class="option-button" data-option="${value}">${icon(
            glyph
          )}<span><strong>${label}</strong><small>${note}</small></span></button>`
      )
      .join("")}</div>`,
    "options"
  );
  $("modalRoot")
    .querySelectorAll("[data-option]")
    .forEach((button) => {
      button.onclick = () => {
        const value = button.dataset.option;
        closeDialog(false);
        takeAction(() => ui.game.chooseOption(value));
      };
    });
}
function showGuide() {
  if (ui.busy) {
    toast("Tunggu transisi medan selesai sebelum membuka field guide.");
    return;
  }
  if (ui.modal && ui.modal !== "guide") return;
  if (ui.game?.s.ended && !ui.resultShown) {
    showWinner();
    return;
  }
  showDialog(
    `<button class="dialog-close" data-close aria-label="Tutup field guide">${icon(
      "close"
    )}</button><div class="eyebrow">FOURFOLD / FIELD MANUAL</div><h2 id="modalTitle">KNOW THE BATTLEFIELD.</h2><p class="dialog-intro">Connect Four dengan 23 kemampuan taktis. Dua pemain, satu perangkat.</p><div class="guide-grid"><section><h3>01 / THE OBJECTIVE</h3><p>Hubungkan 4 koin milikmu secara horizontal, vertikal, atau diagonal. Pada tiap giliran, deploy satu koin atau gunakan satu kartu dari penawaran acak. Koin netral tidak pernah dihitung.</p></section><section><h3>02 / BUILD YOUR LOADOUT</h3><p>Setiap pemain memiliki anggaran 15 poin, tanpa duplikat. Angka poin juga menentukan kelangkaan: bobot lebih tinggi lebih jarang ditawarkan. Hover, fokus keyboard, atau tekan lama kartu untuk detail.</p></section><section><h3>03 / ${CARD_BY_ID.gravity.name.toUpperCase()}</h3><p>Pilih kiri atau kanan; semua koin bergeser dan jalur drop menjadi baris. Panah menunjukkan sisi masuk yang benar. Setelah 4 giliran berikutnya, gravitasi otomatis kembali ke bawah dan koin jatuh dengan animasi pemulihan.</p></section><section><h3>04 / ${CARD_BY_ID.flip.name.toUpperCase()}</h3><p>Papan tidak berputar dan gravitasi tetap ke bawah. Di tiap kolom, koin paling atas bertukar tempat dengan koin paling bawah, sementara tumpukan koin tetap rapi di dasar kolom. Sebelum drop berikutnya, koin diselesaikan mengikuti gravitasi. Ghost preview memakai posisi final tersebut.</p></section><section><h3>05 / EFFECT DURATION</h3><p>1 ronde = 2 giliran penuh berikutnya, tidak termasuk giliran kartu dimainkan. ${
      CARD_BY_ID.overload.name
    } tidak mempercepat timer. Bar protokol menunjukkan sisa giliran; animasi dan log memberi tanda saat efek berakhir. Setiap kartu offensive juga memiliki cooldown: setelah dipakai, kartu terkunci sesuai jumlah ronde dan tidak ditawarkan lagi sampai pulih.</p></section><section><h3>06 / TACTICAL INTERACTIONS</h3><p>${
      CARD_BY_ID.shield.name
    } menahan semua penghapusan selama durasinya. ${
      CARD_BY_ID.lock.name
    } melekat pada jalur fisik. ${
      CARD_BY_ID.ouroboros.name
    } memulihkan dua kolom asal meskipun papan diperluas. Jika kedua pemain terhubung bersamaan, hasilnya draw.</p></section></div><div class="motion-control"><p>Efek visual tidak mengubah hasil permainan.<br>Preferensi reduced motion perangkat tetap dihormati.</p><button class="subtle-button" id="motionToggle" aria-pressed="${
      ui.motion
    }">MOTION / ${ui.motion ? "ON" : "OFF"}</button></div>`,
    "guide",
    true
  );
  $("motionToggle").onclick = () => {
    ui.motion = !ui.motion;
    document.documentElement.dataset.motion = ui.motion ? "on" : "off";
    try {
      localStorage.setItem("fourfold.motion", ui.motion ? "on" : "off");
    } catch (_) {}
    $("motionToggle").textContent = `MOTION / ${ui.motion ? "ON" : "OFF"}`;
    $("motionToggle").setAttribute("aria-pressed", String(ui.motion));
  };
}
function requestNewOperation() {
  if (ui.busy || ui.modal) return;
  if (ui.net) {
    $("menuButton").click();
    return;
  }
  if (!ui.game || ui.game.s.ended) {
    beginSetup();
    return;
  }
  showDialog(
    `<button class="dialog-close" data-close aria-label="Batal">${icon(
      "close"
    )}</button><div class="eyebrow">OPERATION CONTROL</div><h2 id="modalTitle">LEAVE THE FIELD?</h2><p class="dialog-intro">Match saat ini dan kedua loadout akan direset. Tidak ada perubahan jika kamu memilih lanjutkan.</p><div class="option-grid"><button class="option-button" data-close>${icon(
      "arrow-left"
    )}<span><strong>CONTINUE</strong><small>Kembali ke operasi</small></span></button><button class="option-button" id="confirmReset">${icon(
      "grid"
    )}<span><strong>NEW LOADOUT</strong><small>Mulai persiapan baru</small></span></button></div>`,
    "confirm",
    true
  );
  $("confirmReset").onclick = beginSetup;
}
function showWinner() {
  if (!ui.game?.s.ended || ui.resultShown || ui.modal) return;
  ui.resultShown = true;
  const s = ui.game.s;
  showDialog(
    `<div class="winner-icon">${icon(
      s.winner ? "trophy" : "ouroboros"
    )}</div><div class="eyebrow">OPERATION COMPLETE</div><h2 id="modalTitle">${
      s.winner ? `${pname(s.winner)} WINS.` : "TACTICAL DRAW."
    }</h2><p class="dialog-intro">${
      s.winner ? `Connect ${s.target}. Medan berhasil dikuasai.` : s.drawReason
    }</p><button class="primary-button" id="rematch"><span>REMATCH / SAME LOADOUTS</span>${icon(
      "arrow-right"
    )}</button><button class="subtle-button" id="editLoadouts">NEW MATCH / EDIT LOADOUTS</button><button class="icon-button" style="margin:20px auto 0" data-close>VIEW BATTLEFIELD</button>`,
    "winner",
    true
  );
  $("rematch").onclick = ui.net ? () => backToLobby() : startOperation;
  $("editLoadouts").onclick = beginSetup;
  if (ui.net) {
    $("rematch").querySelector("span").textContent = "BACK TO LOBBY";
    $("editLoadouts").hidden = false;
    $("editLoadouts").textContent = "LEAVE ROOM / MAIN MENU";
    $("editLoadouts").onclick = () => {
      netClose();
      showMenu();
    };
  }
}
function takeAction(action) {
  if (!ui.game || ui.busy) return;
  if (ui.net && !ui.net.remote && ui.game.s.turn !== ui.net.me) return;
  hideTooltip();
  clearHover();
  const before = captureTokens(),
    previousTurn = ui.game.s.turn;
  ui.game.error = "";
  if (!action()) {
    if (ui.game.error) toast(ui.game.error);
    if (!ui.modal && !ui.game.sent && mine() && ui.game.s.offer) showOffer();
    else if (
      !ui.modal &&
      !ui.game.sent &&
      mine() &&
      ui.game.s.pending?.type === "options"
    )
      showOptions();
    return;
  }
  presentResult(before, previousTurn, ui.game.drainEvents());
}
function presentResult(before, previousTurn, events) {
  AudioSystem.result(before, events, ui.game);
  if (ui.net?.host) netPush(events);
  ui.busy = true;
  renderBattle();
  const duration = animateTransition(before, events);
  enqueueAnnouncements(events);
  const complete = () => {
    ui.busy = false;
    syncControls();
    if (ui.game.s.offer) {
      if (mine()) showOffer();
    } else if (ui.game.s.pending?.type === "options") {
      if (mine()) showOptions();
    } else if (ui.game.s.ended) later(showWinner, 350);
    else if (previousTurn !== ui.game.s.turn && motionAllowed())
      $("turnEmblem").animate(
        [
          { opacity: 0.3, transform: "translateY(4px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 320 }
      );
    announce(
      events
        .filter((e) => e.type === "expiry")
        .map((e) => e.context.message)
        .join(" ") ||
        ui.game.s.pending?.title ||
        `Giliran Player ${ui.game.s.turn}. ${
          ui.game.s.phase
            ? "Selesaikan aksi tambahan."
            : "Pilih deploy atau kartu."
        }`
    );
    if (
      !ui.modal &&
      !ui.game.s.ended &&
      (ui.game.s.pending || document.activeElement === document.body)
    ) {
      $("board")
        .querySelector(
          ui.game.s.pending ? ".selected,.clickable" : '.cell[tabindex="0"]'
        )
        ?.focus({ preventScroll: true });
    }
  };
  if (duration) later(complete, duration);
  else complete();
}
