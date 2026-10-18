"use strict";
const CRAG_PRE = 180, CRAG_SWING = 380, CRAG_HIT = CRAG_PRE+CRAG_SWING; // pra-aktivasi, ayunan, saat dampak (ms)
const SKILL_VFX_META = {
  purge:          { color:"#ff5e5b", sub:"ASSASSINATION ARTS",   code:"AK-S1 // RED" },
  magnetic:       { color:"#5ce1e6", sub:"GRAPPLE ARTS",         code:"AK-S2 // CLIFFHEART" },
  heavy:          { color:"#ffb84d", sub:"CRUSHER IMPACT",       code:"AK-S2 // SIEGE" },
  bomb:           { color:"#f0935b", sub:"SARKAZ EARTH ARTS",    code:"AK-S2 // MUDROCK" },
  gravity:        { color:"#c77dff", sub:"ANTI-GRAVITY FIELD",   code:"AK-S3 // ANGELINA" },
  flip:           { color:"#4ea8de", sub:"ABYSSAL CURRENT",      code:"AK-S3 // SKADI" },
  bottom:         { color:"#ff6b35", sub:"ORIGINIUM FLAME",      code:"AK-S3 // IFRIT" },
  void:           { color:"#e0fbfc", sub:"KARLAN SWORD ARTS",    code:"AK-S3 // SILVERASH" },
  superbomb:      { color:"#ff4d00", sub:"CATASTROPHE ARTS",     code:"AK-S3 // EYJAFJALLA" },
  ouroboros:      { color:"#72efdd", sub:"CHRONOLOGY LOCK",      code:"AK-S3 // MOSTIMA" },
  expansion:      { color:"#64dfdf", sub:"INK REALM CREATION",   code:"AK-S3 // DUSK" },
  forced:         { color:"#d9ed7b", sub:"PRTS DIRECTIVE",       code:"AK-S3 // KAL'TSIT" },
  threshold:      { color:"#ff477e", sub:"LORD OF FIENDS",       code:"AK-S3 // AMIYA" },
  colorblind:     { color:"#98c1d9", sub:"SHADOW CONCEALMENT",   code:"AK-S2 // INES" },
  colorblindplus: { color:"#b5838d", sub:"MASTERY III ECLIPSE",  code:"AK-M3 // SHADOW" },
  recycle:        { color:"#ffe66d", sub:"VANGUARD DP RECOVERY", code:"AK-S1 // MYRTLE" },
  demotion:       { color:"#ff758f", sub:"TREMOR SILENCE",       code:"AK-S3 // DEGENBRECHER" },
  mimic:          { color:"#e0aaff", sub:"CRIMSON MIRROR",       code:"AK-S2 // PHANTOM" },
  shield:         { color:"#f4d35e", sub:"FERTILE SOIL WARD",    code:"AK-TL // MUDROCK" },
  overload:       { color:"#ff9f1c", sub:"SANKTA BARRAGE",       code:"AK-S3 // EXUSIAI" },
  lock:           { color:"#f9c74f", sub:"RESONATOR TRAP",       code:"AK-S2 // DOROTHY" },
  reposition:     { color:"#80ffdb", sub:"SUBSTITUTE SWAP",      code:"AK-S2 // SPECTER" },
  decoy:          { color:"#a9def9", sub:"PHANTOM CAGE",         code:"AK-TL // NIGHTINGALE" }
};

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
          el.animate([
            {transform:`translate(${dx}px,${dy}px) rotateX(0deg)`},
            {transform:`translate(${dx/2}px,${dy/2}px) rotateX(90deg) scale(1.14)`,offset:.5},
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
      el.animate([{transform:`translate(${dx}px,${dy}px) scale(.8)`,opacity:.1},{transform:"translate(0,3px) scale(1.06)",opacity:1,offset:.8},{transform:"none",opacity:1}],{duration:520,easing});
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
    if (removal?.id === "purge") {
      end = "scale(1.35, .04) rotate(-45deg)";
    }
    if (removal?.id === "magnetic" && removal.context.origin) {
      const origin = removal.context.origin;
      dx = (origin.c+.5)*rect.width/g.width-(old.rect.left-rect.left+old.rect.width/2);
      dy = (origin.r+.5)*rect.height/g.height-(old.rect.top-rect.top+old.rect.height/2);
      end = "scale(.08) rotate(120deg)";
    }
    if (removal?.id === "void") { dy = -rect.height*.65; end = "scale(.12, 2.4)"; }
    if (removal?.id === "bottom") { dy = -38; end = "scale(1.3, .08)"; }
    if (removal?.id === "heavy") { dx = (old.c - (removal.context.center?.c ?? 3))*28; dy = 18; end = "scale(1.4, .08)"; }
    if (["bomb","superbomb"].includes(removal?.id)) {
      const center = removal.context.center;
      dx = (old.c-center.c)*34; dy = (old.r-center.r)*34; end = "scale(.08) rotate(110deg)";
    }
    const hit = removal?.id === "bomb" ? CRAG_HIT : 0; // koin bertahan sampai palu menghantam
    ghost.animate([
      {opacity:1,transform:"none",filter:"brightness(1)"},
      {opacity:.95,transform:"scale(1.16)",filter:"brightness(2.2)",offset:.18},
      {opacity:0,transform:`translate(${dx}px,${dy}px) ${end}`,filter:"brightness(1.5)"}
    ],{duration:680,delay:hit,easing,fill:"both"});
    later(() => ghost.remove(),720+hit);
  }
  for (const event of events) {
    playEffect(event);
    if (event.type === "cast" && event.id === "superbomb") animateTransientBomb(event);
    if (event.type === "cast" && ["heavy","bomb","superbomb","void","bottom"].includes(event.id)) {
      const mag = event.id === "superbomb" ? 6 : event.id === "void" ? 4 : event.id === "bomb" ? 4 : 3;
      board.animate([
        {transform:"none"},
        {transform:`translate(${mag}px, ${mag}px)`},
        {transform:`translate(${-mag}px, ${-mag*.7}px)`},
        {transform:`translate(${mag*.5}px, ${-mag*.4}px)`},
        {transform:"none"}
      ],{duration:420,delay:event.id === "bomb" && event.type === "cast" ? CRAG_HIT : 0,easing:"ease-out"});
    }
  }
  return events.length ? (events.some(e => e.id === "bomb" && e.type === "cast") ? CRAG_HIT+920 : 960) : moved ? 650 : 0;
}

