/* FOURFOLD / Arknights-style theme v2. Dimuat SETELAH styles.css. Tidak mengubah logika game. */
:root{
  --bg:#101113; --surface:#1b1c1f; --deep:#08090a; --line:#34373b; --text:#f2f2ee; --muted:#8d9296;
  --lime:#ffd21f; --cyan:#3ec3ff; --orange:#ff6a4a; --red:#ff4d4d;
  --display:"Rajdhani","Barlow Condensed","Arial Narrow",sans-serif;
  --chamfer:10px;
  --cut:polygon(0 0,calc(100% - var(--chamfer)) 0,100% var(--chamfer),100% 100%,var(--chamfer) 100%,0 calc(100% - var(--chamfer)));
  --para:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);
  --hazard:repeating-linear-gradient(-45deg,var(--lime) 0 7px,#0b0c0e 7px 14px);
  --dots:radial-gradient(#ffffff26 1px,transparent 1.4px) 0 0/7px 7px;
}
body{background:radial-gradient(110% 70% at 85% 0,#1b2024 0,transparent 60%),repeating-linear-gradient(135deg,#ffffff05 0 2px,transparent 2px 14px),var(--bg);}
h1,h2,h3,.card-name,.mode-text strong,.action strong,.primary-button span{text-transform:uppercase;}
::selection{background:var(--lime);color:#0b0c0e;}

/* ---------- Frame ---------- */
.rail{background:#08090b;border-right:1px solid #24282b;}
.rail-button.active{background:linear-gradient(90deg,#ffd21f18,transparent);}
.rail-button.active::before{inset:50% auto auto 0;width:9px;height:9px;transform:translate(-4px,-50%) rotate(45deg);}
.topbar{position:relative;border-bottom:0;background:#090a0cf5;}
.topbar::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--hazard) 0 0/240px 100% no-repeat,linear-gradient(var(--line),var(--line));}
.wordmark h1{font-weight:700;letter-spacing:.12em;transform:skewX(-8deg);}
.page-heading h2{font-weight:700;letter-spacing:.06em;transform:skewX(-6deg);transform-origin:left;}
.page-heading .eyebrow::before{width:26px;height:6px;background:var(--hazard);}
.status-dot{transform:rotate(45deg);box-shadow:0 0 10px #ffd21f88;}
.side-heading{border-bottom:0;position:relative;padding-bottom:12px;}
.side-heading::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,var(--lime) 0 38px,#3b4044 38px);}
.side-heading h3{font-weight:700;letter-spacing:.1em;}

/* ---------- Operator-style skill cards ---------- */
.card-tile,.hand .card-tile,.offer-grid .card-tile,.catalog .card-tile{
  --chamfer:14px;position:relative;display:block;padding:0;height:auto;aspect-ratio:4/5.1;overflow:hidden;
  clip-path:var(--cut);border:0;background:linear-gradient(170deg,#2a2d31,#121316 80%);box-shadow:inset 0 0 0 1px #3a3e43;transition:transform .18s,box-shadow .18s;
}
.card-tile::before,.hand .card-tile::before{content:"";position:absolute;inset:0;left:0;top:0;width:auto;height:auto;background:var(--dots);opacity:.55;z-index:0;}
.card-tile::after,.hand .card-tile::after{content:"";position:absolute;inset:0;width:auto;height:auto;background:linear-gradient(115deg,transparent 0 34%,color-mix(in srgb,var(--card-color) 26%,transparent) 34% 58%,transparent 58%),radial-gradient(circle at 72% 28%,color-mix(in srgb,var(--card-color) 34%,transparent),transparent 62%);z-index:0;}
.card-tile .card-icon{position:absolute;z-index:1;left:50%;top:44%;width:66%;height:auto;aspect-ratio:1;margin:0;transform:translate(-50%,-50%);color:var(--card-color);filter:drop-shadow(0 0 10px color-mix(in srgb,var(--card-color) 60%,transparent));transition:transform .25s,filter .25s;stroke-width:1.4;}
.card-tile:hover,.card-tile:focus-visible{transform:translateY(-4px);background:linear-gradient(170deg,#363a3f,#17181b 80%);box-shadow:inset 0 0 0 1px var(--card-color);}
.card-tile:hover .card-icon{transform:translate(-50%,-52%) scale(1.1);color:#fff;filter:drop-shadow(0 0 14px var(--card-color));}
.card-points,.hand .card-points{position:absolute;z-index:3;top:0;left:0;right:auto;width:36px;height:36px;display:grid;place-content:center;text-align:center;background:#f4f4ef;color:#0b0c0e;font-family:var(--mono);font-size:6px;letter-spacing:.1em;line-height:1;clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%);}
.card-points b,.hand .card-points b{display:block;font-family:var(--display);font-weight:700;font-size:22px;line-height:.9;color:#0b0c0e;}
.sk-tag{position:absolute;z-index:2;top:8px;right:10px;font-family:var(--mono);font-size:7.5px;letter-spacing:.16em;color:var(--card-color);text-transform:uppercase;}
.ct-rank{position:absolute;z-index:2;left:10px;right:10px;bottom:36px;display:flex;gap:3px;}
.ct-rank i{height:4px;flex:0 0 14px;background:var(--card-color);transform:skewX(-30deg);}
.ct-rank i.off{background:#ffffff1c;}
.card-tile .card-name,.hand .card-tile .card-name,.offer-grid .card-name{position:absolute;z-index:2;left:0;right:0;bottom:0;min-height:0;max-width:none;display:block;padding:7px 12px 8px 12px;font-family:var(--display);font-weight:700;font-size:17px;letter-spacing:.06em;line-height:1.05;background:linear-gradient(90deg,#050607f2,#050607b8);border-left:4px solid var(--card-color);clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);}
.card-tile.selected{background:linear-gradient(170deg,#3a3724,#16150e 80%);box-shadow:inset 0 0 0 2px var(--lime);color:inherit;}
.card-tile.selected .card-name{background:var(--lime);color:#0b0c0e;}
.card-tile.selected .card-icon{color:var(--lime);}
.card-tile.selected .sk-tag{color:var(--lime);}
.card-tile.selected .card-points{background:var(--lime);}
.card-tile.selected .card-points b{color:#0b0c0e;}
.card-tile.selected .ct-sel{display:block;}
.ct-sel{display:none;position:absolute;z-index:4;right:0;top:0;width:34px;height:34px;background:var(--lime);clip-path:polygon(0 0,100% 0,100% 100%);}
.ct-sel::after{content:"";position:absolute;right:6px;top:4px;width:6px;height:11px;border:solid #0b0c0e;border-width:0 2px 2px 0;transform:rotate(40deg);}
.card-tile.removed{background:repeating-linear-gradient(-45deg,#1b1e21 0 8px,#0f1113 8px 9px);}
.card-tile[aria-disabled="true"]{opacity:.38;}
.hand .sk-tag,.hand .ct-rank{display:none;}
.hand .card-points,.hand .card-points{width:26px;height:26px;}
.hand .card-points b{font-size:16px;}
.hand .card-points i{display:none;}
.hand .card-tile .card-name{font-size:11px;padding:4px 8px 5px;letter-spacing:.04em;}
.hand{gap:8px;}
.offer-grid .card-tile{aspect-ratio:4/5.4;}
.offer-grid .card-name{font-size:21px;padding:9px 14px 10px;}
.offer-grid .card-points{width:44px;height:44px;} .offer-grid .card-points b{font-size:28px;}
@keyframes tileIn{from{opacity:0;transform:translateX(34px) skewX(-8deg);}to{opacity:1;transform:none;}}

/* ---------- Buttons ---------- */
.primary-button,.action,.subtle-button,.option-button,.menu-mode{--chamfer:12px;clip-path:var(--cut);}
.primary-button{background:var(--lime);color:#0b0c0e;position:relative;overflow:hidden;}
.primary-button span{font-family:var(--display);font-weight:700;letter-spacing:.08em;}
.primary-button::after{content:"";position:absolute;top:0;bottom:0;width:60px;left:-90px;background:#fff8;transform:skewX(-24deg);transition:left .45s ease;}
.primary-button:hover:not(:disabled)::after{left:calc(100% + 30px);}
.primary-button:hover:not(:disabled){background:#ffe35c;}
.action{background:linear-gradient(160deg,#24282c,#131518);border:0;box-shadow:inset 0 0 0 1px #3b4247;}
.action strong{font-weight:700;letter-spacing:.1em;}
.action.primary{background:var(--lime);box-shadow:none;color:#0b0c0e;}
.action.primary small{color:#4a4100;}
.action:not(.primary):hover:not(:disabled){box-shadow:inset 0 0 0 1px var(--lime);background:#20252a;}
.subtle-button{border:0;box-shadow:inset 0 0 0 1px #4a5156;}
.option-button{border:0;box-shadow:inset 0 0 0 1px #434b50;background:linear-gradient(160deg,#22272b,#14171a);}
.option-button:hover{background:linear-gradient(160deg,#ffe24d,#ffd21f);color:#0b0c0e;box-shadow:none;}
.option-button:hover svg,.option-button:hover small{color:#0b0c0e;}

/* ---------- Battlefield ---------- */
.arena{--chamfer:22px;clip-path:var(--cut);border:0;background:linear-gradient(180deg,#0e1316,#090c0e);box-shadow:inset 0 0 0 1px #2f3a40;}
.arena::after{width:110px;height:8px;background:var(--hazard);}
.field-caption span:last-child{color:var(--lime);}
.cell{--chamfer:7px;clip-path:var(--cut);border:0;background:linear-gradient(160deg,#1f262b,#14191d);box-shadow:inset 0 0 0 1px #2f383e;}
.cell.lane-hover{background:#2a3338;box-shadow:inset 0 0 0 1px #ffd21f77;}
.cell.selected{box-shadow:inset 0 0 0 2px var(--lime);background:#ffd21f1a;}
.cell:focus-visible{outline:0;box-shadow:inset 0 0 0 2px var(--lime);}
.cell.win{background:#ffd21f2a;box-shadow:inset 0 0 0 2px var(--lime);}
.cell.win .coin{color:var(--lime);box-shadow:0 0 24px #ffd21f77;}
.coin{background:radial-gradient(circle at 35% 30%,color-mix(in srgb,currentColor 38%,#1a2024),#14181b 72%);box-shadow:0 0 14px color-mix(in srgb,currentColor 38%,transparent),inset 0 0 0 4px #0b0e1060;}
.coin.p2{background:radial-gradient(circle at 35% 30%,color-mix(in srgb,currentColor 38%,#1a2024),#14181b 72%);}
.coin.neutral{box-shadow:inset 0 0 0 4px #0b0e1060;}
.turn-emblem{--chamfer:9px;clip-path:var(--cut);font-weight:700;width:46px;height:46px;font-size:26px;}
.turn-display strong{font-size:26px;font-weight:700;letter-spacing:.1em;}
.turn-number b{font-family:var(--display);font-size:24px;color:var(--lime);}
.effect-track{height:4px;background:#252b2f;}
.effect-track i{height:4px;background:var(--hazard);}

/* ---------- Panels / overlays ---------- */
.dialog{--chamfer:20px;clip-path:var(--cut);border:0;background:linear-gradient(170deg,#1b2024,#0e1114);box-shadow:none;}
.dialog::after{content:"";position:absolute;top:0;right:30px;width:96px;height:8px;background:var(--hazard);}
.dialog h2{font-weight:700;letter-spacing:.05em;}
.overlay{background:#030507e8;}
.tooltip{border:0;border-top:3px solid var(--lime);background:#0a0e11;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);}
.toast{border-left:4px solid var(--lime);background:#14181b;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);padding-right:28px;}
.loadout-sidebar{border-top:3px solid var(--lime);background:#0a0c0e;}
.skill-announcement{background:linear-gradient(90deg,#0a0d0ff5,#0a0d0fcc);border:0;box-shadow:inset 4px 0 0 var(--lime);clip-path:polygon(0 0,100% 0,calc(100% - 16px) 100%,0 100%);padding-right:34px;}
.skill-announcement.expired{box-shadow:inset 4px 0 0 #90a3a6;}

/* ---------- Menu ---------- */
.menu-view{background:radial-gradient(90% 70% at 20% 30%,#1a2126 0,transparent 70%),var(--bg);}
.menu-view::after{top:0;bottom:0;right:22vw;width:4px;height:auto;background:var(--lime);transform:skewX(-18deg);box-shadow:46px 0 0 #ffffff26,92px 0 0 #ffffff12;z-index:-1;}
.menu-title h1{font-weight:700;font-size:clamp(60px,10.5vw,150px);transform:skewX(-8deg);transform-origin:left;text-shadow:7px 7px 0 #ffd21f26;letter-spacing:.07em;}
.menu-title p{border-left:4px solid var(--lime);padding-left:14px;}
.menu-title .eyebrow::before{width:34px;height:7px;background:var(--hazard);}
.menu-mode{--chamfer:16px;border:0;border-left:5px solid #e9ebe3;background:linear-gradient(160deg,#171a1d,#0c0e10);box-shadow:inset 0 0 0 1px #30373b;}
.menu-mode::after{display:none;}
.menu-mode:hover,.menu-mode:focus-visible{background:linear-gradient(160deg,#ffe24d,#ffd21f);border-left-color:#0b0c0e;transform:translateX(-10px);box-shadow:none;}
.menu-mode:hover .mode-text strong,.menu-mode:focus-visible .mode-text strong{color:#0b0c0e;}

/* ---------- Board skill aura (dipasang oleh js/ark.js) ---------- */
.ark-aura{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden;--sk:#ffd21f;}
.ark-aura .tint{position:absolute;inset:0;background:radial-gradient(circle at var(--x,50%) var(--y,50%),color-mix(in srgb,var(--sk) 38%,transparent),transparent 62%);animation:auraTint 1.1s ease-out both;}
.ark-aura .hexgrid{position:absolute;inset:-10%;background:
  linear-gradient(60deg,transparent 47%,color-mix(in srgb,var(--sk) 55%,transparent) 48% 52%,transparent 53%) 0 0/54px 94px,
  linear-gradient(-60deg,transparent 47%,color-mix(in srgb,var(--sk) 55%,transparent) 48% 52%,transparent 53%) 0 0/54px 94px;
  mask:radial-gradient(circle at var(--x,50%) var(--y,50%),#000 0,transparent 55%);-webkit-mask:radial-gradient(circle at var(--x,50%) var(--y,50%),#000 0,transparent 55%);animation:auraHex 1.1s ease-out both;}
.ark-aura .shock{position:absolute;left:var(--x,50%);top:var(--y,50%);width:40px;height:40px;margin:-20px 0 0 -20px;border:3px solid var(--sk);border-radius:50%;box-shadow:0 0 24px var(--sk),inset 0 0 24px var(--sk);animation:auraShock .9s cubic-bezier(.1,.7,.2,1) both;}
.ark-aura .shock.b{border-radius:0;transform:rotate(45deg);animation-name:auraShockB;animation-delay:.08s;}
.ark-aura .scan{position:absolute;left:0;right:0;height:26%;top:-30%;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--sk) 45%,transparent),transparent);animation:auraScan .8s ease-in .05s both;}
.ark-aura .spark{position:absolute;left:var(--x,50%);top:var(--y,50%);width:3px;height:26px;background:var(--sk);box-shadow:0 0 10px var(--sk);transform-origin:50% 0;animation:auraSpark .75s ease-out both;}
@keyframes auraTint{0%{opacity:0;}20%{opacity:1;}100%{opacity:0;}}
@keyframes auraHex{0%{opacity:0;transform:scale(.8);}25%{opacity:.9;}100%{opacity:0;transform:scale(1.15);}}
@keyframes auraShock{from{opacity:1;transform:scale(.3);}to{opacity:0;transform:scale(16);}}
@keyframes auraShockB{from{opacity:1;transform:rotate(45deg) scale(.3);}to{opacity:0;transform:rotate(45deg) scale(11);}}
@keyframes auraScan{from{top:-30%;opacity:1;}to{top:110%;opacity:0;}}
@keyframes auraSpark{from{opacity:1;transform:rotate(var(--a)) translateY(10px) scaleY(.4);}to{opacity:0;transform:rotate(var(--a)) translateY(220px) scaleY(1.4);}}

/* ---------- Skill cast cut-in (dipasang oleh js/ark.js) ---------- */
.ark-cast{position:fixed;inset:0;z-index:100;pointer-events:none;overflow:hidden;animation:arkRoot 2.3s linear both;--sk:#ffd21f;--op:#3ec3ff;}
.ark-cast *{box-sizing:border-box;}
.ark-dim{position:absolute;inset:0;background:radial-gradient(ellipse at 35% 50%,#0000 0,#000d 95%),#000b;animation:arkFade .25s ease both;}
.ark-dots{position:absolute;inset:0;background:var(--dots);opacity:.35;animation:arkFade .4s ease both;}
.ark-panel{position:absolute;left:-6%;top:0;bottom:0;width:64%;clip-path:polygon(0 0,100% 0,80% 100%,0 100%);background:linear-gradient(115deg,color-mix(in srgb,var(--sk) 20%,#07080a) 0,color-mix(in srgb,var(--sk) 85%,#000) 140%);animation:arkPanel .5s cubic-bezier(.15,.9,.2,1) both;}
.ark-panel::before{content:"";position:absolute;inset:0;background:var(--dots);opacity:.6;}
.ark-panel::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 46px,#ffffff10 46px 48px);}
.ark-panel .splash{position:absolute;left:14%;top:50%;width:clamp(260px,62vh,640px);aspect-ratio:1;transform:translateY(-50%) rotate(-8deg);color:#fff;opacity:.92;filter:drop-shadow(0 0 28px color-mix(in srgb,var(--sk) 70%,transparent));animation:arkSplash 2.2s cubic-bezier(.2,.7,.2,1) both;}
.ark-panel .splash svg{width:100%;height:100%;stroke-width:1.1;}
.ark-edge{position:absolute;left:-6%;top:0;bottom:0;width:64%;clip-path:polygon(97% 0,99.5% 0,79.5% 100%,77% 100%);background:#fff;opacity:.9;animation:arkPanel .5s cubic-bezier(.15,.9,.2,1) .05s both;}
.ark-edge.y{clip-path:polygon(100% 0,102% 0,82% 100%,80% 100%);background:var(--sk);animation-delay:.1s;}
.ark-ghost{position:absolute;left:0;bottom:12vh;font-family:var(--display);font-weight:700;font-size:clamp(70px,16vw,240px);line-height:.8;white-space:nowrap;text-transform:uppercase;color:transparent;-webkit-text-stroke:2px #ffffff26;animation:arkGhost 2.2s linear both;}
.ark-plate{position:absolute;right:5vw;top:50%;width:min(52vw,720px);transform:translateY(-50%);padding:clamp(18px,3vw,34px) clamp(20px,3vw,40px);animation:arkPlate .5s cubic-bezier(.15,.9,.2,1) .18s both;}
.ark-plate::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#07080af5,#07080ad8);clip-path:polygon(24px 0,100% 0,calc(100% - 24px) 100%,0 100%);border-left:0;z-index:-1;}
.ark-plate::after{content:"";position:absolute;left:0;top:0;bottom:0;width:7px;background:var(--sk);transform:skewX(-19deg);transform-origin:top left;z-index:-1;}
.ark-head{display:flex;align-items:center;gap:12px;}
.ark-ico{width:clamp(44px,6vw,64px);aspect-ratio:1;display:grid;place-items:center;background:var(--sk);color:#0b0c0e;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));}
.ark-ico svg{width:68%;height:68%;stroke-width:2;}
.ark-lab small{display:block;font-family:var(--mono);font-size:clamp(9px,1.1vw,12px);letter-spacing:.2em;color:var(--sk);}
.ark-lab span{display:block;margin-top:3px;font-family:var(--mono);font-size:clamp(9px,1.1vw,12px);letter-spacing:.16em;color:var(--op);}
.ark-plate strong{display:block;margin-top:clamp(8px,1.4vw,16px);font-family:var(--display);font-weight:700;font-size:clamp(40px,7.4vw,98px);line-height:.92;letter-spacing:.03em;text-transform:uppercase;color:#fff;animation:arkReveal .45s cubic-bezier(.2,.8,.2,1) .3s both;}
.ark-sub{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;animation:arkRise .4s ease .46s both;}
.ark-sub b{font-family:var(--mono);font-weight:500;font-size:clamp(9px,1.05vw,12px);letter-spacing:.1em;color:#0b0c0e;background:#f1f1ec;padding:3px 10px;text-transform:uppercase;clip-path:var(--para);}
.ark-sub b:first-child{background:var(--sk);}
.ark-plate p{margin-top:12px;max-width:50ch;font-size:clamp(11px,1.35vw,15px);line-height:1.55;color:#ccd2d5;animation:arkRise .4s ease .56s both;}
.ark-lines{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 34px,#ffffff0f 34px 35px);mask:linear-gradient(90deg,transparent,#000 30%,transparent);-webkit-mask:linear-gradient(90deg,transparent,#000 30%,transparent);animation:arkLines 1s linear both;}
.ark-bar{position:absolute;left:0;right:0;height:9vh;background:#040506;animation:arkBarT .3s cubic-bezier(.2,.8,.2,1) both;}
.ark-bar.top{top:0;}
.ark-bar.bot{bottom:0;animation-name:arkBarB;}
.ark-bar::after{content:"";position:absolute;left:0;right:0;height:6px;background:var(--hazard);}
.ark-bar.top::after{bottom:0;} .ark-bar.bot::after{top:0;}
.ark-flash{position:absolute;inset:0;background:#fff;opacity:0;animation:arkFlash .4s ease .05s both;}
@keyframes arkRoot{0%,90%{opacity:1;}100%{opacity:0;}}
@keyframes arkFade{from{opacity:0;}to{opacity:1;}}
@keyframes arkBarT{from{transform:translateY(-100%);}to{transform:none;}}
@keyframes arkBarB{from{transform:translateY(100%);}to{transform:none;}}
@keyframes arkPanel{from{transform:translateX(-110%);}to{transform:none;}}
@keyframes arkPlate{from{opacity:0;transform:translate(60px,-50%);}to{opacity:1;transform:translateY(-50%);}}
@keyframes arkSplash{from{transform:translateY(-50%) rotate(-24deg) scale(.7);}to{transform:translateY(-50%) rotate(-4deg) scale(1.04);}}
@keyframes arkGhost{from{opacity:0;left:8%;}18%{opacity:1;}to{opacity:1;left:-4%;}}
@keyframes arkLines{from{background-position:0 0;opacity:0;}20%{opacity:1;}to{background-position:0 -300px;opacity:.5;}}
@keyframes arkReveal{from{clip-path:inset(0 100% 0 0);transform:translateX(-24px);}to{clip-path:inset(0 0 0 0);transform:none;}}
@keyframes arkRise{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
@keyframes arkFlash{0%{opacity:0;}25%{opacity:.85;}100%{opacity:0;}}
@media(max-width:700px){.ark-plate{right:4vw;left:4vw;width:auto;}.ark-panel{width:100%;opacity:.55;}.ark-edge{display:none;}.ark-plate p{display:none;}.ark-bar{height:6vh;}}
@media(prefers-reduced-motion:reduce){.ark-cast,.ark-aura{display:none;}}
html[data-motion="off"] .ark-cast,html[data-motion="off"] .ark-aura{display:none;}