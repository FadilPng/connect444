"use strict";
const ICONS = {
  purge:
    '<circle cx="20" cy="20" r="7"/><path d="M10 10l20 20m0-20L10 30"/><path d="M20 2v5m0 26v5M2 20h5m26 0h5"/>',
  magnetic:
    '<circle cx="9" cy="20" r="4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="20" r="2.6"/><circle cx="21.5" cy="20" r="2.6"/><circle cx="30" cy="20" r="6"/><path d="m26.5 16.5 7 7m0-7-7 7"/>',
  heavy:
    '<circle cx="20" cy="8" r="6"/><circle cx="20" cy="8" r="1.8" fill="currentColor" stroke="none"/><path d="M20 14v9m-4-4 4 4 4-4"/><path d="M4 29h9m14 0h9"/><path d="m17 25 6 6m0-6-6 6"/><path d="M2 35h36"/>',
  bomb: '<rect x="9" y="9" width="22" height="22" stroke-dasharray="3 3"/><path d="M16.5 9v22M23.5 9v22M9 16.5h22M9 23.5h22"/><path d="M20 14v12M14 20h12M16 16l8 8m0-8-8 8"/>',
  gravity:
    '<path d="M6 13h28M12 7l-6 6 6 6M28 7l6 6-6 6"/><path d="M20 22v10m-4-4 4 4 4-4"/><path d="M13 22l14 10"/>',
  flip: '<path d="M14 4v32M26 4v32"/><circle cx="20" cy="9" r="4"/><circle cx="20" cy="31" r="4"/><path d="M28 11c3 5 3 13 0 18M25 26l3 3 3-3M12 29c-3-5-3-13 0-18M9 14l3-3 3 3"/>',
  bottom:
    '<path d="M7 5h26v8H7zM7 15h26v8H7z"/><rect x="7" y="25" width="26" height="8" stroke-dasharray="3 2"/><path d="M10 25.5l20 7M30 25.5l-20 7"/>',
  void: '<path d="M11 4v32M29 4v32" stroke-dasharray="4 3"/><path d="M17 10h6v13l-3 7-3-7V10Z"/><path d="M14 10h12M20 4v6"/><path d="m12 31 3 3m13-3-3 3"/>',
  superbomb:
    '<path d="M6 34 15 16h10l9 18"/><path d="M2 34h36"/><path d="M20 3v12M14 9h12M16 5l8 8m0-8-8 8"/><circle cx="9" cy="8" r="1.6" fill="currentColor" stroke="none"/><circle cx="31" cy="8" r="1.6" fill="currentColor" stroke="none"/><path d="M4 22l4 1M36 22l-4 1"/>',
  ouroboros:
    '<path d="M5 8h7v24H5zM28 8h7v24H28z"/><path d="M14 8h5v24h-5zM21 8h5v24h-5z" stroke-dasharray="3 2"/><path d="M8 4h24m-6-3 6 3-6 3M32 36H8m6-3-6 3 6 3"/>',
  expansion:
    '<path d="M8 14h18v18H8zM17 14v18M8 23h18"/><rect x="26" y="14" width="9" height="18" stroke-dasharray="3 2"/><rect x="8" y="5" width="18" height="9" stroke-dasharray="3 2"/><path d="M30.5 21v6m-3-3h6M17 7.5v4m-2-2h4"/>',
  forced:
    '<path d="M4 17h7l11-5v16l-11-5H4Z"/><path d="M9 23l-2 8"/><circle cx="29" cy="14" r="2.6"/><path d="M29 17v5m-2.5-2.5 2.5 2.5 2.5-2.5"/><path d="M26 27h7v8h-7z"/>',
  threshold:
    '<path d="M6 11h22M4 29h28"/><circle cx="9" cy="11" r="2.8"/><circle cx="17" cy="11" r="2.8"/><circle cx="25" cy="11" r="2.8"/><circle cx="7" cy="29" r="2.8"/><circle cx="13" cy="29" r="2.8"/><circle cx="19" cy="29" r="2.8"/><circle cx="25" cy="29" r="2.8"/><circle cx="31" cy="29" r="2.8"/><path d="M35 13v14M32 16l3-3 3 3M32 24l3 3 3-3"/>',
  colorblind:
    '<path d="M3 20c5-7 11-11 17-11s12 4 17 11c-5 7-11 11-17 11S8 27 3 20Z"/><circle cx="20" cy="20" r="5" stroke-dasharray="3 2"/><path d="M5 35 35 5"/>',
  colorblindplus:
    '<path d="M2 18c5-6 10-9 16-9s11 3 16 9c-5 6-10 9-16 9s-11-3-16-9Z"/><circle cx="18" cy="18" r="4.5" stroke-dasharray="3 2"/><path d="M4 32 32 4"/><path d="M32 28v9m-4.5-4.5h9"/>',
  recycle:
    '<path d="M5 10h13v16H5z"/><path d="M11.5 15l3 4-3 4-3-4 3-4Z"/><path d="M20 18h8m-4-4 4 4-4 4"/><circle cx="32" cy="10" r="3.5"/><path d="M32 14v9m-3-3 3 3 3-3"/><path d="M26 28h12"/>',
  demotion:
    '<path d="M4 14h15v19H4zM10 9h15v19"/><path d="M16 4h16v20" stroke-dasharray="3 2"/><path d="m17 7 13 13m0-13-13 13"/>',
  mimic:
    '<path d="M20 4v32" stroke-dasharray="3 3"/><path d="M5 10h11v20H5z"/><path d="M10.5 16l3 4-3 4-3-4 3-4Z"/><path d="M24 10h11v20h-11" stroke-dasharray="3 2"/><path d="M32 2v6m-3-3h6"/>',
  shield:
    '<path d="m20 3 14 6v12c0 9-14 16-14 16S6 30 6 21V9l14-6Z"/><path d="m20 9 8 4v8c0 5-8 10-8 10s-8-5-8-10v-8l8-4Z"/><circle cx="20" cy="19" r="4.5"/>',
  overload:
    '<circle cx="8" cy="9" r="4"/><path d="M8 13v8m-3-3 3 3 3-3"/><path d="M21 6l-7 15h5l-1 13 8-16h-5l0-12Z" fill="currentColor" stroke="none"/><path d="M28 12h8v16h-8z"/>',
  lock: '<path d="M10 4v32M30 4v32"/><path d="M20 4v5m-2.5-2.5L20 9l2.5-2.5"/><path d="M15 20v-3a5 5 0 0 1 10 0v3"/><path d="M14 20h12v13H14z"/><circle cx="20" cy="24" r="1.8" fill="currentColor" stroke="none"/><path d="M20 26v4"/>',
  reposition:
    '<circle cx="7" cy="13" r="4"/><circle cx="33" cy="27" r="4"/><path d="M12 13h18m-5-5 5 5-5 5M28 27H10m5-5-5 5 5 5"/>',
  decoy:
    '<circle cx="20" cy="21" r="11" stroke-dasharray="4 3"/><circle cx="20" cy="21" r="4"/><path d="M13 28l14-14"/><path d="M32 3v6m-3-3h6"/>',
  grid: '<path d="M5 5h11v11H5zM24 5h11v11H24zM5 24h11v11H5zM24 24h11v11H24z"/>',
  crosshair:
    '<circle cx="20" cy="20" r="13"/><path d="M20 1v11m0 16v11M1 20h11m16 0h11"/><path d="m20 16 4 4-4 4-4-4 4-4Z"/>',
  book: '<path d="M20 9C15 5 8 4 3 5v28c7-1 12 0 17 4 5-4 10-5 17-4V5c-5-1-12 0-17 4Zm0 0v28M8 12l7 2m-7 5 7 2m10-7 7-2m-7 9 7-2"/>',
  search: '<circle cx="17" cy="17" r="11"/><path d="m25 25 11 11"/>',
  info: '<circle cx="20" cy="20" r="16"/><path d="M20 17v12m0-19v2"/>',
  "arrow-right": '<path d="M4 20h31M23 7l13 13-13 13"/>',
  "arrow-left": '<path d="M36 20H5M17 7 4 20l13 13"/>',
  "arrow-down": '<path d="M20 4v31M7 23l13 13 13-13"/>',
  "arrow-up": '<path d="M20 36V5M7 17 20 4l13 13"/>',
  close: '<path d="M9 9l22 22m0-22L9 31"/>',
  check: '<path d="m7 21 8 8L34 9"/>',
  deploy:
    '<path d="M20 2v21m-7-7 7 7 7-7M7 23v12h26V23M3 39h34"/><path d="m14 29 6 3 6-3"/>',
  cards:
    '<path d="M9 9h23v27H9zM4 3h23M4 3v27"/><path d="m20 15 6 7-6 7-5-7 5-7Z"/>',
  signal:
    '<path d="M4 29h5v7H4zM14 21h5v15h-5zM24 12h5v24h-5zM34 3h4v33h-4z" fill="currentColor" stroke="none"/>',
  settings:
    '<path d="m16 3-1 5-4 2-5-1-4 8 4 4 1 4-2 5 8 5 4-3h5l4 3 8-5-2-5 1-4 4-4-4-8-5 1-4-2-1-5h-7Z"/><circle cx="20" cy="20" r="7"/>',
  operator1:
    '<path d="m20 4 16 30H4L20 4Z"/><path d="m20 13 9 17H11l9-17Z" fill="currentColor" stroke="none"/>',
  operator2:
    '<path d="m20 3 17 17-17 17L3 20 20 3Z"/><path d="m20 11 9 9-9 9-9-9 9-9Z" fill="currentColor" stroke="none"/>',
  "expand-col":
    '<path d="M4 8h17v25H4zM28 8h8v25h-8z" stroke-dasharray="3 2"/><path d="M16 20h18m-5-5 5 5-5 5"/>',
  "expand-row":
    '<path d="M7 19h26v17H7zM7 3h26v9H7z" stroke-dasharray="3 2"/><path d="M20 29V6m-5 5 5-5 5 5"/>',
  target3:
    '<path d="M5 13V5h8m14 0h8v8m0 14v8h-8m-14 0H5v-8M15 13h10l-7 7 7 1v7H15"/>',
  target5:
    '<path d="M5 13V5h8m14 0h8v8m0 14v8h-8m-14 0H5v-8M26 12H15v8h10v8H14"/>',
  trophy:
    '<path d="M11 5h18v14c0 8-18 8-18 0V5Zm0 3H4v8c0 5 7 6 7 6m18-14h7v8c0 5-7 6-7 6M20 25v9m-9 3h18M15 34h10"/>',
};
function icon(name, className = "") {
  return `<svg class="${className}" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${
    ICONS[name] || ICONS.crosshair
  }</svg>`;
}
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
function safe(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': "&#34;", "'": "&#39;" }[
        character
      ])
  );
}
const $ = (id) => document.getElementById(id);
const pad = (number, length = 2) => String(number).padStart(length, "0");
