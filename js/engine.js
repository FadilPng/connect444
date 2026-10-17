"use strict";
// The engine has no DOM dependencies, so physics and turn timing can be tested independently.
class FourfoldEngine {
  constructor(loadouts = {1:["gravity","flip","purge"],2:["gravity","flip","purge"]}, random = Math.random) {
    this.random = random;
    this.error = "";
    this.events = [];
    this.s = {
      board:Array.from({length:6}, () => Array(7).fill(null)), turn:1, turns:0, nextId:1,
      gravity:"down", gravityTurns:0, target:4, targetTurns:0,
      neutralTurns:0, neutralCard:"colorblind", neutralMax:2,
      ouroTurns:0, ouroRight:null, locks:{}, expansions:0,
      loadouts:{1:[...new Set(loadouts[1] || [])].filter(id => CARD_BY_ID[id]),2:[...new Set(loadouts[2] || [])].filter(id => CARD_BY_ID[id])},
      removed:{1:[],2:[]}, lastDropId:null, previousCard:null, offer:null, playing:null, pending:null,
      forced:null, enforce:null, overloadFor:null, overloadActive:false, actions:[], phase:null, recyclePending:false,
      ended:false, winner:null, drawReason:"", winningCells:[], log:[]
    };
    this.log("Operasi dimulai. Player 01 bergerak lebih dulu.", "system");
  }
  get height() { return this.s.board.length; }
  get width() { return this.s.board[0].length; }
  get sideways() { return this.s.gravity === "left" || this.s.gravity === "right"; }
  get laneCount() { return this.sideways ? this.height : this.width; }
  get axis() { return this.sideways ? "row" : "col"; }
  other(player = this.s.turn) { return player === 1 ? 2 : 1; }
  fail(message) { this.error = message; return false; }
  log(text, kind = "action") {
    this.s.log.unshift({text,kind,turn:this.s.turns + 1,player:this.s.turn});
    this.s.log = this.s.log.slice(0,40);
  }
  fx(id, context = {}, type = "cast") { this.events.push({id,context,type,player:this.s.turn}); }
  expire(id, text, context = {}) { this.log(text,"expiry"); this.fx(id,{...context,message:text},"expiry"); }
  drainEvents() { return this.events.splice(0); }
  coins() {
    const result = [];
    this.s.board.forEach((row,r) => row.forEach((coin,c) => { if (coin) result.push({r,c,coin}); }));
    return result;
  }
  findCoin(id) { return this.coins().find(x => x.coin.id === id) || null; }
  locked(lane, axis = this.axis) { return (this.s.locks[`${axis}:${lane}`] || 0) > 0; }
  laneForCell(r,c) { return this.s.pending?.type === "column" ? c : this.sideways ? r : c; }
  canDrop(lane) {
    if (!Number.isInteger(lane) || lane < 0 || lane >= this.laneCount || this.locked(lane)) return false;
    const used = this.sideways ? this.s.board[lane].filter(Boolean).length : this.s.board.filter(row => row[lane]).length;
    return used < (this.sideways ? this.width : this.height);
  }
  landing(lane) {
    if (!this.canDrop(lane)) return null;
    // Drops settle a mirrored field first; the preview uses that exact same settled layout.
    if (!this.sideways) {
      const count = this.s.board.filter(row => row[lane]).length;
      return {r:this.s.gravity === "up" ? count : this.height - count - 1,c:lane};
    }
    const count = this.s.board[lane].filter(Boolean).length;
    return {r:lane,c:this.s.gravity === "left" ? count : this.width - count - 1};
  }
  hasDrop() { return Array.from({length:this.laneCount},(_,i) => i).some(lane => this.canDrop(lane)); }
  available(player = this.s.turn) { return this.s.loadouts[player].filter(id => !this.s.removed[player].includes(id)); }
  usable(id, player = this.s.turn, seen = new Set()) {
    if (!CARD_BY_ID[id] || seen.has(id)) return false;
    seen.add(id);
    const coins = this.coins();
    switch (id) {
      case "mimic": return !!this.s.previousCard && this.usable(this.s.previousCard,player,seen);
      case "expansion": return this.s.expansions < 2;
      case "purge": case "void": case "flip": case "ouroboros": return coins.length > 0;
      case "bottom": return this.s.board[this.height-1].some(Boolean);
      case "magnetic": { const last = this.findCoin(this.s.lastDropId); return !!last && coins.some(x => x.coin.id !== last.coin.id); }
      case "recycle": case "decoy": return this.hasDrop();
      case "heavy": case "bomb": case "superbomb": return this.s.gravity === "down" && this.hasDrop();
      case "shield": return coins.some(x => x.coin.owner === player && !x.coin.shield);
      case "reposition": return coins.length > 1;
      case "demotion": return this.available(this.other(player)).length > 0;
      case "lock": return Array.from({length:this.laneCount},(_,i) => i).some(i => !this.locked(i));
      default: return true;
    }
  }
  allows(kind, player = this.s.turn) {
    return player !== this.s.turn || ((!this.s.enforce || this.s.enforce === kind) && (!this.s.phase || this.s.phase === kind));
  }
  canAct(kind) { return !this.s.ended && !this.s.offer && !this.s.pending && !this.s.playing && this.allows(kind); }
  hasLegalAction(player = this.s.turn) {
    return (this.allows("drop",player) && this.hasDrop()) || (this.allows("card",player) && this.available(player).some(id => this.usable(id,player)));
  }
  weightedSample(ids, count) {
    const pool = [...ids], result = [];
    while (pool.length && result.length < count) {
      let roll = this.random() * pool.reduce((sum,id) => sum + 6 - CARD_BY_ID[id].weight,0);
      let index = 0;
      while (index < pool.length-1) { roll -= 6 - CARD_BY_ID[pool[index]].weight; if (roll < 0) break; index++; }
      result.push(pool.splice(index,1)[0]);
    }
    return result;
  }
  drawOffer() {
    if (!this.canAct("card")) return this.fail("Aksi kartu tidak tersedia saat ini.");
    const usable = this.available().filter(id => this.usable(id));
    if (!usable.length) return this.fail("Belum ada kartu yang bisa digunakan. Deploy koin atau pass jika perlu.");
    this.s.offer = this.weightedSample(usable,3);
    return true;
  }
  setPending(type,title,data = {}) { this.s.pending = {type,title,...data}; }
  chooseCard(requested) {
    if (this.s.ended || this.s.pending || !this.s.offer?.includes(requested) || !this.available().includes(requested) || !this.usable(requested) || !this.allows("card")) return this.fail("Kartu bukan bagian dari penawaran yang valid.");
    const id = requested === "mimic" ? this.s.previousCard : requested;
    this.s.offer = null;
    this.s.playing = {id,requested,context:{}};
    if (requested === "mimic") this.fx("mimic",{copied:id});
    const all = this.coins();
    switch (id) {
      case "purge": this.setPending("coin","Pilih satu koin untuk dihapus.",{candidates:all.map(x => x.coin.id)}); break;
      case "magnetic": {
        const last = this.findCoin(this.s.lastDropId);
        const others = all.filter(x => x.coin.id !== last.coin.id);
        const nearest = Math.min(...others.map(x => Math.abs(x.r-last.r)+Math.abs(x.c-last.c)));
        this.s.playing.context.origin = {r:last.r,c:last.c};
        this.setPending("coin","Pilih koin terdekat yang ditandai.",{candidates:others.filter(x => Math.abs(x.r-last.r)+Math.abs(x.c-last.c) === nearest).map(x => x.coin.id)});
        break;
      }
      case "heavy": case "bomb": case "superbomb": case "decoy":
        this.setPending("drop",`Pilih jalur untuk ${CARD_BY_ID[id].name}.`,{values:Array.from({length:this.laneCount},(_,i) => i).filter(i => this.canDrop(i))}); break;
      case "bottom":
        this.s.playing.context.cells = Array.from({length:this.width},(_,c) => ({r:this.height-1,c}));
        for (let c=0;c<this.width;c++) this.removeAt(this.height-1,c);
        this.finishCard(); break;
      case "void":
        this.setPending("column","Pilih kolom yang akan dikosongkan.",{values:Array.from({length:this.width},(_,c) => c).filter(c => this.s.board.some(row => row[c]))}); break;
      case "gravity": this.setPending("options","GRAVITY VECTOR",{options:[["left","SHIFT LEFT","Masuk dari sisi kanan","arrow-left"],["right","SHIFT RIGHT","Masuk dari sisi kiri","arrow-right"]]}); break;
      case "ouroboros":
        if (!this.s.ouroTurns) {
          this.s.ouroRight = this.width-1;
          this.s.board.forEach(row => { [row[0],row[this.s.ouroRight]] = [row[this.s.ouroRight],row[0]]; });
        }
        this.s.ouroTurns = 5;
        this.s.playing.context.right = this.s.ouroRight;
        this.finishCard(); break;
      case "expansion": this.setPending("options","EXPAND THE FIELD",{options:[["col","ADD COLUMN","Satu kolom di kanan","expand-col"],["row","ADD ROW","Satu baris di atas","expand-row"]]}); break;
      case "flip":
        // The board never turns. Every coin trades places with the coin at
        // the opposite end of its column, so the top coin becomes the
        // bottom one while gravity keeps pulling down.
        this.flipBoard();
        this.finishCard(); break;
      case "forced": this.setPending("options","RESTRICT OPPONENT",{options:[["drop","FORCE DEPLOY","Lawan wajib drop sekali","deploy"],["card","FORCE CARD","Lawan wajib memakai kartu","cards"]]}); break;
      case "threshold": this.setPending("options","CHANGE THE OBJECTIVE",{options:[["3","CONNECT 3","Tiga koin berurutan","target3"],["5","CONNECT 5","Lima koin berurutan","target5"]]}); break;
      case "colorblind": case "colorblindplus":
        this.s.neutralMax = id === "colorblind" ? 2 : 4;
        this.s.neutralTurns = this.s.neutralMax + 1;
        this.s.neutralCard = id;
        this.finishCard(); break;
      case "recycle": this.finishCard(true); break;
      case "demotion": {
        const available = this.available(this.other());
        const removed = available[Math.min(available.length-1,Math.floor(this.random()*available.length))];
        this.s.removed[this.other()].push(removed);
        this.s.playing.context.removed = removed;
        this.log(`P${this.other()}: ${CARD_BY_ID[removed].name} dinonaktifkan hingga match selesai.`);
        this.finishCard(); break;
      }
      case "shield": this.setPending("coin","Pilih koin milikmu untuk dilindungi.",{candidates:all.filter(x => x.coin.owner === this.s.turn && !x.coin.shield).map(x => x.coin.id)}); break;
      case "overload": this.s.overloadFor = this.s.turn; this.finishCard(); break;
      case "lock": this.setPending("lane",`Pilih ${this.sideways ? "baris" : "kolom"} untuk dikunci.`,{values:Array.from({length:this.laneCount},(_,i) => i).filter(i => !this.locked(i))}); break;
      case "reposition": this.setPending("swap-first","Pilih koin pertama untuk ditukar.",{candidates:all.map(x => x.coin.id)}); break;
      default: return this.fail("Efek kartu tidak ditemukan.");
    }
    return true;
  }
  chooseOption(value) {
    const pending = this.s.pending;
    if (pending?.type !== "options" || !pending.options.some(option => option[0] === value)) return this.fail("Pilihan tidak valid.");
    const {id,context} = this.s.playing;
    switch (id) {
      case "gravity":
        this.s.gravity = value;
        this.s.gravityTurns = 5;
        this.settle();
        context.direction = value;
        break;
      case "expansion":
        if (this.s.expansions >= 2) return this.fail("Medan sudah diperluas dua kali.");
        if (value === "col") this.s.board.forEach(row => row.push(null));
        else {
          this.s.board.unshift(Array(this.width).fill(null));
          this.s.locks = Object.fromEntries(Object.entries(this.s.locks).map(([key,turns]) => {
            const [axis,index] = key.split(":");
            return [axis === "row" ? `row:${Number(index)+1}` : key,turns];
          }));
        }
        this.s.expansions++;
        context.direction = value;
        break;
      case "forced": this.s.forced = {player:this.other(),kind:value}; context.kind = value; break;
      case "threshold": this.s.target = Number(value); this.s.targetTurns = 5; context.target = Number(value); break;
    }
    this.s.pending = null;
    this.finishCard();
    return true;
  }
  chooseTarget(r,c) {
    const pending = this.s.pending, coin = this.s.board[r]?.[c];
    if (!pending?.candidates || !coin || !pending.candidates.includes(coin.id)) return this.fail("Pilih salah satu koin yang ditandai.");
    if (pending.type === "swap-first") {
      this.setPending("swap-second","Pilih koin kedua untuk ditukar.",{firstId:coin.id,candidates:this.coins().filter(x => x.coin.id !== coin.id).map(x => x.coin.id)});
      return true;
    }
    const {id,context} = this.s.playing;
    context.cells = [{r,c,id:coin.id}];
    if (id === "reposition") {
      const first = this.findCoin(pending.firstId);
      if (!first) return this.fail("Koin pertama sudah tidak tersedia.");
      context.cells.unshift({r:first.r,c:first.c});
      [this.s.board[first.r][first.c],this.s.board[r][c]] = [this.s.board[r][c],this.s.board[first.r][first.c]];
    } else if (id === "shield") coin.shield = 5;
    else this.removeAt(r,c);
    this.s.pending = null;
    this.finishCard();
    return true;
  }
  chooseLane(lane) {
    const pending = this.s.pending;
    if (!pending?.values?.includes(lane)) return this.fail("Jalur itu tidak bisa dipilih.");
    if (pending.type === "drop") return this.drop(lane);
    const context = this.s.playing.context;
    context.lane = lane;
    if (pending.type === "column") {
      context.axis = "col";
      context.cells = Array.from({length:this.height},(_,r) => ({r,c:lane}));
      for (let r=0;r<this.height;r++) this.removeAt(r,lane);
    } else if (pending.type === "lane") {
      context.axis = this.axis;
      this.s.locks[`${this.axis}:${lane}`] = 3;
      context.cells = this.laneCells(lane,this.axis);
    } else return this.fail("Aksi jalur tidak valid.");
    this.s.pending = null;
    this.finishCard();
    return true;
  }
  laneCells(lane,axis) { return axis === "row" ? Array.from({length:this.width},(_,c) => ({r:lane,c})) : Array.from({length:this.height},(_,r) => ({r,c:lane})); }
  actOnCell(r,c) {
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= this.height || c >= this.width || this.s.ended || this.s.offer) return false;
    if (this.s.pending?.candidates) return this.chooseTarget(r,c);
    if (this.s.pending?.values) return this.chooseLane(this.laneForCell(r,c));
    return this.drop(this.sideways ? r : c);
  }
  removeAt(r,c) {
    const coin = this.s.board[r]?.[c];
    if (!coin) return false;
    if (coin.shield > 0) { this.fx("shield",{cells:[{r,c}],message:"Shield menahan serangan."},"resist"); return false; }
    this.s.board[r][c] = null;
    return true;
  }
  // Mirrors every coin across the horizontal axis and settles the board again.
  // With gravity still pointing down this means the topmost coin of each
  // column trades places with the bottom one, and the stack keeps its
  // shape — so the result stays put instead of falling back.
  flipBoard() {
    const height = this.height;
    this.s.board = Array.from({length:height}, (_,r) => this.s.board[height-1-r].slice());
    this.settle();
    this.s.playing && (this.s.playing.context.flipped = true);
  }
  drop(lane) {
    const cardDrop = this.s.pending?.type === "drop" && !!this.s.playing;
    if (this.s.ended || this.s.offer || (!cardDrop && !this.canAct("drop"))) return this.fail("Selesaikan aksi saat ini terlebih dahulu.");
    if (!this.canDrop(lane)) return this.fail("Jalur penuh atau sedang dikunci.");
    this.settle();
    const {r,c} = this.landing(lane);
    const kind = cardDrop ? this.s.playing.id : "normal";
    const coin = {id:this.s.nextId++,owner:kind === "decoy" ? 0 : this.s.turn,kind,shield:0};
    if (this.s.board[r][c]) return this.fail("Ruang tersebut sudah terisi.");
    this.s.board[r][c] = coin;
    this.s.lastDropId = coin.id;
    if (cardDrop) {
      const context = this.s.playing.context;
      context.center = {r,c};
      context.coinId = coin.id;
      context.cells = [{r,c}];
      if (kind === "heavy") {
        context.cells = this.laneCells(r,"row");
        for (let col=0;col<this.width;col++) if (col !== c) this.removeAt(r,col);
      }
      if (kind === "bomb" || kind === "superbomb") {
        context.cells = [];
        const radius = kind === "bomb" ? 1 : 2;
        for (let rr=Math.max(0,r-radius);rr<=Math.min(this.height-1,r+radius);rr++) {
          for (let cc=Math.max(0,c-radius);cc<=Math.min(this.width-1,c+radius);cc++) { context.cells.push({r:rr,c:cc}); this.removeAt(rr,cc); }
        }
      }
      this.s.pending = null;
      this.finishCard();
    } else {
      this.log(`P${this.s.turn} deploy di ${String.fromCharCode(65+c)}${r+1}.`);
      this.settle();
      this.checkWin();
      if (!this.s.ended) this.completeAction("drop");
    }
    return true;
  }
  finishCard(recycle = false) {
    const playing = this.s.playing;
    if (!playing) return;
    this.s.pending = null;
    this.s.previousCard = playing.id;
    this.log(`P${this.s.turn} menggunakan ${playing.requested === "mimic" ? "Mimic / " : ""}${CARD_BY_ID[playing.id].name}.`,"card");
    this.fx(playing.id,playing.context);
    this.s.playing = null;
    this.settle();
    this.checkWin();
    if (this.s.ended) return;
    if (recycle) {
      this.s.recyclePending = true;
      this.s.phase = "drop";
      if (this.s.enforce === "card") { this.s.enforce = null; this.expire("forced","Forced Action selesai: aksi kartu dipenuhi."); }
      return;
    }
    this.completeAction("card");
  }
  completeAction(kind) {
    if (this.s.ended) return;
    if (this.s.recyclePending && kind === "drop") {
      this.s.recyclePending = false;
      this.s.phase = null;
      kind = "card";
      this.expire("recycle","Recycle selesai: drop pengganti dikerahkan.");
    }
    this.s.actions.push(kind);
    if (this.s.enforce === kind) { this.s.enforce = null; this.expire("forced","Forced Action selesai: batasan dilepas."); }
    if (this.s.overloadActive && this.s.actions.length === 1) {
      const next = kind === "drop" ? "card" : "drop";
      const possible = next === "drop" ? this.hasDrop() : this.available().some(id => this.usable(id));
      if (possible) { this.s.phase = next; return; }
    }
    this.endTurn();
  }
  endTurn() {
    if (this.s.ended) return;
    if (this.s.overloadActive) this.expire("overload","Overload selesai: jatah aksi ekstra habis.");
    if (this.s.enforce) this.expire("forced","Forced Action berakhir.");
    this.tickEffects();
    this.checkWin();
    if (this.s.ended) return;
    this.s.turns++;
    this.s.turn = this.other();
    this.s.actions = [];
    this.s.phase = null;
    this.s.enforce = null;
    this.s.overloadActive = false;
    if (this.s.forced?.player === this.s.turn) {
      const kind = this.s.forced.kind;
      this.s.forced = null;
      const possible = kind === "drop" ? this.hasDrop() : this.available().some(id => this.usable(id));
      if (possible) this.s.enforce = kind;
      else this.expire("forced","Forced Action dilepas: aksi yang diwajibkan tidak tersedia.");
    }
    if (this.s.overloadFor === this.s.turn) { this.s.overloadActive = true; this.s.overloadFor = null; }
    if (!this.hasTemporaryEffects() && !this.hasLegalAction(1) && !this.hasLegalAction(2)) this.endMatch(null,"Kedua pemain tidak memiliki aksi legal.");
  }
  tickEffects() {
    if (this.s.ended) return;
    // A fresh N-round effect stores 2*N+1: the caster's own tick is not a future turn.
    if (this.s.gravityTurns && --this.s.gravityTurns === 0) {
      this.s.gravity = "down";
      this.settle();
      this.expire("gravity","Gravity Shift habis. Gravitasi kembali ke bawah.",{direction:"down"});
    }
    if (this.s.targetTurns && --this.s.targetTurns === 0) { this.s.target = 4; this.expire("threshold","Threshold Shift habis. Target kembali Connect 4.",{target:4}); }
    if (this.s.neutralTurns && --this.s.neutralTurns === 0) this.expire(this.s.neutralCard,"Colorblind habis. Warna dan pemeriksaan kemenangan dipulihkan.");
    if (this.s.ouroTurns && --this.s.ouroTurns === 0) {
      const right = this.s.ouroRight;
      if (right !== null && right < this.width) this.s.board.forEach(row => { [row[0],row[right]] = [row[right],row[0]]; });
      this.s.ouroRight = null;
      this.expire("ouroboros","Ouroboros habis. Kedua kolom asal dipulihkan.",{right});
    }
    for (const [key,turns] of Object.entries(this.s.locks)) {
      this.s.locks[key] = turns-1;
      if (this.s.locks[key] <= 0) {
        delete this.s.locks[key];
        const [axis,index] = key.split(":"), lane = Number(index);
        this.expire("lock",`${axis === "col" ? "Column" : "Row"} Lock habis. Jalur ${lane+1} terbuka.`,{axis,lane,cells:this.laneCells(lane,axis)});
      }
    }
    const unshielded = [];
    for (const x of this.coins()) if (x.coin.shield > 0 && --x.coin.shield === 0) unshielded.push({r:x.r,c:x.c,id:x.coin.id});
    if (unshielded.length) this.expire("shield",`Shield habis pada ${unshielded.length} koin.`,{cells:unshielded});
    this.settle();
  }
  settle() {
    if (!this.sideways) {
      for (let c=0;c<this.width;c++) {
        const coins = this.s.board.map(row => row[c]).filter(Boolean);
        for (let r=0;r<this.height;r++) this.s.board[r][c] = null;
        const start = this.s.gravity === "up" ? 0 : this.height-coins.length;
        coins.forEach((coin,index) => { this.s.board[start+index][c] = coin; });
      }
    } else {
      this.s.board = this.s.board.map(row => {
        const coins = row.filter(Boolean), blanks = Array(this.width-coins.length).fill(null);
        return this.s.gravity === "left" ? [...coins,...blanks] : [...blanks,...coins];
      });
    }
  }
  hasTemporaryEffects() {
    return this.s.gravityTurns || this.s.targetTurns || this.s.neutralTurns || this.s.ouroTurns || Object.keys(this.s.locks).length || this.coins().some(x => x.coin.shield);
  }
  checkWin() {
    if (this.s.ended || this.s.neutralTurns) return;
    const winners = new Set(), cells = new Set();
    for (const {r,c,coin} of this.coins()) {
      if (!coin.owner) continue;
      for (const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
        const line = Array.from({length:this.s.target},(_,k) => ({r:r+dr*k,c:c+dc*k}));
        if (line.every(x => this.s.board[x.r]?.[x.c]?.owner === coin.owner)) { winners.add(coin.owner); line.forEach(x => cells.add(`${x.r},${x.c}`)); }
      }
    }
    if (winners.size) {
      this.s.winningCells = [...cells];
      this.endMatch(winners.size === 1 ? [...winners][0] : null,winners.size > 1 ? "Kedua pemain terhubung pada saat bersamaan." : "");
    }
  }
  endMatch(winner,reason) {
    this.s.ended = true;
    this.s.winner = winner;
    this.s.drawReason = reason;
    this.log(winner ? `Player 0${winner} menang. Connect ${this.s.target}.` : `Draw. ${reason}`,"result");
  }
  pass() {
    if (this.s.ended || this.s.offer || this.s.pending || this.hasLegalAction()) return this.fail("Pass hanya tersedia jika tidak ada aksi legal.");
    this.log(`P${this.s.turn} pass: tidak ada aksi legal.`);
    this.endTurn();
    return true;
  }
  protocols() {
    const p = [];
    const add = (id,name,remaining,max,label = "") => p.push({id,name,remaining:Math.min(remaining,max),max,label});
    if (this.s.gravityTurns) add("gravity",`Gravity / ${this.s.gravity.toUpperCase()}`,this.s.gravityTurns,4);
    if (this.s.targetTurns) add("threshold",`Connect ${this.s.target}`,this.s.targetTurns,4);
    if (this.s.neutralTurns) add(this.s.neutralCard,CARD_BY_ID[this.s.neutralCard].name,this.s.neutralTurns,this.s.neutralMax);
    if (this.s.ouroTurns) add("ouroboros","Ouroboros",this.s.ouroTurns,4);
    for (const [key,turns] of Object.entries(this.s.locks)) {
      const [axis,index] = key.split(":");
      add("lock",`${axis === "row" ? "Row" : "Column"} Lock / ${Number(index)+1}`,turns,2);
    }
    for (const x of this.coins().filter(x => x.coin.shield)) add("shield",`Shield / ${String.fromCharCode(65+x.c)}${x.r+1}`,x.coin.shield,4);
    if (this.s.forced || this.s.enforce) add("forced","Forced Action",1,1,this.s.enforce ? "THIS TURN" : "NEXT TURN");
    if (this.s.overloadFor || this.s.overloadActive) add("overload","Overload",1,1,this.s.overloadActive ? "ACTIVE" : "QUEUED");
    if (this.s.recyclePending) add("recycle","Recycle",1,1,"DROP READY");
    return p;
  }
}
