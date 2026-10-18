"use strict";
/* ---------- ONLINE (WebRTC via PeerJS, tanpa database) ---------- */
const PEER_PREFIX = "fourfold-";
// Tanpa TURN, koneksi P2P sering gagal di jaringan seluler/kantor (NAT ketat) dan muncul "waktu habis".
// Open Relay di bawah gratis tapi publik. Untuk lebih stabil, buat akun gratis di metered.ca lalu ganti username/credential.
const TURN_USER = "openrelayproject",
  TURN_PASS = "openrelayproject";
const PEER_OPTS = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:openrelay.metered.ca:80" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: TURN_USER,
        credential: TURN_PASS,
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: TURN_USER,
        credential: TURN_PASS,
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: TURN_USER,
        credential: TURN_PASS,
      },
      {
        urls: "turns:openrelay.metered.ca:443?transport=tcp",
        username: TURN_USER,
        credential: TURN_PASS,
      },
    ],
  },
};
// Opsional: tempel URL kredensial dari dashboard metered.ca (…metered.live/api/v1/turn/credentials?apiKey=…) untuk memakai TURN pribadi.
const METERED_URL = "/api/turn";
async function peerOpts() {
  let servers = PEER_OPTS.config.iceServers;
  if (METERED_URL) {
    try {
      const turn = await (await fetch(METERED_URL)).json();
      if (Array.isArray(turn) && turn.length)
        servers = [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" },
          ...turn,
        ];
    } catch (_) {}
  }
  const config = { iceServers: servers };
  if (new URLSearchParams(location.search).has("relay"))
    config.iceTransportPolicy = "relay";
  return { config };
}
function netDiag(n) {
  const c = n.cands || {};
  return `ICE ${n.ice || "belum mulai"}; kandidat host ${c.host || 0}, srflx ${
    c.srflx || 0
  }, relay ${c.relay || 0}`;
}
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const NET_METHODS = [
  "drawOffer",
  "chooseCard",
  "chooseOption",
  "chooseTarget",
  "chooseLane",
  "actOnCell",
  "drop",
  "pass",
];
const cleanName = (v) =>
  String(v || "")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .trim()
    .slice(0, 14);
