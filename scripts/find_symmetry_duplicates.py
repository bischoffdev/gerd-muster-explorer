import pymupdf
import time
import json
import csv
from collections import defaultdict
import numpy as np

COL_XS = [49.632, 92.152, 134.672, 177.192, 219.712, 262.232, 304.752, 347.272, 389.792, 432.312, 474.832, 517.352]
ROW_YS = [39.672, 82.192, 124.712, 167.232, 209.752, 252.272, 294.792, 337.312, 379.832, 422.352, 464.872, 507.392, 549.902, 592.422, 634.942, 677.462, 719.982, 762.502]
CELL_SIZE = 4.252
GRAY_FILL = (0.6552987098693848, 0.6636301279067993, 0.6734569072723389)

TRANSFORMATIONS = {
    'identisch': lambda r, c: (r, c),
    'rot90': lambda r, c: (c, 6 - r),
    'rot180': lambda r, c: (6 - r, 6 - c),
    'rot270': lambda r, c: (6 - c, r),
    'spiegel_h': lambda r, c: (6 - r, c),
    'spiegel_v': lambda r, c: (r, 6 - c),
    'diag_main': lambda r, c: (c, r),
    'diag_anti': lambda r, c: (6 - c, 6 - r),
}
TRANS_NAMES = {
    'identisch': 'Identisch (0°)',
    'rot90': '90° im UZS gedreht',
    'rot180': '180° gedreht',
    'rot270': '270° im UZS gedreht',
    'spiegel_h': 'Horizontal gespiegelt',
    'spiegel_v': 'Vertikal gespiegelt',
    'diag_main': 'Diagonal gespiegelt (Hauptdiagonale)',
    'diag_anti': 'Diagonal gespiegelt (Nebendiagonale)'
}

def mat_to_bitmask(mat):
    bm = 0
    for i in range(7):
        for j in range(7):
            if mat[i, j]: bm |= (1 << (i * 7 + j))
    return bm

def bitmask_to_mat(bm):
    mat = np.zeros((7, 7), dtype=int)
    for i in range(7):
        for j in range(7):
            if (bm >> (i * 7 + j)) & 1: mat[i, j] = 1
    return mat

