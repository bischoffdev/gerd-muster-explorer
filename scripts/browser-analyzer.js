// Pure in-browser PDF analyzer for Gerd 7x7 pattern D4 symmetry scanner
// Uses standard Web APIs (DecompressionStream, Uint8Array) - zero dependencies, zero backend needed!

(function (window) {
  'use strict';

  const TRANSFORMATIONS = {
    identisch: (r, c) => [r, c],
    rot90: (r, c) => [c, 6 - r],
    rot180: (r, c) => [6 - r, 6 - c],
    rot270: (r, c) => [6 - c, r],
    spiegel_h: (r, c) => [6 - r, c],
    spiegel_v: (r, c) => [r, 6 - c],
    diag_main: (r, c) => [c, r],
    diag_anti: (r, c) => [6 - c, 6 - r]
  };

  const TRANS_NAMES = {
    identisch: 'Identisch (0°)',
    rot90: '90° im UZS gedreht',
    rot180: '180° gedreht',
    rot270: '270° im UZS gedreht',
    spiegel_h: 'Horizontal gespiegelt',
    spiegel_v: 'Vertikal gespiegelt',
    diag_main: 'Diagonal gespiegelt (Hauptdiagonale)',
    diag_anti: 'Diagonal gespiegelt (Nebendiagonale)'
  };

  const COL_XS = [49.632, 92.152, 134.672, 177.192, 219.712, 262.232, 304.752, 347.272, 389.792, 432.312, 474.832, 517.352];
  const ROW_YS = [39.672, 82.192, 124.712, 167.232, 209.752, 252.272, 294.792, 337.312, 379.832, 422.352, 464.872, 507.392, 549.902, 592.422, 634.942, 677.462, 719.982, 762.502];
  const CELL_SIZE = 4.252;
  const PAGE_HEIGHT = 841.89;

  function matToBitmask(mat) {
    let bm = 0n;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (mat[i][j]) bm |= (1n << BigInt(i * 7 + j));
      }
    }
    return bm;
  }

  function getD4Variants(mat) {
    const variants = {};
    for (const [key, func] of Object.entries(TRANSFORMATIONS)) {
      const tMat = Array.from({ length: 7 }, () => Array(7).fill(0));
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const [tr, tc] = func(r, c);
          tMat[tr][tc] = mat[r][c];
        }
      }
      variants[key] = matToBitmask(tMat);
    }
    return variants;
  }

  async function decompressSlice(sliceUint8) {
    // Try standard 'deflate' (RFC 1950 zlib format)
    try {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(sliceUint8);
      writer.close();
      const chunks = [];
      const reader = ds.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return concatenateUint8(chunks);
    } catch {
      // Fallback: 'deflate-raw' (RFC 1951 raw deflate)
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(sliceUint8);
        writer.close();
        const chunks = [];
        const reader = ds.readable.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        return concatenateUint8(chunks);
      } catch {
        return sliceUint8;
      }
    }
  }

  function concatenateUint8(arrays) {
    let totalLength = 0;
    for (const arr of arrays) totalLength += arr.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  function uint8ToLatin1(uint8) {
    let str = '';
    const CHUNK_SIZE = 65536;
    for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
      const sub = uint8.subarray(i, i + CHUNK_SIZE);
      str += String.fromCharCode.apply(null, sub);
    }
    return str;
  }

  window.analyzePdfArrayBuffer = async function (arrayBuffer) {
    const uint8 = new Uint8Array(arrayBuffer);
    const strBuf = uint8ToLatin1(uint8);

    // Map object offsets
    const objMap = new Map();
    const reObj = /(\d+)\s+0\s+obj/g;
    let m;
    while ((m = reObj.exec(strBuf)) !== null) {
      objMap.set(parseInt(m[1]), m.index);
    }

    // Find all pages
    const rePage = /\/Type\s*\/Page[^s]/g;
    const pageIndices = [];
    while ((m = rePage.exec(strBuf)) !== null) {
      pageIndices.push(m.index);
    }

    async function getStream(objId) {
      const off = objMap.get(objId);
      if (off === undefined) return '';
      const streamMarker = 'stream';
      const streamStart = strBuf.indexOf(streamMarker, off);
      if (streamStart === -1) return '';
      let dataStart = streamStart + 6;
      if (uint8[dataStart] === 0x0d && uint8[dataStart + 1] === 0x0a) dataStart += 2;
      else if (uint8[dataStart] === 0x0a || uint8[dataStart] === 0x0d) dataStart += 1;
      const streamEnd = strBuf.indexOf('endstream', dataStart);
      if (streamEnd === -1) return '';
      const slice = uint8.subarray(dataStart, streamEnd);
      const decompressed = await decompressSlice(slice);
      return uint8ToLatin1(decompressed);
    }

    const allPatterns = [];

    for (let p = 0; p < pageIndices.length; p++) {
      const pIdx = pageIndices[p];
      const objStart = strBuf.lastIndexOf('obj', pIdx);
      const objEnd = strBuf.indexOf('endobj', pIdx);
      const pageObjStr = strBuf.slice(objStart, objEnd);

      const contentsMatch = pageObjStr.match(/\/Contents\s*(\[\s*([\d\sR]+)\s*\]|(\d+)\s+0\s+R)/);
      let contentIds = [];
      if (contentsMatch && contentsMatch[2]) {
        contentIds = contentsMatch[2].match(/\d+(?=\s+0\s+R)/g).map(Number);
      } else if (contentsMatch && contentsMatch[3]) {
        contentIds = [parseInt(contentsMatch[3])];
      }

      let pageStream = '';
      for (const cid of contentIds) {
        pageStream += (await getStream(cid)) + '\n';
      }

      const patterns = Array.from({ length: 18 }, () => Array.from({ length: 12 }, () => Array.from({ length: 7 }, () => Array(7).fill(0))));

      const reRect = /([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re\s*[\r\n]+f/g;
      let rm;
      while ((rm = reRect.exec(pageStream)) !== null) {
        const w = parseFloat(rm[3]);
        const h = parseFloat(rm[4]);
        if (Math.abs(w) > 50 || Math.abs(h) > 50) continue;
        const x = parseFloat(rm[1]);
        const y = parseFloat(rm[2]);

        const cx = x + w / 2;
        const cy = PAGE_HEIGHT - (y + h / 2);

        let c_idx = -1;
        for (let c = 0; c < COL_XS.length; c++) {
          if (cx - COL_XS[c] >= 0 && cx - COL_XS[c] <= 29.8) {
            c_idx = c;
            break;
          }
        }

        let r_idx = -1;
        for (let r = 0; r < ROW_YS.length; r++) {
          if (cy - ROW_YS[r] >= 0 && cy - ROW_YS[r] <= 29.8) {
            r_idx = r;
            break;
          }
        }

        if (c_idx !== -1 && r_idx !== -1) {
          const j = Math.round((cx - COL_XS[c_idx] - CELL_SIZE / 2) / CELL_SIZE);
          const i = Math.round((cy - ROW_YS[r_idx] - CELL_SIZE / 2) / CELL_SIZE);
          if (i >= 0 && i < 7 && j >= 0 && j < 7) {
            patterns[r_idx][c_idx][i][j] = 1;
          }
        }
      }

      for (let c = 0; c < 12; c++) {
        for (let r = 0; r < 18; r++) {
          const mat = patterns[r][c];
          let cnt = 0;
          for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
              if (mat[i][j]) cnt++;
            }
          }
          if (cnt > 0) {
            const bm = matToBitmask(mat);
            const variants = getD4Variants(mat);
            let canonicalBm = bm;
            for (const vBm of Object.values(variants)) {
              if (vBm < canonicalBm) canonicalBm = vBm;
            }

            allPatterns.push({
              page: p + 1,
              row: r + 1,
              col: c + 1,
              col_idx: c * 18 + r + 1,
              global_id: allPatterns.length + 1,
              raw_bitmask: bm,
              canonical_bitmask: canonicalBm,
              variants,
              gray_count: cnt,
              matrix: mat
            });
          }
        }
      }
    }

    const groupsMap = new Map();
    for (const p of allPatterns) {
      const key = p.canonical_bitmask.toString();
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key).push(p);
    }

    const totalPatterns = allPatterns.length;
    const uniqueClasses = groupsMap.size;
    const dupEntries = Array.from(groupsMap.entries()).filter(([k, v]) => v.length > 1);
    dupEntries.sort((a, b) => b[1].length - a[1].length);

    const patternsInDups = dupEntries.reduce((sum, [, v]) => sum + v.length, 0);

    const processedGroups = [];
    let groupId = 1;

    for (const [canonBmStr, members] of dupEntries) {
      const rep = members[0];
      const bmToTrans = new Map();
      for (const [tKey, tBm] of Object.entries(rep.variants)) {
        bmToTrans.set(tBm.toString(), tKey);
      }

      const membersInfo = members.map(m => {
        const relKey = bmToTrans.get(m.raw_bitmask.toString()) || 'kombiniert';
        return {
          global_id: m.global_id,
          page: m.page,
          col: m.col,
          row: m.row,
          raw_bitmask: m.raw_bitmask.toString(),
          relation_to_first: relKey,
          relation_name: TRANS_NAMES[relKey] || relKey,
          is_first: m.global_id === rep.global_id
        };
      });

      processedGroups.push({
        group_id: groupId++,
        canonical_bitmask: canonBmStr,
        gray_count: rep.gray_count,
        count: members.length,
        representative_matrix: rep.matrix,
        members: membersInfo
      });
    }

    return {
      total_patterns: totalPatterns,
      unique_symmetry_classes: uniqueClasses,
      duplicate_groups_count: processedGroups.length,
      patterns_in_duplicate_groups: patternsInDups,
      groups: processedGroups
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
