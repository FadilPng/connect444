"use strict";
/* ============================================================
   CHIBI LOBBY — MESIN
   ------------------------------------------------------------
   Karakter Spine 3.8 yang hidup di lobby online.

   API PUBLIK (dipakai js/net.js & js/setup.js):
     ChibiLobby.update({ players, ready })  // sinkronkan state room
     ChibiLobby.pulse(slot)                 // paksa 1 special (mis. saat menang)
     ChibiLobby.destroy()                   // keluar lobby, bebaskan memori
     ChibiLobby.status()                    // info debug

   `players` = [{ slot: 1, char: "mudrok" }, { slot: 2, char: "figna" }]

   Prinsip:
   - Runtime (Pixi + pixi-spine) di-load LAZY saat lobby pertama dibuka.
   - Hanya karakter yang dipakai room itu yang diunduh (bukan seluruh roster).
   - Kalau apa pun gagal (offline/CDN/aset), lobby tetap jalan tanpa chibi.
   ============================================================ */

(function () {
  // penanda versi: cek di console dengan  CHIBI_VERSION
  const CHIBI_VERSION = "3.3";
  window.CHIBI_VERSION = CHIBI_VERSION;
  const CFG = window.CHIBI_CONFIG;
  if (!CFG) {
    console.warn("[chibi] CHIBI_CONFIG tidak ditemukan — chibi dimatikan.");
    return;
  }

  const ASSET_BASE = "assets/chibi/";
  const VENDOR = ["vendor/pixi.min.js", "vendor/pixi-spine-3.8.js"];

  const S = {
    gen: 0, // penanda sesi; naik setiap enter/destroy untuk membatalkan load lama
    alive: false,
    runtime: null, // Promise
    assets: {}, // id -> { spineData, atlas }
    loading: {}, // id -> Promise
    app: null, // Pixi app utama (lantai)
    stageEl: null,
    walkers: [],
    avatars: { 1: null, 2: null },
    chars: { 1: null, 2: null },
    ready: { 1: false, 2: false },
    nextSpecialAt: 0,
    specials: 0,
    offline: false, // true kalau runtime gagal dimuat (setelah beberapa kali coba)
    tickerBound: null,
    runtimeFails: 0,
    lastPlayers: null, // dipakai untuk mencoba ulang kalau load gagal
    retryTimer: 0,
    retryDelay: 1500,
    preloaded: false,
    cacheHits: 0, // berapa karakter yang dilayani dari cache lokal
  };

  const isDesktop = () => window.innerWidth >= CFG.zone.desktopMinWidth;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fin = (n, fallback) => (Number.isFinite(n) ? n : fallback);
  const charById = (id) => (id ? CFG.chars.find((c) => c.id === id) || null : null);

  /* ------------------------------------------------------------
     1. PEMUAT (lazy)
     ------------------------------------------------------------ */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-chibi-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.chibiLoaded === "1") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("gagal: " + src)), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.dataset.chibiSrc = src;
      s.onload = () => {
        s.dataset.chibiLoaded = "1";
        resolve();
      };
      s.onerror = () => reject(new Error("gagal: " + src));
      document.head.appendChild(s);
    });
  }

  function ensureRuntime() {
    if (window.PIXI && window.PIXI.spine) return Promise.resolve();
    if (S.runtime) return S.runtime;
    S.runtime = (async () => {
      for (const src of VENDOR) {
        if (src.includes("pixi-spine") && window.PIXI && window.PIXI.spine) continue;
        if (src.includes("pixi.min") && window.PIXI) continue;
        await loadScript(src);
      }
      if (!window.PIXI) throw new Error("PIXI tidak tersedia");
      if (!window.PIXI.spine) throw new Error("pixi-spine tidak tersedia");
    })().catch((e) => {
      S.runtime = null;
      throw e;
    });
    return S.runtime;
  }

  function loadImageBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("gagal decode png"));
      };
      img.src = url;
    });
  }

  /* ---------------- cache lokal (IndexedDB) ----------------
     Tujuan: aset cuma diunduh SEKALI. Setelah itu tersimpan di disk browser,
     jadi refresh / buka app lagi = instan, tidak makan kuota lagi.
     Kalau IndexedDB tidak tersedia (mode privat), otomatis jatuh ke
     HTTP cache biasa — tetap jalan, cuma tidak sekuat itu. */
  const IDB_NAME = "fourfold-chibi";
  const CACHE_VERSION = "v1"; // naikkan kalau file aset diganti

  let idbPromise = null;
  function idbOpen() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("tanpa indexedDB"));
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("indexedDB gagal"));
    }).catch((e) => {
      idbPromise = null;
      throw e;
    });
    return idbPromise;
  }

  async function cacheGet(key) {
    try {
      const db = await idbOpen();
      return await new Promise((resolve) => {
        const tx = db.transaction("assets", "readonly");
        const rq = tx.objectStore("assets").get(key);
        rq.onsuccess = () => resolve(rq.result || null);
        rq.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  }

  async function cachePut(key, value) {
    try {
      const db = await idbOpen();
      await new Promise((resolve) => {
        const tx = db.transaction("assets", "readwrite");
        tx.objectStore("assets").put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      });
    } catch (_) {}
  }

  async function cacheDelete(key) {
    try {
      const db = await idbOpen();
      await new Promise((resolve) => {
        const tx = db.transaction("assets", "readwrite");
        tx.objectStore("assets").delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {}
  }

  // fetch dengan percobaan ulang — sinyal jelek / koneksi putus bukan alasan
  // chibi hilang permanen
  async function request(url, kind, tries) {
    const n = tries || 3;
    let last = null;
    for (let i = 0; i < n; i++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
        if (kind === "text") return await r.text();
        if (kind === "blob") return await r.blob();
        return await r.arrayBuffer();
      } catch (e) {
        last = e;
        if (i < n - 1) await new Promise((res) => setTimeout(res, 350 * (i + 1)));
      }
    }
    throw last;
  }

  // ambil 3 file mentah sebuah karakter: dari memori -> IndexedDB -> jaringan
  async function fetchRaw(id, forceNetwork) {
    const key = CACHE_VERSION + "/" + id;
    if (!forceNetwork) {
      const hit = await cacheGet(key);
      if (hit && hit.png && hit.atlas && hit.skel) {
        S.cacheHits++;
        return hit;
      }
    }
    const base = ASSET_BASE + id + "/char";
    const [png, atlas, skel] = await Promise.all([
      request(base + ".png", "blob", 3),
      request(base + ".atlas", "text", 3),
      request(base + ".skel", "buffer", 3),
    ]);
    const rec = { png, atlas, skel, savedAt: Date.now() };
    cachePut(key, rec);
    return rec;
  }

  async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
    return r.text();
  }

  async function fetchBuffer(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
    return r.arrayBuffer();
  }

  /**
   * Muat 1 karakter. Hasil di-cache supaya pindah-pindah room tidak
   * mengunduh ulang.
   */
  const MIX = { toIdle: 0.35, fromIdle: 0.35, toSpecial: 0.12, fromSpecial: 0.5, toInteract: 0.2, fromInteract: 0.45 };

  function animOr(skeleton, wanted, fallbacks) {
    const names = skeleton.data.animations.map((a) => a.name);
    for (const w of [wanted].concat(fallbacks || [])) {
      const hit = names.find((n) => n.toLowerCase() === String(w).toLowerCase());
      if (hit) return hit;
    }
    return names.find((n) => /move|walk|run/i.test(n)) || names[0] || null;
  }

  function idleNameFor(spine) {
    const c = spine.charConfig;
    const names = spine.skeleton.data.animations.map((a) => a.name);
    const hits = [];
    for (const wanted of c.idles || []) {
      const hit = names.find((n) => n.toLowerCase() === String(wanted).toLowerCase());
      if (hit) hits.push(hit);
    }
    if (hits.length) return hits[Math.floor(Math.random() * hits.length)];
    return names.find((n) => /relax|sit|idle/i.test(n)) || null;
  }

  function setAnim(spine, name, loop, mixSec) {
    if (!name) return null;
    let entry = null;
    try {
      entry = spine.state.setAnimation(0, name, !!loop);
    } catch (e) {
      return null;
    }
    if (entry && Number.isFinite(mixSec)) entry.mixDuration = mixSec;
    return entry;
  }

  async function buildChar(id, raw) {
    const image = await loadImageBlob(raw.png);
    const baseTex = PIXI.BaseTexture.from(image);
    // PENTING: callback TextureAtlas bisa dipanggil SEBELUM konstruktornya
    // selesai. Jadi jangan pakai variabel atlas di dalam callback — tunggu
    // di luar (await), baru baca atlasnya.
    let atlas = null;
    await new Promise((resolve, reject) => {
      try {
        atlas = new PIXI.spine.TextureAtlas(raw.atlas, (line, cb) => cb(baseTex), () => resolve());
      } catch (e) {
        reject(e);
      }
    });
    if (!atlas) throw new Error("atlas gagal dibuat");
    const ataLoader = new PIXI.spine.AtlasAttachmentLoader(atlas);
    const bin = new PIXI.spine.SkeletonBinary(ataLoader);
    const spineData = bin.readSkeletonData(new Uint8Array(raw.skel));
    return { spineData, atlas, config: charById(id) };
  }

  function loadChar(id) {
    if (!id) return Promise.reject(new Error("id kosong"));
    if (S.assets[id]) return Promise.resolve(S.assets[id]);
    if (S.loading[id]) return S.loading[id];
    S.loading[id] = (async () => {
      // runtime harus siap dulu: kalau user masuk lobby super cepat,
      // PIXI bisa belum ada -> dulu ini yang bikin aset "kadang gagal"
      await ensureRuntime();

      let raw = await fetchRaw(id, false);
      let rec;
      try {
        rec = await buildChar(id, raw);
      } catch (e) {
        // cache lokal rusak / format berubah -> buang lalu ambil ulang dari server
        console.warn("[chibi] cache " + id + " rusak, ambil ulang:", e.message);
        await cacheDelete(CACHE_VERSION + "/" + id);
        raw = await fetchRaw(id, true);
        rec = await buildChar(id, raw);
      }
      S.assets[id] = rec;
      return rec;
    })().finally(() => {
      delete S.loading[id];
    });
    return S.loading[id];
  }

  // unduh semua karakter di latar belakang (sekali seumur cache).
  // Tidak memblokir apa pun — kalau gagal, nanti dicoba lagi saat lobby dibuka.
  let preloadPromise = null;
  function preloadAssets() {
    if (preloadPromise) return preloadPromise;
    preloadPromise = (async () => {
      await ensureRuntime();
      for (const c of CFG.chars) {
        try {
          await fetchRaw(c.id, false);
        } catch (e) {
          preloadPromise = null; // boleh dicoba lagi nanti
          return;
        }
        await new Promise((r) => setTimeout(r, 120)); // kasih napas ke halaman
      }
      S.preloaded = true;
    })().catch(() => {
      preloadPromise = null;
    });
    return preloadPromise;
  }

  /* ------------------------------------------------------------
     3. WALKER (karakter di lantai)
     ------------------------------------------------------------ */
  function zone() {
    const el = S.stageEl;
    const w = el && el.clientWidth > 20 ? el.clientWidth : window.innerWidth;
    const h = el && el.clientHeight > 20 ? el.clientHeight : 170;
    // Tinggi karakter mengikuti tinggi panggung, jadi tidak mungkin kepotong
    // dan otomatis makin besar di layar yang lebih tinggi.
    const zc = CFG.zone;
    const size = isDesktop()
      ? Math.max(
          zc.minPx,
          Math.min(zc.maxPx, Math.round(h * zc.desktopScale), h - zc.floorInset - 2)
        )
      : zc.mobileSize;
    return {
      w,
      h,
      size,
      floorY: h - zc.floorInset,
      minX: w * 0.06,
      maxX: w * 0.94,
    };
  }

  // Tinggi acuan semua karakter, dalam unit skeleton. Satu angka ini yang
  // menentukan skala: scale = size / BODY_UNITS. Karena semua karakter pakai
  // angka yang sama, tingginya di layar juga sama.
  const BODY_UNITS = 420;

  function makeWalker(rec, x, opts) {
    const spine = new PIXI.spine.Spine(rec.spineData);
    spine.charConfig = rec.config;
    spine.autoUpdate = true;

    const holder = new PIXI.Container();
    holder.addChild(spine);
    S.app.stage.addChild(holder);

    const walkName = animOr(spine.skeleton, rec.config.walk, [rec.config.walk]);
    spine.walkName = walkName;
    setAnim(spine, walkName, true, 0);
    spine.update(0);
    spine.updateTransform();

    // Skala seragam: semua karakter setinggi BODY_UNITS unit skeleton.
    const size = opts.size || 150;
    const scale = size / BODY_UNITS;
    spine.scale.set(scale);
    spine.y = 0;

    // Kecepatan tanpa selip: walkUnits (unit skeleton) diskalakan ke tinggi layar.
    const walkUnits = Number.isFinite(rec.config.walkUnits) ? rec.config.walkUnits : 90;
    const natural = walkUnits * scale;
    // Jaga variasi tetap wajar: clamp, dan timeScale ikut supaya kaki tetap menapak.
    const minPx = size * 0.18;
    const maxPx = size * 0.55;
    let animBase = 1;
    if (natural < minPx) animBase = minPx / natural;
    else if (natural > maxPx) animBase = maxPx / natural;
    if (!Number.isFinite(animBase) || animBase <= 0) animBase = 1;

    const z = zone();
    const dir = Math.random() > 0.5 ? 1 : -1;
    const w = {
      holder,
      spine,
      slot: (opts && opts.slot) || 0,
      scale,
      dir,
      speed: natural * animBase,
      animBase,
      mode: "walk",
      walkTimer: rnd(CFG.walk.min, CFG.walk.max),
      idleTimer: 0,
      actionName: null,
      actionLoop: false,
      actionDur: 0,
      limitMin: fin(opts.limitMin, null),
      limitMax: fin(opts.limitMax, null),
    };
    spine.scale.x = dir * scale;
    holder.x = fin(x, z.w * 0.5);
    holder.y = z.floorY;
    holder.zIndex = Math.round(holder.y);
    S.walkers.push(w);
    return w;
  }

  function playAction(w, wanted, fallbacks, loop) {
    const name = animOr(w.spine.skeleton, wanted, fallbacks || []);
    if (!name) return null;
    const anim = w.spine.skeleton.data.findAnimation(name);
    const dur = anim && anim.duration > 0 ? anim.duration : 1.2;
    const ts = CFG.pace * (w.animBase || 1);
    const isSpecial = /special|attack/i.test(name);
    setAnim(w.spine, name, !!loop, isSpecial ? MIX.toSpecial : MIX.toInteract);
    w.spine.state.timeScale = ts;
    w.actionName = name;
    w.actionKind = isSpecial ? "special" : "interact";
    w.actionLoop = !!loop;
    w.actionDur = dur / ts;
    w.actionStart = performance.now();
    return name;
  }

  function playWalk(w) {
    setAnim(w.spine, w.spine.walkName, true, MIX.fromSpecial);
    w.mode = "walk";
    w.walkTimer = rnd(CFG.walk.min, CFG.walk.max);
  }

  function playIdle(w) {
    const name = idleNameFor(w.spine);
    if (name) setAnim(w.spine, name, true, MIX.toIdle);
    w.mode = "idle";
    w.idleTimer = rnd(CFG.idle.min, CFG.idle.max);

  }

  function clearAction(w) {
    w.actionName = null;
    w.actionKind = null;
    w.actionLoop = false;
    w.spine.state.timeScale = CFG.pace * (w.animBase || 1);
    if (w.mode === "idle") {
      playIdle(w);
      w.idleTimer = rnd(0.6, 1.8);
    } else playWalk(w);
  }

  /* ------------------------------------------------------------
     4. AVATAR (di baris OPERATORS)
     ------------------------------------------------------------ */
  function emblemFor(slot) {
    return document.querySelector('.player-emblem[data-slot="' + slot + '"]');
  }

  function ensureAvatar(slot, rec) {
    if (!rec) return null;
    const box = emblemFor(slot);
    if (!box) return null;

    let av = S.avatars[slot];
    // DOM baris operator di-render ulang tiap perubahan state; kanvas lama
    // dipindahkan kembali, bukan dibuat ulang (hemat konteks WebGL).
    if (av && av.charId === rec.config.id) {
      if (av.app.view.parentNode !== box) box.appendChild(av.app.view);
      box.classList.add("has-chibi");
      return av;
    }
    if (av) destroyAvatar(slot);

    const size = 48;
    const app = new PIXI.Application({
      width: 46,
      height: 54,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
    });
    box.appendChild(app.view);
    box.classList.add("has-chibi");

    const spine = new PIXI.spine.Spine(rec.spineData);
    spine.charConfig = rec.config;
    app.stage.addChild(spine);

    const idle = idleNameFor(spine);
    setAnim(spine, idle, true, 0);
    spine.update(0);
    spine.updateTransform();

    const b = spine.getBounds(false);
    const bw = b && b.width > 1 ? b.width : 260;
    const bh = b && b.height > 1 ? b.height : 260;
    const sc = Math.min((size - 4) / bw, (size + 2) / bh);
    spine.scale.set(sc);
    const midX = b && Number.isFinite(b.x) ? b.x + bw / 2 : 0;
    const bottom = b && Number.isFinite(b.y) ? b.y + bh : 0;
    spine.x = 23 - midX * sc;
    spine.y = 52 - bottom * sc;
    if (!Number.isFinite(spine.x)) spine.x = 23;
    if (!Number.isFinite(spine.y)) spine.y = 52;

    const avatar = { app, spine, charId: rec.config.id, idleName: idle, actionName: null, actionLoop: false };
    S.avatars[slot] = avatar;
    return avatar;
  }

  function destroyAvatar(slot) {
    const av = S.avatars[slot];
    if (!av) return;
    try {
      av.app.destroy(true, { children: true });
    } catch (_) {}
    S.avatars[slot] = null;
    const box = emblemFor(slot);
    if (box) box.classList.remove("has-chibi");
  }

  function setAvatarAction(slot, name, loop) {
    const av = S.avatars[slot];
    if (!av) return false;
    if (name) {
      const entry = setAnim(av.spine, name, !!loop, name === "Special" ? MIX.toSpecial : MIX.toInteract);
      if (!entry) return false;
      av.actionName = name;
      av.actionLoop = !!loop;
      return true;
    }
    av.actionName = null;
    av.actionLoop = false;
    setAnim(av.spine, av.idleName, true, MIX.toIdle);
    return false;
  }

  function tickAvatars() {
    for (const slot of [1, 2]) {
      const av = S.avatars[slot];
      if (!av || !av.actionName) continue;
      const cur = av.spine.state.getCurrent(0);
      const curName = cur && cur.animation ? cur.animation.name : null;
      const busy = curName === av.actionName && (av.actionLoop || !cur.isComplete());
      if (!busy) setAvatarAction(slot, null, false);
    }
  }

  /* ------------------------------------------------------------
     5. PANGGUNG (lantai desktop)
     ------------------------------------------------------------ */
  // Tinggi panggung = sisa ruang sampai bawah layar (dibatasi min/max).
  // Efeknya: di layar tinggi chibi ikut membesar, bukan cuma ruang kosong.
  function fitStage() {
    const el = S.stageEl && S.stageEl.parentNode ? S.stageEl.parentNode : null;
    if (!el) return;
    const zc = CFG.zone;
    // pakai koordinat dokumen (bukan viewport) supaya tinggi panggung tidak
    // berubah-ubah kalau halaman sedang di-scroll
    const top = el.getBoundingClientRect().top + (window.scrollY || 0);
    if (!Number.isFinite(top) || top <= 0) return;
    const reserve = zc.stageReserve != null ? zc.stageReserve : 88;
    const avail = window.innerHeight - top - reserve;
    const h = Math.round(
      Math.max(zc.stageMin || 150, Math.min(zc.stageMax || 340, avail))
    );
    if (Math.abs(h - (S.stageH || 0)) < 2) return;
    S.stageH = h;
    el.style.height = h + "px";
    // Pixi hanya auto-resize saat window resize; kalau tinggi panggung
    // diubah manual, renderer harus disuruh hitung ulang — kalau tidak,
    // kanvas lama di-stretch CSS dan karakter jadi gepeng/kepotong.
    if (S.app) {
      try {
        S.app.resize();
      } catch (_) {}
    }
    // tinggi berubah -> jalur jalan tiap karakter dihitung ulang
    if (S.alive && S.app) spawnFloor();
  }

  function ensureStage() {
    const view = document.getElementById("lobbyView");
    if (!view) return null;

    let el = document.getElementById("chibiStage");
    if (!el) {
      el = document.createElement("div");
      el.id = "chibiStage";
      el.className = "chibi-stage";
      el.setAttribute("aria-hidden", "true");
      const canvasBox = document.createElement("div");
      canvasBox.className = "chibi-canvas";
      el.appendChild(canvasBox);
      const actions = view.querySelector(".lobby-actions");
      if (actions && actions.nextSibling) view.insertBefore(el, actions.nextSibling);
      else view.appendChild(el);
    }
    S.stageEl = el.querySelector(".chibi-canvas") || el;

    if (!S.app) {
      S.app = new PIXI.Application({
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        resizeTo: S.stageEl,
        powerPreference: "low-power",
      });
      S.app.stage.sortableChildren = true;
      S.stageEl.appendChild(S.app.view);
    }
    fitStage();
    return el;
  }

  function clearWalkers() {
    for (const w of S.walkers) {
      try {
        w.holder.destroy({ children: true });
      } catch (_) {}
    }
    S.walkers.length = 0;
  }

  /* ------------------------------------------------------------
     6. LOOP: jalan / idle / special
     ------------------------------------------------------------ */
  function maybeSpecial(now, dt) {
    if (!CFG.special.enabled || !isDesktop() || !S.walkers.length) return;
    if (now < S.nextSpecialAt) return;
    // jangan menumpuk: tunggu sampai tidak ada yang sedang aksi
    if (S.walkers.some((w) => w.actionName)) {
      S.nextSpecialAt = now + 2000;
      return;
    }
    const idleWalkers = S.walkers.filter((w) => w.mode === "idle");
    if (!idleWalkers.length) {
      S.nextSpecialAt = now + 2500;
      return;
    }
    const w = pick(idleWalkers);
    if (playAction(w, w.spine.charConfig.special, ["OnAttack", "Special"], false)) {
      S.specials++;
    }
    S.nextSpecialAt = now + rnd(CFG.special.gapMin, CFG.special.gapMax) * 1000;
  }

  function loop() {
    if (!S.alive) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - (loop._last || now)) / 1000);
    loop._last = now;

    S.frames = (S.frames || 0) + 1;
    tickAvatars();
    maybeSpecial(now, dt);

    if (!S.walkers.length) return;
    const z = zone();
    for (const w of S.walkers) {
      w.spine.scale.set(w.dir * w.scale, w.scale);

      const cur = w.spine.state.getCurrent(0);
      const curName = cur && cur.animation ? cur.animation.name : null;

      // 1) sedang aksi (special/interact) -> posisi dibekukan
      if (w.actionName) {
        // Kalau animasi tidak pernah melapor "selesai" (terjadi di sebagian
        // karakter), paksa berhenti setelah durasinya lewat -> tidak beku.
        const overtime =
          performance.now() - (w.actionStart || 0) > w.actionDur * 1000 + 2500;
        const busy =
          !overtime &&
          curName === w.actionName &&
          (w.actionLoop || !cur.isComplete());
        if (busy) {
          w.holder.y = z.floorY;
          continue;
        }
        clearAction(w);
        w.holder.y = z.floorY;
        continue;
      }
      // 2) diam
      if (w.mode === "idle") {
        w.idleTimer -= dt;
        if (w.idleTimer <= 0) playWalk(w);
        w.holder.y = z.floorY;
        continue;
      }
      // 3) jalan
      w.walkTimer -= dt;
      if (w.walkTimer <= 0) {
        playIdle(w);
        w.holder.y = z.floorY;
        continue;
      }
      w.holder.x += w.dir * w.speed * CFG.pace * dt;
      const lo = w.limitMin !== null ? Math.max(z.minX, w.limitMin) : z.minX;
      const hi = w.limitMax !== null ? Math.min(z.maxX, w.limitMax) : z.maxX;
      if (w.holder.x > hi) {
        w.holder.x = hi;
        w.dir = -1;
        w.spine.scale.x = -w.scale;
        playIdle(w);
      } else if (w.holder.x < lo) {
        w.holder.x = lo;
        w.dir = 1;
        w.spine.scale.x = w.scale;
        playIdle(w);
      }
      w.holder.y = z.floorY;
    }
  }

  function bindTicker() {
    if (S.tickerBound) return;
    if (!window.PIXI || !PIXI.Ticker || !PIXI.Ticker.shared) return;
    S.tickerBound = loop;
    PIXI.Ticker.shared.add(loop);
  }

  function unbindTicker() {
    if (!S.tickerBound) return;
    try {
      PIXI.Ticker.shared.remove(S.tickerBound);
    } catch (_) {}
    S.tickerBound = null;
  }

  /* ------------------------------------------------------------
     7. SPAWN 2 KARAKTER DI LANTAI
     ------------------------------------------------------------ */
  function walkerFor(slot) {
    return S.walkers.find((w) => w.slot === slot) || null;
  }

  // READY -> karakter lantai memainkan Interact SEKALI, lalu kembali aktif.
  function syncReady() {
    for (const slot of [1, 2]) {
      const w = walkerFor(slot);
      if (!w) continue;
      if (S.ready[slot] && !w.actionName) playAction(w, "Interact", ["Interact"], false);
      else if (!S.ready[slot] && w.actionKind === "interact") clearAction(w);
    }
    for (const slot of [1, 2]) {
      if (S.ready[slot]) setAvatarAction(slot, "Interact", false);
    }
  }

  function spawnFloor() {
    clearWalkers();
    if (!isDesktop() || !S.app) return;
    const z = zone();
    const slots = [1, 2].filter((s) => S.chars[s] && S.assets[S.chars[s]]);
    if (!slots.length) return;

    const span = z.maxX - z.minX;
    // Jalur jalan dibuat lebar: satu pemain = seluruh panggung, dua pemain =
    // setengah panggung masing-masing (kiri / kanan). Dulu cuma +-10% di sekitar
    // titik spawn, jadi karakternya mondar-mandir pendek seperti jalan di tempat.
    const mid = z.minX + span * 0.5;
    slots.forEach((slot, i) => {
      const rec = S.assets[S.chars[slot]];
      const single = slots.length === 1;
      const cx = single ? z.w * 0.5 : z.minX + span * (i === 0 ? 0.25 : 0.75);
      makeWalker(rec, cx, {
        slot,
        size: z.size,
        limitMin: single ? z.minX : i === 0 ? z.minX : mid,
        limitMax: single ? z.maxX : i === 0 ? mid : z.maxX,
      });
    });
  }

  /* ------------------------------------------------------------
     8. API PUBLIK
     ------------------------------------------------------------ */
  let pending = null;

  async function apply(players) {
    const gen = S.gen;
    S.alive = true;
    let ok = true;

    // kalau tadi runtime gagal (mis. offline sebentar), coba lagi di sini
    try {
      await ensureRuntime();
      S.offline = false;
    } catch (e) {
      S.offline = true;
      return false;
    }

    // PENTING: destroy() melepas ticker. Kalau tidak dipasang lagi di sini,
    // animasi tetap jalan (spine autoUpdate) tapi posisi berhenti bergerak
    // -> karakter "jalan di tempat" setelah keluar-masuk lobby / selesai ronde.
    bindTicker();

    const wanted = [];
    for (const p of players) {
      const c = charById(p.char);
      if (c && !wanted.includes(c.id)) wanted.push(c.id);
      S.chars[p.slot] = c ? c.id : null;
    }
    // slot yang tidak ada di room -> jangan tampil
    for (const slot of [1, 2]) {
      if (!players.some((p) => p.slot === slot)) S.chars[slot] = null;
    }

    ensureStage();
    if (!isDesktop()) S.app && (S.app.view.style.display = "none");

    // sudah punya asetnya? langsung tampilkan tanpa menunggu
    const missing = wanted.filter((id) => !S.assets[id]);
    if (missing.length) {
      // tampilkan yang sudah ada dulu
      placeAll();
      try {
        await Promise.all(missing.map((id) => loadChar(id)));
      } catch (e) {
        ok = false;
        console.warn("[chibi] sebagian aset gagal dimuat:", e.message);
      }
    }
    if (gen !== S.gen) return false; // dibatalkan (user keluar lobby)
    placeAll();
    return ok && wanted.every((id) => !!S.assets[id]);
  }

  function placeAll() {
    if (!S.alive) return;
    // avatar untuk tiap slot yang punya karakter
    for (const slot of [1, 2]) {
      const id = S.chars[slot];
      if (id && S.assets[id]) ensureAvatar(slot, S.assets[id]);
      else if (!id) destroyAvatar(slot);
    }
    spawnFloor();
    syncReady();
  }

  // Coba ulang otomatis kalau load gagal (jaringan putus sebentar, server
  // lambat, dsb). Delay naik pelan-pelan biar tidak membanjiri server.
  function scheduleRetry() {
    if (S.retryTimer || !S.alive) return;
    S.retryTimer = setTimeout(() => {
      S.retryTimer = 0;
      if (!S.alive || !S.lastPlayers) return;
      ChibiLobby.update({ players: S.lastPlayers, ready: S.ready });
    }, S.retryDelay);
    S.retryDelay = Math.min(15000, S.retryDelay * 1.8);
  }

  const ChibiLobby = {
    /**
     * Sinkronkan isi room. Dipanggil dari renderLobby() setiap ada perubahan.
     * players: [{ slot, char }]  (slot 1 = host, 2 = guest)
     * ready  : { 1: bool, 2: bool }
     */
    update(opts) {
      const o = opts || {};
      const players = (o.players || []).filter((p) => p && p.slot);
      const ready = o.ready || {};
      S.ready[1] = !!ready[1];
      S.ready[2] = !!ready[2];

      const sig = players
        .map((p) => p.slot + ":" + (p.char || "-"))
        .sort()
        .join("|");

      if (!document.getElementById("lobbyView")?.hidden) {
        ensureStage();
        fitStage();
      }
      const missing = players.some((p) => p.char && !S.assets[p.char]);
      if (S.sig === sig && S.alive && !missing) {
        // karakter tidak berubah -> cukup update avatar/ready yang murah
        for (const slot of [1, 2]) {
          const av = S.avatars[slot];
          if (!av) continue;
          const box = emblemFor(slot);
          if (box && av.app.view.parentNode !== box) {
            box.appendChild(av.app.view);
            box.classList.add("has-chibi");
          }
        }
        syncReady();
        return;
      }
      const gen = S.gen;
      S.lastPlayers = players;
      pending = apply(players)
        .then((ok) => {
          if (gen !== S.gen) return;
          if (ok) {
            S.sig = sig; // baru dianggap beres kalau asetnya benar-benar ada
            S.retryDelay = 1500;
            clearTimeout(S.retryTimer);
            S.retryTimer = 0;
          } else {
            scheduleRetry();
          }
        })
        .catch((e) => {
          console.warn("[chibi] gagal:", e && e.message);
          scheduleRetry();
        });
      return pending;
    },

    /** Hapus cache aset lokal (dipakai kalau file aset diganti). */
    async clearCache() {
      try {
        indexedDB.deleteDatabase(IDB_NAME);
      } catch (_) {}
      S.preloaded = false;
      preloadPromise = null;
      return true;
    },

    /** Paksa satu karakter memainkan special (untuk event game nanti). */
    pulse(slot) {
      if (S.walkers.length) {
        const w = slot ? walkerFor(slot) : pick(S.walkers);
        if (w && !w.actionName) return playAction(w, w.spine.charConfig.special, ["Special"], false);
      }
      if (slot && setAvatarAction(slot, "Special", false)) return "avatar";
      return null;
    },

    /** Keluar lobby: hentikan loop dan bebaskan semua sumber daya. */
    destroy() {
      S.gen++;
      S.alive = false;
      S.sig = null;
      S.lastPlayers = null;
      S.retryDelay = 1500;
      clearTimeout(S.retryTimer);
      S.retryTimer = 0;
      S.nextSpecialAt = 0;
      S.chars = { 1: null, 2: null };
      S.ready = { 1: false, 2: false };
      unbindTicker();
      clearWalkers();
      destroyAvatar(1);
      destroyAvatar(2);
      if (S.app) {
        try {
          S.app.destroy(true, { children: true });
        } catch (_) {}
        S.app = null;
      }
      S.stageEl = null;
    },

    status() {
      return {
        version: CHIBI_VERSION,
        alive: S.alive,
        chars: { ...S.chars },
        loaded: Object.keys(S.assets),
        walkers: S.walkers.length,
        avatars: [1, 2].filter((s) => S.avatars[s]).length,
        specials: S.specials,
        ticker: !!S.tickerBound,
        frames: S.frames || 0,
        walkersInfo: S.walkers.map((w) => ({
          anim: (w.spine.state.getCurrent(0) || {}).animation
            ? w.spine.state.getCurrent(0).animation.name
            : null,
          action: w.actionName,
          floorY: Math.round(w.holder.y),
          top: Math.round(w.spine.getBounds().y),
          bottom: Math.round(
            w.spine.getBounds().y + w.spine.getBounds().height
          ),
          walkTimer: +w.walkTimer.toFixed(1),
          slot: w.slot,
          x: Math.round(w.holder.x),
          mode: w.mode,
          dir: w.dir,
          speed: +w.speed.toFixed(2),
          lo: Math.round(w.limitMin),
          hi: Math.round(w.limitMax),
        })),
        preloaded: S.preloaded,
        cacheHits: S.cacheHits,
        offline: !!S.offline,
      };
    },
  };

  /* boot runtime sekali di latar belakang saat browser senggang */
  async function preload() {
    try {
      await ensureRuntime();
      S.runtimeFails = 0;
      S.offline = false;
      bindTicker();
      if (CFG.special.enabled) {
        S.nextSpecialAt = performance.now() + rnd(CFG.special.firstMin, CFG.special.firstMax) * 1000;
      }
      // unduh semua aset di latar belakang setelah halaman tenang.
      // Dari cache lokal, jadi buka app berikutnya nyaris tanpa unduh.
      if (!CFG.preload || CFG.preload.all !== false) {
        const start = () => preloadAssets();
        if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 4000 });
        else setTimeout(start, (CFG.preload && CFG.preload.delayMs) || 1500);
      }
    } catch (e) {
      S.runtimeFails++;
      // baru menyerah kalau sudah beberapa kali gagal — sekali gagal
      // (misal wifi belum nyala) tidak boleh mematikan chibi selamanya
      if (S.runtimeFails >= 3) S.offline = true;
      console.warn("[chibi] runtime gagal dimuat (coba ke-" + S.runtimeFails + "):", e.message);
      if (S.runtimeFails < 3) setTimeout(preload, 2500 * S.runtimeFails);
    }
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    if (!S.alive || !S.app) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!S.alive) return;
      fitStage();
      const z = zone();
      for (const w of S.walkers) {
        w.holder.y = z.floorY;
        w.holder.x = Math.min(Math.max(w.holder.x, z.minX), z.maxX);
      }
    }, 120);
  });

  window.ChibiLobby = ChibiLobby;

  // Muat runtime setelah halaman siap (tidak memblokir menu).
  if (document.readyState === "complete") setTimeout(preload, 400);
  else window.addEventListener("load", () => setTimeout(preload, 400), { once: true });
})();
