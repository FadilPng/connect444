function playCard(id) {
    // A card may only be played if it is in the player's loadout, was not
    // removed by Demotion, AND is part of the offer currently on screen.
    // (Previously any card id passed here would resolve — e.g. from the
    // browser console — regardless of loadout or offer.)
    const inLoadout =
      !!state.loadouts?.[state.turn]?.includes(id) &&
      !state.removed?.[state.turn]?.includes(id);
    const inOffer = Array.isArray(state.currentOffer) && state.currentOffer.includes(id);
    if (!canAct("card") || !inLoadout || !inOffer || !isUsable(id)) {
      state.currentOffer = null;
      return;
    }
    state.currentOffer = null; // consumed — one play per offer
    const requested = id;
    if (id === "mimic") id = state.previousCard.id;
    const c = CARDS.find((x) => x.id === id);
    if (!c) return;
    state.played = id;
    state.playedFromMimic = requested === "mimic";
    // Keep the resolved effect, including card coins and chained Mimics.
    // (Logging happens once, when the card completes: logPlayedCard().)
    state.previousCard = { id };
    switch (id) {
      case "purge":
        chooseCoin("Choose a coin to remove", (cells) => removeCell(cells));
        return;
      case "magnetic": {
        const last = lastDropPosition();
        let cells = last
          ? allCoins().filter((x) => x.r !== last.r || x.c !== last.c)
          : [];
        if (!cells.length) {
          finishAction();
          return;
        }
        let ds = cells.map(
            (x) => Math.abs(x.r - last.r) + Math.abs(x.c - last.c)
          ),
          m = Math.min(...ds);
        chooseCoin(
          "Choose one of the nearest coins",
          (xs) => { removeAt(xs[0].r, xs[0].c); finishAction(); },
          cells.filter((x, i) => ds[i] === m)
        );
        return;
      }
      case "bottom": {
        let rr = state.board.length - 1;
        for (let c = 0; c < state.board[rr].length; c++)
          if (state.board[rr][c]) removeAt(rr, c);
        finishAction();
        return;
      }
      case "void":
        chooseColumn(
          "Choose a column to erase",
          (c) => {
            for (let r = 0; r < state.board.length; r++)
              if (state.board[r][c]) removeAt(r, c);
            finishAction();
          },
          // Only columns that actually contain a coin — no wasted Voids.
          Array.from({ length: state.board[0].length }, (_, c) => c).filter(
            (c) => state.board.some((row) => row[c])
          )
        );
        return;
      case "heavy":
        dropCardCoin("heavy");
        return;
      case "bomb":
        dropCardCoin("bomb");
        return;
      case "superbomb":
        dropCardCoin("superbomb");
        return;
      case "gravity":
        chooseOptions(
          "Choose gravity direction",
          [
            ["left", "← Left"],
            ["right", "→ Right"],
          ],
          (v) => {
            settleSide(v);
            state.gravityTurns = durationForRounds(2);
            pendingBoardFx = v === "left" ? "slide-left" : "slide-right";
            finishAction();
          }
        );
        return;
      case "ouroboros": {
        // Replaying Ouroboros while it is active only REFRESHES the duration.
        // (Toggling the columns on every cast left them permanently swapped
        // after the timer expired on the third toggle.)
        if (!state.ouroActive) {
          let w = state.board[0].length;
          state.ouroRightIndex = w - 1;
          for (let r = 0; r < state.board.length; r++)
            [state.board[r][0], state.board[r][w - 1]] = [
              state.board[r][w - 1],
              state.board[r][0],
            ];
          state.ouroActive = true;
        }
        state.ouroTurns = durationForRounds(2);
        finishAction();
        return;
      }
      case "expansion":
        chooseOptions(
          "Expand the board",
          [
            ["col", "Add a column"],
            ["row", "Add a row"],
          ],
          (v) => {
            if (state.expansions >= 2) {
              toast("Maximum expansions reached.");
              finishAction(); // resolve the card instead of hanging the turn
              return;
            }
            if (v === "col") {
              state.board.forEach((r) => r.push(null));
            } else {
              state.board.unshift(Array(state.board[0].length).fill(null));
              // Every existing row just moved down one index: row locks move
              // with the physical row they were placed on.
              const remapped = {};
              for (const [key, turns] of Object.entries(state.locks)) {
                const [axis, idx] = key.split(":");
                remapped[axis === "row" ? `row:${Number(idx) + 1}` : key] = turns;
              }
              state.locks = remapped;
            }
            state.expansions++;
            finishAction();
          }
        );
        return;
      case "flip":
        // Mirror every coin VERTICALLY only: top <-> bottom, same column.
        // The board itself, the columns and gravity do not change — coins
        // stay hovering at their mirrored spots until the next settle
        // (finishAction sets skipSettlementOnce for "flip").
        state.board.reverse();
        pendingBoardFx = "flip";
        finishAction();
        return;
      case "forced":
        chooseOptions(
          "Choose opponent’s forced action",
          [
            ["drop", "They must drop"],
            ["card", "They must use a card"],
          ],
          (v) => {
            state.forced = { player: other(), kind: v };
            finishAction();
          }
        );
        return;
      case "threshold":
        chooseOptions(
          "Choose the new target",
          [
            ["3", "Connect 3"],
            ["5", "Connect 5"],
          ],
          (v) => {
            state.target = Number(v);
            state.targetTurns = durationForRounds(2);
            finishAction();
          }
        );
        return;
      case "colorblind":
      case "colorblindplus":
        state.neutralTurns = durationForRounds(id === "colorblind" ? 1 : 2);
        finishAction();
        return;
      case "recycle":
        finishAction(true);
        return;
      case "demotion": {
        let ids = state.loadouts[other()].filter(
          (x) => !state.removed[other()].includes(x)
        );
        if (!ids.length) {
          toast("Opponent has no cards left to remove.");
          finishAction();
          return;
        }
        let gone = ids[Math.floor(Math.random() * ids.length)];
        state.removed[other()].push(gone);
        toast(
          `Demotion removed ${
            CARDS.find((x) => x.id === gone).name
          } from P${other()}'s loadout.`
        );
        finishAction();
        return;
      }
      case "shield":
        chooseCoin(
          "Choose one of your coins to shield",
          (cells) => {
            cells[0].coin.shield = durationForRounds(2);
            finishAction();
          },
          allCoins().filter((x) => x.coin.owner === state.turn && !x.coin.shield)
        );
        return;
      case "overload":
        state.overloadFor = state.turn;
        finishAction();
        return;
      case "lock":
        chooseLane("Choose a lane to lock", (c) => {
          state.locks[lockKey(c)] = durationForRounds(1);
          finishAction();
        });
        return;
      case "reposition":
        chooseCoin(
          "Choose the first coin",
          (cells) => {
            let first = cells[0];
            // Kept separately from state.selection (which chooseCoin is about
            // to overwrite) so render() can keep the first coin highlighted.
            state.repositionFirst = first;
            chooseCoin(
              "Choose the coin to swap with",
              (cells2) => {
                let second = cells2[0];
                [state.board[first.r][first.c], state.board[second.r][second.c]] =
                  [
                    state.board[second.r][second.c],
                    state.board[first.r][first.c],
                  ];
                state.selection = null;
                finishAction();
              },
              allCoins().filter((x) => x.r !== first.r || x.c !== first.c)
            );
          },
          allCoins()
        );
        return;
      case "decoy":
        placeDecoy();
        return;
      default:
        finishAction();
    }
  }
  function chooseCoin(title, callback, candidates = allCoins()) {
    if (!candidates.length) {
      toast("No valid targets.");
      finishAction();
      return;
    }
    state.selection = { title, callback, candidates };
    render();
    document.getElementById("gameNotice").textContent = title;
    document.getElementById("dropAction").disabled = true;
    document.getElementById("cardAction").disabled = true;
  }
  function chooseColumn(
    title,
    callback,
    columns = Array.from({ length: state.board[0].length }, (_, i) => i)
  ) {
    if (!columns.length) {
      toast("No valid columns.");
      finishAction();
      return;
    }
    state.selection = { title, callback, axis: "column", columns };
    render();
    document.getElementById("gameNotice").textContent = title;
  }
  function chooseLane(title, callback) {
    state.selection = {
      title,
      callback,
      columns: Array.from({ length: laneCount() }, (_, i) => i).filter(
        (c) => !isLaneLocked(c)
      ),
    };
    if (!state.selection.columns.length) {
      toast("No valid lanes.");
      finishAction();
      return;
    }
    render();
    document.getElementById("gameNotice").textContent = title;
  }
  function chooseOptions(title, opts, callback) {
    modalRoot.innerHTML = `<div class="overlay"><div class="modal"><h2>${title}</h2><div class="offer-grid">${opts
      .map(
        ([v, l]) => `<button class="offer" data-v="${v}"><h3>${l}</h3></button>`
      )
      .join("")}</div></div></div>`;
    modalRoot.querySelectorAll(".offer").forEach(
      (b) =>
        (b.onclick = () => {
          modalRoot.innerHTML = "";
          callback(b.dataset.v);
        })
    );
  }
  function removeCell(cells) {
    let x = cells[0];
    if (x) removeAt(x.r, x.c);
    finishAction();
  }
  function removeAt(r, c) {
    let coin = state.board[r]?.[c];
    if (!coin) return false;
    if (coin.shield > 0) {
      // Shield is removal IMMUNITY for its whole duration (as the card
      // says: "protect ... for 2 rounds") — it is not consumed by one hit.
      // The timer in tickEffects is what wears it off.
      toast("Shield blocked the removal!");
      return false;
    }
    state.board[r][c] = null;
    return true;
  }
  function dropCardCoin(kind) {
    state.pendingDrop = kind;
    state.selection = {
      title: "Choose a column to drop into",
      columns: Array.from({ length: laneCount() }, (_, i) => i).filter(
        (c) => canDropLane(c)
      ),
    };
    if (!state.selection.columns.length) { finishAction(); return; }
    render();
    document.getElementById("gameNotice").textContent =
      "Choose a lane for the card coin.";
  }
  function placeDecoy() {
    state.pendingDrop = "decoy";
    state.selection = {
      title: "Choose a lane for Decoy",
      columns: Array.from({ length: laneCount() }, (_, i) => i).filter(
        (c) => canDropLane(c)
      ),
    };
    if (!state.selection.columns.length) { finishAction(); return; }
    render();
  }
  