function pname(n) {
  return ui.net
    ? (n === ui.net.me ? ui.net.name : ui.net.opp).toUpperCase()
    : `PLAYER ${pad(n)}`;
}
function mine() {
  return !ui.net || ui.game?.s.turn === ui.net.me;
}
function validLoadout(l) {
  return (
    Array.isArray(l) &&
    l.length > 0 &&
    new Set(l).size === l.length &&
    l.every((id) => CARD_BY_ID[id]) &&
    l.reduce((s, id) => s + CARD_BY_ID[id].weight, 0) <= 15
  );
}
function netSend(m) {
  try {
    if (ui.net?.conn?.open) ui.net.conn.send(m);
  } catch (_) {}
}
function netClose() {
  const n = ui.net;
  if (!n) return;
  n.closing = true;
  ui.net = null;
  clearInterval(n.hb);
  try {
    n.conn?.send({ t: "bye" });
  } catch (_) {}
  try {
    n.conn?.close();
  } catch (_) {}
  try {
    n.peer?.destroy();
  } catch (_) {}
}
window.addEventListener("pagehide", () => netSend({ t: "bye" }));
function showWait(title, body) {
  showDialog(
    `<div class="eyebrow">ONLINE / STATUS</div><h2 id="modalTitle">${title}</h2><div class="dialog-intro">${body}</div><button class="subtle-button" id="waitLeave">CANCEL</button>`,
    "wait",
    false
  );
  $("waitLeave").onclick = showMenu;
}
function netFail(text) {
  netClose();
  closeDialog(false);
  toast(text);
}
async function netHost(name, tries = 0) {
  if (typeof Peer === "undefined") {
    toast("Library online gagal dimuat. Periksa koneksi internet.");
    return;
  }
  if (!tries) showWait("CREATING ROOM.", "Menyiapkan room...");
  const opts = await peerOpts();
  if (!ui.modal) return;
  const code = Array.from(
    { length: 5 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
  const n = (ui.net = {
    host: true,
    me: 1,
    name,
    opp: "",
    code,
    mode: "classic",
    lobby: {},
    ready: {},
    peer: new Peer(PEER_PREFIX + code, opts),
  });
  n.peer.on("open", () => {
    showWait(
      "WAITING FOR OPPONENT.",
      `<div class="room-code">${code}</div>Bagikan kode ini ke lawanmu. Loadout-mu tetap rahasia.`
    );
  });
  n.peer.on("connection", (conn) => {
    if (n.conn) conn.close();
    else netBind(n, conn);
  });
  n.peer.on("error", (e) => {
    if (e.type === "unavailable-id" && tries < 4) {
      n.closing = true;
      try {
        n.peer.destroy();
      } catch (_) {}
      ui.net = null;
      netHost(name, tries + 1);
    } else netFail("Koneksi gagal: " + e.type);
  });
}
async function netJoin(name, code) {
  if (typeof Peer === "undefined") {
    toast("Library online gagal dimuat. Periksa koneksi internet.");
    return;
  }
  showWait("CONNECTING.", `Menghubungkan ke room ${code}...`);
  const opts = await peerOpts();
  if (!ui.modal) return;
  const n = (ui.net = {
    host: false,
    me: 2,
    name,
    opp: "",
    code,
    mode: "classic",
    lobby: {},
    ready: {},
    peer: new Peer(opts),
  });
  n.peer.on("open", () => {
    console.log("[net] signaling ok, menghubungi host");
    netBind(n, n.peer.connect(PEER_PREFIX + code, { reliable: true }));
  });
  n.peer.on("error", (e) =>
    netFail(
      e.type === "peer-unavailable"
        ? "Room tidak ditemukan. Periksa kodenya."
        : "Koneksi gagal: " + e.type
    )
  );
  setTimeout(() => {
    if (ui.net === n && !n.opp) {
      console.warn("[net] timeout", netDiag(n));
      netFail(`Waktu koneksi habis. ${netDiag(n)}`);
    }
  }, 25000);
}
function netBind(n, conn) {
  n.conn = conn;
  const pc = conn.peerConnection;
  if (pc) {
    n.cands = {};
    pc.addEventListener("icecandidate", (e) => {
      const t = e.candidate?.type;
      if (t) n.cands[t] = (n.cands[t] || 0) + 1;
    });
    pc.addEventListener("icecandidateerror", (e) =>
      console.warn("[net] icecandidateerror", e.url, e.errorCode, e.errorText)
    );
    pc.addEventListener("iceconnectionstatechange", () => {
      n.ice = pc.iceConnectionState;
      console.log("[net] ICE", n.ice, n.cands);
    });
  }
  conn.on("open", () => {
    n.last = Date.now();
    n.hb = setInterval(() => {
      if (ui.net !== n) {
        clearInterval(n.hb);
        return;
      }
      netSend({ t: "ping" });
      if (Date.now() - n.last > 12000) netLost(n);
    }, 2000);
    if (!n.host) netSend({ t: "hello", name: n.name });
  });
  conn.on("data", (m) => netRecv(n, m));
  conn.on("iceStateChanged", (st) => {
    if (st !== "failed" || n.opp) return;
    if (n.host) toast("Koneksi ke tamu gagal. Minta dia coba lagi.");
    else netFail(`Koneksi langsung ke host gagal. ${netDiag(n)}`);
  });
  conn.on("close", () => netLost(n));
}
function netRecv(n, m) {
  if (ui.net !== n || !m || typeof m !== "object") return;
  n.last = Date.now();
  switch (m.t) {
    case "hello":
      if (n.opp) break;
      n.opp = cleanName(m.name) || "OPPONENT";
      if (n.host) netSend({ t: "hello", name: n.name });
      goLobby();
      break;
    case "ready":
      if (n.host && !n.ready[2]) {
        if (validLoadout(m.loadout)) {
          n.ready[2] = m.loadout;
          if (n.ready[1]) hostStart();
        } else netSend({ t: "reject" });
      }
      break;
    case "reject":
      if (!n.host) netFail("Loadout ditolak host. Muat ulang dan coba lagi.");
      break;
    case "lobby":
      n.lobby[n.me === 1 ? 2 : 1] = !!m.ready;
      renderLobby();
      if (n.host && n.lobby[1] && n.lobby[2] && !$("lobbyView").hidden)
        startFromLobby();
      break;
    case "start":
      if (!n.host && !$("lobbyView").hidden) goSetup();
      break;
    case "tolobby":
      if (ui.game?.s.ended && $("lobbyView").hidden) backToLobby(false);
      break;
    case "mode":
      if (LOBBY_MODES.some((mode) => mode.enabled && mode.id === m.mode)) {
        n.mode = m.mode;
        renderLobby();
      }
      break;
    case "act":
      if (n.host) hostAct(m);
      break;
    case "state":
      if (!n.host) applySnap(m);
      break;
    case "bye":
      netLost(n);
      break;
    case "ping":
      break;
  }
}
function netLost(n) {
  if (ui.net !== n || n.closing || n.lost) return;
  n.lost = true;
  clearInterval(n.hb);
  if (!$("lobbyView").hidden) renderLobby();
  const name = (n.opp || "LAWAN").toUpperCase();
  if (ui.game?.s.ended) {
    toast(`${name} meninggalkan room.`);
    return;
  }
  const playing = !!ui.game;
  showDialog(
    `<div class="eyebrow">ONLINE / OPPONENT LEFT</div><h2 id="modalTitle">${name} MUNDUR.</h2><p class="dialog-intro">${
      playing
        ? "Lawanmu keluar di tengah pertandingan. Kamu menang walkover."
        : "Lawanmu keluar sebelum pertandingan dimulai."
    }</p><button class="primary-button" id="lostMenu"><span>BACK TO MAIN MENU</span>${icon(
      "arrow-right"
    )}</button>`,
    "lost",
    false
  );
  $("lostMenu").onclick = showMenu;
}
function goSetup() {
  menu.hidden = true;
  shell.hidden = false;
  document.body.style.overflow = "";
  // Reset penanda siap (lobi + loadout) supaya match berikutnya mulai bersih.
  ui.net.ready = {};
  ui.net.lobby = { 1: false, 2: false };
  beginSetup();
  ui.player = ui.net.me;
  renderSetup(true);
  document.querySelector(
    ".session-label"
  ).lastChild.textContent = `ONLINE / VS ${ui.net.opp.toUpperCase()}`;
}
/* ---------- ONLINE LOBBY ---------- */
// Lobi = ruang tunggu setelah konek, sebelum loadout. Kedua pemain harus READY,
// lalu host otomatis memulai setup. Match selesai -> kembali ke lobi (bukan menu),
// jadi satu room bisa dipakai berkali-kali tanpa create ulang.
const LOBBY_MODES = [
  {
    id: "classic",
    name: "CLASSIC",
    desc: "Aturan standar. 23 kartu, 15 poin.",
    glyph: "trophy",
    enabled: true,
  },
  {
    id: "ban",
    name: "BAN CARD",
    desc: "Kedua pemain mem-ban kartu. Segera hadir.",
    glyph: "close",
    enabled: false,
  },
  {
    id: "cardout",
    name: "CARD OUT",
    desc: "??? Segera hadir.",
    glyph: "cards",
    enabled: false,
  },
];
function goLobby() {
  closeDialog(false);
  menu.hidden = true;
  shell.hidden = false;
  document.body.style.overflow = "";
  const n = ui.net;
  n.lobby = { 1: false, 2: false };
  n.ready = {};
  setView("lobby");
  renderLobby();
  document.querySelector(
    ".session-label"
  ).lastChild.textContent = `ONLINE / VS ${(n.opp || "?").toUpperCase()}`;
  $("lobbyReady").onclick = toggleLobbyReady;
  $("lobbyLeave").onclick = () => {
    netClose();
    showMenu();
  };
  announce(`Masuk lobi online melawan ${n.opp}.`);
}
function lobbyPlayerRow(p) {
  const n = ui.net,
    you = p === n.me,
    gone = !you && (n.lost || !n.opp),
    ready = !gone && !!n.lobby[p];
  return `<div class="player-row ${you ? "you" : ""} ${ready ? "ready" : ""} ${
    gone ? "gone" : ""
  }"><span class="player-emblem" style="color:${
    p === 1 ? "var(--cyan)" : "var(--orange)"
  }">${icon(`operator${p}`)}</span><span class="player-meta"><strong>${safe(
    (you ? n.name : n.opp || "WAITING...").toUpperCase()
  )}</strong><small>P0${p} / ${p === 1 ? "HOST" : "GUEST"}${
    you ? " / YOU" : ""
  }</small></span><span class="ready-pill">${
    gone ? "LEFT" : ready ? "READY" : "NOT READY"
  }</span></div>`;
}
function renderLobby() {
  const n = ui.net;
  if (!n || $("lobbyView").hidden) return;
  $("lobbyCode").textContent = n.code || "-----";
  const oppGone = n.lost || !n.opp;
  $("lobbyCount").textContent = oppGone ? "1 / 2" : "2 / 2";
  $("lobbyPlayers").innerHTML = lobbyPlayerRow(1) + lobbyPlayerRow(2);
  $("lobbyModes").innerHTML = LOBBY_MODES.map((m) => {
    const active = n.mode === m.id;
    return `<button type="button" class="gmode-card ${
      active ? "active" : ""
    }" data-modepick="${m.id}" ${
      m.enabled ? "" : "disabled"
    } aria-pressed="${active}"><span class="gmode-glyph">${icon(
      m.glyph
    )}</span><span class="gmode-text"><strong>${m.name}</strong><small>${
      m.desc
    }</small></span>${
      m.enabled
        ? active
          ? '<span class="gmode-tag on">ACTIVE</span>'
          : ""
        : '<span class="gmode-tag">SOON</span>'
    }</button>`;
  }).join("");
  $("lobbyModes")
    .querySelectorAll("[data-modepick]")
    .forEach((button) => {
      button.onclick = () => {
        const mode = LOBBY_MODES.find((m) => m.id === button.dataset.modepick);
        if (!mode?.enabled || ui.net.mode === mode.id) return;
        ui.net.mode = mode.id;
        netSend({ t: "mode", mode: mode.id });
        renderLobby();
      };
    });
  const myReady = !!n.lobby[n.me],
    oppReady = !oppGone && !!n.lobby[n.me === 1 ? 2 : 1];
  $("lobbyStatus").textContent = oppGone
    ? "OPPONENT LEFT THE ROOM."
    : myReady && oppReady
    ? "BOTH READY. STARTING OPERATION..."
    : myReady
    ? "WAITING FOR OPPONENT READY..."
    : oppReady
    ? "OPPONENT READY. TEKAN READY BILA SIAP."
    : "TEKAN READY BILA SIAP BERMAIN.";
  $("lobbyReady").disabled = oppGone;
  $("lobbyReady").innerHTML = myReady
    ? `<span>UNREADY</span>${icon("close")}`
    : `<span>READY</span>${icon("check")}`;
}
function toggleLobbyReady() {
  const n = ui.net;
  if (!n || n.lost || !n.opp || $("lobbyView").hidden) return;
  n.lobby[n.me] = !n.lobby[n.me];
  netSend({ t: "lobby", ready: n.lobby[n.me] });
  AudioSystem.sfx("select");
  renderLobby();
  if (n.host && n.lobby[1] && n.lobby[2] && !$("lobbyView").hidden)
    startFromLobby();
}
function startFromLobby() {
  netSend({ t: "start" });
  goSetup();
}
function backToLobby(send = true) {
  const n = ui.net;
  if (!n || n.closing) return;
  if (send) netSend({ t: "tolobby" });
  goLobby();
  toast("Kembali ke lobi. Ready untuk match berikutnya.");
}
function netConfirm() {
  const n = ui.net,
    chosen = ui.loadouts[n.me];
  if (!chosen.length) return;
  n.ready[n.me] = [...chosen];
  if (n.host) {
    if (n.ready[2]) {
      hostStart();
      return;
    }
  } else netSend({ t: "ready", loadout: n.ready[2] });
  showWait("LOADOUT LOCKED.", "Menunggu lawan memilih loadout...");
}
// Host = satu-satunya pemilik engine. Tamu hanya mengirim aksi dan menerima snapshot
// yang sudah dibersihkan dari loadout / tawaran kartu milik host.
function hostStart() {
  const n = ui.net;
  clearVisuals();
  closeDialog(false);
  ui.game = new FourfoldEngine({ 1: n.ready[1], 2: n.ready[2] });
  ui.resultShown = false;
  ui.focusCell = { r: 0, c: 0 };
  setView("battle");
  renderBattle();
  netPush([]);
}
function snapFor(me) {
  const c = JSON.parse(JSON.stringify(ui.game.s)),
    o = me === 1 ? 2 : 1;
  c.loadouts[o] = [];
  c.removed[o] = [];
  c.cooldowns[o] = {};
  if (c.turn !== me) c.offer = null;
  return c;
}
function netPush(events) {
  if (ui.net?.host && ui.game)
    netSend({ t: "state", s: snapFor(2), events: events || [] });
}
function hostAct(m) {
  const n = ui.net,
    g = ui.game;
  if (
    !g ||
    !NET_METHODS.includes(m.m) ||
    !Array.isArray(m.a) ||
    m.a.length > 2 ||
    !m.a.every((x) => typeof x === "string" || Number.isInteger(x))
  )
    return;
  if (ui.busy) {
    later(() => hostAct(m), 120);
    return;
  }
  if (g.s.turn !== 2 || g.s.ended) {
    netPush([]);
    return;
  }
  let ok = false;
  n.remote = true;
  g.error = "";
  takeAction(() => (ok = g[m.m](...m.a)));
  n.remote = false;
  if (!ok) netPush([]);
}
function applySnap(m) {
  if (!m.s) return;
  if (ui.busy) {
    later(() => applySnap(m), 120);
    return;
  }
  if (!ui.game) {
    const g = new FourfoldEngine({ 1: [], 2: [] });
    NET_METHODS.forEach((name) => {
      g[name] = (...a) => {
        g.sent = true;
        netSend({ t: "act", m: name, a });
        return false;
      };
    });
    clearVisuals();
    closeDialog(false);
    ui.game = g;
    g.s = m.s;
    ui.resultShown = false;
    ui.focusCell = { r: 0, c: 0 };
    setView("battle");
    renderBattle();
    return;
  }
  const before = captureTokens(),
    previousTurn = ui.game.s.turn;
  ui.game.s = m.s;
  ui.game.sent = false;
  presentResult(before, previousTurn, Array.isArray(m.events) ? m.events : []);
}
function showOnline() {
  if (ui.modal) return;
  let saved = "";
  try {
    saved = cleanName(localStorage.getItem("fourfold.name"));
  } catch (_) {}
  showDialog(
    `<button class="dialog-close" data-close aria-label="Tutup">${icon(
      "close"
    )}</button><div class="eyebrow">ONLINE / FIND OPPONENT</div><h2 id="modalTitle">FIND AN OPPONENT.</h2><p class="dialog-intro">Masukkan nama, lalu buat room atau gabung dengan kode. Lawan tidak bisa melihat loadout-mu.</p><label class="eyebrow" for="playerName">CALLSIGN</label><input class="dialog-field" id="playerName" maxlength="14" placeholder="Nama kamu" autocomplete="off" spellcheck="false" value="${saved}"><div class="option-grid stack"><button class="option-button" id="onlineCreate">${icon(
      "signal"
    )}<span><strong>CREATE ROOM</strong><small>Jadi host, kirim kode ke lawan</small></span></button><div class="option-button join-box">${icon(
      "search"
    )}<span><strong>JOIN ROOM</strong><input id="roomCode" maxlength="5" placeholder="KODE" autocomplete="off" spellcheck="false" aria-label="Kode room"><button class="subtle-button" id="onlineJoin">JOIN</button></span></div></div><p class="dialog-status" style="--d:var(--lime)"><i style="background:var(--lime)"></i>PEER-TO-PEER / TANPA SERVER</p>`,
    "online",
    true
  );
  const getName = () => {
    const v = cleanName($("playerName").value);
    if (!v) {
      toast("Masukkan nama dulu.");
      $("playerName").focus();
      return null;
    }
    try {
      localStorage.setItem("fourfold.name", v);
    } catch (_) {}
    return v;
  };
  $("onlineCreate").onclick = () => {
    const v = getName();
    if (v) netHost(v);
  };
  $("onlineJoin").onclick = () => {
    const v = getName();
    if (!v) return;
    const code = $("roomCode").value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      toast("Masukkan 5 karakter kode room.");
      $("roomCode").focus();
      return;
    }
    netJoin(v, code);
  };
}
