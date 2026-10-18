"use strict";
// Isi file pada path ini. Boleh ganti path/ekstensi ke .ogg atau .wav.
// Path kosong ("" atau null) = nonaktif. File yang belum ada = diam, tanpa synth.
const AUDIO_FILES = {
  bgm: {
    menu: "assets/audio/bgm/menu.ogg",
    battle: "assets/audio/bgm/battle.mp3",
  },
  sfx: {
    click: "assets/audio/sfx/ui_click.mp3",
    select: "assets/audio/sfx/ui_select.mp3",
    drop: "assets/audio/sfx/drop.mp3",
    error: "assets/audio/sfx/action_error.mp3",
    offer: "assets/audio/sfx/card_offer.mp3",
    start: "assets/audio/sfx/operation_start.mp3",
    win: "assets/audio/sfx/victory.mp3",
    draw: "assets/audio/sfx/draw.mp3",
    blast: "assets/audio/sfx/skill_impact.mp3",
    shield: "assets/audio/sfx/skill_shield.mp3",
    shift: "assets/audio/sfx/skill_shift.mp3",
    skill: "assets/audio/sfx/skill_cast.mp3",
    expiry: "assets/audio/sfx/effect_expire.mp3",
    resist: "assets/audio/sfx/effect_resist.mp3",
  },
  cards: {
    purge: "assets/audio/sfx/cards/card_purge.wav",
    magnetic: "assets/audio/sfx/cards/card_magnetic.wav",
    heavy: "assets/audio/sfx/cards/card_heavy.wav",
    bomb: "assets/audio/sfx/cards/card_bomb.mp3",
    gravity: "assets/audio/sfx/cards/card_gravity.wav",
    flip: "assets/audio/sfx/cards/card_flip.wav",
    bottom: "assets/audio/sfx/cards/card_bottom.wav",
    void: "assets/audio/sfx/cards/card_void.wav",
    superbomb: "assets/audio/sfx/cards/card_bomb.mp3",
    ouroboros: "assets/audio/sfx/cards/card_ouroboros.mp3",
    expansion: "assets/audio/sfx/cards/card_expansion.mp3",
    forced: "assets/audio/sfx/cards/card_forced.mp3",
    threshold: "assets/audio/sfx/cards/card_threshold.mp3",
    colorblind: "assets/audio/sfx/cards/card_colorblind.mp3",
    colorblindplus: "assets/audio/sfx/cards/card_colorblindplus.mp3",
    recycle: "assets/audio/sfx/cards/card_recycle.mp3",
    demotion: "assets/audio/sfx/cards/card_demotion.mp3",
    mimic: "assets/audio/sfx/cards/card_mimic.mp3",
    shield: "assets/audio/sfx/cards/card_shield.mp3",
    overload: "assets/audio/sfx/cards/card_overload.mp3",
    lock: "assets/audio/sfx/cards/card_lock.mp3",
    reposition: "assets/audio/sfx/cards/card_reposition.mp3",
    decoy: "assets/audio/sfx/cards/card_decoy.mp3",
  },
};

/* Custom files only. No built-in recordings, oscillator, synth or music generator.
 * Edit the AUDIO_FILES mapping at the top of this file or drop your files at its existing paths. */
