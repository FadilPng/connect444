"use strict";
function runRegressionTests() {
  const results = [];
  const assert = (condition,message = "Assertion failed") => { if (!condition) throw new Error(message); };
  const test = (name,check) => { try { check(); results.push({name,passed:true}); } catch (error) { results.push({name,passed:false,error:error.message}); } };
  const make = (ids = ["recycle"],otherIds = ids) => new FourfoldEngine({1:ids,2:otherIds},() => 0);
  const put = (g,r,c,owner = 0,shield = 0) => {
    const coin = {id:g.s.nextId++,owner,kind:"normal",shield};
    g.s.board[r][c] = coin;
    return coin;
  };
  const play = (g,id) => { g.s.offer = [id]; assert(g.chooseCard(id),g.error || `${id} could not be played`); };
  const expired = (g,id) => g.events.filter(event => event.id === id && event.type === "expiry");

  test("23 unique cards, valid weights, and dedicated icons",() => {
    assert(CARDS.length === 23 && new Set(CARDS.map(c => c.id)).size === 23);
    assert(CARDS.every(c => Number.isInteger(c.weight) && c.weight >= 1 && c.weight <= 5 && ICONS[c.id] && CATEGORY_COLOR[c.category]));
  });
  test("Fresh board and independent loadout copies",() => {
    const deck = ["gravity","flip"], g = make(deck);
    assert(g.height === 6 && g.width === 7 && g.coins().length === 0);
    g.s.loadouts[1].pop(); assert(deck.length === 2 && g.s.loadouts[2].length === 2);
  });
  test("Normal drops preserve existing coins and match the preview",() => {
    const g = make();
    assert(g.landing(2).r === 5 && g.drop(2));
    const first = g.s.board[5][2];
    assert(g.landing(2).r === 4 && g.drop(2));
    assert(g.s.board[5][2] === first && g.s.board[4][2].owner === 2);
    assert(!g.drop(-1) && !g.drop(7) && !g.drop(1.5));
  });
  test("Gravity Shift left: stable coin order and row entry",() => {
    const g = make(["gravity","recycle"]), a = put(g,5,4,1), b = put(g,5,6,2);
    play(g,"gravity"); assert(g.chooseOption("left"));
    assert(g.s.board[5][0] === a && g.s.board[5][1] === b);
    assert(g.laneCount === 6 && g.landing(5).c === 2 && g.s.gravityTurns === 4);
    assert(g.drop(5) && g.s.board[5][2].owner === 2);
  });
  test("Gravity Shift right: stable order and opposite entry",() => {
    const g = make(["gravity"]), a = put(g,5,0,1), b = put(g,5,3,2);
    play(g,"gravity"); g.chooseOption("right");
    assert(g.s.board[5][5] === a && g.s.board[5][6] === b);
    assert(g.landing(5).c === 4 && g.drop(5) && g.s.board[5][4].owner === 2);
  });
  test("Gravity Shift lasts four future full turns and restores down",() => {
    const g = make(["gravity"]);
    play(g,"gravity"); g.chooseOption("left");
    for (let i=0;i<4;i++) {
      assert(g.s.gravityTurns === 4-i);
      assert(g.drop(i));
      if (i < 3) assert(g.s.gravity === "left");
    }
    assert(g.s.gravity === "down" && g.s.gravityTurns === 0 && g.laneCount === 7);
    assert(expired(g,"gravity").length === 1 && g.coins().length === 4);
  });
  test("Recasting gravity changes direction and refreshes, not stacks",() => {
    const g = make(["gravity"]);
    play(g,"gravity"); g.chooseOption("left");
    play(g,"gravity"); g.chooseOption("right");
    assert(g.s.gravity === "right" && g.s.gravityTurns === 4);
  });
  test("Flip trades the top and bottom coin of a column, gravity unchanged",() => {
    const g = make(["flip","recycle"]), lower = put(g,5,1,1), upper = put(g,4,1,2);
    play(g,"flip");
    // The top coin sinks to the bottom, the bottom coin rises to the top.
    assert(g.s.board[4][1] === lower && g.s.board[5][1] === upper);
    assert(g.s.gravity === "down" && g.s.turn === 2);
    // The stack keeps its shape, so the next coin still lands on top of it.
    assert(g.canDrop(1) && g.landing(1).r === 3);
    assert(g.drop(1) && g.s.board[3][1].owner === 2);
    assert(g.s.board[4][1] === lower && g.s.board[5][1] === upper);
    assert(g.coins().length === 3 && g.s.target === 4);
  });
  test("A flipped order survives unrelated cards and end-of-turn ticks",() => {
    const g = make(["flip","overload"]), top = put(g,4,2,1), bottom = put(g,5,2,2);
    play(g,"flip"); play(g,"overload");
    assert(g.s.board[4][2] === bottom && g.s.board[5][2] === top);
    g.tickEffects(); assert(g.s.board[4][2] === bottom && g.s.board[5][2] === top);
  });
  test("Double Flip swaps the same two coins back",() => {
    const g = make(["flip"]), bottom = put(g,5,2,0), top = put(g,4,2,1);
    play(g,"flip");
    assert(g.s.board[4][2] === bottom && g.s.board[5][2] === top);
    play(g,"flip");
    assert(g.s.board[4][2] === top && g.s.board[5][2] === bottom);
    assert(g.coins().length === 2);
  });
  test("A Gravity Shift after a Flip settles the flipped stack",() => {
    const g = make(["flip","gravity"]), coin = put(g,5,4,1);
    play(g,"flip"); play(g,"gravity"); g.chooseOption("left");
    assert(g.s.gravity === "left" && g.s.board[5][0] === coin);
  });
  test("Overload does not tick durations between its two actions",() => {
    const g = make(["shield"]);
    g.s.gravity = "left"; g.s.gravityTurns = 4; g.s.overloadActive = true;
    assert(g.drop(0));
    assert(g.s.turn === 1 && g.s.phase === "card" && g.s.gravityTurns === 4);
    play(g,"shield"); assert(g.chooseTarget(0,0));
    assert(g.s.turn === 2 && g.s.gravityTurns === 3 && g.s.board[0][0].shield === 4);
    assert(expired(g,"overload").length === 1);
  });
  test("Forced Action is lifted before an Overload extra action",() => {
    const g = make(["forced","recycle"]);
    g.s.overloadFor = 2;
    play(g,"forced"); g.chooseOption("drop");
    assert(g.s.turn === 2 && g.s.enforce === "drop" && g.s.overloadActive);
    assert(g.drop(0) && !g.s.enforce && g.s.phase === "card");
    play(g,"recycle"); assert(g.canAct("drop") && !g.canAct("card"));
    assert(g.drop(1) && g.s.turn === 1 && expired(g,"forced").length === 1);
  });
  test("Shield resists repeated removal until four future ticks expire",() => {
    const g = make(["shield"]), coin = put(g,5,0,1);
    play(g,"shield"); g.chooseTarget(5,0);
    assert(coin.shield === 4 && !g.removeAt(5,0) && !g.removeAt(5,0));
    for (let i=0;i<3;i++) g.tickEffects();
    assert(coin.shield === 1 && !g.removeAt(5,0));
    g.tickEffects();
    assert(coin.shield === 0 && expired(g,"shield").length === 1 && g.removeAt(5,0));
  });
  test("A physical column lock does not become a row lock",() => {
    const g = make(["lock","gravity"]);
    play(g,"lock"); g.chooseLane(6);
    assert(g.locked(6,"col") && !g.canDrop(6));
    play(g,"gravity"); g.chooseOption("left");
    assert(g.locked(6,"col") && !g.locked(0,"row") && g.canDrop(0));
    g.tickEffects();
    assert(!g.locked(6,"col") && expired(g,"lock")[0].context.axis === "col");
  });
  test("Expansion remaps row locks to the same physical row",() => {
    const g = make(["lock","expansion"]);
    g.s.gravity = "left";
    play(g,"lock"); g.chooseLane(0);
    play(g,"expansion"); g.chooseOption("row");
    assert(g.height === 7 && g.locked(1,"row") && !g.locked(0,"row"));
  });
  test("Ouroboros restores its original right column after Expansion",() => {
    const g = make(["ouroboros","expansion"]), a = put(g,5,0), b = put(g,5,6);
    play(g,"ouroboros"); assert(g.s.board[5][0] === b);
    play(g,"expansion"); g.chooseOption("col");
    assert(g.width === 8 && g.s.ouroRight === 6 && g.s.ouroTurns === 3);
    for (let i=0;i<3;i++) g.tickEffects();
    assert(g.s.board[5][0] === a && g.s.board[5][6] === b && !g.s.board[5][7]);
    assert(expired(g,"ouroboros").length === 1);
  });
  test("Recasting Ouroboros refreshes without toggling the swap",() => {
    const g = make(["ouroboros"]), a = put(g,5,0), b = put(g,5,6);
    for (let i=0;i<3;i++) { play(g,"ouroboros"); assert(g.s.board[5][0] === b && g.s.ouroTurns === 4); }
    for (let i=0;i<4;i++) g.tickEffects();
    assert(g.s.board[5][0] === a && g.s.board[5][6] === b);
  });
  test("Threshold checks both players immediately and can draw",() => {
    const g = make(["threshold"]);
    for (let c=0;c<3;c++) put(g,5,c,1);
    for (let c=3;c<6;c++) put(g,5,c,2);
    play(g,"threshold"); g.chooseOption("3");
    assert(g.s.ended && g.s.winner === null && g.s.winningCells.length === 6);
  });
  test("Threshold expiry restores Connect 4 exactly once",() => {
    const g = make(); g.s.target = 5; g.s.targetTurns = 1;
    g.tickEffects(); g.tickEffects();
    assert(g.s.target === 4 && expired(g,"threshold").length === 1);
  });
  test("Colorblind delays wins, preserves ownership, then restores checks",() => {
    const g = make(["colorblind"]);
    for (let c=0;c<4;c++) put(g,5,c,1);
    play(g,"colorblind");
    assert(!g.s.ended && g.s.neutralTurns === 2 && g.s.board[5][0].owner === 1);
    g.tickEffects(); g.checkWin(); assert(!g.s.ended);
    g.tickEffects(); g.checkWin();
    assert(g.s.ended && g.s.winner === 1 && expired(g,"colorblind").length === 1);
  });
  test("Colorblind+ has its own four-turn expiry event",() => {
    const g = make(["colorblindplus"]);
    play(g,"colorblindplus"); assert(g.s.neutralTurns === 4);
    for (let i=0;i<4;i++) g.tickEffects();
    assert(expired(g,"colorblindplus").length === 1 && !g.s.neutralTurns);
  });
  test("Recycle replacement drop completes one original card action",() => {
    const g = make(["recycle"]);
    play(g,"recycle");
    assert(g.s.turn === 1 && g.s.turns === 0 && g.s.recyclePending && !g.canAct("card"));
    assert(g.drop(0));
    assert(g.s.turn === 2 && g.s.turns === 1 && !g.s.recyclePending && g.s.previousCard === "recycle");
    assert(g.s.log.filter(entry => entry.kind === "card").length === 1 && expired(g,"recycle").length === 1);
  });
  test("Demotion permanently removes a card from future offers",() => {
    const g = make(["demotion"],["shield","recycle"]);
    play(g,"demotion");
    assert(g.s.removed[2].includes("shield") && !g.available(2).includes("shield"));
    assert(g.drawOffer() && !g.s.offer.includes("shield"));
  });
  test("Mimic follows the resolved effect and safely chains",() => {
    const g = make(["flip","mimic"]), bottom = put(g,5,2), top = put(g,4,2);
    play(g,"flip"); play(g,"mimic");
    // Flip + Mimic = dua kali flip, jadi susunan kembali seperti semula.
    assert(g.s.previousCard === "flip" && g.s.board[4][2] === top && g.s.board[5][2] === bottom);
    play(g,"mimic");
    assert(g.s.previousCard === "flip" && g.s.board[4][2] === bottom && g.s.board[5][2] === top);
    assert(g.events.filter(event => event.id === "mimic").length === 2);
  });
  test("Magnetic Pull tracks a stable last-coin ID through Flip",() => {
    const g = make(["flip","magnetic"]), a = put(g,5,0,1), b = put(g,5,3,2);
    g.s.lastDropId = b.id;
    play(g,"flip"); play(g,"magnetic");
    assert(g.s.pending.candidates.includes(a.id));
    assert(g.chooseTarget(5,0) && !g.findCoin(a.id) && g.findCoin(b.id).r === 5);
  });
  test("Reposition rejects the first coin as a second target",() => {
    const g = make(["reposition"]), a = put(g,5,0,1), b = put(g,5,4,2);
    play(g,"reposition"); assert(g.chooseTarget(5,0));
    assert(!g.chooseTarget(5,0) && g.s.pending.type === "swap-second");
    assert(g.chooseTarget(5,4) && g.s.board[5][0] === b && g.s.board[5][4] === a);
  });
  test("Four neutral decoys never form a winning line",() => {
    const g = make(["decoy"]);
    for (let c=0;c<3;c++) put(g,5,c);
    play(g,"decoy"); assert(g.chooseLane(3));
    assert(!g.s.ended && g.s.board[5][3].owner === 0 && g.coins().length === 4);
  });
  test("Cards outside the offer, removed cards, and forged targets are rejected",() => {
    const g = make(["gravity","recycle"]);
    g.s.offer = ["recycle"];
    assert(!g.chooseCard("gravity") && !g.chooseCard("purge") && g.s.offer[0] === "recycle");
    g.s.removed[1].push("recycle"); assert(!g.chooseCard("recycle"));
    assert(!g.chooseTarget(5,0) && !g.chooseLane(0) && !g.chooseOption("left"));
  });
  test("Weighted offers contain no duplicates and prefer lower weights",() => {
    let seed = 43;
    const g = make(["purge","superbomb"]);
    g.random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed/4294967296; };
    const sample = g.weightedSample(["purge","superbomb"],3);
    assert(sample.length === 2 && new Set(sample).size === 2);
    let common = 0;
    for (let i=0;i<600;i++) if (g.weightedSample(["purge","superbomb"],1)[0] === "purge") common++;
    assert(common > 430 && common < 570,`Unexpected weighted distribution: ${common}`);
  });
  test("Pass honors an impossible restricted phase",() => {
    const g = make(["gravity"]);
    for (let r=0;r<g.height;r++) for (let c=0;c<g.width;c++) put(g,r,c);
    g.s.phase = "drop"; g.s.overloadActive = true;
    assert(!g.hasLegalAction() && g.pass() && g.s.turn === 2 && !g.s.phase);
  });
  test("A true no-action stalemate ends in a draw",() => {
    const g = make(["recycle"]);
    for (let r=0;r<g.height;r++) for (let c=0;c<g.width;c++) put(g,r,c);
    assert(!g.hasLegalAction(1) && !g.hasLegalAction(2));
    g.endTurn(); assert(g.s.ended && g.s.winner === null && g.s.drawReason);
  });
  test("All four winning directions are recognized",() => {
    for (const [r,c,dr,dc] of [[5,0,0,1],[0,0,1,0],[0,0,1,1],[0,3,1,-1]]) {
      const g = make();
      for (let k=0;k<4;k++) put(g,r+dr*k,c+dc*k,1);
      g.checkWin(); assert(g.s.ended && g.s.winner === 1 && g.s.winningCells.length === 4);
    }
  });
  for (const card of CARDS) test(`Card resolution + visual event: ${card.name}`,() => {
    const g = make([card.id],["recycle"]);
    put(g,5,0,1); put(g,5,2,2); put(g,5,4,1);
    const last = put(g,4,4,2); g.s.lastDropId = last.id; g.s.previousCard = "purge";
    play(g,card.id);
    let guard = 0;
    while (g.s.pending && guard++ < 5) {
      const p = g.s.pending;
      if (p.type === "options") assert(g.chooseOption(p.options[0][0]));
      else if (p.candidates) { const target = g.findCoin(p.candidates[0]); assert(!!target && g.chooseTarget(target.r,target.c)); }
      else assert(g.chooseLane(p.values[0]));
    }
    if (g.s.recyclePending) assert(g.drop(Array.from({length:g.laneCount},(_,i) => i).find(i => g.canDrop(i))));
    assert(!g.s.pending && !g.s.playing && !g.s.offer,`${card.name} left an unfinished action`);
    assert(g.events.some(event => event.id === card.id && event.type === "cast"),`${card.name} has no unique visual event`);
  });
  return {passed:results.filter(result => result.passed).length,total:results.length,failed:results.filter(result => !result.passed),results};
}
