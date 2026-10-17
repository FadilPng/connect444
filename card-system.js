function showOffer() {
    if (!canAct("card")) return;
    let available = state.loadouts[state.turn].filter(
      (id) => !state.removed[state.turn].includes(id) && isUsable(id)
    );
    if (!available.length) {
      state.currentOffer = null;
      toast("No usable cards in your loadout. Choose Drop instead.");
      return;
    }
    let chosen = weightedSample(available, Math.min(3, available.length));
    // Remember the offer: playCard() only accepts cards from this list.
    state.currentOffer = chosen;
    state.cardMode = true;
    modalRoot.innerHTML = `<div class="overlay"><div class="modal"><h2>Choose an action card</h2><p>Pick one. You cannot cancel after choosing Use Card.</p><div class="offer-grid">${chosen
      .map((id) => {
        let c = CARDS.find((x) => x.id === id);
        return `<button class="offer" data-id="${id}"><span class="rarity">WEIGHT ${
          c.weight
        } · ${"★".repeat(c.weight)}</span><h3>${c.name}</h3><p>${
          c.desc
        }</p></button>`;
      })
      .join("")}</div></div></div>`;
    modalRoot.querySelectorAll(".offer").forEach(
      (b) =>
        (b.onclick = () => {
          modalRoot.innerHTML = "";
          state.cardMode = false;
          playCard(b.dataset.id);
        })
    );
  }
  function weightedSample(ids, n) {
    let a = [...ids],
      out = [];
    while (out.length < n && a.length) {
      let total = a.reduce(
          (s, id) => s + (6 - CARDS.find((c) => c.id === id).weight),
          0
        ),
        r = Math.random() * total,
        idx = 0;
      for (; idx < a.length - 1; idx++) {
        r -= 6 - CARDS.find((c) => c.id === a[idx]).weight;
        if (r < 0) break;
      }
      out.push(a.splice(idx, 1)[0]);
    }
    return out;
  }
  function isUsable(id, seen = new Set()) {
    if (!CARDS.some(c => c.id === id) || seen.has(id)) return false;
    seen.add(id);
    const coins = allCoins();
    const drop = Array.from({length:laneCount()},(_,i)=>i).some(canDropLane);
    switch (id) {
      case "mimic": return !!state.previousCard && isUsable(state.previousCard.id, seen);
      case "expansion": return state.expansions < 2;
      case "purge": case "void": case "flip": case "ouroboros": return coins.length > 0;
      case "bottom": return state.board[state.board.length-1].some(Boolean);
      case "magnetic": { const last = lastDropPosition(); return !!last && coins.some(x => x.r !== last.r || x.c !== last.c); }
      case "recycle": case "decoy": return drop;
      case "heavy": case "bomb": case "superbomb": return state.gravity === "down" && drop;
      case "shield": return coins.some(x => x.coin.owner === state.turn && !x.coin.shield);
      case "reposition": return coins.length >= 2;
      case "demotion": return state.loadouts[other()].some(id => !state.removed[other()].includes(id));
      case "lock": return Array.from({length:laneCount()},(_,i)=>i).some(i => !isLaneLocked(i));
      default: return true;
    }
  }
  