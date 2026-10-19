import pymupdf
import time
import json
from collections import defaultdict
import numpy as np

COL_XS = [49.632, 92.152, 134.672, 177.192, 219.712, 262.232, 304.752, 347.272, 389.792, 432.312, 474.832, 517.352]
ROW_YS = [39.672, 82.192, 124.712, 167.232, 209.752, 252.272, 294.792, 337.312, 379.832, 422.352, 464.872, 507.392, 549.902, 592.422, 634.942, 677.462, 719.982, 762.502]
CELL_SIZE = 4.252
GRAY_FILL = (0.6552987098693848, 0.6636301279067993, 0.6734569072723389)

def main():
    pdf_path = r"C:\Users\Kessler Heinz\Desktop\Gerd_Doppelsuche\muster1,2.pdf"
    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    print(f"Scanning all {total_pages} pages for duplicates...")
    
    t0 = time.time()
    
    # Store: bitmask -> list of locations: [{"page": p, "row": r, "col": c, "col_idx": idx}]
    pattern_map = defaultdict(list)
    total_patterns_scanned = 0
    
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
        
        for r in range(18):
            for c in range(12):
                bitmask = 0
                for i in range(7):
                    for j in range(7):
                        if patterns[r, c, i, j]:
                            bitmask |= (1 << (i * 7 + j))
                
                total_patterns_scanned += 1
                pattern_map[bitmask].append({
                    "page": p_idx + 1,
                    "row": r + 1,
                    "col": c + 1,
                    "col_idx": c * 18 + r + 1,
                    "global_col_idx": p_idx * 216 + c * 18 + r + 1
                })
        
        if (p_idx + 1) % 25 == 0 or p_idx + 1 == total_pages:
            print(f"Scanned {p_idx+1}/{total_pages} pages ({total_patterns_scanned} patterns)...")
    
    elapsed = time.time() - t0
    print(f"Finished scan in {elapsed:.1f}s. Unique patterns: {len(pattern_map)}.")
    
    # Check for duplicates
    duplicates = {bm: locs for bm, locs in pattern_map.items() if len(locs) > 1}
    print(f"\n==========================================")
    print(f"DUPLICATES FOUND: {len(duplicates)}")
    print(f"==========================================")
    
    dup_list = []
    for bm, locs in duplicates.items():
        # reconstruct matrix
        mat = [[(bm >> (i * 7 + j)) & 1 for j in range(7)] for i in range(7)]
        dup_list.append({
            "bitmask": str(bm),
            "occurrences_count": len(locs),
            "locations": locs,
            "matrix": mat
        })
        print(f"Bitmask {bm} found {len(locs)} times at: {[(l['page'], l['col'], l['row']) for l in locs]}")
    
    # Save results to json
    report_path = r"C:\Users\Kessler Heinz\.gemini\antigravity-ide\scratch\gerd-muster-explorer\data\duplicate_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_patterns_scanned": total_patterns_scanned,
            "unique_patterns_count": len(pattern_map),
            "duplicates_count": len(duplicates),
            "scan_time_seconds": round(elapsed, 2),
            "duplicates": dup_list
        }, f, indent=2)
    print(f"\nSaved duplicate report to {report_path}")

if __name__ == "__main__":
    main()
