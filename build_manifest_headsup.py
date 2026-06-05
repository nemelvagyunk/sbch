# build_manifest_headsup.py - HU (headsup, 2-handed) manifest.
# A HU charts csak SB/BB. Vonalak: sb_open, bb_vs_open, sb_vs_3bet, bb_vs_4bet, bb_vs_limp, sb_vs_iso.
# A nevek uj-formatumuak (buildNodeName), plusz az SB open kulon: "sb-Xbb-open".
import os, json, re
from datetime import datetime, timezone
from build_manifest import parse_new_name, BASE

GAME_FOLDER = "0.5bbante-headsup"
OUT = "manifest_headsup.json"
STACKS = [50, 100]

def parse_hu(base, file_path, stack):
    def mk(line, hero, open_size=None, threebet_size=None, fourbet_size=None, iso_size=None):
        return {"file": file_path, "line": line, "hero": hero, "stack": stack, "title": base,
                "open_size": open_size, "threebet_size": threebet_size,
                "fourbet_size": fourbet_size, "iso_size": iso_size}
    # SB open range: sb-Xbb-open
    mo = re.match(r'^sb-([0-9.]+)bb-open$', base)
    if mo:
        return mk("sb_open", "SB", open_size=float(mo.group(1)))
    steps, hero = parse_new_name(base)
    if hero is None:
        return None
    n = len(steps)
    types = [s[1] for s in steps]; poss = [s[0] for s in steps]
    # BB vs SB open: sb-Xbb-raise-bb
    if n == 1 and steps[0][0]=='sb' and types[0]=='R' and hero=='bb':
        return mk("bb_vs_open", "BB", open_size=steps[0][2])
    # SB vs BB 3bet: sb-Xbb-raise-bb-Ybb-raise-sb
    if n == 2 and types==['R','R'] and poss==['sb','bb'] and hero=='sb':
        return mk("sb_vs_3bet", "SB", open_size=steps[0][2], threebet_size=steps[1][2])
    # BB vs SB 4bet: sb-Xbb-raise-bb-Ybb-raise-sb-Zbb-raise-bb
    if n == 3 and types==['R','R','R'] and poss==['sb','bb','sb'] and hero=='bb':
        return mk("bb_vs_4bet", "BB", open_size=steps[0][2], threebet_size=steps[1][2], fourbet_size=steps[2][2])
    # BB vs SB limp: sb-limp-bb
    if n == 1 and steps[0][0]=='sb' and types[0]=='C' and hero=='bb':
        return mk("bb_vs_limp", "BB")
    # SB vs BB iso (limp utan): sb-limp-bb-Ybb-raise-sb
    if n == 2 and types==['C','R'] and poss==['sb','bb'] and hero=='sb':
        return mk("sb_vs_iso", "SB", iso_size=steps[1][2])
    return None

def build():
    charts=[]; skipped=[]
    for stack in STACKS:
        sp=os.path.join(BASE, GAME_FOLDER, str(stack))
        if not os.path.isdir(sp): continue
        for fn in sorted(os.listdir(sp)):
            if not fn.lower().endswith('.png'): continue
            base=fn[:-4]
            fpath=f"{GAME_FOLDER}/{stack}/{fn}"
            e=parse_hu(base, fpath, stack)
            if e: charts.append(e)
            else: skipped.append(fpath)
    out={"generated":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),"charts":charts}
    with open(os.path.join(BASE,OUT),"w",encoding="utf-8") as f:
        json.dump(out,f,ensure_ascii=False,indent=2)
    with open(os.path.join(BASE, OUT[:-5]+".js"),"w",encoding="utf-8") as f:
        f.write("window.__MANIFEST__ = "); json.dump(out,f,ensure_ascii=False); f.write(";\n")
    return charts,skipped

if __name__=="__main__":
    c,s=build()
    print(f"OK: {len(c)} chart -> {OUT}")
    if s: print(f"Kihagyva ({len(s)}): {s}")
