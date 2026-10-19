import pymupdf
import time
import json
from collections import defaultdict
import numpy as np

COL_XS = [49.632, 92.152, 134.672, 177.192, 219.712, 262.232, 304.752, 347.272, 389.792, 432.312, 474.832, 517.352]
ROW_YS = [39.672, 82.192, 124.712, 167.232, 209.752, 252.272, 294.792, 337.312, 379.832, 422.352, 464.872, 507.392, 549.902, 592.422, 634.942, 677.462, 719.982, 762.502]
CELL_SIZE = 4.252
GRAY_FILL = (0.6552987098693848, 0.6636301279067993, 0.6734569072723389)

# 8 D4 Symmetry transformation functions for 7x7 matrix
# (r, c) -> transformed (r', c')
TRANSFORMATIONS = {
    "identisch": lambda r, c: (r, c),
    "rot90": lambda r, c: (c, 6 - r),         # 90 deg clockwise
    "rot180": lambda r, c: (6 - r, 6 - c),     # 180 deg
    "rot270": lambda r, c: (6 - c, r),         # 270 deg clockwise
    "spiegel_h": lambda r, c: (6 - r, c),      # Horizontal axis reflection (flip vertical)
    "spiegel_v": lambda r, c: (r, 6 - c),      # Vertical axis reflection (flip horizontal)
    "diag_main": lambda r, c: (c, r),          # Main diagonal reflection
    "diag_anti": lambda r, c: (6 - c, 6 - r),  # Anti-diagonal reflection
}

TRANS_NAMES = {
    "identisch": "Identisch (0°)",
    "rot90": "90° im UZS gedreht",
    "rot180": "180° gedreht",
    "rot270": "270° im UZS gedreht",
    "spiegel_h": "Horizontal gespiegelt",
    "spiegel_v": "Vertikal gespiegelt",
    "diag_main": "Diagonal gespiegelt (Hauptdiagonale)",
    "diag_anti": "Diagonal gespiegelt (Nebendiagonale)"
}

def mat_to_bitmask(mat):
    bm = 0
    for i in range(7):
        for j in range(7):
            if mat[i, j]:
                bm |= (1 << (i * 7 + j))
    return bm

def bitmask_to_mat(bm):
    mat = np.zeros((7, 7), dtype=int)
    for i in range(7):
        for j in range(7):
            if (bm >> (i * 7 + j)) & 1:
                mat[i, j] = 1
    return mat

def get_d4_variants(mat):
    """
    Returns dict: trans_key -> bitmask
    """
    variants = {}
    for t_key, func in TRANSFORMATIONS.items():
        t_mat = np.zeros((7, 7), dtype=int)
        for r in range(7):
            for c in range(7):
                tr, tc = func(r, c)
                t_mat[tr, tc] = mat[r, c]
        variants[t_key] = mat_to_bitmask(t_mat)
    return variants

