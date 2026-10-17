const W = 7,
  H = 6;
let state = {};
let selecting = { player: 1, loadouts: { 1: [], 2: [] }, step: 0 };
let modalRoot = document.getElementById("modalRoot");
let winnerTimer = null;
let lastToast = { msg: "", at: 0 };
// UI-only animation state (not part of the game state):
let pendingBoardFx = null; // one-shot board animation: "flip" | "boom" | "slide-left" | "slide-right" | "shake"
let lastAnimatedCoinId = null; // so the drop animation plays once per coin
let lastCutinTurn = null; // so the "TAKE YOUR TURN" cut-in fires once per turn change
// Effects tick once at the end of EVERY player's turn, including the caster's
// own end-of-turn tick in the same turn the card was played. So an effect that
// should last N full rounds (= 2N subsequent player turns) is stored as 2N+1.
function durationForRounds(rounds) {
  return rounds * 2 + 1;
}
// The single place a completed card is written to the match log.
function logPlayedCard() {
  if (!state.played) return;
  const name = CARDS.find((c) => c.id === state.played)?.name || "a card";
  const label = state.playedFromMimic ? `Mimic → ${name}` : name;
  state.log.unshift(`P${state.turn} used ${label}.`);
  state.playedFromMimic = false;
}
const fresh = () => ({
  board: Array.from({ length: H }, () => Array(W).fill(null)),
  turn: 1,
  gravity: "down",
  target: 4,
  rounds: 0,
  lastDropCoinId: null,
  nextCoinId: 1,
  locks: {}, // keyed "col:N" / "row:N" — a lock sticks to its physical lane
  played: null,
  playedFromMimic: false,
  previousCard: null,
  currentOffer: null,
  forced: null,
  overloadFor: null,
  overloadActive: false,
  targetTurns: 0,
  neutralTurns: 0,
  gravityTurns: 0,
  ouroTurns: 0,
  ouroActive: false,
  ouroRightIndex: null,
  turnActions: [],
  extraPhase: null,
  enforce: null,
  expansions: 0,
  // Copy — never alias the setup object, or match-time edits would leak back.
  loadouts: {
    1: [...(selecting.loadouts[1] || [])],
    2: [...(selecting.loadouts[2] || [])],
  },
  removed: { 1: [], 2: [] },
  log: [],
  ended: false,
  winner: null,
  drawReason: null,
  winningCells: [],
  selection: null,
  repositionFirst: null,
  pendingDrop: null,
  recyclePending: false,
  skipSettlementOnce: false,
  cardMode: false,
});
function initSetup() {
  if (winnerTimer) {
    clearTimeout(winnerTimer);
    winnerTimer = null;
  }
  selecting = { player: 1, loadouts: { 1: [], 2: [] }, step: 0 };
  renderSetup();
}
function renderSetup() {
  const p = selecting.player,
    chosen = selecting.loadouts[p],
    sum = chosen.reduce(
      (n, id) => n + CARDS.find((c) => c.id === id).weight,
      0
    );
  modalRoot.innerHTML = `<div class="overlay"><div class="modal"><h2>${
    selecting.step === 0 ? "Build your loadouts" : "Choose your cards"
  }</h2><p>Each player selects cards separately. Spend up to <b>10 points</b>. No duplicates. A higher weight costs more points and also makes the card rarer when offers are drawn.</p><div class="setup-player"><div class="setup-title"><strong style="color:${
    p === 1 ? "var(--cyan)" : "var(--pink)"
  }">PLAYER ${p}</strong><span>${sum} / 10 points · ${
    chosen.length
  } cards</span></div><div class="catalog">${CARDS.map(
    (c) =>
      `<button class="pick ${chosen.includes(c.id) ? "active" : ""}" data-id="${
        c.id
      }" ${
        !chosen.includes(c.id) && sum + c.weight > 10 ? "disabled" : ""
      }><b>${c.name}<span class="weight">${c.weight} pt</span></b><small>${
        c.desc
      }</small></button>`
  ).join(
    ""
  )}</div></div><div class="notice" id="setupNotice"></div><div class="setup-buttons"><span class="hint">Select cards by tapping. Your loadout is hidden when passing the device.</span><button class="btn go" id="setupNext">${
    p === 1 ? "Confirm Player 1 →" : "Start match"
  }</button></div></div></div>`;
  modalRoot.querySelectorAll(".pick").forEach(
    (b) =>
      (b.onclick = () => {
        let id = b.dataset.id;
        if (chosen.includes(id))
          selecting.loadouts[p] = chosen.filter((x) => x !== id);
        else if (sum + CARDS.find((c) => c.id === id).weight <= 10)
          chosen.push(id);
        renderSetup();
      })
  );
  document.getElementById("setupNext").onclick = () => {
    if (!chosen.length) {
      document.getElementById("setupNotice").textContent =
        "Choose at least one card to continue.";
      return;
    }
    if (p === 1) {
      selecting.player = 2;
      selecting.step = 1;
      renderSetup();
    } else {
      startMatch();
    }
  };
}
function startMatch() {
  state = fresh();
  lastCutinTurn = null;
  lastAnimatedCoinId = null;
  pendingBoardFx = null;
  state.log.push("Match started. Player 1 goes first.");
  modalRoot.innerHTML = "";
  render();
}
function allCoins() {
  let a = [];
  state.board.forEach((row, r) =>
    row.forEach((coin, c) => {
      if (coin) a.push({ r, c, coin });
    })
  );
  return a;
}
function other() {
  return state.turn === 1 ? 2 : 1;
}
// Coins carry a stable uid, so "the most recently dropped coin" can be found
// again after the board is flipped, expanded, settled or gravity-shifted.
// (Storing {r,c} coordinates goes stale the moment the board changes shape.)
function findCoinById(id) {
  if (id == null) return null;
  return allCoins().find((x) => x.coin.id === id) || null;
}
function lastDropPosition() {
  const x = findCoinById(state.lastDropCoinId);
  return x ? { r: x.r, c: x.c } : null;
}
function clickColumn(c) {
  if (state.ended || state.cardMode) return;
  if (state.selection) {
    let s = state.selection;
    if (s.columns && !s.columns.includes(c)) return;
    if (s.columns) {
      if (state.pendingDrop) {
        let kind = state.pendingDrop;
        if (!canDropLane(c)) { toast("That lane is full or locked."); return; }
        state.pendingDrop = null;
        state.selection = null;
        dropInColumn(c, kind);
        return;
      }
      state.selection = null;
      s.callback(c);
      render();
      return;
    }
    return;
  }
  if (!canAct("drop")) return;
  dropInColumn(c, "normal");
}
function laneCount() {
  return state.gravity === "left" || state.gravity === "right"
    ? state.board.length
    : state.board[0].length;
}
// A "lane" is a column under vertical gravity and a row under sideways
// gravity. Locks remember WHICH physical lane they were placed on, so a
// Gravity Shift can no longer silently turn a column lock into a row lock
// (or make a lock on column 7 vanish when only 6 row-lanes exist).
function laneAxis() {
  return state.gravity === "left" || state.gravity === "right" ? "row" : "col";
}
function lockKey(lane, axis = laneAxis()) {
  return `${axis}:${lane}`;
}
function isLaneLocked(lane) {
  return !!state.locks[lockKey(lane)];
}
function canAct(kind) {
  return !state.ended && !state.selection && !state.cardMode &&
    (!state.enforce || state.enforce === kind) &&
    (!state.extraPhase || state.extraPhase === kind);
}
function canDropLane(lane) {
  if (!Number.isInteger(lane) || lane < 0 || lane >= laneCount() || isLaneLocked(lane)) return false;
  return state.gravity === "down" || state.gravity === "up"
    ? !state.board[state.gravity === "down" ? 0 : state.board.length-1][lane]
    : !state.board[lane][state.gravity === "left" ? state.board[0].length-1 : 0];
}
// Which lane a board cell belongs to for click-to-drop: its column under
// vertical gravity, its row under sideways gravity. During a Void-style
// physical-column selection it is always the column.
function laneForCell(r, c) {
  if (state.selection?.axis === "column") return c;
  return state.gravity === "left" || state.gravity === "right" ? r : c;
}
// The cell a coin dropped into `lane` would land on (or null). Scans in from
// the entry edge and stops at the last empty cell before the first coin, so
// it is correct even on an unsettled (e.g. just-Flipped) board, and the
// hover ghost preview always matches where the coin really lands.
function landingCellForLane(lane) {
  if (!canDropLane(lane)) return null;
  if (state.gravity === "down" || state.gravity === "up") {
    const c = lane;
    const order = Array.from({ length: state.board.length }, (_, i) =>
      state.gravity === "down" ? i : state.board.length - 1 - i
    );
    let r = null;
    for (const rr of order) { if (state.board[rr][c]) break; r = rr; }
    return r === null ? null : { r, c };
  }
  const r = lane;
  const width = state.board[r].length;
  const order = Array.from({ length: width }, (_, i) =>
    state.gravity === "left" ? width - 1 - i : i
  );
  let c = null;
  for (const cc of order) { if (state.board[r][cc]) break; c = cc; }
  return c === null ? null : { r, c };
}
// Hover/focus feedback on the board: highlight the whole lane a click would
// drop into, plus a ghost marker on the landing cell.
function clearLaneHover(boardEl) {
  boardEl
    .querySelectorAll(".lane-hover, .landing")
    .forEach((x) => x.classList.remove("lane-hover", "landing", "landing-p1", "landing-p2", "landing-neutral"));
}
function highlightLaneHover(r, c) {
  const boardEl = document.getElementById("board");
  if (!boardEl || !boardEl.querySelectorAll) return;
  clearLaneHover(boardEl);
  if (state.selection?.candidates) return; // coin-targeting: candidates already glow
  const lane = laneForCell(r, c);
  if (state.selection?.columns && !state.selection.columns.includes(lane)) return;
  if (!state.selection && !canAct("drop")) return;
  boardEl.querySelectorAll(".cell").forEach((cell) => {
    if (laneForCell(+cell.dataset.r, +cell.dataset.c) === lane) cell.classList.add("lane-hover");
  });
  // Ghost landing marker applies when the click will drop a coin.
  const dropping = !state.selection || !!state.pendingDrop;
  if (dropping) {
    const land = landingCellForLane(lane);
    if (land) {
      const cell = boardEl.querySelector(`.cell[data-r="${land.r}"][data-c="${land.c}"]`);
      if (cell) cell.classList.add("landing", state.pendingDrop === "decoy" ? "landing-neutral" : "landing-p" + state.turn);
    }
  }
}
function dropInColumn(lane, kind = "normal") {
  if (state.ended || (kind === "normal" && !canAct("drop"))) return;
  if (!canDropLane(lane)) { toast("That lane is full or locked."); return; }
  const landing = landingCellForLane(lane);
  if (!landing) { toast("That entry is blocked."); return; }
  const { r, c } = landing;
  // Invariant: a drop NEVER replaces a coin that is already on the board.
  if (state.board[r][c]) { toast("That entry is blocked."); return; }
  let owner = kind === "decoy" ? -1 : state.turn;
  const coin = { id: state.nextCoinId++, owner, kind, shield: 0 };
  state.board[r][c] = coin;
  state.lastDropCoinId = coin.id;
  if (kind !== "normal") logPlayedCard();
  if (kind === "heavy") {
    for (let j = 0; j < state.board[r].length; j++) if (j !== c) removeAt(r, j);
    pendingBoardFx = "shake";
  }
  if (kind === "bomb" || kind === "superbomb") {
    const radius = kind === "superbomb" ? 2 : 1;
    for (let rr = Math.max(0, r-radius); rr <= Math.min(state.board.length-1,r+radius); rr++)
      for (let cc = Math.max(0,c-radius); cc <= Math.min(state.board[0].length-1,c+radius); cc++) removeAt(rr,cc);
    state.log.unshift(`${kind === "bomb" ? "Bomb Coin" : "Super Bomb"} exploded.`);
    pendingBoardFx = "boom";
  }
  if (kind !== "normal") state.previousCard = { id: state.played };
  settleBoard();
  checkWin();
  if (state.ended) return;
  completeTurn(kind === "normal" ? "drop" : "card");
}
function completeTurn(action = "card") {
  if (state.ended) return;
  const p = state.turn;
  state.turnActions.push(action);
  // Recycle's replacement drop completes the original card action.
  if (state.recyclePending && action === "drop") {
    state.recyclePending = false;
    state.turnActions.pop();
    state.turnActions.push("card");
  }
  // A Forced Action is satisfied by performing the forced kind ONCE. Once it
  // is satisfied the restriction lifts, so it no longer silently deletes the
  // extra action Overload promised this player.
  if (state.enforce && state.turnActions.includes(state.enforce)) {
    state.enforce = null;
  }
  if (state.overloadActive && state.turnActions.length === 1) {
    const next = state.turnActions[0] === "card" ? "drop" : "card";
    // Impossible extra actions are skipped.
    const possible = next === "drop" ? Array.from({length:laneCount()},(_,i)=>i).some(canDropLane)
      : state.loadouts[p].some(id => !state.removed[p].includes(id) && isUsable(id));
    if (possible && (!state.enforce || state.enforce === next)) {
      state.extraPhase = next;
      render();
      return;
    }
  }
  endTurn(p);
}
function endTurn(p) {
  state.rounds++;
  tickEffects(p);
  if (state.ended) return;
  state.log.unshift(`Player ${p} ended their turn.`);
  state.turn = p === 1 ? 2 : 1;
  state.turnActions = [];
  state.extraPhase = null;
  state.overloadActive = false;
  state.enforce = null;
  if (state.forced?.player === state.turn) {
    state.enforce = state.forced.kind;
    state.forced = null;
    const possible = state.enforce === "drop"
      ? Array.from({length:laneCount()},(_,i)=>i).some(canDropLane)
      : state.loadouts[state.turn].some(id => !state.removed[state.turn].includes(id) && isUsable(id));
    if (!possible) {
      state.log.unshift("Forced action unavailable; restriction waived.");
      state.enforce = null;
    }
  }
  if (state.overloadFor === state.turn) {
    state.overloadActive = true;
    state.overloadFor = null;
  }
  checkStalemate();
  render();
}
function tickEffects(player) {
  ["targetTurns", "neutralTurns", "gravityTurns", "ouroTurns"].forEach((k) => {
    if (state[k] > 0) {
      state[k]--;
      if (state[k] === 0) {
        if (k === "targetTurns") state.target = 4;
        if (k === "neutralTurns") {
        }
        if (k === "gravityTurns") state.gravity = "down";
        if (k === "ouroTurns" && state.ouroActive) {
          // Restore exactly the two columns that were swapped (the recorded
          // right column, not whatever happens to be last after Expansions).
          const right = Math.min(
            state.ouroRightIndex ?? state.board[0].length - 1,
            state.board[0].length - 1
          );
          state.board.forEach(
            (row) => ([row[0], row[right]] = [row[right], row[0]])
          );
          state.ouroActive = false;
          state.ouroRightIndex = null;
        }
      }
    }
  });
  for (let c in state.locks) {
    state.locks[c]--;
    if (state.locks[c] <= 0) delete state.locks[c];
  }
  allCoins().forEach((x) => {
    if (x.coin.shield > 0) x.coin.shield--;
  });
  // Timers are decremented once, in the loop above.
  if (!state.skipSettlementOnce) settleBoard();
  state.skipSettlementOnce = false;
  checkWin();
}
function checkWin() {
  if (state.ended || state.neutralTurns > 0) return;
  const winners = new Set();
  const winCells = new Map(); // "r,c" -> {r,c}, for highlighting the line
  let dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ],
    need = state.target;
  for (let r = 0; r < state.board.length; r++)
    for (let c = 0; c < state.board[r].length; c++) {
      let coin = state.board[r][c];
      if (!coin || coin.owner < 1) continue;
      for (let [dr, dc] of dirs) {
        let n = 1;
        for (let k = 1; k < need; k++) {
          let rr = r + dr * k,
            cc = c + dc * k;
          if (state.board[rr]?.[cc]?.owner === coin.owner) n++;
          else break;
        }
        if (n >= need) {
          winners.add(coin.owner);
          for (let k = 0; k < need; k++) {
            const rr = r + dr * k,
              cc = c + dc * k;
            winCells.set(`${rr},${cc}`, { r: rr, c: cc });
          }
        }
      }
    }
  if (winners.size) {
    state.ended = true;
    state.winningCells = [...winCells.values()];
    state.winner = winners.size === 1 ? [...winners][0] : null;
    state.drawReason = winners.size > 1 ? "Both players connected at the same time." : null;
    showWinner();
  }
}
function finishAction(recycle = false) {
  state.selection = null;
  state.pendingDrop = null;
  state.repositionFirst = null;
  logPlayedCard();
  state.previousCard = { id: state.played };
  if (!pendingBoardFx && (state.played === "bottom" || state.played === "void"))
    pendingBoardFx = "shake";
  if (state.played !== "flip") settleBoard();
  else state.skipSettlementOnce = true;
  // EVERY completed card runs the win check after settling — including
  // Recycle, whose settle can itself drop coins into a winning line.
  checkWin();
  if (state.ended) return;
  if (recycle) {
    state.extraPhase = "drop";
    state.recyclePending = true;
    state.enforce = null; // The forced card was used; allow its replacement drop.
    render();
    return;
  }
  completeTurn();
}
function settleBoard() {
  const h = state.board.length,
    w = state.board[0].length;
  if (state.gravity === "down" || state.gravity === "up") {
    for (let c = 0; c < w; c++) {
      let cells = state.board.map((row) => row[c]).filter(Boolean);
      for (let r = 0; r < h; r++) state.board[r][c] = null;
      let start = state.gravity === "down" ? h - cells.length : 0;
      cells.forEach((x, i) => (state.board[start + i][c] = x));
    }
  } else {
    for (let r = 0; r < h; r++) {
      let cells = state.board[r].filter(Boolean);
      state.board[r] =
        state.gravity === "left"
          ? [...cells, ...Array(w - cells.length).fill(null)]
          : [...Array(w - cells.length).fill(null), ...cells];
    }
  }
}
function settleSide(dir) {
  state.gravity = dir;
  settleBoard();
}
function render() {
  if (!state.board) return;
  let rows = state.board.length,
    cols = state.board[0].length;
  document.getElementById("turnAvatar").className = "avatar p" + state.turn;
  document.getElementById("turnAvatar").textContent = "P" + state.turn;
  document.getElementById(
    "turnName"
  ).textContent = `Player ${state.turn}'s turn`;
  document.getElementById("turnPrompt").textContent =
    state.selection?.title ||
    (state.enforce
      ? `Forced to ${state.enforce}`
      : state.extraPhase
      ? `Overload: ${state.extraPhase} action`
      : state.overloadFor === state.turn
      ? "Overload ready — choose drop or card"
      : "Choose your move");
  document.getElementById("count1").textContent = allCoins().filter(
    (x) => x.coin.owner === 1
  ).length;
  document.getElementById("count2").textContent = allCoins().filter(
    (x) => x.coin.owner === 2
  ).length;
  document.getElementById("gravityLabel").textContent =
    (state.gravity === "down"
      ? "▼"
      : state.gravity === "up"
      ? "▲"
      : state.gravity === "left"
      ? "◀"
      : "▶") +
    " Gravity: " +
    state.gravity;
  document.getElementById("boardInfo").textContent = `${cols} columns · connect ${state.target}`;
  // "TAKE YOUR TURN" cut-in, once per actual turn change.
  if (lastCutinTurn !== state.turn) {
    lastCutinTurn = state.turn;
    const cutin = document.getElementById("turnCutin");
    if (cutin) {
      cutin.textContent = `PLAYER ${state.turn} — TAKE YOUR TURN!`;
      cutin.className = "turn-cutin";
      void cutin.offsetWidth; // restart the CSS animation
      cutin.className = `turn-cutin show p${state.turn}`;
    }
  }
  // Active-effects HUD (durations shown in remaining player turns).
  const chips = [];
  if (state.gravity === "left" || state.gravity === "right")
    chips.push(`GRAVITY ${state.gravity === "left" ? "◀" : "▶"} ${state.gravityTurns}T`);
  if (state.targetTurns > 0) chips.push(`CONNECT ${state.target} · ${state.targetTurns}T`);
  if (state.neutralTurns > 0) chips.push(`COLORBLIND · ${state.neutralTurns}T`);
  if (state.ouroActive) chips.push(`OUROBOROS · ${state.ouroTurns}T`);
  for (const [key, turns] of Object.entries(state.locks)) {
    const [axis, idx] = key.split(":");
    chips.push(`🔒 ${axis === "col" ? "COL" : "ROW"} ${Number(idx) + 1} · ${turns}T`);
  }
  if (state.forced) chips.push(`P${state.forced.player} FORCED: ${state.forced.kind.toUpperCase()}`);
  if (state.overloadActive) chips.push("OVERLOAD ACTIVE");
  else if (state.overloadFor) chips.push(`OVERLOAD → P${state.overloadFor}`);
  if (state.previousCard) {
    const prev = CARDS.find((c) => c.id === state.previousCard.id);
    if (prev) chips.push(`LAST CARD: ${prev.name.toUpperCase()}`);
  }
  const effectBar = document.getElementById("effectBar");
  if (effectBar)
    effectBar.innerHTML = chips.length
      ? chips.map((x) => `<span class="effect-chip">${x}</span>`).join("")
      : '<span class="effect-chip dim">NO ACTIVE EFFECTS</span>';
  let board = document.getElementById("board");
  board.dataset.gravity = state.gravity; // lets the drop animation fly in from the entry side
  const cellMin =
    typeof window !== "undefined" && window.innerWidth && window.innerWidth <= 520 ? 28 : 35;
  board.style.gridTemplateColumns = `repeat(${cols},minmax(${cellMin}px,1fr))`;
  if (pendingBoardFx && board.classList) {
    board.classList.remove("Fx-flip", "Fx-boom", "Fx-shake", "Fx-slide-left", "Fx-slide-right");
    void board.offsetWidth;
    board.classList.add("Fx-" + pendingBoardFx);
    pendingBoardFx = null;
  }
  const animateCoinId =
    state.lastDropCoinId !== null && state.lastDropCoinId !== lastAnimatedCoinId
      ? state.lastDropCoinId
      : null;
  board.innerHTML = state.board
    .map((row, r) =>
      row
        .map((coin, c) => {
          const lane = laneForCell(r, c);
          const isCandidate =
            state.selection?.candidates?.some((x) => x.r === r && x.c === c) ||
            (state.repositionFirst?.r === r && state.repositionFirst?.c === c);
          const isWin = state.winningCells?.some((x) => x.r === r && x.c === c);
          const locked = state.selection?.axis !== "column" && isLaneLocked(lane);
          const clickable =
            !!isCandidate ||
            (state.selection?.columns
              ? state.selection.columns.includes(lane)
              : !state.selection && canAct("drop") && canDropLane(lane));
          const glyph = !coin
            ? ""
            : state.neutralTurns > 0
            ? "?"
            : coin.owner === 1
            ? "1"
            : coin.owner === 2
            ? "2"
            : "✕";
          const label = `Row ${r + 1}, column ${c + 1}${
            coin
              ? state.neutralTurns > 0
                ? ", coin, color hidden"
                : coin.owner > 0
                ? `, player ${coin.owner} coin`
                : ", neutral decoy coin"
              : ", empty"
          }`;
          return `<div class="cell ${isCandidate ? "selected" : ""} ${isWin ? "win" : ""} ${
            locked ? "locked" : ""
          } ${clickable ? "clickable" : ""}" data-r="${r}" data-c="${c}" tabindex="0" role="button" aria-label="${label}">${
            coin
              ? `<div class="coin ${
                  state.neutralTurns > 0 ? "neutral" : coin.owner === 1
                    ? "p1"
                    : coin.owner === 2
                    ? "p2"
                    : "neutral"
                } ${coin.shield ? "shielded" : ""} ${
                  coin.kind === "bomb" || coin.kind === "superbomb" ? "bomb" : ""
                } ${coin.id === animateCoinId ? "just-dropped" : ""}">${glyph}</div>`
              : ""
          }</div>`;
        })
        .join("")
    )
    .join("");
  if (animateCoinId !== null) lastAnimatedCoinId = animateCoinId;
  board.querySelectorAll(".cell").forEach((el) => {
    el.onclick = () => {
      let r = +el.dataset.r,
        c = +el.dataset.c;
      if (state.selection?.candidates) {
        let x = state.selection.candidates.find((x) => x.r === r && x.c === c);
        if (x) {
          let cb = state.selection.callback;
          state.selection = null;
          cb([x]);
          render();
        }
        return;
      }
      // No drop-row anymore: clicking ANY cell drops into that cell's lane
      // (its column, or its row when gravity is sideways), and likewise
      // resolves lane/column selections (card coins, Lock, Void).
      clickColumn(laneForCell(r, c));
    };
    el.onmouseenter = () => highlightLaneHover(+el.dataset.r, +el.dataset.c);
    el.onfocus = () => highlightLaneHover(+el.dataset.r, +el.dataset.c);
    el.onkeydown = (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        el.onclick();
      }
    };
  });
  board.onmouseleave = () => clearLaneHover(board);
  let hand = document.getElementById("hand"),
    ids = state.loadouts[state.turn] || [];
  hand.innerHTML =
    ids
      .filter((id) => !state.removed[state.turn].includes(id))
      .map((id) => CARDS.find((c) => c.id === id))
      .map(
        (c) =>
          `<div class="hand-card"><h3>${c.name}<span class="weight">${c.weight} pt</span></h3><p>${c.desc}</p></div>`
      )
      .join("") || '<div class="hint">No cards in this loadout.</div>';
  document.getElementById("budgetLabel").textContent =
    ids
      .filter((id) => !state.removed[state.turn].includes(id))
      .reduce((s, id) => s + CARDS.find((c) => c.id === id).weight, 0) +
    " / 10 pts";
  document.getElementById("log").innerHTML = state.log
    .slice(0, 12)
    .map((x) => `<div>${x}</div>`)
    .join("");
  let enforce = state.enforce;
  document.getElementById("dropAction").disabled =
    state.ended ||
    !!state.selection ||
    enforce === "card" ||
    state.extraPhase === "card";
  document.getElementById("cardAction").disabled =
    state.ended ||
    !!state.selection ||
    enforce === "drop" ||
    state.extraPhase === "drop";
  document.getElementById("dropAction").onclick = () => {
    const b = document.getElementById("board");
    if (b && b.classList) {
      b.classList.remove("aiming");
      void b.offsetWidth;
      b.classList.add("aiming");
      setTimeout(() => b.classList.remove("aiming"), 1300);
    }
    document.getElementById("gameNotice").textContent =
      state.gravity === "left" || state.gravity === "right"
        ? "Click a row on the board to drop your coin into it."
        : "Click a column on the board to drop your coin into it.";
  };
  document.getElementById("cardAction").onclick = showOffer;
  const pass = document.getElementById("passAction");
  pass.hidden = state.ended || !!state.selection || hasLegalAction();
  pass.onclick = passTurn;
  document.getElementById("gameNotice").textContent =
    state.selection?.title || "";
  document.getElementById("newGame").onclick = initSetup;
}
function showWinner() {
  render(); // shows the highlighted winning line before the modal covers it
  const endedState = state;
  const heading = state.winner ? `Player ${state.winner} wins!` : "It's a draw!";
  const detail = state.winner ? `Connect ${state.target}. Nicely played.` : state.drawReason;
  const medal = state.winner ? "🏆" : "🤝";
  if (winnerTimer) clearTimeout(winnerTimer);
  winnerTimer = setTimeout(() => {
    winnerTimer = null;
    // Bail if a new match/setup replaced this finished game in the meantime.
    if (state !== endedState || !state.ended || document.getElementById("setupNext")) return;
    modalRoot.innerHTML = `<div class="overlay"><div class="modal winner" role="dialog" aria-modal="true" aria-label="Match result"><div class="medal">${medal}</div><h2>${heading}</h2><p>${detail}</p><button class="btn go" id="again">New match / edit loadouts</button></div></div>`;
    document.getElementById("again").onclick = initSetup;
  }, 900);
}
function hasLegalAction(player = state.turn) {
  const old = state.turn;
  state.turn = player;
  try {
    // Model the SAME restrictions canAct() enforces — enforce AND extraPhase —
    // otherwise the Pass button can stay hidden for a player who actually has
    // no clickable action in their current Overload/Recycle phase.
    const restriction = player === old ? state.enforce : null;
    const phase = player === old ? state.extraPhase : null;
    const allowed = (kind) =>
      (!restriction || restriction === kind) && (!phase || phase === kind);
    const drop = allowed("drop") && Array.from({length:laneCount()},(_,i)=>i).some(canDropLane);
    const card = allowed("card") && state.loadouts[player].some(id => !state.removed[player].includes(id) && isUsable(id));
    return drop || card;
  } finally { state.turn = old; }
}
function checkStalemate() {
  if (state.ended || state.selection) return;
  const temporary = ["targetTurns","neutralTurns","gravityTurns","ouroTurns"].some(k => state[k] > 0) || Object.keys(state.locks).length || allCoins().some(x=>x.coin.shield>0);
  if (!temporary && !hasLegalAction(1) && !hasLegalAction(2)) {
    state.ended = true;
    state.winner = null;
    state.drawReason = "Neither player has a legal action.";
    showWinner();
  }
}
function passTurn() {
  if (state.ended || state.selection || state.cardMode || hasLegalAction()) return;
  state.log.unshift(`P${state.turn} passes: no legal action.`);
  endTurn(state.turn);
}
function toast(msg) {
  // Coalesce repeats (e.g. several shielded coins caught in one Bomb) instead
  // of stacking identical toasts on top of each other.
  const now = Date.now();
  if (lastToast.msg === msg && now - lastToast.at < 1000) return;
  lastToast = { msg, at: now };
  let t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
initSetup();
