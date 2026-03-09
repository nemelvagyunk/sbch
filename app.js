const APP_VERSION = (window.__APP_VERSION__ || "dev");
const APP_MODE    = (window.__APP_MODE__    || "ante");   // "ante" | "noante"

const HERO_ALL       = ["UTG","HJ","CO","BU","SB","BB"];
const VILLAIN_ALL    = ["UTG","HJ","CO","BU","SB","BB"];
const ALL_OPEN_SIZES = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7];
// noante has no 75bb folder → strip 75 from stack list
const ALL_STACKS     = APP_MODE === "noante" ? [50, 100] : [50, 75, 100];

const HERO_POS_BY_MODE = {
  open:      ["UTG","HJ","CO","BU","SB"],
  raise:     ["HJ","CO","BU","SB","BB"],
  "3bet":    ["UTG","HJ","CO","BU","SB"],
  sqz:       ["UTG","HJ","CO","BU","SB","BB"],
  c4b:       ["CO","BU","SB","BB"],
  limp:      ["SB","BB"],
  faceiso:    ["UTG","HJ","CO","BU"],
  vsopenlimp: ["SB","BB","UTG","HJ","CO","BU"],
};
const VSOPENLIMP_VILLAINS = ["UTG","HJ","CO","BU"];
const faceisoVillains_unused=null;
function faceisoVillains(stack,hero){
  if(!stack||!hero)return["UTG","HJ","CO","BU","SB","BB"];
  return Object.keys(((index["faceiso"]||{})[String(stack)]||{})[hero]||{});
}
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

// DEFAULT_BET_SIZE[stack][openSize][hero=3bettor][villain=opener] — 100bb only
const DEFAULT_BET_SIZE = {
  100: {
    4:   { SB:{UTG:16,HJ:16,CO:16,BU:14}, BB:{UTG:18,HJ:18,CO:18,BU:18} },
    3:   { SB:{UTG:16,HJ:16,CO:14,BU:12}, BB:{UTG:18,HJ:18,CO:18,BU:18} },
    2.5: { SB:{UTG:14,HJ:14,CO:14,BU:12}, BB:{UTG:16,HJ:16,CO:16,BU:14} },
    2:   { SB:{UTG:14,HJ:14,CO:12,BU:12}, BB:{UTG:14,HJ:14,CO:14,BU:14} },
  },
};

function getDefaultBetSize(stack, openSize, hero, villain){
  return (DEFAULT_BET_SIZE[stack]?.[openSize]?.[hero]?.[villain]) ?? null;
}

