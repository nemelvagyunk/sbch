const APP_VERSION = (window.__APP_VERSION__ || "dev");

const HERO_ALL       = ["UTG","HJ","CO","BU","SB","BB"];
const VILLAIN_ALL    = ["UTG","HJ","CO","BU","SB","BB"];
const ALL_OPEN_SIZES = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7];
const ALL_STACKS     = [50, 75, 100];

const HERO_POS_BY_MODE = {
  open:   ["UTG","HJ","CO","BU","SB"],
  raise:  ["HJ","CO","BU","SB","BB"],
  "3bet": ["UTG","HJ","CO","BU","SB"],
  sqz:    ["UTG","HJ","CO","BU","SB","BB"],
  c4b:    ["CO","BU","SB","BB"],
  limp:   ["SB","BB"],
};
const POS_ORDER = {UTG:0,HJ:1,CO:2,BU:3,SB:4,BB:5};

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
let selected = { mode:null, stack:100, hero:null, villain:null, villain2:null, openSize:null, threebetSize:null, betSize:null };

function showError(msg){ els.status.textContent=msg; els.miniHeader.classList.add("visible"); }
function clearError(){ els.miniHeader.classList.remove("visible"); }
function sk(v){ return (v==null) ? "_" : String(v); }

let indexC4b = {};
function buildIndex(){
  index = {}; indexC4b = {};
  for (const ch of manifest){
    const f=ch.facing, st=String(ch.stack||"_"), h=ch.hero;
    if (f==="c4b"){
      const v=((ch.villain||"_")+"_"+(ch.villain2||"_"));
      const os=sk(ch.open_size), ts=sk(ch.threebet_size), cs=sk(ch.c4b_size);
      if (!indexC4b[st])               indexC4b[st]={};
      if (!indexC4b[st][h])            indexC4b[st][h]={};
      if (!indexC4b[st][h][v])         indexC4b[st][h][v]={};
      if (!indexC4b[st][h][v][os])     indexC4b[st][h][v][os]={};
      if (!indexC4b[st][h][v][os][ts]) indexC4b[st][h][v][os][ts]={};
      indexC4b[st][h][v][os][ts][cs]=ch;
      if (!index[f])     index[f]={};
      if (!index[f][st]) index[f][st]={};
    } else {
      const v=(f==="sqz")?((ch.villain||"_")+"_"+(ch.villain2||"_")):(ch.villain||"_");
      const os=sk(ch.open_size);
      const bs=(f==="limp"&&h==="SB")?sk(ch.iso_size):sk(ch.threebet_size);
      if (!index[f])             index[f]={};
      if (!index[f][st])         index[f][st]={};
      if (!index[f][st][h])      index[f][st][h]={};
      if (!index[f][st][h][v])   index[f][st][h][v]={};
      if (!index[f][st][h][v][os]) index[f][st][h][v][os]={};
      index[f][st][h][v][os][bs]=ch;
    }
  }
}

function hasMode(mode){ return !!(index[mode]&&Object.keys(index[mode]).length>0); }
function hasStack(mode,stack){ return !!(index[mode]&&index[mode][String(stack)]); }
function heroHasAnyChart(mode,stack,hero){ return !!(index[mode]&&index[mode][String(stack)]&&index[mode][String(stack)][hero]); }
function villainHasAnyChart(mode,stack,hero,villain){ return !!(index[mode]&&index[mode][String(stack)]&&index[mode][String(stack)][hero]&&index[mode][String(stack)][hero][villain]); }

function sqzKey(v1,v2){ return (v1||"_")+"_"+(v2||"_"); }
function availableOpenSizes(mode,stack,hero,villain,villain2){
  const vk=(mode==="sqz")?sqzKey(villain,villain2):(villain||"_");
  const sub=(((index[mode]||{})[String(stack)]||{})[hero]||{})[vk]||{};
  return Object.keys(sub).map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}
function availableBetSizes(mode,stack,hero,villain,openSize,villain2){
  const vk=(mode==="sqz")?sqzKey(villain,villain2):(villain||"_");
  const sub=((((index[mode]||{})[String(stack)]||{})[hero]||{})[vk]||{})[sk(openSize)]||{};
  return Object.keys(sub).filter(k=>k!=="_").map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}
