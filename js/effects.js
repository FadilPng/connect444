"use strict";
function captureTokens() {
  const board = $("board"), rect = board.getBoundingClientRect(), coins = new Map();
  board.querySelectorAll("[data-coin]").forEach(el => {
    const cell = el.closest(".cell");
    coins.set(Number(el.dataset.coin),{rect:el.getBoundingClientRect(),html:el.outerHTML,r:Number(cell.dataset.r),c:Number(cell.dataset.c)});
  });
  return {rect,coins,gravity:ui.game?.s.gravity || "down"};
}
function animateTransition(before,events) {
  if (!motionAllowed()) return 0;
  const g = ui.game, board = $("board"), rect = board.getBoundingClientRect(), layer = $("fxLayer");
  const after = new Map([...board.querySelectorAll("[data-coin]")].map(el => [Number(el.dataset.coin),el]));
  let moved = false;
  const easing = "cubic-bezier(.2,.75,.2,1)";
  const flipping = events.some(event => event.id === "flip" && event.type === "cast");
  let flipIndex = 0;
  for (const [id,el] of after) {
    const now = el.getBoundingClientRect(), old = before.coins.get(id);
    if (old) {
      const dx = old.rect.left-now.left, dy = old.rect.top-now.top;
      if (Math.abs(dx)+Math.abs(dy) > 1 || Math.abs(old.rect.width-now.width) > 1) {
        moved = true;
        if (flipping) {
          // Each coin flips over on its own axis while sliding to the mirrored row.
          el.animate([
            {transform:`translate(${dx}px,${dy}px) rotateX(0deg)`},
            {transform:`translate(${dx/2}px,${dy/2}px) rotateX(90deg) scale(1.12)`,offset:.5},
            {transform:"none"}
          ],{duration:780,easing,delay:Math.min(220,flipIndex++*18)});
        } else {
          el.animate([{transform:`translate(${dx}px,${dy}px) scale(${old.rect.width/now.width})`},{transform:"none"}],{duration:620,easing});
        }
      }
    } else {
      moved = true;
      let dx = 0, dy = -(now.top-rect.top+now.height*1.7);
      if (before.gravity === "left") { dx = rect.right-now.left+now.width; dy = 0; }
      if (before.gravity === "right") { dx = -(now.right-rect.left+now.width); dy = 0; }
      if (before.gravity === "up") dy = rect.bottom-now.top+now.height;
      el.animate([{transform:`translate(${dx}px,${dy}px) scale(.8)`,opacity:.1},{transform:"translate(0,3px) scale(1.04)",opacity:1,offset:.8},{transform:"none",opacity:1}],{duration:520,easing});
    }
  }
  const removal = events.find(event => event.type === "cast" && ["purge","magnetic","heavy","bottom","bomb","superbomb","void"].includes(event.id));
  for (const [id,old] of before.coins) {
    if (after.has(id)) continue;
    moved = true;
    const ghost = document.createElement("div");
    ghost.className = "token-ghost";
    Object.assign(ghost.style,{left:`${old.rect.left-rect.left}px`,top:`${old.rect.top-rect.top}px`,width:`${old.rect.width}px`,height:`${old.rect.height}px`});
    ghost.innerHTML = old.html;
    ghost.firstElementChild.removeAttribute("data-coin");
    ghost.firstElementChild.style.width = "100%"; ghost.firstElementChild.style.height = "100%";
    layer.appendChild(ghost);
    let dx = 0, dy = 0, end = "scale(.05) rotate(35deg)";
    if (removal?.id === "magnetic" && removal.context.origin) {
      const origin = removal.context.origin;
      dx = (origin.c+.5)*rect.width/g.width-(old.rect.left-rect.left+old.rect.width/2);
      dy = (origin.r+.5)*rect.height/g.height-(old.rect.top-rect.top+old.rect.height/2);
    }
    if (removal?.id === "void") { dy = -rect.height*.6; end = "scale(.2,2)"; }
    if (removal?.id === "bottom") { dy = 45; end = "scale(.3)"; }
    if (["bomb","superbomb"].includes(removal?.id)) {
      const center = removal.context.center;
      dx = (old.c-center.c)*25; dy = (old.r-center.r)*25; end = "scale(.1) rotate(90deg)";
    }
    ghost.animate([{opacity:1,transform:"none"},{opacity:.8,transform:"scale(1.1)",offset:.2},{opacity:0,transform:`translate(${dx}px,${dy}px) ${end}`}],{duration:650,easing,fill:"forwards"});
    later(() => ghost.remove(),700);
  }
  for (const event of events) {
    playEffect(event);
    if (event.type === "cast" && ["bomb","superbomb"].includes(event.id)) animateTransientBomb(event);
    // Flip: the board stays still; only the coins travel to their mirrored rows.
    if (event.type === "cast" && ["heavy","superbomb"].includes(event.id)) board.animate([{transform:"none"},{transform:"translateY(3px)"},{transform:"translateY(-2px)"},{transform:"none"}],{duration:350,easing:"ease-out"});
  }
  return events.length ? 900 : moved ? 650 : 0;
}
function animateTransientBomb(event) {
  const g = ui.game, position = event.context.center;
  if (!position) return;
  const cell = $("board").querySelector(`[data-r="${position.r}"][data-c="${position.c}"]`);
  if (!cell) return;
  const rect = cell.getBoundingClientRect(), board = $("board").getBoundingClientRect(), ghost = document.createElement("div");
  ghost.className = "token-ghost";
  Object.assign(ghost.style,{left:`${rect.left-board.left}px`,top:`${rect.top-board.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  ghost.innerHTML = `<span class="coin p${event.player}">${icon(event.id)}</span>`;
  $("fxLayer").appendChild(ghost);
  ghost.animate([{transform:`translateY(-${Math.min(board.height,rect.top-board.top+rect.height)}px)`,opacity:.2},{transform:"none",opacity:1,offset:.5},{transform:"scale(1.4)",opacity:0}],{duration:650,easing:"ease-out",fill:"forwards"});
  later(() => ghost.remove(),720);
}
function playEffect(event) {
  const g = ui.game, W = g.width*100, H = g.height*100;
  const ctx = {...event.context};
  if (event.id === "shield" && ctx.cells) ctx.cells = ctx.cells.map(cell => {
    const current = cell.id ? g.findCoin(cell.id) : null;
    return current ? {r:current.r,c:current.c,id:cell.id} : cell;
  });
  const point = cell => ({x:(cell.c+.5)*100,y:(cell.r+.5)*100});
  const first = ctx.center || ctx.cells?.[0], at = first ? point(first) : {x:W/2,y:H/2};
  const circles = (x,y,r,css = "fx-ring",extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" class="${css}" ${extra}/>`;
  const area = (cells = ctx.cells || [],css = "fx-flash") => cells.map(cell => `<rect x="${cell.c*100+7}" y="${cell.r*100+7}" width="86" height="86" fill="currentColor" fill-opacity=".22" stroke="currentColor" class="${css}"/>`).join("");
  const hex = (x,y,r,css = "fx-ring") => `<polygon points="${Array.from({length:6},(_,i) => `${x+Math.cos(i*Math.PI/3-Math.PI/6)*r},${y+Math.sin(i*Math.PI/3-Math.PI/6)*r}`).join(" ")}" class="${css}"/>`;
  const frame = `<path d="M4 55V4h55M${W-59} 4h55v51M${W-4} ${H-55}v51h-55M59 ${H-4}H4v-51" class="fx-flash"/>`;
  let art = "";
  let color = CATEGORY_COLOR[CARD_BY_ID[event.id]?.category] || "#d9ed7b";
  if (event.type === "expiry") {
    color = "#b2c5c1";
    switch (event.id) {
      case "gravity":
        art = Array.from({length:g.width},(_,c) => `<path d="M${c*100+50} 20v${H-70}m-18-18 18 18 18-18" class="fx-path"/>`).join("")+frame;
        break;
      case "flip": art = `<path d="M10 30h${W-20}M10 ${H-30}h${W-20}M${W/2} 30v${H-60}" class="fx-expiry" stroke-dasharray="8 6"/>`+circles(W/2,H/2,80,"fx-ring"); break;
      case "threshold": art = `<rect x="${W/2-100}" y="${H/2-100}" width="200" height="200" class="fx-expiry" stroke-dasharray="10 8"/><text x="${W/2}" y="${H/2+28}" text-anchor="middle" font-family="monospace" font-size="84" fill="currentColor" stroke="none" class="fx-flash">4</text>`; break;
      case "colorblind": case "colorblindplus":
        art = Array.from({length:g.height},(_,r) => `<path d="M10 ${r*100+50}H${W-10}" stroke="${r%2 ? "#e99b77" : "#82cbd9"}" stroke-width="30" opacity=".5" class="fx-sweep"/>`).join(""); break;
      case "ouroboros": art = `<path d="M${W-45} 45Q${W/2} ${H+70} 45 45m0 0 7 35m-7-35 35 7M45 ${H-45}Q${W/2} -70 ${W-45} ${H-45}" class="fx-path"/>`+frame; break;
      case "lock": art = area(ctx.cells,"fx-expiry")+`<path d="M${at.x-30} ${at.y-18}h60m-60 36h60" class="fx-expiry" stroke-dasharray="5 8"/>`; break;
      case "shield": art = (ctx.cells || []).map(cell => { const p=point(cell); return hex(p.x,p.y,46,"fx-expiry")+circles(p.x,p.y,34,"fx-ring",'stroke-dasharray="4 7"'); }).join(""); break;
      case "overload": art = `<path d="M${W/2+15} ${H/2-85}l-55 95h50l-25 75" class="fx-expiry" stroke-dasharray="5 9"/>`+circles(W/2,H/2,90,"fx-ring"); break;
      case "forced": art = `<path d="M${W/2-80} ${H/2-65}l160 130m-160 0 160-130" class="fx-expiry" stroke-dasharray="10 8"/>`; break;
      case "recycle": art = circles(W/2,H/2,75,"fx-expiry",'stroke-dasharray="10 7"')+`<path d="m${W/2-20} ${H/2} 15 15 30-35" class="fx-flash"/>`; break;
      default: art = frame;
    }
  } else if (event.type === "resist") {
    color = "#82cbd9";
    art = hex(at.x,at.y,49)+hex(at.x,at.y,61,"fx-flash");
  } else {
    switch (event.id) {
      case "purge":
        color = "#ef9787";
        art = circles(at.x,at.y,38,"fx-ring")+`<path d="M${at.x-65} ${at.y}h38m54 0h38M${at.x} ${at.y-65}v38m0 54v38" class="fx-flash"/><path d="m${at.x-28} ${at.y-28} 56 56m0-56-56 56" class="fx-fragment"/>`;
        break;
      case "magnetic": {
        const from = ctx.origin ? point(ctx.origin) : {x:W/2,y:H/2};
        art = `<path d="M${at.x} ${at.y}Q${from.x+90} ${at.y-75} ${from.x} ${from.y}" class="fx-path"/>`+circles(from.x,from.y,55,"fx-orbit",'stroke-dasharray="25 20"')+circles(at.x,at.y,38); break;
      }
      case "heavy": art = area()+`<path d="M5 ${at.y}H${W-5}" stroke-width="15" class="fx-sweep"/><path d="M${at.x} ${at.y-150}v120m-22-22 22 22 22-22" class="fx-path"/>`; break;
      case "bottom": art = area()+`<path d="M5 ${H-45}H${W-5}" stroke-width="22" class="fx-sweep"/><path d="M5 ${H-10}H${W-5}" class="fx-path"/>`; break;
      case "bomb": art = area()+circles(at.x,at.y,85)+circles(at.x,at.y,130,"fx-ring",'stroke-dasharray="10 10"')+`<path d="M${at.x-130} ${at.y}h260M${at.x} ${at.y-130}v260" class="fx-flash"/>`; break;
      case "superbomb": art = area()+circles(at.x,at.y,115)+circles(at.x,at.y,210,"fx-ring",'stroke-width="6"')+hex(at.x,at.y,155,"fx-fragment"); break;
      case "void": art = `<rect x="${ctx.lane*100+6}" y="0" width="88" height="${H}" fill="currentColor" fill-opacity=".3" class="fx-beam"/><path d="M${ctx.lane*100+50} ${H}V0" stroke-width="9" class="fx-path"/>`+area(ctx.cells,"fx-fragment"); break;
      case "gravity": {
        const left = ctx.direction === "left";
        art = Array.from({length:4},(_,i) => {
          const y = (i+1)*H/5;
          return `<path d="M${left ? W-20 : 20} ${y}H${left ? 25 : W-25}m${left ? 28 : -28}-20 ${left ? -28 : 28} 20 ${left ? 28 : -28} 20" class="fx-path"/>`;
        }).join("")+frame;
        break;
      }
      case "ouroboros": art = `<path d="M45 45Q${W/2} ${H+40} ${W-45} 45m-35 7 35-7-7 35M${W-45} ${H-45}Q${W/2} -40 45 ${H-45}m7-35-7 35 35-7" class="fx-path"/><path d="M45 5v${H-10}M${W-45} 5v${H-10}" stroke-width="5" class="fx-flash"/>`; break;
      case "expansion": art = `<rect x="${ctx.direction === "col" ? W-95 : 5}" y="5" width="${ctx.direction === "col" ? 90 : W-10}" height="${ctx.direction === "row" ? 90 : H-10}" fill="currentColor" fill-opacity=".12" stroke-dasharray="8 8" class="fx-shutter"/>`+`<path d="M5 5h${W-10}v${H-10}H5V5Z" class="fx-ring"/>`; break;
      case "flip": art = Array.from({length:g.width},(_,c) => {
        const x = c*100+50;
        return `<path d="M${x} 22v${H-58}m-13-13 13 13 13-13M${x} ${H-22}v${-H+58}m-13 13 13-13 13 13" class="fx-path"/>`;
      }).join("")+frame; break;
      case "forced": art = `<path d="M${W*.2} ${H*.2}L${W*.8} ${H*.8}M${W*.32} ${H*.2}L${W*.92} ${H*.8}" stroke-width="18" class="fx-sweep"/><rect x="${W/2-65}" y="${H/2-65}" width="130" height="130" class="fx-flash"/>`; break;
      case "threshold": art = `<path d="M${W/2-115} ${H/2-65}v-50h50m130 0h50v50m0 130v50h-50m-130 0h-50v-50" class="fx-ring"/><text x="${W/2}" y="${H/2+34}" text-anchor="middle" font-size="96" font-family="monospace" fill="currentColor" stroke="none" class="fx-flash">${ctx.target}</text>`; break;
      case "colorblind": art = `<rect x="0" y="0" width="${W}" height="${H}" fill="#bcc9c9" fill-opacity=".19" stroke="none" class="fx-shutter"/>`+Array.from({length:7},(_,i) => `<path d="M0 ${i*H/6}H${W}" stroke-width="5" class="fx-path"/>`).join(""); break;
      case "colorblindplus": art = `<rect x="0" y="0" width="${W/2}" height="${H}" fill="#bfcfd1" fill-opacity=".2" stroke="none" class="fx-shutter"/><rect x="${W/2}" y="0" width="${W/2}" height="${H}" fill="#bfcfd1" fill-opacity=".2" stroke="none" class="fx-beam"/>`+circles(W/2,H/2,130,"fx-orbit",'stroke-dasharray="5 15"'); break;
      case "recycle": art = `<path d="M${W/2-90} ${H/2}a90 90 0 1 1 90 90m-20-20 20 20-20 20" class="fx-orbit"/>`+circles(W/2,H/2,60,"fx-ring",'stroke-dasharray="10 7"'); break;
      case "demotion": art = [-1,0,1].map(i => `<rect x="${W/2-50+i*22}" y="${H/2-75+i*12}" width="100" height="140" class="fx-fragment"/>`).join("")+`<path d="M${W/2-95} ${H/2+95}l190-190" stroke-width="9" class="fx-sweep"/>`; break;
      case "mimic": art = [-1,0,1].map(i => `<path d="m${W/2+i*30} ${H/2-90} 90 90-90 90-90-90 90-90Z" opacity="${i === 0 ? 1 : .4}" class="fx-sweep"/>`).join(""); break;
      case "shield": art = hex(at.x,at.y,44,"fx-ring")+hex(at.x,at.y,58,"fx-flash")+circles(at.x,at.y,33,"fx-orbit",'stroke-dasharray="8 10"'); break;
      case "overload": art = `<path d="M${W/2+20} ${H/2-120}l-80 135h65l-25 105 85-145h-65l20-95Z" fill="currentColor" fill-opacity=".3" stroke-width="4" class="fx-flash"/>`+Array.from({length:4},(_,i) => `<path d="M${W/2} ${H/2}l${i%2 ? -130 : 130} ${i < 2 ? -100 : 100}" class="fx-path"/>`).join(""); break;
      case "lock": art = area(ctx.cells,"fx-shutter")+`<path d="M${at.x-22} ${at.y-9}h44v34h-44v-34Zm9 0v-15a13 13 0 0 1 26 0v15" stroke-width="4" class="fx-flash"/>`; break;
      case "reposition": {
        const a = point(ctx.cells[0]), b = point(ctx.cells[1]);
        art = `<path d="M${a.x} ${a.y}Q${(a.x+b.x)/2+60} ${(a.y+b.y)/2-60} ${b.x} ${b.y}M${b.x} ${b.y}Q${(a.x+b.x)/2-60} ${(a.y+b.y)/2+60} ${a.x} ${a.y}" class="fx-path"/>`+circles(a.x,a.y,42)+circles(b.x,b.y,42); break;
      }
      case "decoy": art = circles(at.x,at.y,43,"fx-ring",'stroke-dasharray="4 10"')+circles(at.x,at.y,70,"fx-orbit")+`<path d="m${at.x} ${at.y-35} 35 35-35 35-35-35 35-35Z" class="fx-flash"/>`; break;
      default: art = frame;
    }
  }
  const scene = document.createElement("div");
  scene.className = `fx-scene fx-${event.id} ${event.type === "expiry" ? "is-expiring" : ""}`;
  scene.dataset.effect = `${event.id}:${event.type}`;
  scene.style.setProperty("--fx-color",color);
  scene.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square">${art}</svg>`;
  $("fxLayer").appendChild(scene);
  later(() => scene.remove(),1050);
}
function enqueueAnnouncements(events) {
  const unique = [], seen = new Set();
  for (const event of [...events].sort((a,b) => (a.type === "cast" ? 0 : 1)-(b.type === "cast" ? 0 : 1))) {
    const key = `${event.id}:${event.type}`;
    if (!seen.has(key)) { unique.push(event); seen.add(key); }
  }
  if (!motionAllowed()) {
    unique.forEach(event => toast(event.type === "cast" ? `${CARD_BY_ID[event.id].name} diaktifkan.` : event.context.message));
    return;
  }
  ui.announcementQueue.push(...unique);
  runNextAnnouncement();
}
function runNextAnnouncement() {
  if (ui.announcing || !ui.announcementQueue.length) return;
  if (!motionAllowed()) {
    for (const event of ui.announcementQueue.splice(0)) toast(event.type === "cast" ? `${CARD_BY_ID[event.id].name} diaktifkan.` : event.context.message);
    return;
  }
  ui.announcing = true;
  const event = ui.announcementQueue.shift(), el = document.createElement("div");
  el.className = `skill-announcement ${event.type === "expiry" ? "expired" : ""}`;
  const label = event.type === "cast" ? "SKILL ACTIVATED" : event.type === "resist" ? "REMOVAL BLOCKED" : "PROTOCOL EXPIRED";
  el.innerHTML = `${icon(event.id)}<span><small>${label}</small><strong>${CARD_BY_ID[event.id]?.name || "TACTICAL SYSTEM"}</strong></span>`;
  $("arena").appendChild(el);
  later(() => { el.remove(); ui.announcing = false; runNextAnnouncement(); },1900);
}