def main():
    pdf_path = r"C:\Users\Kessler Heinz\Desktop\Gerd_Doppelsuche\muster1,2.pdf"
    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    print(f"Scanning all {total_pages} pages for D4 symmetry duplicates...")

    t0 = time.time()
    all_patterns = []

    # Step 1: Extract all patterns
    for p_idx in range(total_pages):
        page = doc[p_idx]
        patterns = np.zeros((18, 12, 7, 7), dtype=int)

        for d in page.get_drawings():
            if d.get('fill') is not None:
                f = d['fill']
                if abs(f[0] - GRAY_FILL[0]) < 0.01:
                    r = d['rect']
                    cx = (r.x0 + r.x1) / 2
                    cy = (r.y0 + r.y1) / 2

                    c_idx = -1
                    for c, x0 in enumerate(COL_XS):
                        if 0 <= cx - x0 <= 29.8:
                            c_idx = c
                            break
                    r_idx = -1
                    for ro, y0 in enumerate(ROW_YS):
                        if 0 <= cy - y0 <= 29.8:
                            r_idx = ro
                            break

                    if c_idx != -1 and r_idx != -1:
                        j = int(round((cx - COL_XS[c_idx] - CELL_SIZE/2) / CELL_SIZE))
                        i = int(round((cy - ROW_YS[r_idx] - CELL_SIZE/2) / CELL_SIZE))
                        if 0 <= i < 7 and 0 <= j < 7:
                            patterns[r_idx, c_idx, i, j] = 1

        for c in range(12):
            for r in range(18):
                mat = patterns[r, c]
                bm = mat_to_bitmask(mat)
                variants = get_d4_variants(mat)
                canonical_bm = min(variants.values())

                all_patterns.append({
                    "page": p_idx + 1,
                    "row": r + 1,
                    "col": c + 1,
                    "col_idx": c * 18 + r + 1,
                    "global_id": len(all_patterns) + 1,
                    "raw_bitmask": bm,
                    "canonical_bitmask": canonical_bm,
                    "variants": variants,
                    "gray_count": int(mat.sum())
                })

        if (p_idx + 1) % 25 == 0 or p_idx + 1 == total_pages:
            print(f"Extracted {p_idx+1}/{total_pages} pages ({len(all_patterns)} patterns)...")

    t_extract = time.time() - t0
    print(f"Extraction done in {t_extract:.1f}s.")

    # Step 2: Group by canonical bitmask
    groups = defaultdict(list)
    for p in all_patterns:
        groups[p["canonical_bitmask"]].append(p)

    total_patterns = len(all_patterns)
    unique_classes = len(groups)
    dup_classes = {k: v for k, v in groups.items() if len(v) > 1}
    exact_duplicates_count = sum(1 for v in groups.values() if len(set(p['raw_bitmask'] for p in v)) < len(v))

    print(f"\n==========================================")
    print(f"TOTAL PATTERNS: {total_patterns}")
    print(f"UNIQUE SYMMETRY CLASSES: {unique_classes}")
    print(f"DUPLICATE SYMMETRY GROUPS (len > 1): {len(dup_classes)}")
    print(f"PATTERNS INVOLVED IN DUPLICATES: {sum(len(v) for v in dup_classes.values())}")
    print(f"==========================================")

    # Analyze relation of each duplicate to the representative (first occurrence)
    processed_groups = []
    group_id = 1

    # Sort groups by size descending
    sorted_groups = sorted(dup_classes.items(), key=lambda x: len(x[1]), reverse=True)

    for canon_bm, members in sorted_groups:
        rep = members[0]
        rep_variants = rep["variants"]
        # reverse map: bitmask -> transform name relative to representative
        bm_to_trans = {}
        for t_k, t_bm in rep_variants.items():
            if t_bm not in bm_to_trans:
                bm_to_trans[t_bm] = t_k

        members_info = []
        for m in members:
            # find relation to rep
            rel_key = bm_to_trans.get(m["raw_bitmask"], "kombiniert")
            members_info.append({
                "global_id": m["global_id"],
                "page": m["page"],
                "col": m["col"],
                "row": m["row"],
                "raw_bitmask": str(m["raw_bitmask"]),
                "relation_to_first": rel_key,
                "relation_name": TRANS_NAMES.get(rel_key, rel_key),
                "is_first": m["global_id"] == rep["global_id"]
            })

        processed_groups.append({
            "group_id": group_id,
            "canonical_bitmask": str(canon_bm),
            "gray_count": rep["gray_count"],
            "count": len(members),
            "representative_matrix": bitmask_to_mat(rep["raw_bitmask"]).tolist(),
            "members": members_info
        })
        group_id += 1

    # Save to data/symmetry_duplicates.json
    out_json = r"C:\Users\Kessler Heinz\.gemini\antigravity-ide\scratch\gerd-muster-explorer\data\symmetry_duplicates.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({
            "total_patterns": total_patterns,
            "unique_symmetry_classes": unique_classes,
            "duplicate_groups_count": len(dup_classes),
            "patterns_in_duplicate_groups": sum(len(v) for v in dup_classes.values()),
            "scan_time_seconds": round(time.time() - t0, 2),
            "groups": processed_groups
        }, f, indent=2)

    print(f"Saved symmetry duplicate report to {out_json}")

    # Also save a lightweight lookup index: page_col_row -> group_id
    index_map = {}
    for g in processed_groups:
        for m in g["members"]:
            key = f"{m['page']}_{m['col']}_{m['row']}"
            index_map[key] = {
                "group_id": g["group_id"],
                "count": g["count"],
                "relation": m["relation_name"],
                "is_first": m["is_first"]
            }

    out_index = r"C:\Users\Kessler Heinz\.gemini\antigravity-ide\scratch\gerd-muster-explorer\data\pattern_symmetry_index.json"
    with open(out_index, "w", encoding="utf-8") as f:
        json.dump(index_map, f)
    print(f"Saved lookup index to {out_index}")

if __name__ == "__main__":
    main()
