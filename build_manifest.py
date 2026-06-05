# build_manifest.py - uj-formatumu (buildNodeName) PNG nevekbol manifest.
# A PNG nev a teljes akcio-szekvencia: "<poz>-<size>bb-raise" / "<poz>-limp" / "<poz>-call" / "<poz>-check",
# a vegen a hos pozicioja. A facing-tipust a szekvenciabol vezetjuk le.
# Mappa-strukturа: <game_folder>/<stack>/<size-mappa | bvb | limp>/<nev>.png
import os, json, re
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
POS = r'(?:utg|hj|co|bu|sb|bb)'
SB_OPEN_BB = 4  # SB open default size (bvb-ben, ahol a nev nem kodolja a meretet) - sbante6max

def parse_new_name(base):
    """A nevet (poz, type, size) lepesekre + hos pozaciora bontja. type: R/C/X."""
    rest = base.lower(); steps = []
    while rest:
        m = re.match(rf'^({POS})-([0-9.]+)bb-raise(?:-(.*))?$', rest)
        if m:
            steps.append((m.group(1), 'R', float(m.group(2)))); rest = m.group(3) or ''; continue
        m = re.match(rf'^({POS})-(limp|call|check)(?:-(.*))?$', rest)
        if m:
            act = m.group(2); t = 'X' if act == 'check' else 'C'
            steps.append((m.group(1), t, 0.5 if act == 'limp' else None)); rest = m.group(3) or ''; continue
        break
    hero = rest if re.match(rf'^{POS}$', rest) else None
    return steps, hero

def _raw(v): return (f"{v}bb" if v is not None else None)

def _entry(file_path, facing, hero, villain, stack, title,
           villain2=None, open_size=None, threebet_size=None, iso_size=None, c4b_size=None, seq_key=None):
    U = lambda p: (p.upper() if p else None)
    return {
        "file": file_path, "facing": facing,
        "hero": U(hero), "villain": U(villain), "villain2": U(villain2),
        "stack": stack, "title": title,
        "open_size": open_size, "open_size_raw": _raw(open_size),
        "threebet_size": threebet_size, "threebet_size_raw": _raw(threebet_size),
        "iso_size": iso_size, "iso_size_raw": _raw(iso_size),
        "c4b_size": c4b_size, "c4b_size_raw": _raw(c4b_size),
        "seq_key": seq_key,
    }

def parse_chart(base, stack, folder, folder_open, file_path):
    steps, hero = parse_new_name(base)
    if hero is None: return None
    n = len(steps)
    E = lambda **kw: _entry(file_path, hero=hero, stack=stack, title=base, **kw)

    # --- BvB (blind-vs-blind, "limp" mode) ---
    # BB szembe SB open/limp:
    if hero == 'bb' and n == 1 and steps[0][0] == 'sb':
        return E(facing='limp', villain='sb', open_size=(steps[0][2] if steps[0][1] == 'R' else 0.5))
    # SB szembe BB iso (SB limp utan):
    if hero == 'sb' and n == 2 and steps[0] == ('sb','C',0.5) and steps[1][0] == 'bb' and steps[1][1] == 'R':
        return E(facing='limp', villain='bb', open_size=0.5, iso_size=steps[1][2])

    # --- limp-pot tobbutas (faceiso / vsopenlimp) ---
    if folder == 'limp':
        first = steps[0][0] if steps else None
        raisers = [s[0] for s in steps if s[1] == 'R']
        if first and hero == first:
            return E(facing='faceiso', villain=(raisers[-1] if raisers else None), seq_key=base)
        return E(facing='vsopenlimp', villain=first, seq_key=base)

    # --- meret-mappak (szekvencia szerinti facing) ---
    if n == 0:
        # open-decision node (pl. SB open a bvb mappaban): a nev nem kodolja a meretet.
        osz = folder_open if folder_open is not None else SB_OPEN_BB
        return E(facing='open', villain=None, open_size=osz)
    if n == 1:
        s = steps[0]
        if s[1] == 'R':
            return E(facing='raise', villain=s[0], open_size=s[2])
        return E(facing='limp', villain=s[0], open_size=0.5)
    if n == 2:
        a, b = steps
        if a[1] == 'R' and b[1] == 'R':
            if hero == a[0]:
                return E(facing='3bet', villain=b[0], open_size=a[2], threebet_size=b[2])
            return E(facing='c4b', villain=a[0], villain2=b[0], open_size=a[2], threebet_size=b[2])
        if a[1] == 'R' and b[1] in ('C','X'):
            return E(facing='sqz', villain=a[0], villain2=b[0], open_size=a[2])
    if n == 3:
        a, b, c = steps
        if a[1] == 'R' and b[1] in ('C','X') and c[1] == 'R':
            return E(facing='fsqz', villain=b[0], villain2=c[0], open_size=a[2], threebet_size=c[2])
        if a[1] == 'R' and b[1] == 'R' and c[1] == 'R':
            return E(facing='f4b', villain=a[0], open_size=b[2], threebet_size=c[2])
    return None

def build(game_folder, out_file, stacks):
    charts = []; skipped = []
    for stack in stacks:
        sp = os.path.join(BASE, game_folder, str(stack))
        if not os.path.isdir(sp): continue
        for sub in sorted(os.listdir(sp)):
            subp = os.path.join(sp, sub)
            if not os.path.isdir(subp): continue
            mo = re.match(r'^([0-9.]+)bb$', sub)
            if mo: folder = 'size'; folder_open = float(mo.group(1))
            elif sub in ('bvb','limp'): folder = sub; folder_open = None
            else: continue
            for fn in sorted(os.listdir(subp)):
                if not fn.lower().endswith('.png'): continue
                base = fn[:-4]
                fpath = f"{game_folder}/{stack}/{sub}/{fn}"
                e = parse_chart(base, stack, folder, folder_open, fpath)
                if e: charts.append(e)
                else: skipped.append(fpath)
    out = {"generated": datetime.now(timezone.utc).isoformat().replace("+00:00","Z"), "charts": charts}
    with open(os.path.join(BASE, out_file), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    # file:// (dupla katt) eseten a bongeszo nem fetch-eli a JSON-t -> JS-globalt is irunk.
    js_file = (out_file[:-5] if out_file.endswith(".json") else out_file) + ".js"
    with open(os.path.join(BASE, js_file), "w", encoding="utf-8") as f:
        f.write("window.__MANIFEST__ = ")
        json.dump(out, f, ensure_ascii=False)
        f.write(";\n")
    return charts, skipped

# Profil: game-folder -> manifest fajl + stackek
PROFILE = {"game_folder": "0.5bbante-6max", "out_file": "manifest.json", "stacks": [50, 100]}

def main():
    charts, skipped = build(PROFILE["game_folder"], PROFILE["out_file"], PROFILE["stacks"])
    print(f"OK: {len(charts)} chart -> {PROFILE['out_file']}")
    if skipped:
        print(f"Kihagyva ({len(skipped)}): {skipped[:20]}")

if __name__ == "__main__":
    main()
