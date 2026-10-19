import pymupdf
import json
import os
import numpy as np

# Coordinates of the 12 columns and 18 rows
COL_XS = [49.632, 92.152, 134.672, 177.192, 219.712, 262.232, 304.752, 347.272, 389.792, 432.312, 474.832, 517.352]
ROW_YS = [39.672, 82.192, 124.712, 167.232, 209.752, 252.272, 294.792, 337.312, 379.832, 422.352, 464.872, 507.392, 549.902, 592.422, 634.942, 677.462, 719.982, 762.502]
CELL_SIZE = 4.252
GRAY_FILL = (0.6552987098693848, 0.6636301279067993, 0.6734569072723389)

def extract_patterns_from_page(page):
    """
    Extracts all 216 patterns from a single page.
    Returns a list of dicts with:
      page, row (1-18), col (1-12), index_col_major, index_row_major, matrix (7x7), bitmask, gray_count
    """
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

    result = []
    for r in range(18):
        for c in range(12):
            mat = patterns[r, c].tolist()
            # 49-bit integer bitmask (1 = gray, 0 = white)
            bitmask = 0
            for i in range(7):
                for j in range(7):
                    if mat[i][j]:
                        bitmask |= (1 << (i * 7 + j))
            
            result.append({
                "row": r + 1,
                "col": c + 1,
                "index_col_major": c * 18 + r + 1,
                "index_row_major": r * 12 + c + 1,
                "matrix": mat,
                "bitmask": str(bitmask),
                "gray_count": int(patterns[r, c].sum())
            })
    return result

if __name__ == "__main__":
    pdf_path = r"C:\Users\Kessler Heinz\Desktop\Gerd_Doppelsuche\muster1,2.pdf"
    doc = pymupdf.open(pdf_path)
    page_12 = doc[11]
    
    p12_patterns = extract_patterns_from_page(page_12)
    output_path = r"C:\Users\Kessler Heinz\.gemini\antigravity-ide\scratch\gerd-muster-explorer\data\page_12_patterns.json"
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "page": 12,
            "total_patterns": len(p12_patterns),
            "patterns": p12_patterns
        }, f, indent=2)
    
    print(f"Exported {len(p12_patterns)} patterns for Page 12 to {output_path}")
