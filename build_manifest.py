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

    def entry(facing, hero, villain, open_size, bet_size, villain2=None, iso_size=None, c4b_size=None):
        return {
            "file": file_path, "facing": facing,
            "hero": hero, "villain": villain, "villain2": villain2,
            "stack": stack, "title": base,
            "open_size": open_size,
            "open_size_raw": f"{open_size}bb" if open_size else None,
            "threebet_size": bet_size,
            "threebet_size_raw": f"{bet_size}bb" if bet_size else None,
            "iso_size": iso_size,
            "iso_size_raw": f"{iso_size}bb" if iso_size else None,
            "c4b_size": c4b_size,
            "c4b_size_raw": f"{c4b_size}bb" if c4b_size else None,
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

    # 3. SQZ
    sqz_m = re.match(
        r"^(UTG|HJ|CO|BU|SB|BB)-vs-(UTG|HJ|CO|BU|SB|BB)-OPEN-([0-9]+(?:[.][0-9]+)?)bb-(UTG|HJ|CO|BU|SB|BB)-CALL-SQZ-([0-9]+(?:[.][0-9]+)?)bb$",
        base, re.IGNORECASE)
    if sqz_m:
        return entry("sqz", sqz_m.group(1).upper(), sqz_m.group(2).upper(),
                     _parse_size(sqz_m.group(3)+"bb"), _parse_size(sqz_m.group(5)+"bb"),
                     villain2=sqz_m.group(4).upper())

    # 4. C4B
    c4b_m = re.match(
        r"^(UTG|HJ|CO|BU|SB|BB)-vs-(UTG|HJ|CO|BU|SB|BB)-OPEN-([0-9]+(?:[.][0-9]+)?)bb-(UTG|HJ|CO|BU|SB|BB)-3BET-([0-9]+(?:[.][0-9]+)?)bb$",
        base, re.IGNORECASE)
    if c4b_m:
        return entry("c4b", c4b_m.group(1).upper(), c4b_m.group(2).upper(),
                     _parse_size(c4b_m.group(3)+"bb"), _parse_size(c4b_m.group(5)+"bb"),
                     villain2=c4b_m.group(4).upper())

    # 5. Facing limp BB with size — BB-vs-SB-OPEN-4bb.png
    bvb_m = re.match(r"^BB-vs-SB-OPEN-([0-9]+(?:[.][0-9]+)?)bb$", base, re.IGNORECASE)
    if bvb_m:
        return entry("limp", "BB", "SB", _parse_size(bvb_m.group(1)+"bb"), None)

    # 6. Facing limp BB no size — SB-Complete-BB.png
    if re.match(r"^SB-Complete-BB$", base, re.IGNORECASE):
        return entry("limp", "BB", "SB", 0.5, None)

    # 7. Facing limp SB — SB-LIMP-0.5bb-vs-BB-ISO-6bb.png
    iso_m = re.match(r"^SB-LIMP-([0-9]+(?:[.][0-9]+)?)bb-vs-BB-ISO-([0-9]+(?:[.][0-9]+)?)bb$", base, re.IGNORECASE)
    if iso_m:
        return entry("limp", "SB", "BB", _parse_size(iso_m.group(1)+"bb"), None,
                     iso_size=_parse_size(iso_m.group(2)+"bb"))

    # Skip SB-LIMP in charts folders
    if re.search(r"SB-LIMP", base, re.IGNORECASE):
        return None

    # 8. Facing open: BB-vs-BU-OPEN-2.5bb.png or BB-vs-BU.png
    fop_m = re.match(
        r"^(UTG|HJ|CO|BU|SB|BB)-vs-(UTG|HJ|CO|BU|SB|BB)(?:-OPEN-([0-9]+(?:[.\-][0-9]+)?)bb)?$",
        base, re.IGNORECASE)
    if fop_m:
        hero      = fop_m.group(1).upper()
        villain   = fop_m.group(2).upper()
        open_size = _parse_size(fop_m.group(3)+"bb") if fop_m.group(3) else folder_open_size
        return entry("raise", hero, villain, open_size, None)

    # Skip SB-LIMP and BB-ISO in charts folders (belong in bvb folder)
    if re.search(r'(SB-LIMP|BB-ISO)', base, re.IGNORECASE):
        return None

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
        bvb_path = os.path.join(stack_path, "bvb")
        if os.path.isdir(bvb_path):
            for fn in sorted(os.listdir(bvb_path)):
                if not re.search(r"\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE):
                    continue
                info = parse_chart_filename(fn, stack, None, "bvb", stack_folder)
                if info:
                    charts.append(info)
                else:
                    skipped.append(f"{stack_folder}/bvb/{fn}")
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