const els = {
  miniHeader:  document.querySelector(".miniHeader"),
  status:      document.getElementById("status"),
  vsoplGroup:  document.getElementById("vsoplGroup"),
  row0divider: document.getElementById("row0divider"),
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
let selected = { mode:null, stack:100, hero:null, villain:null, villain2:null, openSize:null, threebetSize:null, betSize:null, limpSeq:null };

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
      if (f==="faceiso"||f==="vsopenlimp"){
        const sq=ch.seq_key||"_", vk=ch.villain||"_";
        if (!index[f])             index[f]={};
        if (!index[f][st])         index[f][st]={};
        if (!index[f][st][h])      index[f][st][h]={};
        if (!index[f][st][h][vk])  index[f][st][h][vk]={};
        index[f][st][h][vk][sq]=ch;
      } else {
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

function allRaiseOpenSizesForStack(stack){
  // collect all open sizes in raise mode regardless of hero/villain
  const all=new Set();
  for (const [h,villains] of Object.entries((index["raise"]||{})[String(stack)]||{}))
    for (const [v,sizes] of Object.entries(villains))
      for (const os of Object.keys(sizes))
        if (!isNaN(Number(os))) all.add(Number(os));
  return [...all].sort((a,b)=>a-b);
}

function pickChart(){
  const {mode,stack,hero,villain,villain2,openSize,threebetSize,betSize,limpSeq}=selected;
  if (!mode||!stack||!hero) return null;
  if (mode==="c4b"){
    if (!villain||!villain2) return null;
    return ((((indexC4b[String(stack)]||{})[hero]||{})[sqzKey(villain,villain2)]||{})[sk(openSize)]||{})[sk(threebetSize)]?.[sk(betSize)]||null;
  }
  if (mode==="faceiso"||mode==="vsopenlimp"){
    if (!villain||!limpSeq) return null;
    return ((((index[mode]||{})[String(stack)]||{})[hero]||{})[villain]||{})[limpSeq]||null;
  }
  if (mode==="limp"){
    if (hero==="BB") return ((((index["limp"]||{})[String(stack)]||{})["BB"]||{})["SB"]||{})[sk(openSize)]?.["_"]||null;
    return ((((index["limp"]||{})[String(stack)]||{})["SB"]||{})["BB"]||{})[sk(openSize)]?.[sk(betSize)]||null;
  }
  const vk=(mode==="sqz")?sqzKey(villain,villain2):(villain||"_");
  return ((((index[mode]||{})[String(stack)]||{})[hero]||{})[vk]||{})[sk(openSize)]?.[sk(betSize)]||null;
}

function sizeLabel(v){ return (Math.round(v)===v)?String(Math.round(v)):String(v); }
function allinClass(v){ return (v!=null&&selected.stack&&v>=selected.stack-1)?" allin":""; }

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
  // ── vsoplGroup: hidden in noante mode ──
  els.vsoplGroup.innerHTML="";
  if (APP_MODE === "noante"){
    els.vsoplGroup.style.display="none";
    if (els.row0divider) els.row0divider.style.display="none";
    // If current mode is one of the hidden modes, reset it
    if (selected.mode==="vsopenlimp"||selected.mode==="faceiso"){
      selected.mode=null;
    }
  } else {
    els.vsoplGroup.style.display="";
    if (els.row0divider) els.row0divider.style.display="";
    for (const m of [{key:"vsopenlimp",label:"Vs openlimp"},{key:"faceiso",label:"Open limp/vs iso"}]){
      const btn=mkBtn(m.label,()=>{
        selected.mode=m.key; selected.villain2=null;
        selected.threebetSize=null; selected.betSize=null; selected.limpSeq=null;
        syncHash(); refreshAll();
      });
      setBtnState(btn,{sel:selected.mode===m.key,dis:false});
      els.vsoplGroup.appendChild(btn);
    }
  }

  els.modeGroup.innerHTML="";
  for (const m of [{key:"open",label:"Open"},{key:"raise",label:"Facing open"},{key:"3bet",label:"Facing 3bet"},{key:"sqz",label:"SQZ"},{key:"c4b",label:"C4B"},{key:"limp",label:"BvB"}]){
    const btn=mkBtn(m.label,()=>{
      selected.mode=m.key; selected.villain2=null;
      selected.threebetSize=null; selected.betSize=null; selected.limpSeq=null;
      // set default hero only if none selected
      if (m.key==="raise"&&!selected.hero)      selected.hero="BB";
      else if (m.key==="3bet"&&!selected.hero)  selected.hero="UTG";
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
      selected.stack=s;
      selected.threebetSize=null; selected.betSize=null;
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
      selected.hero = (selected.hero===p) ? null : p;
      selected.threebetSize=null; selected.betSize=null; selected.limpSeq=null;
      syncHash(); refreshAll();
    },"hero");
    setBtnState(btn,{sel:selected.hero===p,dis:false});
    els.heroGroup.appendChild(btn);
  }
}

function renderVillain(){
  const grp = els.villainGroup;
  grp.innerHTML="";
  if (selected.mode==="limp"||selected.mode==="open"){ grp.style.display="none"; return; }
  grp.style.display="";

  function makeVillainBtn(p, isSel, isDis){
    const btn = document.createElement("button");
    btn.type="button";
    btn.className="btn villain";
    btn.textContent=p;
    btn.dataset.pos=p;
    if (isSel) btn.classList.add("selected");
    if (isDis){ btn.classList.add("disabled"); btn.disabled=true; }
    return btn;
  }

  if (selected.mode==="sqz"||selected.mode==="c4b"){
    const twoSel=!!(selected.villain&&selected.villain2);
    for (const p of VILLAIN_ALL){
      const isSel=selected.villain===p||selected.villain2===p;
      const isDis=!isSel&&twoSel;
      grp.appendChild(makeVillainBtn(p,isSel,isDis));
    }
    grp.onclick=function(e){
      const btn=e.target.closest("button[data-pos]");
      if (!btn||btn.disabled) return;
      const p=btn.dataset.pos;
      if (selected.villain===p) selected.villain=null;
      else if (selected.villain2===p) selected.villain2=null;
      else {
        let a=selected.villain, b=selected.villain2;
        if (!a) a=p; else b=p;
        if (a&&b&&POS_ORDER[a]>POS_ORDER[b]){const t=a;a=b;b=t;}
        selected.villain=a; selected.villain2=b;
      }
      selected.threebetSize=null; selected.betSize=null;
      syncHash(); refreshAll();
    };
    return;
  }

  if (selected.mode==="vsopenlimp"||selected.mode==="faceiso"){
    const vlist=selected.mode==="faceiso"?faceisoVillains(selected.stack,selected.hero):VSOPENLIMP_VILLAINS;
    for (const p of vlist){
      grp.appendChild(makeVillainBtn(p, selected.villain===p, false));
    }
  } else {
    for (const p of VILLAIN_ALL){
      grp.appendChild(makeVillainBtn(p, selected.villain===p, false));
    }
  }

  grp.onclick=function(e){
    const btn=e.target.closest("button[data-pos]");
    if (!btn||btn.disabled) return;
    const p=btn.dataset.pos;
    selected.villain = (selected.villain===p) ? null : p;
    selected.betSize=null; selected.limpSeq=null;
    syncHash(); refreshAll();
  };
}

function renderSize(){
  els.sizeGroup.innerHTML="";
  if ((selected.mode==="faceiso"||selected.mode==="vsopenlimp")&&selected.villain&&selected.hero&&selected.stack){
    const seqs=Object.keys((((index[selected.mode]||{})[String(selected.stack)]||{})[selected.hero]||{})[selected.villain]||{}).filter(k=>k!=="_").sort();
    for (const sq of seqs){
      const label=sq.replace(/-([0-9]+(?:[.][0-9]+)?bb)/g," $1").replace(/-/g," ").toLowerCase();
      const btn=mkBtn(label,()=>{ selected.limpSeq=sq; syncHash(); refreshAll(); },"size");
      setBtnState(btn,{sel:selected.limpSeq===sq,dis:false});
      els.sizeGroup.appendChild(btn);
    }
  } else if (selected.mode==="faceiso"||selected.mode==="vsopenlimp"){
    // villain or hero not yet selected — show nothing
  } else if (selected.mode==="limp"&&selected.hero&&selected.stack){
    for (const v of limpOpenSizes(selected.stack,selected.hero)){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.openSize=v; selected.betSize=null; syncHash(); refreshAll(); },"size"+allinClass(v));
      setBtnState(btn,{sel:selected.openSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
    if (selected.hero==="SB"&&selected.openSize!=null){
      for (const v of limpIsoSizes(selected.stack,selected.openSize)){
        const btn=mkBtn(sizeLabel(v)+"bb iso",()=>{ selected.betSize=v; syncHash(); refreshAll(); },"size"+allinClass(v));
        setBtnState(btn,{sel:selected.betSize===v,dis:false});
        els.sizeGroup.appendChild(btn);
      }
    }
  } else if (selected.mode==="c4b"){
    for (const v of c4bSizes(selected.stack,selected.hero,selected.villain,selected.villain2,selected.openSize,selected.threebetSize)){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.betSize=v; syncHash(); refreshAll(); },"size"+allinClass(v));
      setBtnState(btn,{sel:selected.betSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
  } else if (selected.mode==="sqz"){
    const openAvail=availableOpenSizes("sqz",selected.stack,selected.hero,selected.villain,selected.villain2);
    for (const v of openAvail){
      const btn=mkBtn("open "+sizeLabel(v)+"bb",()=>{ selected.openSize=v; selected.betSize=null; syncHash(); refreshAll(); },"size opensize"+allinClass(v));
      setBtnState(btn,{sel:selected.openSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
    const sqzAvail=availableBetSizes("sqz",selected.stack,selected.hero,selected.villain,selected.openSize,selected.villain2);
    if (sqzAvail.length>0){
      const div=document.createElement("span");
      div.className="divider"; div.textContent="|"; div.setAttribute("aria-hidden","true");
      els.sizeGroup.appendChild(div);
      for (const v of sqzAvail){
        const btn=mkBtn("sqz "+sizeLabel(v)+"bb",()=>{ selected.betSize=v; syncHash(); refreshAll(); },"size"+allinClass(v));
        setBtnState(btn,{sel:selected.betSize===v,dis:false});
        els.sizeGroup.appendChild(btn);
      }
    }
  } else if (selected.mode==="3bet"){
    for (const v of availableBetSizes("3bet",selected.stack,selected.hero,selected.villain,selected.openSize,null)){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.betSize=v; syncHash(); refreshAll(); },"size"+allinClass(v));
      setBtnState(btn,{sel:selected.betSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
  } else if (selected.mode==="raise") {
    // show all open sizes immediately — visible even before any selection
    const avail = (selected.stack && Object.keys(index["raise"]||{}).length>0) ? allRaiseOpenSizesForStack(selected.stack) : ALL_OPEN_SIZES;
    for (const v of avail){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.openSize=v; selected.betSize=null; syncHash(); refreshAll(); },"size"+allinClass(v));
      setBtnState(btn,{sel:selected.openSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
  } else if (selected.mode!=="faceiso"&&selected.mode!=="vsopenlimp") {
    const avail=availableOpenSizes(selected.mode,selected.stack,selected.hero,selected.villain);
    for (const v of avail){
      const btn=mkBtn(sizeLabel(v)+"bb",()=>{ selected.openSize=v; selected.betSize=null; syncHash(); refreshAll(); },"size"+allinClass(v));
      setBtnState(btn,{sel:selected.openSize===v,dis:false});
      els.sizeGroup.appendChild(btn);
    }
  }
}

function applyDefaultsOpen(){
  if (selected.mode!=="open"||!selected.stack||!selected.hero) return;
  if (selected.openSize==null){
    const avail=availableOpenSizes("open",selected.stack,selected.hero,"_");
    if (avail.includes(2.5)) selected.openSize=2.5; else if (avail.includes(4)) selected.openSize=4; else if (avail.length===1) selected.openSize=avail[0];
  }
}
function applyDefaultsRaise(){
  if (selected.mode!=="raise"||!selected.stack||!selected.hero) return;
  if (selected.openSize==null){
    const avail=availableOpenSizes("raise",selected.stack,selected.hero,selected.villain);
    if (avail.includes(2.5)) selected.openSize=2.5; else if (avail.includes(4)) selected.openSize=4; else if (avail.length===1) selected.openSize=avail[0];
  }
}
function applyDefaults3bet(){
  if ((selected.mode!=="3bet"&&selected.mode!=="sqz")||!selected.stack||!selected.hero||!selected.villain) return;
  if (selected.mode==="sqz"&&!selected.villain2) return;
  if (selected.openSize==null){
    const def=selected.mode==="sqz"
      ? DEFAULT_OPEN_SIZE_BY_HERO[selected.villain]
      : DEFAULT_OPEN_SIZE_BY_HERO[selected.hero];
    const avail=availableOpenSizes(selected.mode,selected.stack,selected.hero,selected.villain,selected.villain2);
    if (def!=null&&avail.includes(def)) selected.openSize=def;
    else if (avail.length===1) selected.openSize=avail[0];
    else if (selected.mode==="sqz"&&avail.length>0) selected.openSize=avail[0];
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
function applyDefaultsOpenLimp(){
  if ((selected.mode!=="faceiso"&&selected.mode!=="vsopenlimp")||!selected.stack||!selected.hero||!selected.villain) return;
  if (selected.limpSeq==null){
    const keys=Object.keys((((index[selected.mode]||{})[String(selected.stack)]||{})[selected.hero]||{})[selected.villain]||{}).filter(k=>k!=="_").sort();
    if (keys.length>0) selected.limpSeq=keys[0];
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
  const frame=document.querySelector(".frame");
  let noChartMsg=document.getElementById("noChartMsg");
  if (!noChartMsg){
    noChartMsg=document.createElement("div");
    noChartMsg.id="noChartMsg";
    noChartMsg.className="noChartMsg";
    frame.appendChild(noChartMsg);
  }
  // only show "Nincs ilyen chart" if something meaningful is selected
  const hasSelection = selected.mode && (selected.hero||selected.villain||selected.openSize);
  if (chart){
    els.img.src=chart.file;
    els.img.style.display="";
    noChartMsg.style.display="none";
  } else if (hasSelection){
    els.img.removeAttribute("src");
    els.img.style.display="none";
    noChartMsg.textContent="Nincs ilyen chart";
    noChartMsg.style.display="";
  } else {
    els.img.removeAttribute("src");
    els.img.style.display="";
    noChartMsg.style.display="none";
  }
}
// Modes where villain row appears ABOVE hero row
const VILLAIN_FIRST_MODES = ["raise","3bet","sqz","c4b"];

function applyLayout(){
  const row2 = document.getElementById("row2");
  const row3 = document.getElementById("row3");
  if (!row2||!row3) return;
  if (VILLAIN_FIRST_MODES.includes(selected.mode)){
    row2.appendChild(els.villainGroup);
    row3.appendChild(els.heroGroup);
  } else {
    row2.appendChild(els.heroGroup);
    row3.appendChild(els.villainGroup);
  }
}

function resetAll(){
  selected={mode:"raise",stack:100,hero:null,villain:null,villain2:null,openSize:null,threebetSize:null,betSize:null,limpSeq:null};
  syncHash(); refreshAll();
}

function refreshAll(){ applyDefaultsOpen(); applyDefaultsRaise(); applyDefaults3bet(); applyDefaultsC4b(); applyDefaultsLimp(); applyDefaultsOpenLimp(); applyLayout(); renderMode(); renderStack(); renderHero(); renderVillain(); renderSize(); renderChart(); }

function syncHash(){
  const {mode,stack,hero,villain,villain2,openSize,threebetSize,betSize,limpSeq}=selected;
  const p=new URLSearchParams();
  if (mode)            p.set("mode",mode);
  if (stack)           p.set("stack",String(stack));
  if (hero)            p.set("hero",hero);
  if (villain)         p.set("villain",villain);
  if (villain2)        p.set("v2",villain2);
  if (openSize!=null)  p.set("os",String(openSize));
  if (threebetSize!=null) p.set("ts",String(threebetSize));
  if (betSize!=null)   p.set("bs",String(betSize));
  if (limpSeq)         p.set("lq",limpSeq);
  const h=p.toString();
  if (h!==window.location.hash.replace(/^#/,"")) window.history.replaceState(null,"","#"+h);
}

async function init(){
  try{
    const manifestFile = APP_MODE === "noante" ? "manifest_noante.json" : "manifest.json";
    const res=await fetch(`${manifestFile}?v=${encodeURIComponent(APP_VERSION)}`,{cache:"no-store"});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    manifest=data.charts||[];
    buildIndex();
    if (!ALL_STACKS.includes(selected.stack)) selected.stack = ALL_STACKS[ALL_STACKS.length-1];
    selected={...selected,mode:"raise",hero:null,villain:null,villain2:null,openSize:null,threebetSize:null,betSize:null,limpSeq:null};
    // inject reset button into appNav once
    const nav = document.querySelector(".appNav");
    if (nav && !nav.querySelector(".resetBtn")){
      const rb = document.createElement("button");
      rb.type="button"; rb.className="btn appNavBtn resetBtn"; rb.textContent="Reset";
      rb.addEventListener("click", resetAll);
      nav.appendChild(rb);
    }
    refreshAll();
  }catch(e){
    console.error(e);
    showError("Nem sikerült betölteni a manifestet.");
  }
}

els.img.addEventListener("error",()=>showError("A kép nem tölthető be."));
init();

// ── Keyboard shortcuts ──────────────────────────────────────────────
const KEY_MODE = {
  q:"open", w:"raise", e:"3bet", r:"sqz", t:"c4b", z:"limp"
};
const KEY_VILLAIN = {
  a:"UTG", s:"HJ", d:"CO", f:"BU", g:"SB", h:"BB"
};
// Í = key code varies by layout; we match by key value
const KEY_HERO = {
  "í":"UTG", y:"HJ", x:"CO", c:"BU", v:"SB", b:"BB"
};

document.addEventListener("keydown", function(e){
  // ignore when typing in an input
  if (e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
  const k = e.key.toLowerCase();

  if (KEY_MODE[k]!==undefined){
    const newMode = KEY_MODE[k];
    if (selected.mode===newMode){ selected.mode=null; }
    else {
      selected.mode=newMode;
      selected.villain2=null; selected.threebetSize=null; selected.betSize=null; selected.limpSeq=null;
      if (newMode==="raise"&&!selected.hero) selected.hero="BB";
      else if (newMode==="3bet"&&!selected.hero) selected.hero="UTG";
    }
    syncHash(); refreshAll(); return;
  }

  if (KEY_VILLAIN[k]!==undefined){
    const p=KEY_VILLAIN[k];
    if (selected.mode==="sqz"||selected.mode==="c4b"){
      if (selected.villain===p) selected.villain=null;
      else if (selected.villain2===p) selected.villain2=null;
      else if (!selected.villain) selected.villain=p;
      else if (!selected.villain2){
        let a=selected.villain, b=p;
        if (POS_ORDER[a]>POS_ORDER[b]){const t=a;a=b;b=t;}
        selected.villain=a; selected.villain2=b;
      }
      selected.threebetSize=null; selected.betSize=null;
    } else {
      selected.villain=(selected.villain===p)?null:p;
      selected.betSize=null; selected.limpSeq=null;
    }
    syncHash(); refreshAll(); return;
  }

  if (KEY_HERO[k]!==undefined){
    const p=KEY_HERO[k];
    selected.hero=(selected.hero===p)?null:p;
    selected.threebetSize=null; selected.betSize=null; selected.limpSeq=null;
    syncHash(); refreshAll(); return;
  }

  // Number keys 1-9 → open size by index (sorted ascending)
  const numMatch = k.match(/^([1-9])$/);
  if (numMatch){
    const idx = parseInt(numMatch[1]) - 1;
    // collect current visible sizes same way renderSize does
    let sizes = [];
    if (selected.mode==="raise"){
      sizes = (selected.stack && Object.keys(index["raise"]||{}).length>0)
        ? allRaiseOpenSizesForStack(selected.stack)
        : ALL_OPEN_SIZES;
    } else if (selected.mode==="open"){
      sizes = availableOpenSizes("open", selected.stack, selected.hero, "_");
    } else if (selected.mode==="3bet"){
      // bet sizes for 3bet
      sizes = availableBetSizes("3bet", selected.stack, selected.hero, selected.villain, selected.openSize, null);
    } else {
      sizes = availableOpenSizes(selected.mode, selected.stack, selected.hero, selected.villain);
    }
    if (idx >= 0 && idx < sizes.length){
      const v = sizes[idx];
      if (selected.mode==="3bet"){
        selected.betSize = (selected.betSize===v) ? null : v;
      } else {
        selected.openSize = (selected.openSize===v) ? null : v;
        selected.betSize = null;
      }
      syncHash(); refreshAll();
    }
    return;
  }
});

// ── Extra shortcuts ─────────────────────────────────────────────────
document.addEventListener("keydown", function(e){
  if (e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
  const k = e.key.toLowerCase();
  if (k==="ö"){ resetAll(); return; }
  if (k==="ü"){ selected.stack=50;  selected.threebetSize=null; selected.betSize=null; syncHash(); refreshAll(); return; }
  if (k==="ó"){ selected.stack=100; selected.threebetSize=null; selected.betSize=null; syncHash(); refreshAll(); return; }
});
