import os, json, re
from datetime import datetime, timezone

BASE = os.path.dirname(__file__)

STACK_SIZES = [50, 75, 100]

OPEN_SIZE_FOLDERS = {
    "charts2bb":   2.0,
    "charts2-5bb": 2.5,
    "charts3bb":   3.0,
    "charts3-5bb": 3.5,
    "charts4bb":   4.0,
    "charts4-5bb": 4.5,
    "charts5bb":   5.0,
    "charts6bb":   6.0,
    "charts7bb":   7.0,
}

def _parse_size(token):
    if not token: return None
    s = token.strip().lower().replace("bb","").replace("-",".")
    try: return float(s)
    except: return None

def parse_chart_filename(filename, stack, folder_open_size, folder_name, stack_folder):
    m = re.match(r"^(.*)\.(png|jpg|jpeg|webp)$", filename, re.IGNORECASE)
    if not m: return None
    base = m.group(1)
    file_path = f"{stack_folder}/{folder_name}/{filename}"

    def entry(facing, hero, villain, open_size, bet_size):
        return {
            "file": file_path,
            "facing": facing,
            "hero": hero,
            "villain": villain,
            "stack": stack,
            "title": base,
            "open_size": open_size,
            "open_size_raw": f"{open_size}bb" if open_size else None,
            "threebet_size": bet_size,
            "threebet_size_raw": f"{bet_size}bb" if bet_size else None,
        }

    # 1. Open RFI: UTG-OPEN.png or UTG-OPEN-2.5bb.png
    rfi_m = re.match(r"^(UTG|HJ|CO|BU|SB|BB)-OPEN(?:-([0-9]+(?:[.\-][0-9]+)?)bb)?$", base, re.IGNORECASE)
    if rfi_m:
        hero      = rfi_m.group(1).upper()
        open_size = _parse_size(rfi_m.group(2)+"bb") if rfi_m.group(2) else folder_open_size
        return entry("open", hero, None, open_size, None)

    # 2. Facing 3bet: BU-OPEN-2.5bb-vs-BB-3BET-13bb.png or BU-vs-BB-3BET-13bb.png
    f3b_m = re.match(
        r"^(UTG|HJ|CO|BU|SB|BB)(?:-OPEN-([0-9]+(?:[.\-][0-9]+)?)bb)?-vs-(UTG|HJ|CO|BU|SB|BB)-3BET-([0-9]+(?:[.\-][0-9]+)?)bb$",
        base, re.IGNORECASE)
    if f3b_m:
        hero      = f3b_m.group(1).upper()
        open_size = _parse_size(f3b_m.group(2)+"bb") if f3b_m.group(2) else folder_open_size
        villain   = f3b_m.group(3).upper()
        bet_size  = _parse_size(f3b_m.group(4)+"bb")
        return entry("3bet", hero, villain, open_size, bet_size)

    # 3. Facing open: BB-vs-BU-OPEN-2.5bb.png or BB-vs-BU.png
    fop_m = re.match(
        r"^(UTG|HJ|CO|BU|SB|BB)-vs-(UTG|HJ|CO|BU|SB|BB)(?:-OPEN-([0-9]+(?:[.\-][0-9]+)?)bb)?$",
        base, re.IGNORECASE)
    if fop_m:
        hero      = fop_m.group(1).upper()
        villain   = fop_m.group(2).upper()
        open_size = _parse_size(fop_m.group(3)+"bb") if fop_m.group(3) else folder_open_size
        return entry("raise", hero, villain, open_size, None)

    return None

def main():
    charts  = []
    skipped = []

    for stack in STACK_SIZES:
        stack_folder = str(stack)
        stack_path   = os.path.join(BASE, stack_folder)
        if not os.path.isdir(stack_path):
            print(f"Nem található: {stack_folder}/ (kihagyva)")
            continue
        for folder_name, open_size in OPEN_SIZE_FOLDERS.items():
            folder_path = os.path.join(stack_path, folder_name)
            if not os.path.isdir(folder_path):
                continue
            for fn in sorted(os.listdir(folder_path)):
                if not re.search(r"\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE):
                    continue
                info = parse_chart_filename(fn, stack, open_size, folder_name, stack_folder)
                if info:
                    charts.append(info)
                else:
                    skipped.append(f"{stack_folder}/{folder_name}/{fn}")

    generated = datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
    out = {"generated": generated, "charts": charts}

    with open(os.path.join(BASE, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(charts)} chart -> manifest.json")
    if skipped:
        print(f"Kihagyva ({len(skipped)}): {skipped}")

if __name__ == "__main__":
    main()