function animateTransientBomb(event) {
  const position = event.context.center;
  if (!position) return;
  const cell = $("board").querySelector(`[data-r="${position.r}"][data-c="${position.c}"]`);
  if (!cell) return;
  const rect = cell.getBoundingClientRect(), board = $("board").getBoundingClientRect(), ghost = document.createElement("div");
  ghost.className = "token-ghost";
  Object.assign(ghost.style,{left:`${rect.left-board.left}px`,top:`${rect.top-board.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  ghost.innerHTML = `<span class="coin p${event.player}">${icon(event.id)}</span>`;
  $("fxLayer").appendChild(ghost);
  ghost.animate([
    {transform:`translateY(-${Math.min(board.height,rect.top-board.top+rect.height)}px) scale(.85)`,opacity:.25},
    {transform:"scale(1.08)",opacity:1,filter:"brightness(1.8)",offset:.48},
    {transform:"scale(1.65)",opacity:0,filter:"brightness(2.5)"}
  ],{duration:680,easing:"ease-out",fill:"forwards"});
  later(() => ghost.remove(),740);
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

  // Arknights PRTS SVG primitives
  const circles = (x,y,r,css = "fx-ring",extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" class="${css}" ${extra}/>`;
  const diamond = (x,y,r,css = "fx-ring",extra = "") => `<polygon points="${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}" class="${css}" ${extra}/>`;
  const hex = (x,y,r,css = "fx-ring",extra = "") => `<polygon points="${Array.from({length:6},(_,i) => `${(x+Math.cos(i*Math.PI/3-Math.PI/6)*r).toFixed(1)},${(y+Math.sin(i*Math.PI/3-Math.PI/6)*r).toFixed(1)}`).join(" ")}" class="${css}" ${extra}/>`;
  const oct = (x,y,r,css = "fx-ring",extra = "") => `<polygon points="${Array.from({length:8},(_,i) => `${(x+Math.cos(i*Math.PI/4)*r).toFixed(1)},${(y+Math.sin(i*Math.PI/4)*r).toFixed(1)}`).join(" ")}" class="${css}" ${extra}/>`;
  const reticle = (x,y,r) => `
    ${diamond(x,y,r,"fx-ring",'stroke-width="2.5"')}
    ${circles(x,y,r*.68,"fx-orbit",'stroke-dasharray="14 8"')}
    <path d="M${x-r*1.35} ${y}h${r*.55}M${x+r*.8} ${y}h${r*.55}M${x} ${y-r*1.35}v${r*.55}M${x} ${y+r*.8}v${r*.55}" stroke-width="2.5" class="fx-flash"/>
    <path d="M${x-r*.85} ${y-r*.45}v-${r*.4}h${r*.4}M${x+r*.45} ${y-r*.85}h${r*.4}v${r*.4}M${x+r*.85} ${y+r*.45}v${r*.4}h-${r*.4}M${x-r*.45} ${y+r*.85}h-${r*.4}v-${r*.4}" stroke-width="2" class="fx-flash"/>
  `;
  const area = (cells = ctx.cells || [],css = "fx-flash",fillOp = ".24") => cells.map(cell => {
    const x = cell.c*100, y = cell.r*100;
    return `<g class="${css}">
      <rect x="${x+6}" y="${y+6}" width="88" height="88" fill="currentColor" fill-opacity="${fillOp}" stroke="currentColor" stroke-width="2.2"/>
      <path d="M${x+14} ${y+26}V${y+14}h12M${x+74} ${y+14}h12v12M${x+86} ${y+74}v12h-12M${x+26} ${y+86}H${x+14}v-12" stroke-width="2"/>
    </g>`;
  }).join("");
  const prtsFrame = (label = "PRTS // SYNCHRONIZED") => `
    <path d="M6 62V6h56M${W-62} 6h56v56M${W-6} ${H-62}v56h-56M62 ${H-6}H6v-56" stroke-width="3.5" class="fx-flash"/>
    <path d="M22 18h36M${W-58} 18h36M22 ${H-18}h36M${W-58} ${H-18}h36" stroke-width="1.5" opacity=".7" class="fx-flash"/>
    <text x="26" y="34" font-family="monospace" font-size="15" letter-spacing="3" fill="currentColor" stroke="none" opacity=".8" class="fx-flash">${label}</text>
  `;
  const slashArc = (cx,cy,rx,ry,rot = 0,css = "fx-slash") =>
    `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path d="M${-rx} 0 Q0 ${-ry*1.35} ${rx} 0 Q0 ${-ry*.55} ${-rx} 0 Z" fill="currentColor" fill-opacity=".88" stroke="currentColor" stroke-width="2" class="${css}"/></g>`;

  let art = "";
  const meta = SKILL_VFX_META[event.id] || { color: CATEGORY_COLOR[CARD_BY_ID[event.id]?.category] || "#d9ed7b", sub: "TACTICAL SKILL", code: "PRTS // ACT" };
  let color = meta.color;

  if (event.type === "expiry") {
    color = "#9db4c0";
    switch (event.id) {
      case "gravity":
        art = Array.from({length:g.width},(_,c) => `<path d="M${c*100+50} 25v${H-75}m-16-16 16 16 16-16" class="fx-path"/>`).join("") + prtsFrame("ANTI-GRAVITY // TERMINATED");
        break;
      case "flip":
        art = `<path d="M12 30h${W-24}M12 ${H-30}h${W-24}M${W/2} 30v${H-60}" class="fx-expiry" stroke-dasharray="8 6"/>` + diamond(W/2,H/2,78,"fx-ring");
        break;
      case "threshold":
        art = diamond(W/2,H/2,120,"fx-expiry",'stroke-dasharray="10 8"') + `<text x="${W/2}" y="${H/2+28}" text-anchor="middle" font-family="monospace" font-size="84" fill="currentColor" stroke="none" class="fx-flash">4</text>`;
        break;
      case "colorblind": case "colorblindplus":
        art = Array.from({length:g.height},(_,r) => `<path d="M10 ${r*100+50}H${W-10}" stroke="${r%2 ? "#e99b77" : "#82cbd9"}" stroke-width="26" opacity=".48" class="fx-sweep"/>`).join("") + prtsFrame("SHADOW VEIL // LIFTED");
        break;
      case "ouroboros":
        art = `<path d="M${W-45} 45Q${W/2} ${H+60} 45 45m0 0 8 32m-8-32 32 8M45 ${H-45}Q${W/2} -60 ${W-45} ${H-45}" class="fx-path"/>` + prtsFrame("CHRONOLOGY // RESTORED");
        break;
      case "lock":
        art = area(ctx.cells,"fx-expiry",".14") + `<path d="M${at.x-32} ${at.y-18}h64m-64 36h64" class="fx-expiry" stroke-dasharray="6 8"/>`;
        break;
      case "shield":
        art = (ctx.cells || []).map(cell => { const p = point(cell); return hex(p.x,p.y,48,"fx-expiry") + diamond(p.x,p.y,34,"fx-ring",'stroke-dasharray="5 7"'); }).join("");
        break;
      case "overload":
        art = `<path d="M${W/2+15} ${H/2-85}l-55 95h50l-25 75" class="fx-expiry" stroke-dasharray="6 9"/>` + oct(W/2,H/2,92,"fx-ring");
        break;
      case "forced":
        art = `<path d="M${W/2-80} ${H/2-65}l160 130m-160 0 160-130" class="fx-expiry" stroke-dasharray="10 8"/>`;
        break;
      case "recycle":
        art = diamond(W/2,H/2,76,"fx-expiry",'stroke-dasharray="10 7"') + `<path d="m${W/2-22} ${H/2} 16 16 32-36" class="fx-flash"/>`;
        break;
      default:
        art = prtsFrame("PROTOCOL // EXPIRED");
    }
  } else if (event.type === "resist") {
    // Mudrock Fertile Ward block effect: double golden-cyan hexagonal barrier + shockwave + rune cross
    color = "#f4d35e";
    art = `
      ${hex(at.x,at.y,46,"fx-flash",'fill="currentColor" fill-opacity=".28" stroke-width="3.5"')}
      ${hex(at.x,at.y,64,"fx-ring",'stroke-width="2.5" stroke-dasharray="12 6"')}
      ${diamond(at.x,at.y,54,"fx-orbit",'stroke="#82cbd9" stroke-width="2"')}
      <path d="M${at.x-22} ${at.y}h44M${at.x} ${at.y-22}v44" stroke="#fff" stroke-width="3" class="fx-flash"/>
      <text x="${at.x}" y="${at.y-56}" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="2" fill="#fff" stroke="none" class="fx-flash">WARD // BLOCKED</text>
    `;
  } else {
    switch (event.id) {
      case "purge":
        // Execution Mode (Projekt Red S1): Assassin cross-slash + crimson diamond reticle + shatter shards
        art = `
          ${reticle(at.x,at.y,48)}
          ${slashArc(at.x,at.y,95,22,-42,"fx-slash")}
          ${slashArc(at.x,at.y,95,22,42,"fx-slash")}
          ${diamond(at.x,at.y,82,"fx-fragment",'stroke-dasharray="10 8"')}
          <circle cx="${at.x}" cy="${at.y}" r="14" fill="#fff" stroke="none" class="fx-flash"/>
          ${prtsFrame("EXECUTION MODE // TARGET ELIMINATED")}
        `;
        break;

      case "magnetic": {
        // Binding Chains (Cliffheart S2): Grappling chain links + anchor claw + tension vortex
        const from = ctx.origin ? point(ctx.origin) : {x:W/2,y:H/2};
        const dx = from.x - at.x, dy = from.y - at.y;
        const steps = 7;
        const chainLinks = Array.from({length:steps},(_,i) => {
          const t = (i+1)/(steps+1);
          const lx = at.x + dx*t, ly = at.y + dy*t;
          return diamond(lx,ly,9,"fx-flash",'fill="currentColor" fill-opacity=".45"');
        }).join("");
        art = `
          <path d="M${from.x} ${from.y}L${at.x} ${at.y}" stroke-width="5" stroke-dasharray="14 8" class="fx-path"/>
          ${chainLinks}
          ${oct(from.x,from.y,46,"fx-orbit",'stroke-dasharray="18 10"')}
          ${reticle(at.x,at.y,44)}
          <path d="M${at.x-28} ${at.y-28}L${at.x} ${at.y}L${at.x+28} ${at.y-28}M${at.x-28} ${at.y+28}L${at.x} ${at.y}L${at.x+28} ${at.y+28}" stroke-width="4" class="fx-fragment"/>
          ${prtsFrame("BINDING CHAINS // GRAPPLE LOCK")}
        `;
        break;
      }

      case "heavy": {
        // Aerial Hammer (Siege S2): Lion King vertical hammer drop + horizontal seismic shockwave & ground spikes
        const rowY = at.y;
        const spikes = Array.from({length:g.width},(_,c) => {
          const sx = c*100+50;
          return `<polygon points="${sx-22},${rowY+42} ${sx},${rowY-36} ${sx+22},${rowY+42}" fill="currentColor" fill-opacity=".28" stroke="currentColor" stroke-width="2" class="fx-shutter"/>`;
        }).join("");
        art = `
          ${area(ctx.cells,"fx-flash",".28")}
          <rect x="6" y="${rowY-24}" width="${W-12}" height="48" fill="currentColor" fill-opacity=".22" stroke="none" class="fx-sweep"/>
          <path d="M4 ${rowY}H${W-4}" stroke="#fff" stroke-width="7" class="fx-sweep"/>
          <path d="M4 ${rowY-18}H${W-4}M4 ${rowY+18}H${W-4}" stroke-width="2.5" stroke-dasharray="20 10" class="fx-path"/>
          ${spikes}
          <path d="M${at.x} 10V${rowY}" stroke="#fff" stroke-width="10" class="fx-beam"/>
          ${hex(at.x,rowY,68,"fx-ring",'stroke-width="4"')}
          ${diamond(at.x,rowY,105,"fx-fragment")}
          ${prtsFrame("AERIAL HAMMER // SEISMIC SLAM")}
        `;
        break;
      }

      case "bomb": {
        // Crag Splitter (Mudrock S2): Giant spinning Sarkaz hammer sweep + 3x3 jagged obsidian crags
        art = ""; // efek Crag Splitter digambar oleh cragSplitterFx()
        break;
      }

      case "bottom": {
        // Scorched Earth (Ifrit S3): Blazing Originium flame corridor across bottom row + flame pillars + hazard stripes
        const by = H-50;
        const flames = Array.from({length:g.width},(_,c) => {
          const fx = c*100+50;
          return `
            <polygon points="${fx-34},${H-6} ${fx-16},${by-42} ${fx},${by+4} ${fx+14},${by-56} ${fx+34},${H-6}" fill="currentColor" fill-opacity=".42" stroke="#ffd166" stroke-width="2" class="fx-shutter"/>
            ${diamond(fx,by,24,"fx-ring",'stroke="#ffd166"')}
          `;
        }).join("");
        art = `
          ${area(ctx.cells,"fx-flash",".34")}
          <rect x="4" y="${H-96}" width="${W-8}" height="90" fill="currentColor" fill-opacity=".26" stroke="none" class="fx-sweep"/>
          <path d="M4 ${by}H${W-4}" stroke="#ffd166" stroke-width="12" class="fx-sweep"/>
          <path d="M4 ${H-94}H${W-4}M4 ${H-8}H${W-4}" stroke-width="3" stroke-dasharray="24 12" class="fx-path"/>
          ${flames}
          ${prtsFrame("SCORCHED EARTH // PYROCLASM LINE")}
        `;
        break;
      }

      case "void": {
        // Truesilver Thrust (SilverAsh S3): Iconic Karlan crescent sword waves + blinding vertical column cleave
        const cx = ctx.lane*100+50;
        const crescents = Array.from({length:g.height},(_,r) => {
          const cy = r*100+50;
          return slashArc(cx,cy,76,26,-18,"fx-slash");
        }).join("");
        art = `
          <rect x="${ctx.lane*100+4}" y="0" width="92" height="${H}" fill="currentColor" fill-opacity=".34" class="fx-beam"/>
          <rect x="${cx-14}" y="0" width="28" height="${H}" fill="#fff" fill-opacity=".75" stroke="none" class="fx-beam"/>
          <path d="M${cx} ${H}V0" stroke="#fff" stroke-width="8" class="fx-path"/>
          ${crescents}
          ${area(ctx.cells,"fx-fragment",".2")}
          ${diamond(cx,H/2,92,"fx-ring",'stroke="#fff" stroke-width="3"')}
          ${prtsFrame("TRUESILVER THRUST // COLUMN CLEAVE")}
        `;
        break;
      }

      case "superbomb": {
        // Volcano (Eyjafjalla S3): Catastrophic 5x5 volcanic eruption + lava fissures + Originium spires + dual blast rings
        const rays = Array.from({length:8},(_,i) => {
          const ang = i*Math.PI/4;
          const x2 = (at.x + Math.cos(ang)*245).toFixed(1), y2 = (at.y + Math.sin(ang)*245).toFixed(1);
          return `<path d="M${at.x} ${at.y}L${x2} ${y2}" stroke="#ffd166" stroke-width="5" stroke-dasharray="26 12" class="fx-path"/>`;
        }).join("");
        const spires = (ctx.cells || []).filter((_,i) => i%2 === 0).map(cell => {
          const p = point(cell);
          return `<polygon points="${p.x-22},${p.y+34} ${p.x},${p.y-38} ${p.x+22},${p.y+34}" fill="#ff9e00" fill-opacity=".38" stroke="#ffd166" stroke-width="2" class="fx-shutter"/>`;
        }).join("");
        art = `
          ${area(ctx.cells,"fx-flash",".35")}
          ${spires}
          ${rays}
          <circle cx="${at.x}" cy="${at.y}" r="54" fill="#fff" fill-opacity=".65" stroke="none" class="fx-flash"/>
          ${circles(at.x,at.y,110,"fx-ring",'stroke="#ffd166" stroke-width="6"')}
          ${oct(at.x,at.y,185,"fx-orbit",'stroke-width="4" stroke-dasharray="22 10"')}
          ${hex(at.x,at.y,235,"fx-fragment",'stroke-width="4.5"')}
          ${prtsFrame("VOLCANO // CATASTROPHE ERUPTION")}
        `;
        break;
      }

      case "gravity": {
        // Anti-Gravity Mode (Angelina S3): Zero-G purple/cyan field + vector chevrons + weightless Originium rings
        const left = ctx.direction === "left";
        const streams = Array.from({length:g.height},(_,r) => {
          const y = r*100+50;
          const x1 = left ? W-24 : 24, x2 = left ? 28 : W-28, dir = left ? 26 : -26;
          return `
            <path d="M${x1} ${y}H${x2}" stroke-width="3" stroke-dasharray="28 12" class="fx-path"/>
            <path d="M${x2+dir} ${y-18}L${x2} ${y}L${x2+dir} ${y+18}M${W/2+dir} ${y-14}L${W/2} ${y}L${W/2+dir} ${y+14}" stroke-width="3.5" class="fx-flash"/>
          `;
        }).join("");
        art = `
          <rect x="6" y="6" width="${W-12}" height="${H-12}" fill="currentColor" fill-opacity=".12" stroke="none" class="fx-flash"/>
          ${streams}
          ${circles(W/2,H/2,125,"fx-orbit",'stroke-dasharray="18 14" stroke-width="3"')}
          ${diamond(W/2,H/2,76,"fx-ring",'stroke-width="3"')}
          ${prtsFrame(`ANTI-GRAVITY MODE // VECTOR ${left ? "LEFT" : "RIGHT"}`)}
        `;
        break;
      }

      case "ouroboros": {
        // Key of Chronology (Mostima S3): Sankta astronomical clock dial in center + dimensional portals on Col 1 & Col N
        const ticks = Array.from({length:12},(_,i) => {
          const ang = i*Math.PI/6;
          const x1 = (W/2+Math.cos(ang)*105).toFixed(1), y1 = (H/2+Math.sin(ang)*105).toFixed(1);
          const x2 = (W/2+Math.cos(ang)*128).toFixed(1), y2 = (H/2+Math.sin(ang)*128).toFixed(1);
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${i%3===0?4:2}" class="fx-flash"/>`;
        }).join("");
        art = `
          <rect x="8" y="8" width="84" height="${H-16}" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="3" class="fx-beam"/>
          <rect x="${W-92}" y="8" width="84" height="${H-16}" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="3" class="fx-beam"/>
          <path d="M50 55Q${W/2} ${H+30} ${W-50} 55M${W-50} ${H-55}Q${W/2} -30 50 ${H-55}" stroke-width="4" stroke-dasharray="22 10" class="fx-path"/>
          ${circles(W/2,H/2,132,"fx-ring",'stroke-width="3.5"')}
          ${circles(W/2,H/2,92,"fx-orbit",'stroke-dasharray="14 10"')}
          ${ticks}
          <path d="M${W/2} ${H/2}V${H/2-82}M${W/2} ${H/2}L${W/2+62} ${H/2+28}" stroke="#fff" stroke-width="5" class="fx-flash"/>
          ${diamond(W/2,H/2,16,"fx-flash",'fill="#fff"')}
          ${prtsFrame("KEY OF CHRONOLOGY // SPATIAL LOOP")}
        `;
        break;
      }

      case "expansion": {
        // Painted Realm (Dusk S3): Ink-wash scroll borders + newly materialized column/row grid & seal
        const isCol = ctx.direction === "col";
        const rx = isCol ? W-96 : 6, ry = 6, rw = isCol ? 90 : W-12, rh = isCol ? H-12 : 90;
        art = `
          <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="currentColor" fill-opacity=".26" stroke="currentColor" stroke-width="3.5" stroke-dasharray="10 6" class="fx-shutter"/>
          ${diamond(isCol ? W-50 : W/2, isCol ? H/2 : 50, 44, "fx-ring", 'stroke-width="3"')}
          ${oct(isCol ? W-50 : W/2, isCol ? H/2 : 50, 66, "fx-orbit", 'stroke-dasharray="12 8"')}
          <path d="M6 6h${W-12}v${H-12}H6V6Z" stroke-width="3" class="fx-ring"/>
          ${prtsFrame(`PAINTED REALM // +1 ${isCol ? "COLUMN" : "ROW"}`)}
        `;
        break;
      }

      case "flip": {
        // Tide Reversal (Skadi Alter S3): Abyssal counter-current waves in every column + central tidal vortex
        const cols = Array.from({length:g.width},(_,c) => {
          const x = c*100+50;
          return `
            <path d="M${x-14} 28v${H-68}m-12-14 12 14 12-14" stroke-width="3" class="fx-path"/>
            <path d="M${x+14} ${H-28}V40m-12 14 12-14 12 14" stroke="#ff758f" stroke-width="3" class="fx-path"/>
          `;
        }).join("");
        art = `
          ${cols}
          ${circles(W/2,H/2,118,"fx-orbit",'stroke-dasharray="26 14" stroke-width="3.5"')}
          ${diamond(W/2,H/2,72,"fx-ring",'stroke="#ff758f" stroke-width="3"')}
          ${prtsFrame("TIDE REVERSAL // ABYSSAL INVERSION")}
        `;
        break;
      }

      case "forced": {
        // Command: Override (Kal'tsit / PRTS): Mon3tr angular spine brackets + tactical lockdown warning
        const modeLabel = ctx.kind === "drop" ? "FORCE DEPLOY" : "FORCE SKILL";
        art = `
          <path d="M${W*.16} ${H*.2}L${W*.84} ${H*.8}M${W*.84} ${H*.2}L${W*.16} ${H*.8}" stroke-width="10" opacity=".45" class="fx-sweep"/>
          ${oct(W/2,H/2,135,"fx-orbit",'stroke-dasharray="22 10" stroke-width="3.5"')}
          ${diamond(W/2,H/2,95,"fx-flash",'fill="currentColor" fill-opacity=".18" stroke-width="4"')}
          <rect x="${W/2-145}" y="${H/2-30}" width="290" height="60" fill="#111618" fill-opacity=".88" stroke="currentColor" stroke-width="2.5" class="fx-flash"/>
          <text x="${W/2}" y="${H/2+8}" text-anchor="middle" font-family="monospace" font-size="24" font-weight="bold" letter-spacing="4" fill="currentColor" stroke="none" class="fx-flash">${modeLabel}</text>
          ${prtsFrame("COMMAND: OVERRIDE // PRTS LOCK")}
        `;
        break;
      }

      case "threshold": {
        // Chimera (Amiya S3): Lord of Fiends Black Crown & Originium rhombic cage + Connect 3 / 5 emblem
        art = `
          ${diamond(W/2,H/2,165,"fx-ring",'stroke-width="4"')}
          ${diamond(W/2,H/2,125,"fx-orbit",'stroke="#72efdd" stroke-dasharray="18 10" stroke-width="3"')}
          <polygon points="${W/2-95},${H/2-75} ${W/2-48},${H/2-135} ${W/2},${H/2-92} ${W/2+48},${H/2-135} ${W/2+95},${H/2-75}" fill="currentColor" fill-opacity=".32" stroke="currentColor" stroke-width="3" class="fx-shutter"/>
          <text x="${W/2}" y="${H/2+38}" text-anchor="middle" font-size="108" font-family="monospace" font-weight="bold" fill="#fff" stroke="currentColor" stroke-width="3" class="fx-flash">${ctx.target}</text>
          ${prtsFrame(`CHIMERA // OBJECTIVE CONNECT ${ctx.target}`)}
        `;
        break;
      }

      case "colorblind": {
        // Shadow Veil (Ines S2): Kazdel shadow threads + stealth camouflage scanlines + slit eye
        const lines = Array.from({length:8},(_,i) => `<path d="M0 ${(i+.5)*H/8}H${W}" stroke-width="4" stroke-dasharray="36 16" class="fx-path"/>`).join("");
        art = `
          <rect x="0" y="0" width="${W}" height="${H}" fill="#1a242b" fill-opacity=".42" stroke="none" class="fx-shutter"/>
          ${lines}
          <path d="M${W/2-130} ${H/2}Q${W/2} ${H/2-75} ${W/2+130} ${H/2}Q${W/2} ${H/2+75} ${W/2-130} ${H/2}Z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="3.5" class="fx-ring"/>
          ${diamond(W/2,H/2,28,"fx-flash",'fill="currentColor"')}
          ${prtsFrame("SHADOW VEIL // IFF CONCEALED")}
        `;
        break;
      }

      case "colorblindplus": {
        // Shadow Veil M3: Mastery 3 total eclipse + triple M3 diamonds + dual shadow shutters
        art = `
          <rect x="0" y="0" width="${W/2}" height="${H}" fill="#1d1828" fill-opacity=".46" stroke="none" class="fx-shutter"/>
          <rect x="${W/2}" y="0" width="${W/2}" height="${H}" fill="#1d1828" fill-opacity=".46" stroke="none" class="fx-beam"/>
          ${circles(W/2,H/2,145,"fx-orbit",'stroke-dasharray="10 14" stroke-width="4"')}
          ${circles(W/2,H/2,95,"fx-ring",'fill="#0d1115" fill-opacity=".75" stroke-width="4"')}
          ${[-55,0,55].map(dx => diamond(W/2+dx,H/2,20,"fx-flash",'fill="currentColor"')).join("")}
          ${prtsFrame("SHADOW VEIL M3 // TOTAL ECLIPSE")}
        `;
        break;
      }

      case "recycle": {
        // Support Beta (Myrtle S1): Golden Vanguard DP recovery rings + rising deployment chevrons
        const chevrons = [-1,0,1].map(i => {
          const cy = H/2 + i*55;
          return `<path d="M${W/2-65} ${cy+22}L${W/2} ${cy-22}L${W/2+65} ${cy+22}" stroke-width="6" class="fx-flash"/>`;
        }).join("");
        art = `
          ${circles(W/2,H/2,125,"fx-orbit",'stroke-dasharray="22 12" stroke-width="3.5"')}
          ${hex(W/2,H/2,88,"fx-ring",'stroke-width="3"')}
          ${chevrons}
          ${prtsFrame("SUPPORT BETA // DP RECOVERED")}
        `;
        break;
      }

      case "demotion": {
        // Silent Return (Degenbrecher S3): Black Knight twin X-slash + shattered card silhouettes
        const cards = [-1,0,1].map(i =>
          `<rect x="${W/2-48+i*28}" y="${H/2-72+i*14}" width="96" height="136" fill="currentColor" fill-opacity=".16" stroke-width="3" class="fx-fragment"/>`
        ).join("");
        art = `
          ${cards}
          ${slashArc(W/2,H/2,195,30,-36,"fx-slash")}
          ${slashArc(W/2,H/2,195,30,36,"fx-slash")}
          ${oct(W/2,H/2,135,"fx-ring",'stroke-width="3.5"')}
          ${prtsFrame("SILENT RETURN // CARD SEALED")}
        `;
        break;
      }

      case "mimic": {
        // Phantom Mirror (Phantom S2): Overlapping crimson/violet mirror diamonds + reflection waves
        art = `
          ${[-55,0,55].map((dx,i) => diamond(W/2+dx,H/2,95,"fx-sweep",`opacity="${i===1?1:.55}" stroke-width="${i===1?4:2.5}"`)).join("")}
          ${circles(W/2,H/2,135,"fx-orbit",'stroke-dasharray="16 12"')}
          <path d="M${W/2} ${H/2-130}v260M${W/2-130} ${H/2}h260" stroke-width="2" stroke-dasharray="10 10" class="fx-flash"/>
          ${prtsFrame("PHANTOM MIRROR // ARTS DUPLICATED")}
        `;
        break;
      }

      case "shield": {
        // Fertile Ward (Mudrock Talent): Hexagonal earth-gold barrier + inner rune cross on coin
        art = `
          ${hex(at.x,at.y,44,"fx-flash",'fill="currentColor" fill-opacity=".28" stroke-width="3.5"')}
          ${hex(at.x,at.y,62,"fx-ring",'stroke-width="3"')}
          ${circles(at.x,at.y,76,"fx-orbit",'stroke-dasharray="14 10" stroke-width="2.5"')}
          <path d="M${at.x-20} ${at.y}h40M${at.x} ${at.y-20}v40" stroke="#fff" stroke-width="3" class="fx-flash"/>
          ${prtsFrame("FERTILE WARD // BARRIER ACTIVE")}
        `;
        break;
      }

      case "overload": {
        // Overloading Mode (Exusiai S3): Sankta golden halo + 8-way vector barrage + central lightning burst
        const barrage = Array.from({length:8},(_,i) => {
          const ang = i*Math.PI/4;
          const x1 = (W/2+Math.cos(ang)*45).toFixed(1), y1 = (H/2+Math.sin(ang)*45).toFixed(1);
          const x2 = (W/2+Math.cos(ang)*195).toFixed(1), y2 = (H/2+Math.sin(ang)*195).toFixed(1);
          return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="4" stroke-dasharray="24 10" class="fx-path"/>`;
        }).join("");
        art = `
          ${barrage}
          ${circles(W/2,H/2,135,"fx-orbit",'stroke-dasharray="28 12" stroke-width="4"')}
          ${oct(W/2,H/2,92,"fx-ring",'stroke="#fff" stroke-width="3"')}
          <path d="M${W/2+22} ${H/2-125}l-82 135h66l-26 110 88-148h-66l20-97Z" fill="currentColor" fill-opacity=".42" stroke="#fff" stroke-width="3.5" class="fx-flash"/>
          ${prtsFrame("OVERLOADING MODE // DUAL ACTION")}
        `;
        break;
      }

      case "lock": {
        // Binding Trap (Dorothy S2): Rhine Lab resonator nodes on every cell of locked lane + laser lattice
        const resonators = (ctx.cells || []).map(cell => {
          const p = point(cell);
          return `${oct(p.x,p.y,32,"fx-ring",'stroke-width="2.5"')}${diamond(p.x,p.y,14,"fx-flash",'fill="currentColor" fill-opacity=".6"')}`;
        }).join("");
        art = `
          ${area(ctx.cells,"fx-shutter",".22")}
          ${resonators}
          <path d="M${at.x-22} ${at.y-9}h44v34h-44v-34Zm9 0v-15a13 13 0 0 1 26 0v15" stroke="#fff" stroke-width="3.5" class="fx-flash"/>
          ${prtsFrame("BINDING TRAP // LANE SEALED")}
        `;
        break;
      }

      case "reposition": {
        // Parting Sorrow (Specter Alter S2): Abyssal twin-vortex swap currents between coin A and coin B
        const a = point(ctx.cells[0]), b = point(ctx.cells[1]);
        const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
        art = `
          <path d="M${a.x} ${a.y}Q${mx+70} ${my-70} ${b.x} ${b.y}M${b.x} ${b.y}Q${mx-70} ${my+70} ${a.x} ${a.y}" stroke-width="4" stroke-dasharray="20 10" class="fx-path"/>
          ${reticle(a.x,a.y,44)}
          ${reticle(b.x,b.y,44)}
          ${diamond(mx,my,28,"fx-ring",'fill="currentColor" fill-opacity=".35"')}
          ${prtsFrame("PARTING SORROW // TACTICAL SWAP")}
        `;
        break;
      }

      case "decoy": {
        // Fleeting Phantom (Nightingale Summon): Holographic birdcage diamond + ethereal feathers/orbit
        art = `
          ${oct(at.x,at.y,68,"fx-orbit",'stroke-dasharray="10 10" stroke-width="2.5"')}
          ${diamond(at.x,at.y,46,"fx-ring",'fill="currentColor" fill-opacity=".22" stroke-width="3"')}
          ${circles(at.x,at.y,26,"fx-flash",'stroke-dasharray="4 6"')}
          <path d="M${at.x-48} ${at.y}h96M${at.x} ${at.y-48}v96" stroke-width="2" class="fx-flash"/>
          ${prtsFrame("FLEETING PHANTOM // MIRAGE DEPLOYED")}
        `;
        break;
      }

      default:
        art = prtsFrame();
    }
  }

  const scene = document.createElement("div");
  scene.className = `fx-scene fx-${event.id} ${event.type === "expiry" ? "is-expiring" : ""}`;
  scene.dataset.effect = `${event.id}:${event.type}`;
  scene.style.setProperty("--fx-color",color);
  scene.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square">${art}</svg>`;
  $("fxLayer").appendChild(scene);
  later(() => scene.remove(),1100);
  arkAccent(event,at,color,W,H);
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
  const meta = SKILL_VFX_META[event.id] || { color:"#d9ed7b", sub:"TACTICAL SYSTEM", code:"PRTS // ACT" };
  const accent = event.type === "expiry" ? "#90a3a6" : event.type === "resist" ? "#f4d35e" : meta.color;
  el.className = `skill-announcement ${event.type === "expiry" ? "expired" : ""}`;
  el.style.setProperty("--skill-accent", accent);
  const label = event.type === "cast" ? `${meta.code} // SKILL ACTIVATED` : event.type === "resist" ? "FERTILE WARD // IMPACT NULLIFIED" : "PRTS // PROTOCOL EXPIRED";
  const sub = event.type === "cast" ? meta.sub : event.type === "resist" ? "BARRIER INTACT" : (event.context?.message || "EFFECT ENDED");
  el.innerHTML = `
    <div class="skill-badge">${icon(event.id)}</div>
    <div class="skill-copy">
      <small>${safe(label)}</small>
      <strong>${safe(CARD_BY_ID[event.id]?.name || "TACTICAL SYSTEM")}</strong>
      <em>${safe(sub)}</em>
    </div>
  `;
  $("arena").appendChild(el);
  later(() => { el.remove(); ui.announcing = false; runNextAnnouncement(); },1950);
}


