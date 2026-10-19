// Gerd Doppelsuche — D4 Symmetry Duplicate Scanner

let duplicateReport = null;
let patternIndex = null;
let filteredGroups = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 40;

let selectedGroup = null;

// Transformations for D4 symmetry
const TRANSFORMATIONS = {
  "identisch": (r, c) => [r, c],
  "rot90": (r, c) => [c, 6 - r],
  "rot180": (r, c) => [6 - r, 6 - c],
  "rot270": (r, c) => [6 - c, r],
  "spiegel_h": (r, c) => [6 - r, c],
  "spiegel_v": (r, c) => [r, 6 - c],
  "diag_main": (r, c) => [c, r],
  "diag_anti": (r, c) => [6 - c, 6 - r]
};

const TRANS_NAMES = {
  "identisch": "Identisch (0°)",
  "rot90": "90° im UZS gedreht",
  "rot180": "180° gedreht",
  "rot270": "270° im UZS gedreht",
  "spiegel_h": "Horizontal gespiegelt",
  "spiegel_v": "Vertikal gespiegelt",
  "diag_main": "Diagonal gespiegelt (Hauptdiagonale)",
  "diag_anti": "Diagonal gespiegelt (Nebendiagonale)"
};

// Sample pattern for transformer tab
let sampleMatrix = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 0, 0, 0, 0],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1]
];

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupTransformer();
  setupChecker();

  await loadData();
  setupFilters();
  applyFilters();
});

// Setup tab navigation
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// Load JSON/JS data
async function loadData() {
  // First check if loaded via <script> tag (offline file:/// mode)
  if (window.DUPLICATE_REPORT) {
    duplicateReport = window.DUPLICATE_REPORT;
  }
  if (window.PATTERN_INDEX) {
    patternIndex = window.PATTERN_INDEX;
  }

  // Fallback: try fetch (if served via http://)
  if (!duplicateReport) {
    try {
      const res = await fetch('data/symmetry_duplicates.json');
      if (res.ok) {
        duplicateReport = await res.json();
      }
    } catch (e) {
      console.warn("Could not fetch symmetry_duplicates.json", e);
    }
  }

  if (!patternIndex) {
    try {
      const resIdx = await fetch('data/pattern_symmetry_index.json');
      if (resIdx.ok) {
        patternIndex = await resIdx.json();
      }
    } catch (e) {
      console.warn("Could not fetch pattern_symmetry_index.json", e);
    }
  }

  // Update header stats
  if (duplicateReport) {
    document.getElementById('results-count-badge').textContent = `${duplicateReport.duplicate_groups_count.toLocaleString()} Gruppen`;
  }
}

// Setup filters
function setupFilters() {
  const transSelect = document.getElementById('filter-trans');
  const countSelect = document.getElementById('filter-count');
  const pageInput = document.getElementById('search-page-input');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  transSelect.addEventListener('change', () => { currentPage = 1; applyFilters(); });
  countSelect.addEventListener('change', () => { currentPage = 1; applyFilters(); });
  pageInput.addEventListener('input', () => { currentPage = 1; applyFilters(); });

  btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderGroupList();
    }
  });

  btnNext.addEventListener('click', () => {
    const maxPage = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
    if (currentPage < maxPage) {
      currentPage++;
      renderGroupList();
    }
  });
}

// Filter logic
function applyFilters() {
  if (!duplicateReport) return;

  const transVal = document.getElementById('filter-trans').value;
  const countVal = document.getElementById('filter-count').value;
  const pageQuery = document.getElementById('search-page-input').value.trim();

  filteredGroups = duplicateReport.groups.filter(g => {
    // Filter by count
    if (countVal === '2' && g.count !== 2) return false;
    if (countVal === '3' && g.count !== 3) return false;
    if (countVal === '4+' && g.count < 4) return false;

    // Filter by transformation
    if (transVal !== 'all') {
      const hasTrans = g.members.some(m => m.relation_to_first === transVal);
      if (!hasTrans) return false;
    }

    // Filter by page query
    if (pageQuery) {
      const targetPage = parseInt(pageQuery, 10);
      if (!isNaN(targetPage)) {
        const hasPage = g.members.some(m => m.page === targetPage);
        if (!hasPage) return false;
      }
    }

    return true;
  });

  document.getElementById('results-count-badge').textContent = `${filteredGroups.length.toLocaleString()} Gruppen`;
  renderGroupList();

  // Auto-select first group if available
  if (filteredGroups.length > 0) {
    selectGroup(filteredGroups[0]);
  } else {
    document.getElementById('dup-detail-panel').innerHTML = '<div class="empty-state">Keine Duplikate für diese Filtereinstellungen gefunden.</div>';
  }
}