function c4bOpenSizes(stack,hero,v1,v2){
  return Object.keys(((indexC4b[String(stack)]||{})[hero]||{})[sqzKey(v1,v2)]||{}).map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}
function c4bThreebetSizes(stack,hero,v1,v2,openSize){
  return Object.keys((((indexC4b[String(stack)]||{})[hero]||{})[sqzKey(v1,v2)]||{})[sk(openSize)]||{}).map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}
function c4bSizes(stack,hero,v1,v2,openSize,threebetSize){
  return Object.keys(((((indexC4b[String(stack)]||{})[hero]||{})[sqzKey(v1,v2)]||{})[sk(openSize)]||{})[sk(threebetSize)]||{}).filter(k=>k!=="_").map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
}
function limpOpenSizes(stack,hero){
  const v=hero==="BB"?"SB":"BB";
  return Object.keys((((index["limp"]||{})[String(stack)]||{})[hero]||{})[v]||{}).map(Number).filter(x=>!isNaN(x)).sort((a,b)=>a-b);
}
function limpIsoSizes(stack,openSize){
  const sub=(((index["limp"]||{})[String(stack)]||{})["SB"]||{})["BB"]||{};
  return Object.keys(sub[sk(openSize)]||{}).filter(k=>k!=="_").map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
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
  const {mode,stack,hero,villain,villain2,openSize,threebetSize,betSize}=selected;
  if (!mode||!stack||!hero) return null;
  if (mode==="c4b"){
    if (!villain||!villain2) return null;
    return ((((indexC4b[String(stack)]||{})[hero]||{})[sqzKey(villain,villain2)]||{})[sk(openSize)]||{})[sk(threebetSize)]?.[sk(betSize)]||null;
  }
  if (mode==="limp"){
    if (hero==="BB") return ((((index["limp"]||{})[String(stack)]||{})["BB"]||{})["SB"]||{})[sk(openSize)]?.["_"]||null;
    return ((((index["limp"]||{})[String(stack)]||{})["SB"]||{})["BB"]||{})[sk(openSize)]?.[sk(betSize)]||null;
  }
  const vk=(mode==="sqz")?sqzKey(villain,villain2):(villain||"_");
  return ((((index[mode]||{})[String(stack)]||{})[hero]||{})[vk]||{})[sk(openSize)]?.[sk(betSize)]||null;
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
  for (const m of [{key:"open",label:"Open"},{key:"raise",label:"Facing open"},{key:"3bet",label:"Facing 3bet"},{key:"sqz",label:"SQZ"},{key:"c4b",label:"C4B"},{key:"limp",label:"Facing limp"}]){
    const btn=mkBtn(m.label,()=>{
      selected.mode=m.key; selected.villain=null; selected.villain2=null;
      selected.openSize=null; selected.threebetSize=null; selected.betSize=null;
      syncHash(); refreshAll();
    });
    setBtnState(btn,{sel:selected.mode===m.key,dis:false});
    els.modeGroup.appendChild(btn);
  }
}

function renderStack(){
  els.stackGroup.innerHTML="";
  for (const s of ALL_STACKS){
    const btn=mkBtn(String(s),()=>{
      selected.stack=s; selected.villain=null; selected.villain2=null;
      selected.openSize=null; selected.threebetSize=null; selected.betSize=null;
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
      selected.hero=p; selected.villain=null; selected.villain2=null;
      selected.openSize=null; selected.threebetSize=null; selected.betSize=null;
      syncHash(); refreshAll();
    },"hero");
    let dis=false;
    if (selected.mode==="limp"){
      dis=!["SB","BB"].includes(p);
    } else if (selected.mode==="sqz"||selected.mode==="c4b"){
      if (p===selected.villain||p===selected.villain2) dis=true;
      else if (selected.mode==="sqz"&&selected.villain&&selected.villain2)
        dis=POS_ORDER[p]<=Math.max(POS_ORDER[selected.villain],POS_ORDER[selected.villain2]);
      else dis=!(HERO_POS_BY_MODE[selected.mode]||[]).includes(p);
    } else if (selected.mode&&selected.stack)
      dis=!(HERO_POS_BY_MODE[selected.mode]||[]).includes(p)||!heroHasAnyChart(selected.mode,selected.stack,p);
    else if (selected.mode)
      dis=!(HERO_POS_BY_MODE[selected.mode]||[]).includes(p);
    setBtnState(btn,{sel:selected.hero===p,dis});
    els.heroGroup.appendChild(btn);
  }
}

