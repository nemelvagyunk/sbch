// headsup.js - HU (2-handed, SB vs BB) chart-nezo. Onnallo, kis logika.
const APP_VERSION = (window.__APP_VERSION__ || "dev");

const HU_LINES = [
  { key:"sb_open",    label:"SB open",    hero:"SB" },
  { key:"bb_vs_open", label:"BB vs open", hero:"BB" },
  { key:"sb_vs_3bet", label:"SB vs 3bet", hero:"SB" },
  { key:"bb_vs_4bet", label:"BB vs 4bet", hero:"BB" },
  { key:"bb_vs_limp", label:"BB vs limp", hero:"BB" },
  { key:"sb_vs_iso",  label:"SB vs iso",  hero:"SB" },
];
const NEEDS_OPEN = ["sb_open","bb_vs_open","sb_vs_3bet","bb_vs_4bet"];
const NEEDS_3BET = ["sb_vs_3bet","bb_vs_4bet"];

let manifest = [];
let sel = { line:"sb_open", stack:100, openSize:null, threebetSize:null, fourbetSize:null, isoSize:null };

const els = {
  status:     document.getElementById("status"),
  miniHeader: document.querySelector(".miniHeader"),
  lineGroup:  document.getElementById("lineGroup"),
  stackGroup: document.getElementById("stackGroup"),
  sizeGroup:  document.getElementById("sizeGroup"),
  img:        document.getElementById("chartImg"),
};

const uniqSorted = a => [...new Set(a)].sort((x,y)=>x-y);
const openSizesFor   = line     => uniqSorted(manifest.filter(c=>c.line===line&&c.stack===sel.stack&&c.open_size!=null).map(c=>c.open_size));
const threebetSizesFor=(line,os)=> uniqSorted(manifest.filter(c=>c.line===line&&c.stack===sel.stack&&c.open_size===os&&c.threebet_size!=null).map(c=>c.threebet_size));
const fourbetSizesFor=(os,ts)   => uniqSorted(manifest.filter(c=>c.line==="bb_vs_4bet"&&c.stack===sel.stack&&c.open_size===os&&c.threebet_size===ts&&c.fourbet_size!=null).map(c=>c.fourbet_size));
const isoSizesFor    = ()       => uniqSorted(manifest.filter(c=>c.line==="sb_vs_iso"&&c.stack===sel.stack&&c.iso_size!=null).map(c=>c.iso_size));
const stacksAvail    = ()       => uniqSorted(manifest.map(c=>c.stack));

function pickChart(){
  const {line,stack,openSize,threebetSize,fourbetSize,isoSize}=sel;
  return manifest.find(c=>{
    if (c.line!==line || c.stack!==stack) return false;
    if (line==="sb_open"||line==="bb_vs_open") return c.open_size===openSize;
    if (line==="sb_vs_3bet") return c.open_size===openSize && c.threebet_size===threebetSize;
    if (line==="bb_vs_4bet") return c.open_size===openSize && c.threebet_size===threebetSize && c.fourbet_size===fourbetSize;
    if (line==="bb_vs_limp") return true;
    if (line==="sb_vs_iso")  return c.iso_size===isoSize;
    return false;
  }) || null;
}

function applyDefaults(){
  if (NEEDS_OPEN.includes(sel.line)){
    const os=openSizesFor(sel.line);
    if (sel.openSize==null || !os.includes(sel.openSize)) sel.openSize = os.includes(2.5)?2.5:(os.length?os[0]:null);
  }
  if (NEEDS_3BET.includes(sel.line)){
    const ts=threebetSizesFor(sel.line,sel.openSize);
    if (sel.threebetSize==null || !ts.includes(sel.threebetSize)) sel.threebetSize = ts.length?ts[0]:null;
  }
  if (sel.line==="bb_vs_4bet"){
    const fs=fourbetSizesFor(sel.openSize,sel.threebetSize);
    if (sel.fourbetSize==null || !fs.includes(sel.fourbetSize)) sel.fourbetSize = fs.length?fs[0]:null;
  }
  if (sel.line==="sb_vs_iso"){
    const is=isoSizesFor();
    if (sel.isoSize==null || !is.includes(sel.isoSize)) sel.isoSize = is.length?is[0]:null;
  }
}

function showError(m){ els.status.textContent=m; els.miniHeader.classList.add("visible"); }
function clearError(){ els.miniHeader.classList.remove("visible"); }
function sizeLabel(v){ return String(v); }
function mkBtn(label,onClick,cls=""){ const b=document.createElement("button"); b.type="button"; b.className="btn"+(cls?" "+cls:""); b.textContent=label; b.addEventListener("click",onClick); return b; }
function divider(){ const d=document.createElement("span"); d.className="divider"; d.textContent="|"; d.setAttribute("aria-hidden","true"); return d; }