/* Aksen ringan, lokal di titik kartu. Tidak menutupi papan: tanpa dim, bar, atau kolom lebar. */
const ARK_HEX = "46,0 23,39.8 -23,39.8 -46,0 -23,-39.8 23,-39.8";
function arkAccent(event,at,color,W,H) {
  if (event.type === "expiry") return;
  if (event.id === "bomb" && event.type === "cast") { cragSplitterFx(at,W,H,event.context?.cells || []); return; }
  const layer = $("fxLayer"), box = layer.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const px = at.x/W*box.width, py = at.y/H*box.height, cell = Math.min(box.width/g_w(),box.height/g_h());
  const stage = document.createElement("div");
  stage.className = "ark-stage";
  stage.style.setProperty("--fx-color",color);
  layer.appendChild(stage);
  const reach = cell*1.5, big = ["bomb","superbomb","heavy","void","bottom"].includes(event.id);
  const ring = document.createElement("div"), d = cell*(big ? 2.6 : 1.7);
  ring.className = "ark-ring";
  ring.style.cssText = `left:${px}px;top:${py}px;width:${d}px;height:${d}px`;
  ring.innerHTML = `<svg viewBox="-50 -50 100 100"><polygon points="${ARK_HEX}" fill="none" stroke="currentColor" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg>`;
  stage.appendChild(ring);
  ring.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.2)"},{opacity:.9,offset:.15},{opacity:0,transform:"translate(-50%,-50%) scale(1)"}],{duration:620,easing:"cubic-bezier(.16,1,.3,1)",fill:"both"});
  const n = big ? 18 : 10;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i"), a = Math.random()*Math.PI*2, r = reach*(.4+Math.random()*.6);
    p.className = "ark-p";
    p.style.cssText = `left:${px}px;top:${py}px`;
    const deg = a*180/Math.PI+90;
    stage.appendChild(p);
    p.animate([
      {opacity:1,transform:`translate(-50%,-50%) rotate(${deg}deg) scaleY(1.8)`},
      {opacity:0,transform:`translate(-50%,-50%) translate(${Math.cos(a)*r}px,${Math.sin(a)*r}px) rotate(${deg}deg) scaleY(.3)`}
    ],{duration:420+Math.random()*260,easing:"cubic-bezier(.2,.7,.25,1)",fill:"both"});
  }
  later(() => stage.remove(),1000);
}
function g_w() { return ui.game.width; }
function g_h() { return ui.game.height; }

