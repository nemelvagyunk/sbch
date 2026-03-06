const APP_VERSION = (window.__APP_VERSION__ || "dev");

const HERO_ALL       = ["UTG","HJ","CO","BU","SB","BB"];
const VILLAIN_ALL    = ["UTG","HJ","CO","BU","SB","BB"];
const ALL_OPEN_SIZES = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7];
const ALL_STACKS     = [50, 75, 100];

const HERO_POS_BY_MODE = {
  open:   ["UTG","HJ","CO","BU","SB"],
  raise:  ["HJ","CO","BU","SB","BB"],
  "3bet": ["UTG","HJ","CO","BU","SB"],
};

const OPEN_ALLOWED_VILLAINS = {
  HJ: ["UTG"],
  CO: ["UTG","HJ"],
  BU: ["UTG","HJ","CO"],
  SB: ["UTG","HJ","CO","BU"],
  BB: ["UTG","HJ","CO","BU","SB"],
};

const DEFAULT_OPEN_SIZE_BY_HERO = {
  UTG: 4, HJ: 4, CO: 4, BU: 4, SB: 6,
};

// DEFAULT_BET_SIZE[stack][openSize][hero][villain] = default 3bet size
const DEFAULT_BET_SIZE = {
  100: {
    4: {
      UTG: { HJ:11,  CO:11,  BU:12,  SB:16,  BB:18  },
      HJ:  { CO:11,  BU:12,  SB:16,  BB:18  },
      CO:  { BU:12,  SB:16,  BB:18  },
      BU:  { SB:16,  BB:18  },
      SB:  { BB:18  },
    },
  },
};

function getDefaultBetSize(stack, openSize, hero, villain){
  return (DEFAULT_BET_SIZE[stack]?.[openSize]?.[hero]?.[villain]) ?? null;
}

const els = {
  miniHeader:  document.querySelector(".miniHeader"),
  status:      document.getElementById("status"),
  modeGroup:   document.getElementById("modeGroup"),
  stackGroup:  document.getElementById("stackGroup"),
  heroGroup:   document.getElementById("heroGroup"),
  villainGroup:document.getElementById("villainGroup"),
  sizeGroup:   document.getElementById("sizeGroup"),
  img:         document.getElementById("chartImg"),
};

let manifest = [];
// index[facing][stack][hero][villain_or__][openSizeStr][betSizeStr_or__] = chart
let index = {};
let selected = { mode:null, stack:null, hero:null, villain:null, openSize:null, betSize:null };

function showError(msg){ els.status.textContent=msg; els.miniHeader.classList.add("visible"); }
function clearError(){ els.miniHeader.classList.remove("visible"); }
function sk(v){ return (v==null) ? "_" : String(v); }

function buildIndex(){
  index = {};
  for (const c of manifest){
    const f=c.facing, st=String(c.stack||"_"), h=c.hero,
          v=c.villain||"_", os=sk(c.open_size), bs=sk(c.threebet_size);
    if (!index[f])             index[f]={};
    if (!index[f][st])         index[f][st]={};
    if (!index[f][st][h])      index[f][st][h]={};
    if (!index[f][st][h][v])   index[f][st][h][v]={};
    if (!index[f][st][h][v][os]) index[f][st][h][v][os]={};
    index[f][st][h][v][os][bs]=c;
  }
}

function hasMode(mode){ return !!(index[mode]&&Object.keys(index[mode]).length>0); }
function hasStack(mode,stack){ return !!(index[mode]&&index[mode][String(stack)]); }
function heroHasAnyChart(mode,stack,hero){ return !!(index[mode]&&index[mode][String(stack)]&&index[mode][String(stack)][hero]); }
function villainHasAnyChart(mode,stack,hero,villain){ return !!(index[mode]&&index[mode][String(stack)]&&index[mode][String(stack)][hero]&&index[mode][String(stack)][hero][villain]); }

function availableOpenSizes(mode,stack,hero,villain){
  const sub=(((index[mode]||{})[String(stack)]||{})[hero]||{})[villain||"_"]||{};
  return Object.keys(sub).map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}

function availableBetSizes(mode,stack,hero,villain,openSize){
  const sub=((((index[mode]||{})[String(stack)]||{})[hero]||{})[villain||"_"]||{})[sk(openSize)]||{};
  return Object.keys(sub).filter(k=>k!=="_").map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}

function allBetSizesEver(){
  const all=new Set();
  for (const st of Object.values(index["3bet"]||{}))
    for (const h of Object.values(st))
      for (const v of Object.values(h))
        for (const os of Object.values(v))
          for (const bs of Object.keys(os))
            if (bs!=="_") all.add(Number(bs));
  return [...all].filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}

function pickChart(){
  const {mode,stack,hero,villain,openSize,betSize}=selected;
  if (!mode||!stack||!hero) return null;
  return ((((index[mode]||{})[String(stack)]||{})[hero]||{})[villain||"_"]||{})[sk(openSize)]?.[sk(betSize)]||null;
}

function sizeLabel(v){ return (Math.round(v)===v)?String(Math.round(v)):String(v); }

function setBtnState(btn,{sel=false,dis=false}={}){
  btn.classList.toggle("selected",!!sel);
  btn.classList.toggle("disabled",!!dis);
  btn.disabled=!!dis;
}

function mkBtn(label,onClick,extraClass=""){
  const b=document.createElement("button");
  b.type="button"; b.className="btn"+(extraClass?" "+extraClass:"");
  b.textContent=label; b.addEventListener("click",onClick);
  return b;
}

