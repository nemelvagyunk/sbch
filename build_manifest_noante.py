"""
build_manifest_noante.py
Scans  noante/100/<chartsXbb>/  and produces  manifest_noante.json

Folder structure expected:
  noante/
    100/
      charts2bb/   *.png
      charts2.5bb/ *.png
      charts3bb/   *.png
      charts3.5bb/ *.png
      charts4bb/   *.png
      charts4.5bb/ *.png
      charts5bb/   *.png
      charts6bb/   *.png
      charts7bb/   *.png
      limp/        *.png   (optional)
      bvb/         *.png   (optional)

File naming convention is identical to the SB-Ante charts.
"""

import os, json, re
from datetime import datetime, timezone

BASE = os.path.dirname(__file__)

# Only 100bb stacks for no-ante (add more here if needed later)
STACK_SIZES = [50, 100]

# Root subfolder for no-ante charts
NOANTE_ROOT = "noante"

OPEN_SIZE_FOLDERS = {
    "charts2bb":   2.0,
    "charts2.5bb": 2.5,
    "charts3bb":   3.0,
    "charts3.5bb": 3.5,
    "charts4bb":   4.0,
    "charts4.5bb": 4.5,
    "charts5bb":   5.0,
    "charts6bb":   6.0,
    "charts7bb":   7.0,
}

def _parse_size(token):
    if not token: return None
    s = token.strip().lower().replace("bb","").replace("-",".")
    try: return float(s)
    except: return None

def parse_chart_filename(filename, stack, folder_open_size, folder_name, file_prefix):
    """file_prefix: path used in the 'file' field, e.g. 'noante/100/charts2bb'"""
    m = re.match(r"^(.*)\.(png|jpg|jpeg|webp)$", filename, re.IGNORECASE)
    if not m: return None
    base = m.group(1)
    file_path = f"{file_prefix}/{filename}"

    def entry(facing, hero, villain, open_size, bet_size, villain2=None, iso_size=None, c4b_size=None, seq_key=None):
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
            "seq_key": seq_key,
        }

    # 1. Open RFI
    rfi_m = re.match(r"^(UTG|HJ|CO|BU|SB|BB)-OPEN(?:-([0-9]+(?:[.\-][0-9]+)?)bb)?$", base, re.IGNORECASE)
    if rfi_m:
        hero      = rfi_m.group(1).upper()
        open_size = _parse_size(rfi_m.group(2)+"bb") if rfi_m.group(2) else folder_open_size
        return entry("open", hero, None, open_size, None)

    # 2. Facing 3bet
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

    # 5. Facing limp BB with size
    bvb_m = re.match(r"^BB-vs-SB-OPEN-([0-9]+(?:[.][0-9]+)?)bb$", base, re.IGNORECASE)
    if bvb_m:
        return entry("limp", "BB", "SB", _parse_size(bvb_m.group(1)+"bb"), None)

    # 6. SB-Complete-BB
    if re.match(r"^SB-Complete-BB$", base, re.IGNORECASE):
        return entry("limp", "BB", "SB", 0.5, None)

    # 7. SB limp vs BB iso
    iso_m = re.match(r"^SB-LIMP-([0-9]+(?:[.][0-9]+)?)bb-vs-BB-ISO-([0-9]+(?:[.][0-9]+)?)bb$", base, re.IGNORECASE)
    if iso_m:
        return entry("limp", "SB", "BB", _parse_size(iso_m.group(1)+"bb"), None,
                     iso_size=_parse_size(iso_m.group(2)+"bb"))

    # 8. Limp folder decision files
    if folder_name == "limp":
        dec_m = re.match(r"^(.+)-(UTG|HJ|CO|BU|SB|BB)-decision$", base, re.IGNORECASE)
        if dec_m:
            seq = dec_m.group(1)
            hero = dec_m.group(2).upper()
            limper_m = re.match(r"^(UTG|HJ|CO|BU|SB|BB)-LIMP", seq, re.IGNORECASE)
            if limper_m:
                first_limper = limper_m.group(1).upper()
                if hero == first_limper:
                    raises = re.findall(r"-(UTG|HJ|CO|BU|SB|BB)-RAISE", seq, re.IGNORECASE)
                    if not raises:
                        return None
                    villain = raises[-1].upper()
                    return entry("faceiso", hero, villain, None, None, seq_key=seq)
                else:
                    return entry("vsopenlimp", hero, first_limper, None, None, seq_key=seq)

    if re.search(r"SB-LIMP|BB-vs-SB-LIMP", base, re.IGNORECASE):
        return None

    # 9. Facing open
    fop_m = re.match(
        r"^(UTG|HJ|CO|BU|SB|BB)-vs-(UTG|HJ|CO|BU|SB|BB)(?:-OPEN-([0-9]+(?:[.\-][0-9]+)?)bb)?$",
        base, re.IGNORECASE)
    if fop_m:
        hero      = fop_m.group(1).upper()
        villain   = fop_m.group(2).upper()
        open_size = _parse_size(fop_m.group(3)+"bb") if fop_m.group(3) else folder_open_size
        return entry("raise", hero, villain, open_size, None)

    if re.search(r'(SB-LIMP|BB-ISO)', base, re.IGNORECASE):
        return None

    return None


def main():
    charts  = []
    skipped = []

    noante_path = os.path.join(BASE, NOANTE_ROOT)
    if not os.path.isdir(noante_path):
        print(f"Nem található: {NOANTE_ROOT}/ mappa – kihagyva.")
        print("Hozd létre: noante/100/charts2bb/ stb. mappákat.")

    for stack in STACK_SIZES:
        stack_folder   = str(stack)
        stack_path     = os.path.join(noante_path, stack_folder)
        if not os.path.isdir(stack_path):
            print(f"Nem található: {NOANTE_ROOT}/{stack_folder}/ (kihagyva)")
            continue

        # limp folder
        limp_path = os.path.join(stack_path, "limp")
        if os.path.isdir(limp_path):
            prefix = f"{NOANTE_ROOT}/{stack_folder}/limp"
            for fn in sorted(os.listdir(limp_path)):
                if not re.search(r"\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE):
                    continue
                info = parse_chart_filename(fn, stack, None, "limp", prefix)
                if info:   charts.append(info)
                else:      skipped.append(f"{prefix}/{fn}")

        # bvb folder
        bvb_path = os.path.join(stack_path, "bvb")
        if os.path.isdir(bvb_path):
            prefix = f"{NOANTE_ROOT}/{stack_folder}/bvb"
            for fn in sorted(os.listdir(bvb_path)):
                if not re.search(r"\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE):
                    continue
                info = parse_chart_filename(fn, stack, None, "bvb", prefix)
                if info:   charts.append(info)
                else:      skipped.append(f"{prefix}/{fn}")

        # open-size chart folders
        for folder_name, open_size in OPEN_SIZE_FOLDERS.items():
            folder_path = os.path.join(stack_path, folder_name)
            if not os.path.isdir(folder_path):
                continue
            prefix = f"{NOANTE_ROOT}/{stack_folder}/{folder_name}"
            for fn in sorted(os.listdir(folder_path)):
                if not re.search(r"\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE):
                    continue
                info = parse_chart_filename(fn, stack, open_size, folder_name, prefix)
                if info:   charts.append(info)
                else:      skipped.append(f"{prefix}/{fn}")

    generated = datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
    out = {"generated": generated, "charts": charts}

    out_path = os.path.join(BASE, "manifest_noante.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(charts)} chart -> manifest_noante.json")
    if skipped:
        print(f"Kihagyva ({len(skipped)}): {skipped}")

if __name__ == "__main__":
    main()