/* ---------- CRAG SPLITTER (Mudrock S2) ----------
 * 1) pra-aktivasi: debu tipis melayang naik dari palu
 * 2) palu berputar 360 derajat berlawanan arah jarum jam, jejak asap abu tebal berdiameter 3 kotak
 * 3) dampak serentak di 8 kotak sekitar: retakan hitam, debu cokelat muda menyembur ke atas,
 *    5-8 serpihan batu jajaran genjang yang terlempar lalu memantul di lantai. Papan bergetar mikro. */
function cragSplitterFx(at,W,H,cells = []) {
  const layer = $("fxLayer"), box = layer.getBoundingClientRect(), g = ui.game;
  if (!box.width || !box.height) return;
  const tw = box.width/g.width, th = box.height/g.height, cell = Math.min(tw,th);
  const crow = Math.round(at.y/100-.5), ccol = Math.round(at.x/100-.5);
  const cx = c => (c+.5)*tw, cy = r => (r+.5)*th, px = cx(ccol), py = cy(crow);
  if (!cells.length) for (let r = crow-1; r <= crow+1; r++) for (let c = ccol-1; c <= ccol+1; c++) if (r >= 0 && c >= 0 && r < g.height && c < g.width) cells.push({r,c});
  const rand = (a,b) => a+Math.random()*(b-a), NS = "http://www.w3.org/2000/svg";
  const stage = document.createElement("div");
  stage.className = "crag-stage";
  layer.appendChild(stage);
  const make = (cls,x = px,y = py) => {
    const el = document.createElement("i");
    el.className = cls; el.style.left = `${x}px`; el.style.top = `${y}px`;
    stage.appendChild(el); return el;
  };

  // 1) pra-aktivasi: debu tipis naik
  for (let i = 0; i < 10; i++) {
    const mote = make("crag-mote",px+rand(-cell*.5,cell*.5),py+rand(-cell*.2,cell*.4));
    mote.animate([
      {opacity:0,transform:"translate(-50%,-50%) scale(.6)"},
      {opacity:.85,offset:.3},
      {opacity:0,transform:`translate(-50%,-50%) translateY(${-cell*rand(.4,.8)}px) scale(1)`}
    ],{duration:CRAG_PRE+120,delay:rand(0,60),easing:"ease-out",fill:"both"});
  }

  // 2) putaran palu 360 derajat, berlawanan arah jarum jam; jejak diameter 3 kotak
  const R = cell*1.5, swing = make("crag-swing");
  swing.style.width = swing.style.height = `${R*2}px`;
  const arcPath = (r,from,len) => {
    const p = a => `${(Math.cos(a*Math.PI/180)*r).toFixed(1)} ${(Math.sin(a*Math.PI/180)*r).toFixed(1)}`;
    return `M${p(from)}A${r} ${r} 0 0 1 ${p(from+len)}`;
  };
  const brownArcs = [[96,-86,92,.9],[93,-80,64,.7],[98,-76,38,.8],[90,-70,110,.5]].map(([r,from,len,o]) => `<path d="${arcPath(r,from,len)}" fill="none" stroke="#a07a52" stroke-width="1.5" stroke-linecap="round" opacity="${o}"/>`).join("");
  swing.innerHTML = `<i class="crag-trail"></i><svg viewBox="-100 -100 200 200" aria-hidden="true">${brownArcs}
    <rect x="-4.5" y="-72" width="9" height="76" fill="#6a5440" stroke="#2a2018" stroke-width="1.5"/>
    <polygon points="-32,-98 32,-98 36,-62 -36,-62" fill="#8d938e" stroke="#e4e8e2" stroke-width="2.6" stroke-linejoin="miter"/>
    <polygon points="-32,-98 2,-92 -36,-62" fill="#70766f"/><polygon points="32,-98 36,-62 8,-70" fill="#a9afa9"/>
    <path d="M-10 -98 -16 -82 -7 -72M14 -98 10 -84 18 -70" fill="none" stroke="#3a3e3b" stroke-width="2"/>
    <rect x="-9" y="-62" width="18" height="6" fill="#3a3e3b"/></svg>`;
  swing.animate([
    {opacity:0,transform:"translate(-50%,-50%) rotate(55deg) scale(.6)"},
    {opacity:1,offset:.14},
    {opacity:1,transform:"translate(-50%,-50%) rotate(-325deg) scale(1.04)",offset:.86},
    {opacity:0,transform:"translate(-50%,-50%) rotate(-360deg) scale(1.08)"}
  ],{duration:CRAG_SWING+90,delay:CRAG_PRE,easing:"cubic-bezier(.5,.05,.4,1)",fill:"both"});

  const impact = () => {
    // 3a) retakan tanah hitam menjalar dari posisi Mudrock
    const cracks = document.createElementNS(NS,"svg"), arms = 11;
    let d = "";
    for (let i = 0; i < arms; i++) {
      let a = i/arms*Math.PI*2+rand(-.2,.2), x = 0, y = 0;
      const len = cell*rand(1.2,2);
      d += "M0 0";
      for (let s = 0; s < 4; s++) { a += rand(-.45,.45); x += Math.cos(a)*len/4; y += Math.sin(a)*len/4; d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
    }
    cracks.setAttribute("class","crag-cracks");
    cracks.setAttribute("viewBox",`${-cell*2.2} ${-cell*2.2} ${cell*4.4} ${cell*4.4}`);
    cracks.innerHTML = `<path d="${d}" stroke="#030507" stroke-width="6.5" fill="none"/><path d="${d}" stroke="#7d868b" stroke-width="1.3" fill="none" opacity=".7"/>`;
    cracks.style.width = cracks.style.height = `${cell*4.4}px`; cracks.style.left = `${px}px`; cracks.style.top = `${py}px`;
    stage.appendChild(cracks);
    cracks.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.45)"},{opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.12},{opacity:1,offset:.62},{opacity:0,transform:"translate(-50%,-50%) scale(1)"}],{duration:1000,easing:"ease-out",fill:"both"});

    // 3b) debu cokelat muda menyembur ke atas dari tiap kotak, memudar sekitar 0,4 detik
    for (const {r,c} of cells) for (let k = 0; k < 2; k++) {
      const puff = make("crag-dust",cx(c)+rand(-tw*.25,tw*.25),cy(r)+rand(-th*.1,th*.3)), size = cell*rand(.6,1);
      puff.style.width = puff.style.height = `${size}px`;
      puff.animate([
        {opacity:0,transform:"translate(-50%,-50%) scale(.4)"},
        {opacity:.9,offset:.25},
        {opacity:0,transform:`translate(-50%,-50%) translateY(${-cell*rand(.5,.95)}px) scale(1.5)`}
      ],{duration:rand(400,520),delay:rand(0,80),easing:"ease-out",fill:"both"});
    }

    // 3c) 5-8 serpihan batu jajaran genjang: terlempar, memantul di lantai, lalu hilang
    const pieces = Math.floor(rand(5,9)), grav = cell*15, STEPS = 32, TOTAL = 1050;
    for (let i = 0; i < pieces; i++) {
      const el = make("crag-chip"), w = rand(9,16), h = rand(6,10), ang = rand(-Math.PI*.92,-Math.PI*.08), speed = cell*rand(2.2,4.2), spin = rand(-420,420), floorY = rand(0,cell*.75);
      el.style.width = `${w}px`; el.style.height = `${h}px`;
      el.style.background = ["#2f3438","#3b4146","#474d53"][Math.floor(rand(0,3))];
      let x = 0, y = 0, vx = Math.cos(ang)*speed, vy = Math.sin(ang)*speed, bounces = 0;
      const frames = [], dt = TOTAL/1000/STEPS;
      for (let k = 0; k <= STEPS; k++) {
        const t = k/STEPS;
        frames.push({offset:t,opacity:t > .86 ? Math.max(0,1-(t-.86)/.14) : 1,transform:`translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(spin*t).toFixed(0)}deg)`});
        vy += grav*dt; x += vx*dt; y += vy*dt;
        if (y > floorY && vy > 0) { y = floorY; vy = -vy*.4; vx *= .7; bounces++; if (bounces > 2) vy = 0; }
      }
      el.animate(frames,{duration:TOTAL,delay:rand(0,40),easing:"linear",fill:"both"});
    }

    // 4) bintang ledakan putih bergerigi (hentakan)
    const burst = (radius,delay,fill,glow) => {
      const spikes = Math.floor(rand(15,21)), pts = [];
      for (let i = 0; i < spikes*2; i++) {
        const a = i/(spikes*2)*Math.PI*2+rand(-.04,.04), rr = i%2 === 0 ? rand(.62,1) : rand(.2,.36);
        pts.push(`${(Math.cos(a)*rr*50).toFixed(1)},${(Math.sin(a)*rr*50).toFixed(1)}`);
      }
      const svg = document.createElementNS(NS,"svg");
      svg.setAttribute("class","crag-burst"); svg.setAttribute("viewBox","-50 -50 100 100");
      svg.innerHTML = `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
      svg.style.width = svg.style.height = `${radius*2}px`; svg.style.left = `${px}px`; svg.style.top = `${py}px`;
      svg.style.filter = `drop-shadow(0 0 ${glow}px #fff) drop-shadow(0 0 ${glow*2.4}px #ffe9a8)`;
      stage.appendChild(svg);
      const rot = rand(-25,25);
      svg.animate([
        {opacity:0,transform:`translate(-50%,-50%) scale(.15) rotate(${rot}deg)`},
        {opacity:1,transform:`translate(-50%,-50%) scale(1.08) rotate(${rot+8}deg)`,offset:.2},
        {opacity:1,transform:`translate(-50%,-50%) scale(1) rotate(${rot+12}deg)`,offset:.45},
        {opacity:0,transform:`translate(-50%,-50%) scale(1.18) rotate(${rot+20}deg)`}
      ],{duration:440,delay,easing:"cubic-bezier(.16,1,.3,1)",fill:"both"});
    };
    burst(cell*1.6,0,"#fff",8);
    burst(cell*1.0,50,"#fff7d6",5);

    // 5) tile terangkat hampir serentak + garis seismik
    for (const {r,c} of cells) {
      const dist = Math.hypot(r-crow,c-ccol), tile = make("crag-tile",cx(c),cy(r));
      tile.style.width = `${tw-4}px`; tile.style.height = `${th-4}px`;
      tile.animate([
        {opacity:0,transform:"translate(-50%,-50%) scale(.9)"},
        {opacity:.95,transform:"translate(-50%,calc(-50% - 6px)) scale(1.07)",offset:.25},
        {opacity:0,transform:"translate(-50%,-50%) scale(1)"}
      ],{duration:520,delay:dist*30,easing:"ease-out",fill:"both"});
    }
    for (let i = 0; i < 3; i++) {
      const ripple = make("crag-ripple");
      ripple.style.width = ripple.style.height = `${cell*3}px`;
      ripple.animate([
        {opacity:0,transform:"translate(-50%,-50%) scale(.35)"},
        {opacity:.9,offset:.18},
        {opacity:0,transform:"translate(-50%,-50%) scale(1.7)"}
      ],{duration:740,delay:i*120,easing:"cubic-bezier(.16,1,.3,1)",fill:"both"});
    }
  };
  later(impact,CRAG_HIT);
  later(() => stage.remove(),CRAG_HIT+1500);
}