function renderLines(){
  els.lineGroup.innerHTML="";
  for (const L of HU_LINES){
    const b=mkBtn(L.label,()=>{ sel.line=L.key; sel.openSize=null; sel.threebetSize=null; sel.fourbetSize=null; sel.isoSize=null; refresh(); }, L.hero==="SB"?"hero":"villain");
    b.classList.toggle("selected", sel.line===L.key);
    els.lineGroup.appendChild(b);
  }
}
function renderStack(){
  els.stackGroup.innerHTML="";
  const stacks=stacksAvail();
  if (stacks.length<=1){ els.stackGroup.style.display="none"; return; }
  els.stackGroup.style.display="";
  for (const s of stacks){
    const b=mkBtn(String(s),()=>{ sel.stack=s; sel.openSize=null;sel.threebetSize=null;sel.fourbetSize=null;sel.isoSize=null; refresh(); },"size");
    b.classList.toggle("selected", sel.stack===s);
    els.stackGroup.appendChild(b);
  }
}
function renderSizes(){
  const g=els.sizeGroup; g.innerHTML="";
  const line=sel.line;
  if (NEEDS_OPEN.includes(line)){
    for (const v of openSizesFor(line)){
      const b=mkBtn(sizeLabel(v)+"bb",()=>{ sel.openSize=v; sel.threebetSize=null; sel.fourbetSize=null; refresh(); },"size opensize");
      b.classList.toggle("selected", sel.openSize===v); g.appendChild(b);
    }
  }
  if (NEEDS_3BET.includes(line)){
    const ts=threebetSizesFor(line,sel.openSize);
    if (ts.length){ g.appendChild(divider());
      for (const v of ts){ const b=mkBtn("3bet "+sizeLabel(v)+"bb",()=>{ sel.threebetSize=v; sel.fourbetSize=null; refresh(); },"size");
        b.classList.toggle("selected", sel.threebetSize===v); g.appendChild(b); }
    }
  }
  if (line==="bb_vs_4bet"){
    const fs=fourbetSizesFor(sel.openSize,sel.threebetSize);
    if (fs.length){ g.appendChild(divider());
      for (const v of fs){ const b=mkBtn("4bet "+sizeLabel(v)+"bb",()=>{ sel.fourbetSize=v; refresh(); },"size");
        b.classList.toggle("selected", sel.fourbetSize===v); g.appendChild(b); }
    }
  }
  if (line==="sb_vs_iso"){
    for (const v of isoSizesFor()){ const b=mkBtn("iso "+sizeLabel(v)+"bb",()=>{ sel.isoSize=v; refresh(); },"size");
      b.classList.toggle("selected", sel.isoSize===v); g.appendChild(b); }
  }
}
function renderChart(){
  const c=pickChart();
  if (c){ els.img.src=c.file; els.img.style.display=""; clearError(); }
  else { els.img.removeAttribute("src"); els.img.style.display="none"; showError("Nincs ilyen chart"); }
}
function syncHash(){
  const p=new URLSearchParams();
  p.set("line",sel.line); p.set("stack",String(sel.stack));
  if (sel.openSize!=null)    p.set("os",String(sel.openSize));
  if (sel.threebetSize!=null)p.set("ts",String(sel.threebetSize));
  if (sel.fourbetSize!=null) p.set("fs",String(sel.fourbetSize));
  if (sel.isoSize!=null)     p.set("is",String(sel.isoSize));
  history.replaceState(null,"","#"+p.toString());
}
function refresh(){ applyDefaults(); renderLines(); renderStack(); renderSizes(); renderChart(); syncHash(); }

async function init(){
  try{
    let data;
    if (window.__MANIFEST__) { data = window.__MANIFEST__; }
    else {
      const res=await fetch(`manifest_headsup.json?v=${encodeURIComponent(APP_VERSION)}`,{cache:"no-store"});
      if(!res.ok) throw new Error("HTTP "+res.status);
      data=await res.json();
    }
    manifest=data.charts||[];
    const stacks=stacksAvail(); if(stacks.length && !stacks.includes(sel.stack)) sel.stack=stacks[stacks.length-1];
    refresh();
  }catch(e){ console.error(e); showError("Nem sikerült betölteni a HU manifestet."); }
}
els.img.addEventListener("error",()=>showError("A kép nem tölthető be."));
init();