def get_d4_variants(mat):
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
    doc = pymupdf.open(r'C:\Users\Kessler Heinz\Desktop\Gerd_Doppelsuche\muster1,2.pdf')
    all_patterns = []

    for p_idx in range(len(doc)):
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
                        if 0 <= cx - x0 <= 29.8: c_idx = c; break
                    r_idx = -1
                    for ro, y0 in enumerate(ROW_YS):
                        if 0 <= cy - y0 <= 29.8: r_idx = ro; break
                    if c_idx != -1 and r_idx != -1:
                        j = int(round((cx - COL_XS[c_idx] - CELL_SIZE/2) / CELL_SIZE))
                        i = int(round((cy - ROW_YS[r_idx] - CELL_SIZE/2) / CELL_SIZE))
                        if 0 <= i < 7 and 0 <= j < 7: patterns[r_idx, c_idx, i, j] = 1

        for c in range(12):
            for r in range(18):
                cnt = int(patterns[r, c].sum())
                # ONLY KEEP ACTUAL PRINTED PATTERNS (filter out blank/empty paper slots)
                if cnt > 0:
                    mat = patterns[r, c]
                    bm = mat_to_bitmask(mat)
                    variants = get_d4_variants(mat)
                    canonical_bm = min(variants.values())
                    all_patterns.append({
                        'page': p_idx + 1,
                        'row': r + 1,
                        'col': c + 1,
                        'col_idx': c * 18 + r + 1,
                        'global_id': len(all_patterns) + 1,
                        'raw_bitmask': bm,
                        'canonical_bitmask': canonical_bm,
                        'variants': variants,
                        'gray_count': cnt
                    })

    groups = defaultdict(list)
    for p in all_patterns:
        groups[p['canonical_bitmask']].append(p)

    total_patterns = len(all_patterns)
    unique_classes = len(groups)
    dup_classes = {k: v for k, v in groups.items() if len(v) > 1}
    patterns_in_dups = sum(len(v) for v in dup_classes.values())

    print(f'=== EXAKTE SAUBERE METRIKEN ===')
    print(f'Tatsächlich gedruckte Muster: {total_patterns}')
    print(f'Einzigartige Symmetrieklassen: {unique_classes}')
    print(f'Duplikat-Gruppen: {len(dup_classes)}')
    print(f'Muster in Duplikat-Gruppen: {patterns_in_dups}')
    print(f'Einzigartige Muster (ohne jedes Duplikat): {total_patterns - patterns_in_dups}')

    processed_groups = []
    group_id = 1
    sorted_groups = sorted(dup_classes.items(), key=lambda x: len(x[1]), reverse=True)
    for canon_bm, members in sorted_groups:
        rep = members[0]
        bm_to_trans = {t_bm: t_k for t_k, t_bm in rep['variants'].items()}
        members_info = []
        for m in members:
            rel_key = bm_to_trans.get(m['raw_bitmask'], 'kombiniert')
            members_info.append({
                'global_id': m['global_id'],
                'page': m['page'],
                'col': m['col'],
                'row': m['row'],
                'raw_bitmask': str(m['raw_bitmask']),
                'relation_to_first': rel_key,
                'relation_name': TRANS_NAMES.get(rel_key, rel_key),
                'is_first': m['global_id'] == rep['global_id']
            })
        processed_groups.append({
            'group_id': group_id,
            'canonical_bitmask': str(canon_bm),
            'gray_count': rep['gray_count'],
            'count': len(members),
            'representative_matrix': bitmask_to_mat(rep['raw_bitmask']).tolist(),
            'members': members_info
        })
        group_id += 1

    base_dir = r'C:\Users\Kessler Heinz\.gemini\antigravity-ide\scratch\gerd-muster-explorer\data'
    # JSON
    with open(f'{base_dir}\\symmetry_duplicates.json', 'w', encoding='utf-8') as f:
        json.dump({
            'total_patterns': total_patterns,
            'unique_symmetry_classes': unique_classes,
            'duplicate_groups_count': len(dup_classes),
            'patterns_in_duplicate_groups': patterns_in_dups,
            'groups': processed_groups
        }, f, indent=2)

    # JS (Offline)
    with open(f'{base_dir}\\symmetry_duplicates.js', 'w', encoding='utf-8') as f:
        f.write('window.DUPLICATE_REPORT = ' + json.dumps({
            'total_patterns': total_patterns,
            'unique_symmetry_classes': unique_classes,
            'duplicate_groups_count': len(dup_classes),
            'patterns_in_duplicate_groups': patterns_in_dups,
            'groups': processed_groups
        }) + ';')

    # Index
    index_map = {}
    for g in processed_groups:
        for m in g['members']:
            key = f"{m['page']}_{m['col']}_{m['row']}"
            index_map[key] = {
                'group_id': g['group_id'],
                'count': g['count'],
                'relation': m['relation_name'],
                'is_first': m['is_first']
            }

    with open(f'{base_dir}\\pattern_symmetry_index.json', 'w', encoding='utf-8') as f:
        json.dump(index_map, f)
    with open(f'{base_dir}\\pattern_symmetry_index.js', 'w', encoding='utf-8') as f:
        f.write('window.PATTERN_INDEX = ' + json.dumps(index_map) + ';')

    # CSV
    with open(f'{base_dir}\\duplikate_d4_symmetrie.csv', 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['Gruppe_ID', 'Anzahl_in_Gruppe', 'Graue_Zellen', 'Globale_ID', 'Seite', 'Spalte', 'Zeile', 'Ist_Erstvorkommen', 'Transformation_zu_Erstvorkommen', 'Bitmask'])
        for g in processed_groups:
            for m in g['members']:
                writer.writerow([g['group_id'], g['count'], g['gray_count'], m['global_id'], m['page'], m['col'], m['row'], 'JA' if m['is_first'] else 'NEIN', m['relation_name'], m['raw_bitmask']])

    print('Export finished successfully!')

if __name__ == '__main__':
    main()