// Render paginated group list
function renderGroupList() {
  const container = document.getElementById('duplicate-groups-container');
  const pageIndicator = document.getElementById('page-indicator');
  container.innerHTML = '';

  const maxPage = Math.max(1, Math.ceil(filteredGroups.length / ITEMS_PER_PAGE));
  if (currentPage > maxPage) currentPage = maxPage;
  pageIndicator.textContent = `Seite ${currentPage} / ${maxPage}`;

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredGroups.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  pageItems.forEach(group => {
    const item = document.createElement('div');
    item.className = `dup-group-item ${selectedGroup && selectedGroup.group_id === group.group_id ? 'active' : ''}`;

    const preview = document.createElement('div');
    preview.className = 'dup-item-preview';

    // Mini 7x7 grid
    const miniGrid = document.createElement('div');
    miniGrid.className = 'mini-grid';
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const mc = document.createElement('div');
        mc.className = `mini-cell ${group.representative_matrix[i][j] ? 'gray' : 'white'}`;
        miniGrid.appendChild(mc);
      }
    }

    const meta = document.createElement('div');
    meta.className = 'group-meta';
    const firstLoc = group.members[0];
    meta.innerHTML = `
      <div class="group-title">Gruppe #${group.group_id}</div>
      <div class="group-sub">Erstes: S.${firstLoc.page} (Sp.${firstLoc.col}, Z.${firstLoc.row})</div>
    `;

    preview.appendChild(miniGrid);
    preview.appendChild(meta);

    const countBadge = document.createElement('span');
    countBadge.className = 'badge-count';
    countBadge.textContent = `${group.count}×`;

    item.appendChild(preview);
    item.appendChild(countBadge);

    item.addEventListener('click', () => {
      document.querySelectorAll('.dup-group-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      selectGroup(group);
    });

    container.appendChild(item);
  });
}

// Select and render detail view
function selectGroup(group) {
  selectedGroup = group;
  const panel = document.getElementById('dup-detail-panel');

  const rep = group.members[0];

  let membersHtml = '';
  group.members.forEach((m, idx) => {
    const transMatrix = getTransformedMatrix(group.representative_matrix, m.relation_to_first);
    const relClass = m.relation_to_first === 'identisch' ? 'identisch' : '';

    membersHtml += `
      <div class="member-card ${m.is_first ? 'is-rep' : ''}">
        <div class="member-header">
          <span class="member-loc">Seite ${m.page} (Spalte ${m.col}, Zeile ${m.row})</span>
          <span class="member-rel-badge ${relClass}">${m.is_first ? '★ Referenz (Original)' : m.relation_name}</span>
        </div>
        <div class="member-card-body">
          <div class="pattern-matrix" id="member-matrix-${group.group_id}-${idx}"></div>
          <div class="member-meta-text">
            <div>Muster-ID: <strong>#${m.global_id}</strong></div>
            <div>Spalten-Index: #${(m.col - 1) * 18 + m.row}</div>
            <div>Bitmask: <code style="font-size:0.75rem;">${m.raw_bitmask}</code></div>
          </div>
        </div>
      </div>
    `;
  });

  panel.innerHTML = `
    <div class="detail-header">
      <div>
        <h3>Duplikat-Gruppe #${group.group_id}</h3>
        <p style="color:var(--text-secondary); font-size:0.88rem;">
          Dieses Muster kommt <strong>${group.count} mal</strong> im Dokument vor (inkl. Drehungen und Spiegelungen).
        </p>
      </div>
      <div>
        <span class="badge-count" style="font-size:0.9rem; padding:0.35rem 0.8rem;">${group.count} Fundstellen</span>
      </div>
    </div>

    <h4>Alle Fundstellen dieses Musters:</h4>
    <div class="detail-members-grid">
      ${membersHtml}
    </div>
  `;

  // Render individual member matrices
  group.members.forEach((m, idx) => {
    const mat = getTransformedMatrix(group.representative_matrix, m.relation_to_first);
    renderMatrix(mat, `member-matrix-${group.group_id}-${idx}`, 16);
  });
}

function getTransformedMatrix(baseMat, transKey) {
  if (!transKey || transKey === 'identisch' || !TRANSFORMATIONS[transKey]) {
    return baseMat;
  }
  const op = TRANSFORMATIONS[transKey];
  const res = Array(7).fill(null).map(() => Array(7).fill(0));
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const [tr, tc] = op(r, c);
      res[tr][tc] = baseMat[r][c];
    }
  }
  return res;
}