function renderVillain(){
  els.villainGroup.innerHTML="";
  if (selected.mode==="limp"){ els.villainGroup.style.display="none"; return; }
  els.villainGroup.style.display="";
  if (selected.mode==="sqz"||selected.mode==="c4b"){
    for (const p of VILLAIN_ALL){
      const isSel=selected.villain===p||selected.villain2===p;
      const btn=mkBtn(p,()=>{
        if (selected.villain===p) selected.villain=null;
        else if (selected.villain2===p) selected.villain2=null;
        else {
          let a=selected.villain, b=selected.villain2;
          if (!a) a=p; else b=p;
          if (a&&b&&POS_ORDER[a]>POS_ORDER[b]){const t=a;a=b;b=t;}
          selected.villain=a; selected.villain2=b;
        }
        if (selected.hero&&(selected.hero===selected.villain||selected.hero===selected.villain2)) selected.hero=null;
        if (selected.hero&&selected.villain&&selected.villain2){
          const maxV=Math.max(POS_ORDER[selected.villain],POS_ORDER[selected.villain2]);
          if (POS_ORDER[selected.hero]<=maxV) selected.hero=null;
        }
        selected.openSize=null; selected.threebetSize=null; selected.betSize=null;
        syncHash(); refreshAll();
      },"villain");
      const twoSel=!!(selected.villain&&selected.villain2);
      let dis=(!isSel&&twoSel)||(!!selected.hero&&p===selected.hero);
      if (!dis&&selected.hero) dis=POS_ORDER[p]>=POS_ORDER[selected.hero];
      setBtnState(btn,{sel:isSel,dis});
      els.villainGroup.appendChild(btn);
    }
    return;
  }
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
  if (selected.mode==="limp"&&selected.hero&&selected.stack){
    for (const v of limpOpenSizes(selected.stack,selected.hero)){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.openSize=v; selected.betSize=null; syncHash(); refreshAll(); },"size");
      setBtnState(btn,{sel:selected.openSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
    if (selected.hero==="SB"&&selected.openSize!=null){
      for (const v of limpIsoSizes(selected.stack,selected.openSize)){
        const btn=mkBtn(sizeLabel(v)+"bb iso",()=>{ selected.betSize=v; syncHash(); refreshAll(); },"size");
        setBtnState(btn,{sel:selected.betSize===v,dis:false});
        els.sizeGroup.appendChild(btn);
      }
    }
  } else if (selected.mode==="c4b"){
    for (const v of c4bSizes(selected.stack,selected.hero,selected.villain,selected.villain2,selected.openSize,selected.threebetSize)){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.betSize=v; syncHash(); refreshAll(); },"size");
      setBtnState(btn,{sel:selected.betSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
  } else if (selected.mode==="3bet"||selected.mode==="sqz"){
    for (const v of availableBetSizes(selected.mode,selected.stack,selected.hero,selected.villain,selected.openSize,selected.villain2)){
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

function applyDefaultsOpen(){
  if (selected.mode!=="open"||!selected.stack||!selected.hero) return;
  if (selected.openSize==null){
    const avail=availableOpenSizes("open",selected.stack,selected.hero,"_");
    if (avail.includes(4)) selected.openSize=4; else if (avail.length===1) selected.openSize=avail[0];
  }
}
function applyDefaultsRaise(){
  if (selected.mode!=="raise"||!selected.stack||!selected.hero) return;
  if (selected.openSize==null){
    const avail=availableOpenSizes("raise",selected.stack,selected.hero,selected.villain);
    if (avail.includes(4)) selected.openSize=4; else if (avail.length===1) selected.openSize=avail[0];
  }
}
function applyDefaults3bet(){
  if ((selected.mode!=="3bet"&&selected.mode!=="sqz")||!selected.stack||!selected.hero||!selected.villain) return;
  if (selected.mode==="sqz"&&!selected.villain2) return;
  if (selected.openSize==null){
    const def=DEFAULT_OPEN_SIZE_BY_HERO[selected.hero];
    const avail=availableOpenSizes(selected.mode,selected.stack,selected.hero,selected.villain,selected.villain2);
    if (def!=null&&avail.includes(def)) selected.openSize=def;
    else if (avail.length===1) selected.openSize=avail[0];
  }
  if (selected.betSize==null&&selected.openSize!=null){
    const avail=availableBetSizes(selected.mode,selected.stack,selected.hero,selected.villain,selected.openSize,selected.villain2);
    if (selected.mode==="3bet"){
      const def=getDefaultBetSize(selected.stack,selected.openSize,selected.hero,selected.villain);
      if (def!=null&&avail.includes(def)) selected.betSize=def;
      else if (avail.length>0) selected.betSize=avail[0];
    } else if (avail.length>0) selected.betSize=avail[0];
  }
}
function applyDefaultsC4b(){
  if (selected.mode!=="c4b"||!selected.stack||!selected.hero||!selected.villain||!selected.villain2) return;
  if (selected.openSize==null){
    const avail=c4bOpenSizes(selected.stack,selected.hero,selected.villain,selected.villain2);
    const def=DEFAULT_OPEN_SIZE_BY_HERO[selected.villain];
    if (def!=null&&avail.includes(def)) selected.openSize=def;
    else if (avail.includes(4)) selected.openSize=4;
    else if (avail.length>0) selected.openSize=avail[0];
  }
  if (selected.threebetSize==null&&selected.openSize!=null){
    const avail=c4bThreebetSizes(selected.stack,selected.hero,selected.villain,selected.villain2,selected.openSize);
    if (avail.length>0) selected.threebetSize=avail[0];
  }
  if (selected.betSize==null&&selected.openSize!=null&&selected.threebetSize!=null){
    const avail=c4bSizes(selected.stack,selected.hero,selected.villain,selected.villain2,selected.openSize,selected.threebetSize);
    if (avail.length>0) selected.betSize=avail[0];
  }
}
function applyDefaultsLimp(){
  if (selected.mode!=="limp"||!selected.stack||!selected.hero) return;
  if (selected.openSize==null){
    const avail=limpOpenSizes(selected.stack,selected.hero);
    if (avail.length>0) selected.openSize=avail[0];
  }
  if (selected.hero==="SB"&&selected.betSize==null&&selected.openSize!=null){
    const avail=limpIsoSizes(selected.stack,selected.openSize);
    if (avail.length>0) selected.betSize=avail[0];
  }
}
function renderChart(){
  clearError();
  const chart=pickChart();
  if (chart) els.img.src=chart.file;
  else els.img.removeAttribute("src");
}
function refreshAll(){ applyDefaultsOpen(); applyDefaultsRaise(); applyDefaults3bet(); applyDefaultsC4b(); applyDefaultsLimp(); renderMode(); renderStack(); renderHero(); renderVillain(); renderSize(); renderChart(); }

function syncHash(){
  const {mode,stack,hero,villain,villain2,openSize,threebetSize,betSize}=selected;
  const p=new URLSearchParams();
  if (mode)            p.set("mode",mode);
  if (stack)           p.set("stack",String(stack));
  if (hero)            p.set("hero",hero);
  if (villain)         p.set("villain",villain);
  if (villain2)        p.set("v2",villain2);
  if (openSize!=null)  p.set("os",String(openSize));
  if (threebetSize!=null) p.set("ts",String(threebetSize));
  if (betSize!=null)   p.set("bs",String(betSize));
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
    selected={mode:null,stack:100,hero:null,villain:null,villain2:null,openSize:null,threebetSize:null,betSize:null};
    refreshAll();
  }catch(e){
    console.error(e);
    showError("Nem sikerült betölteni a manifestet.");
  }
}

els.img.addEventListener("error",()=>showError("A kép nem tölthető be."));
init();
