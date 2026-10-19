"use strict";
/* ============================================================
   CHIBI LOBBY — KONFIGURASI
   ------------------------------------------------------------
   File ini TUJUANNYA untuk di-tweak manual.
   Logika berat ada di js/chibi.js — tidak perlu disentuh
   kecuali mau mengubah perilaku mesinnya.

   Aset tiap karakter diasumsikan ada di:
     assets/chibi/<id>/char.skel   (Spine 3.8.99 binary)
     assets/chibi/<id>/char.png
     assets/chibi/<id>/char.atlas
   ============================================================ */

const CHIBI_CONFIG = {
  /* ---- tempo ---- */
  pace: 0.8, // pengali kecepatan jalan + timeScale animasi. 1 = normal, 0.55 = lambat

  /* ---- siklus jalan / diam ---- */
  walk: { min: 3, max: 9 }, // detik jalan sebelum berhenti
  idle: { min: 2.5, max: 6.5 }, // detik diam (anim Relax) sebelum jalan lagi

  /* ---- special otomatis (tanpa tombol) ---- */
  special: {
    enabled: true,
    firstMin: 9, // jeda pertama setelah lobby dibuka (detik)
    firstMax: 16,
    gapMin: 22, // jarak antar special berikutnya (detik)
    gapMax: 48,
  },

  /* ---- preload & cache ----
     all: true  -> semua karakter diunduh di latar belakang saat app dibuka
                   (sekali saja; setelah itu tersimpan di cache browser).
     delayMs    -> dipakai kalau browser tidak mendukung requestIdleCallback.
     Kalau mau hemat kuota, set all: false — nanti tiap karakter diunduh
     saat benar-benar dipakai di room. */
  preload: {
    all: true,
    delayMs: 1500,
  },

  /* ---- area lantai ---- */
  zone: {
    desktopMinWidth: 900, // di bawah ini = mode avatar (tidak ada lantai)

    // tinggi karakter = tinggi panggung x desktopScale, dijepit minPx..maxPx.
    // Panggungnya sendiri ikut memanjang sesuai sisa layar (stageMin..stageMax),
    // jadi di monitor tinggi chibi otomatis besar tanpa pernah kepotong.
    // Semua karakter memakai tinggi acuan yang sama (BODY_UNITS di chibi.js),
    // jadi tingginya di layar selalu sama.
    desktopScale: 0.96,
    minPx: 120,
    maxPx: 330,

    stageMin: 140, // panggung minimal (px)
    stageMax: 360, // panggung maksimal (px)
    stageReserve: 72, // ruang yang disisakan untuk footer (px)

    mobileSize: 52, // tinggi avatar di baris OPERATORS (px)
    floorInset: 6, // jarak minimum kaki dari dasar panggung (px)
  },

  /* ---- roster ----
     walk      : nama animasi jalan
     walkUnits : kecepatan "tanpa selip" hasil ukur (unit skeleton/detik).
                 Kecil = jalannya pelan, besar = cepat. Ini yang paling sering diubah.
     idles     : animasi diam (dipilih acak)
     special   : animasi special
     speedScale: (opsional) pengali tambahan. Kalau diubah, kaki akan selip sedikit.
  */
  chars: [
    {
      id: "mudrok",
      label: "Mudrok / AmbienceSynesthesia",
      walk: "Move",
      walkUnits: 65,
      idles: ["Relax", "Sit"],
      special: "Special",
    },
    {
      id: "frostl",
      label: "Frostl / BoC",
      walk: "Move",
      walkUnits: 170,
      idles: ["Relax", "Sit"],
      special: "Special",
    },
    {
      id: "aprl",
      label: "April / Wild",
      walk: "Move",
      walkUnits: 223,
      idles: ["Relax", "Sit"],
      special: "Special",
    },
    {
      id: "liskam",
      label: "Liskarm / Nian",
      walk: "Move",
      walkUnits: 313,
      idles: ["Relax", "Sit"],
      special: "Special",
    },
    {
      id: "vigna",
      label: "Vigna / AS",
      walk: "Move",
      walkUnits: 144,
      idles: ["Relax", "Sit"],
      special: "Special",
    },
  ],
};

// dipakai js/chibi.js
window.CHIBI_CONFIG = CHIBI_CONFIG;