function renderMode(){
  els.modeGroup.innerHTML="";
  for (const m of [{key:"open",label:"Open"},{key:"raise",label:"Facing open"},{key:"3bet",label:"Facing 3bet"}]){
    const btn=mkBtn(m.label,()=>{
      selected.mode=m.key; selected.villain=null; selected.openSize=null; selected.betSize=null;
      syncHash(); refreshAll();
    });
    setBtnState(btn,{sel:selected.mode===m.key,dis:!hasMode(m.key)});
    els.modeGroup.appendChild(btn);
  }
}

function renderStack(){
  els.stackGroup.innerHTML="";
  for (const s of ALL_STACKS){
    const btn=mkBtn(String(s),()=>{
      selected.stack=s; selected.villain=null; selected.openSize=null; selected.betSize=null;
      syncHash(); refreshAll();
    },"size");
    const dis = selected.mode ? !hasStack(selected.mode,s) : false;
    setBtnState(btn,{sel:selected.stack===s,dis});
    els.stackGroup.appendChild(btn);
  }
}

function renderHero(){
  els.heroGroup.innerHTML="";
  for (const p of HERO_ALL){
    const btn=mkBtn(p,()=>{
      selected.hero=p; selected.villain=null; selected.openSize=null; selected.betSize=null;
      syncHash(); refreshAll();
    },"hero");
    let dis=false;
    if (selected.mode&&selected.stack)
      dis=!(HERO_POS_BY_MODE[selected.mode]||[]).includes(p)||!heroHasAnyChart(selected.mode,selected.stack,p);
    else if (selected.mode)
      dis=!(HERO_POS_BY_MODE[selected.mode]||[]).includes(p);
    setBtnState(btn,{sel:selected.hero===p,dis});
    els.heroGroup.appendChild(btn);
  }
}

function renderVillain(){
  els.villainGroup.innerHTML="";
  for (const p of VILLAIN_ALL){
    const btn=mkBtn(p,()=>{
      selected.villain=p; selected.openSize=null; selected.betSize=null;
      syncHash(); refreshAll();
    },"villain");
    let dis=false;
    if (selected.mode==="open") dis=true;
    else if (selected.mode&&selected.stack&&selected.hero){
      const allowed=selected.mode==="raise"?(OPEN_ALLOWED_VILLAINS[selected.hero]||[]):VILLAIN_ALL.filter(x=>x!==selected.hero);
      dis=!allowed.includes(p)||!villainHasAnyChart(selected.mode,selected.stack,selected.hero,p);
    } else if (selected.hero&&p===selected.hero) dis=true;
    setBtnState(btn,{sel:selected.villain===p,dis});
    els.villainGroup.appendChild(btn);
  }
}

function renderSize(){
  els.sizeGroup.innerHTML="";
  if (selected.mode==="3bet"){
    const avail=availableBetSizes("3bet",selected.stack,selected.hero,selected.villain,selected.openSize);
    for (const v of avail){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.betSize=v; syncHash(); refreshAll(); },"size");
      setBtnState(btn,{sel:selected.betSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
  } else {
    const avail=new Set(availableOpenSizes(selected.mode,selected.stack,selected.hero,selected.villain));
    const hasCtx=!!(selected.mode&&selected.stack&&selected.hero);
    for (const v of ALL_OPEN_SIZES){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.openSize=v; selected.betSize=null; syncHash(); refreshAll(); },"size");
      setBtnState(btn,{sel:selected.openSize===v,dis:hasCtx?!avail.has(v):false});
      els.sizeGroup.appendChild(btn);
    }
  }
}

function applyDefaults3bet(){
  if (selected.mode!=="3bet"||!selected.stack||!selected.hero||!selected.villain) return;
  if (selected.openSize==null){
    const def=DEFAULT_OPEN_SIZE_BY_HERO[selected.hero];
    const avail=availableOpenSizes("3bet",selected.stack,selected.hero,selected.villain);
    if (def!=null&&avail.includes(def)) selected.openSize=def;
    else if (avail.length===1) selected.openSize=avail[0];
  }
  if (selected.betSize==null&&selected.openSize!=null){
    const def=getDefaultBetSize(selected.stack,selected.openSize,selected.hero,selected.villain);
    const avail=availableBetSizes("3bet",selected.stack,selected.hero,selected.villain,selected.openSize);
    if (def!=null&&avail.includes(def)) selected.betSize=def;
    else if (avail.length===1) selected.betSize=avail[0];
    else if (avail.length>0) selected.betSize=avail[0]; // fallback: first available
  }
}

function renderChart(){
  clearError();
  applyDefaults3bet();
  const chart=pickChart();
  if (chart) els.img.src=chart.file;
  else els.img.removeAttribute("src");
}

function refreshAll(){ renderMode(); renderStack(); renderHero(); renderVillain(); renderSize(); renderChart(); }

function syncHash(){
  const {mode,stack,hero,villain,openSize,betSize}=selected;
  const p=new URLSearchParams();
  if (mode)          p.set("mode",mode);
  if (stack)         p.set("stack",String(stack));
  if (hero)          p.set("hero",hero);
  if (villain)       p.set("villain",villain);
  if (openSize!=null) p.set("os",String(openSize));
  if (betSize!=null)  p.set("bs",String(betSize));
  const h=p.toString();
  if (h!==window.location.hash.replace(/^#/,"")) window.history.replaceState(null,"","#"+h);
}

async function init(){
  try{
    const res=await fetch(`manifest.json?v=${encodeURIComponent(APP_VERSION)}`,{cache:"no-store"});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    manifest=data.charts||[];
    buildIndex();
    selected={mode:null,stack:null,hero:null,villain:null,openSize:null,betSize:null};
    refreshAll();
  }catch(e){
    console.error(e);
    showError("Nem sikerült betölteni a manifestet.");
  }
}

els.img.addEventListener("error",()=>showError("A kép nem tölthető be."));
init();