const AudioSystem = (() => {
  const defaults = {
    enabled: false,
    bgm: true,
    sfx: true,
    musicVolume: 56,
    sfxVolume: 70,
  };
  const prefs = { ...defaults };
  const storageKey = "fourfold.audio.custom";
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") {
      for (const key of ["enabled", "bgm", "sfx"])
        if (typeof saved[key] === "boolean") prefs[key] = saved[key];
      for (const key of ["musicVolume", "sfxVolume"])
        if (Number.isFinite(saved[key]))
          prefs[key] = Math.max(0, Math.min(100, saved[key]));
    }
  } catch (_) {}
  const root = new URL("../", document.currentScript.src);
  const cache = new Map(),
    pending = new Map(),
    missing = new Set(),
    voices = new Set();
  let ctx,
    music,
    effects,
    master,
    duck,
    track = null,
    scene = "menu",
    request = 0,
    epoch = 0,
    loading = false,
    failed = false;
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch (_) {}
  };
  const pathForScene = () => AUDIO_FILES.bgm[scene];
  const canPlay = () =>
    ctx?.state === "running" && prefs.enabled && !document.hidden;
  const wantsMusic = () => canPlay() && prefs.bgm;
  function diagnostics() {
    let state, message;
    if (failed) {
      state = "error";
      message = "AUDIO UNAVAILABLE / browser tidak mendukung audio.";
    } else if (!prefs.enabled) {
      state = "off";
      message = "AUDIO OFF / aktifkan setelah mengisi file sendiri.";
    } else if (!canPlay()) {
      state = "paused";
      message = "PAUSED / klik AUDIO atau RELOAD AUDIO FILES.";
    } else if (!prefs.bgm || !prefs.musicVolume) {
      state = "muted";
      message = "MUSIC MUTED / BGM off atau volume 0.";
    } else if (!pathForScene() || missing.has(pathForScene())) {
      state = "empty";
      message = "BELUM ADA AUDIO / isi file BGM sendiri, lalu RELOAD.";
    } else if (track?.path === pathForScene()) {
      state = "playing";
      message = "PLAYING / CUSTOM BGM";
    } else {
      state = "loading";
      message = "LOADING / CUSTOM BGM";
    }
    return {
      version: "custom-audio-5",
      scene,
      state,
      message,
      loading,
      path: pathForScene() || null,
      missing: [...missing],
    };
  }
  function sync() {
    if (ctx) {
      master.gain.setTargetAtTime(
        prefs.enabled && !document.hidden ? 0.8 : 0,
        ctx.currentTime,
        0.03
      );
      music.gain.setTargetAtTime(
        prefs.bgm ? prefs.musicVolume / 100 : 0,
        ctx.currentTime,
        0.03
      );
      effects.gain.setTargetAtTime(
        prefs.sfx ? prefs.sfxVolume / 100 : 0,
        ctx.currentTime,
        0.03
      );
    }
    const power = document.getElementById("audioPower");
    if (!power) return;
    power.textContent = failed
      ? "AUDIO / UNAVAILABLE"
      : `AUDIO / ${prefs.enabled ? (canPlay() ? "ON" : "READY") : "OFF"}`;
    power.setAttribute("aria-pressed", String(prefs.enabled));
    power.setAttribute(
      "aria-label",
      prefs.enabled ? "Matikan semua audio" : "Aktifkan audio kustom"
    );
    for (const key of ["bgm", "sfx"]) {
      const button = document.getElementById(`audio-${key}`);
      button.textContent = `${key.toUpperCase()} / ${
        prefs[key] ? "ON" : "OFF"
      }`;
      button.setAttribute("aria-pressed", String(prefs[key]));
    }
    for (const key of ["musicVolume", "sfxVolume"]) {
      document.getElementById(`audio-${key}`).value = prefs[key];
      document.getElementById(
        `audio-${key}-value`
      ).textContent = `${prefs[key]}%`;
    }
    document.getElementById("audioTrack").textContent =
      pathForScene()?.replace(/^assets\/audio\//, "") ||
      "BGM / DISABLED IN MANIFEST";
    const status = diagnostics(),
      el = document.getElementById("audioStatus");
    el.textContent = status.message;
    el.dataset.state = status.state;
  }
  function load(path) {
    if (!path || missing.has(path)) return Promise.resolve(null);
    if (cache.has(path)) return Promise.resolve(cache.get(path));
    if (pending.has(path)) return pending.get(path).promise;
    const job = { controller: new AbortController(), promise: null };
    const timeout = setTimeout(() => job.controller.abort(), 15000);
    job.promise = (async () => {
      try {
        const response = await fetch(new URL(path, root), {
          signal: job.controller.signal,
          cache: "no-cache",
        });
        if (
          !response.ok ||
          response.headers.get("content-type")?.includes("text/html")
        )
          throw new Error("Optional audio file unavailable");
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength) throw new Error("Empty audio file");
        const buffer = await ctx.decodeAudioData(bytes);
        if (pending.get(path) === job) cache.set(path, buffer);
        return buffer;
      } catch (_) {
        // Unfilled slots are expected. Never synthesize substitute sounds.
        if (pending.get(path) === job) missing.add(path);
        return null;
      } finally {
        clearTimeout(timeout);
        if (pending.get(path) === job) pending.delete(path);
      }
    })();
    pending.set(path, job);
    return job.promise;
  }
  function stopTrack() {
    if (!track) return;
    const old = track;
    track = null;
    old.amp.gain.cancelScheduledValues(ctx.currentTime);
    old.amp.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    try {
      old.source.stop(ctx.currentTime + 0.2);
    } catch (_) {}
  }
  function stopEffects() {
    ++epoch;
    for (const source of voices) {
      try {
        source.stop();
      } catch (_) {}
    }
    voices.clear();
  }
  async function updateMusic() {
    const token = ++request,
      path = pathForScene();
    if (!wantsMusic() || !path) {
      loading = false;
      stopTrack();
      sync();
      return;
    }
    if (track?.path === path) return;
    stopTrack();
    loading = true;
    sync();
    const buffer = await load(path);
    if (token !== request || !wantsMusic() || path !== pathForScene()) return;
    loading = false;
    if (buffer) {
      const source = ctx.createBufferSource(),
        amp = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(amp);
      amp.connect(music);
      amp.gain.setValueAtTime(0, ctx.currentTime);
      amp.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.2);
      source.onended = () => {
        source.disconnect();
        amp.disconnect();
      };
      source.start();
      track = { source, amp, path };
    }
    sync();
  }
  async function unlock() {
    if (!prefs.enabled || document.hidden || failed) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error("Web Audio unsupported");
        ctx = new AC();
        music = ctx.createGain();
        effects = ctx.createGain();
        master = ctx.createGain();
        duck = ctx.createGain();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.knee.value = 16;
        compressor.ratio.value = 6;
        music.connect(duck);
        duck.connect(master);
        effects.connect(master);
        master.connect(compressor);
        compressor.connect(ctx.destination);
        ctx.onstatechange = sync;
      }
      await ctx.resume();
      sync();
      updateMusic();
      for (const path of Object.values(AUDIO_FILES.sfx)) load(path);
    } catch (_) {
      failed = true;
      prefs.enabled = false;
      sync();
    }
  }
  async function sfx(name, cardId = null) {
    if (!canPlay() || !prefs.sfx) return;
    const token = epoch;
    const customPath = cardId ? AUDIO_FILES.cards[cardId] : null;
    let buffer = customPath ? await load(customPath) : null;
    if (!buffer) buffer = await load(AUDIO_FILES.sfx[name]);
    if (!buffer || token !== epoch || !canPlay() || !prefs.sfx) return;
    while (voices.size >= 12) {
      const old = voices.values().next().value;
      try {
        old.stop();
      } catch (_) {}
      voices.delete(old);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(effects);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
    };
    if (["blast", "skill", "start", "win"].includes(name)) {
      const t = ctx.currentTime;
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(0.55, t);
      duck.gain.linearRampToValueAtTime(1, t + 0.5);
    }
    source.start();
  }
  function result(before, events, game) {
    const cast =
      events.find(
        (e) =>
          e.type === "cast" &&
          ["bomb", "superbomb", "heavy", "bottom", "purge", "void"].includes(
            e.id
          )
      ) || events.find((e) => e.type === "cast");
    if (cast) {
      const name = [
        "bomb",
        "superbomb",
        "heavy",
        "bottom",
        "purge",
        "void",
      ].includes(cast.id)
        ? "blast"
        : cast.id === "shield"
        ? "shield"
        : ["gravity", "flip", "magnetic", "ouroboros"].includes(cast.id)
        ? "shift"
        : "skill";
      sfx(name, cast.id);
    } else if (events.some((e) => e.type === "resist")) sfx("resist");
    else if (game.coins().some((item) => !before.coins.has(item.coin.id)))
      sfx("drop");
    else if (game.s.offer) sfx("offer");
    else if (events.some((e) => e.type === "expiry")) sfx("expiry");
  }
  function setScene(value) {
    if (!["menu", "battle"].includes(value) || scene === value) return;
    scene = value;
    stopTrack();
    updateMusic();
    sync();
  }
  function init() {
    document.getElementById("audioPower").onclick = () => {
      prefs.enabled = !prefs.enabled;
      save();
      if (prefs.enabled) unlock();
      else {
        ++request;
        stopTrack();
        stopEffects();
      }
      sync();
    };
    for (const key of ["bgm", "sfx"])
      document.getElementById(`audio-${key}`).onclick = () => {
        prefs[key] = !prefs[key];
        save();
        if (key === "sfx" && !prefs.sfx) stopEffects();
        sync();
        if (prefs.enabled) unlock();
      };
    for (const key of ["musicVolume", "sfxVolume"])
      document.getElementById(`audio-${key}`).oninput = (event) => {
        prefs[key] = Number(event.target.value);
        save();
        sync();
      };
    document.getElementById("audioRetry").onclick = () => {
      ++request;
      stopTrack();
      stopEffects();
      for (const job of pending.values()) job.controller.abort();
      pending.clear();
      cache.clear();
      missing.clear();
      prefs.enabled = true;
      save();
      sync();
      unlock();
    };
    document.addEventListener(
      "pointerdown",
      () => {
        if (prefs.enabled && ctx?.state !== "running") unlock();
      },
      { passive: true }
    );
    document.addEventListener("keydown", (event) => {
      if (
        ["Enter", " ", "1", "2"].includes(event.key) &&
        prefs.enabled &&
        ctx?.state !== "running"
      )
        unlock();
    });
    document.addEventListener(
      "click",
      (event) => {
        if (
          !event.target.closest("#audioConsole") &&
          event.target.closest("button:not(:disabled)") &&
          !event.target.closest(
            "#board,#columnHeaders,#rowHeaders,#sideHeaders"
          )
        )
          sfx("click");
      },
      true
    );
    function pause() {
      ++request;
      loading = false;
      stopTrack();
      stopEffects();
      if (ctx) ctx.suspend().catch(() => {});
      sync();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
      else if (prefs.enabled) unlock();
    });
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", () => {
      if (ctx && prefs.enabled) unlock();
    });
    sync();
  }
  return Object.freeze({
    init,
    sfx,
    result,
    setScene,
    get status() {
      return Object.freeze(diagnostics());
    },
  });
})();
