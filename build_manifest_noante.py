# build_manifest_noante.py - a No-Ante (0ante-6max) manifestet epiti.
# A parsert/epitot a build_manifest.py-bol hasznalja (kozos uj-formatumu logika).
from build_manifest import build

PROFILE = {"game_folder": "0ante-6max", "out_file": "manifest_noante.json", "stacks": [50, 100]}

def main():
    charts, skipped = build(PROFILE["game_folder"], PROFILE["out_file"], PROFILE["stacks"])
    print(f"OK: {len(charts)} chart -> {PROFILE['out_file']}")
    if skipped:
        print(f"Kihagyva ({len(skipped)}): {skipped[:20]}")

if __name__ == "__main__":
    main()