function renderMatrix(mat, containerId, cellSize = 22) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(7, ${cellSize}px)`;
  container.style.gridTemplateRows = `repeat(7, ${cellSize}px)`;

  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const cell = document.createElement('div');
      cell.className = `pattern-cell ${mat[i][j] ? 'gray' : 'white'}`;
      cell.style.width = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;
      container.appendChild(cell);
    }
  }
}

// Tab 2: Checker Form
function setupChecker() {
  const btn = document.getElementById('btn-run-check');
  btn.addEventListener('click', runChecker);
}

function runChecker() {
  const page = parseInt(document.getElementById('check-page').value, 10);
  const col = parseInt(document.getElementById('check-col').value, 10);
  const row = parseInt(document.getElementById('check-row').value, 10);
  const resultArea = document.getElementById('checker-result-area');

  if (isNaN(page) || isNaN(col) || isNaN(row) || page < 1 || page > 159 || col < 1 || col > 12 || row < 1 || row > 18) {
    resultArea.innerHTML = '<div style="color:var(--accent-rose);">Bitte gültige Werte eingeben (Seite 1–159, Spalte 1–12, Zeile 1–18).</div>';
    return;
  }

  const key = `${page}_${col}_${row}`;
  const hit = patternIndex ? patternIndex[key] : null;

  if (!hit || !duplicateReport) {
    resultArea.innerHTML = `
      <div class="callout-card" style="border-color: rgba(52, 211, 153, 0.4);">
        <div class="callout-icon">✨</div>
        <div class="callout-text">
          <h3>Kein Duplikat gefunden</h3>
          <p>Das Muster auf <strong>Seite ${page}, Spalte ${col}, Zeile ${row}</strong> ist <strong>vollkommen einzigartig</strong> im gesamten Dokument (auch unter Drehung und Spiegelung).</p>
        </div>
      </div>
    `;
    return;
  }

  const group = duplicateReport.groups.find(g => g.group_id === hit.group_id);
  if (!group) return;

  const otherMembers = group.members.filter(m => !(m.page === page && m.col === col && m.row === row));

  let otherList = '';
  otherMembers.forEach(m => {
    otherList += `
      <li style="margin-bottom: 0.5rem;">
        <strong>Seite ${m.page}</strong>, Spalte ${m.col}, Zeile ${m.row} 
        <span class="member-rel-badge" style="margin-left:0.5rem;">${m.relation_name}</span>
      </li>
    `;
  });

  resultArea.innerHTML = `
    <div class="card" style="border-color: rgba(244, 63, 94, 0.5); background: rgba(244, 63, 94, 0.05);">
      <h3 style="color:var(--accent-rose); margin-bottom: 0.5rem;">⚠️ Duplikat gefunden! (Gruppe #${group.group_id})</h3>
      <p style="margin-bottom: 1rem;">
        Das Muster auf <strong>Seite ${page}, Spalte ${col}, Zeile ${row}</strong> existiert <strong>${group.count} mal</strong> im Dokument:
      </p>
      <div style="display:flex; gap: 2rem; align-items:flex-start; flex-wrap:wrap;">
        <div class="pattern-matrix" id="checker-pattern-grid"></div>
        <div style="flex:1;">
          <h4>Weitere Vorkommen (${otherMembers.length}):</h4>
          <ul style="padding-left:1.25rem; margin-top:0.5rem; color:var(--text-secondary);">
            ${otherList}
          </ul>
        </div>
      </div>
    </div>
  `;

  renderMatrix(group.representative_matrix, 'checker-pattern-grid', 26);
}

// Tab 3: Transformer
function setupTransformer() {
  renderMatrix(sampleMatrix, 'transform-orig-grid', 26);
  renderMatrix(sampleMatrix, 'transform-res-grid', 26);

  const btns = document.querySelectorAll('.trans-btn');
  btns.forEach(b => {
    b.addEventListener('click', () => {
      btns.forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');

      const opKey = b.getAttribute('data-op');
      const transformed = getTransformedMatrix(sampleMatrix, opKey);
      renderMatrix(transformed, 'transform-res-grid', 26);

      document.getElementById('transform-result-title').textContent = `Transformiert: ${TRANS_NAMES[opKey]}`;
      document.getElementById('transform-op-desc').textContent = getOperationDescription(opKey);
    });
  });

  document.getElementById('btn-sample-pattern').addEventListener('click', () => {
    if (duplicateReport && duplicateReport.groups.length > 0) {
      const randIdx = Math.floor(Math.random() * Math.min(50, duplicateReport.groups.length));
      sampleMatrix = duplicateReport.groups[randIdx].representative_matrix;
      renderMatrix(sampleMatrix, 'transform-orig-grid', 26);

      const activeBtn = document.querySelector('.trans-btn.active');
      const opKey = activeBtn ? activeBtn.getAttribute('data-op') : 'identisch';
      const transformed = getTransformedMatrix(sampleMatrix, opKey);
      renderMatrix(transformed, 'transform-res-grid', 26);
    }
  });
}

function getOperationDescription(opKey) {
  switch (opKey) {
    case 'identisch': return 'Originalzustand unverändert.';
    case 'rot90': return 'Um 90 Grad im Uhrzeigersinn gedreht.';
    case 'rot180': return 'Um 180 Grad gedreht (Kopfstehend).';
    case 'rot270': return 'Um 270 Grad im Uhrzeigersinn (oder 90° gegen UZS) gedreht.';
    case 'spiegel_h': return 'An der horizontalen Achse gespiegelt (oben und unten vertauscht).';
    case 'spiegel_v': return 'An der vertikalen Achse gespiegelt (links und rechts vertauscht).';
    case 'diag_main': return 'An der Hauptdiagonale gespiegelt (transponiert).';
    case 'diag_anti': return 'An der Nebendiagonale gespiegelt.';
    default: return '';
  }
}
