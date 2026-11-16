// Gerd Doppelsuche — D4 Symmetry Duplicate Scanner & Analyzer

let duplicateReport = null;
let filteredGroups = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 40;

let selectedGroup = null;

// In-memory set of resolved patterns for the current session (no local persistence)
let resolvedPatterns = new Set();
try {
  localStorage.removeItem('gerd_resolved_patterns');
} catch (e) {}

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

// Helper keys
function getPatternKey(page, col, row) {
  return `${page}_${col}_${row}`;
}

function isPatternResolved(m) {
  if (m.is_first) return false;
  return resolvedPatterns.has(getPatternKey(m.page, m.col, m.row));
}

function getOpenMembers(group) {
  return group.members.filter(m => !isPatternResolved(m));
}

function isGroupResolved(group) {
  // A duplicate is solved once fewer than 2 open occurrences remain (only the reference remains)
  return getOpenMembers(group).length < 2;
}

// Toggle resolution of a specific pattern instance (only non-reference duplicates)
window.toggleResolvePattern = function(page, col, row) {
  if (selectedGroup) {
    const member = selectedGroup.members.find(m => m.page === page && m.col === col && m.row === row);
    if (member && member.is_first) {
      return; // Reference can never be resolved
    }
  }

  const key = getPatternKey(page, col, row);
  if (resolvedPatterns.has(key)) {
    resolvedPatterns.delete(key);
  } else {
    resolvedPatterns.add(key);
  }

  updateHeaderStats();
  applyFilters();
};

document.addEventListener('DOMContentLoaded', () => {
  setupUpload();
  setupFilters();
  updateHeaderStats();
  applyFilters();
});

// Setup local PDF upload
function setupUpload() {
  const fileInput = document.getElementById('pdf-upload-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handlePdfFile(file);
      e.target.value = '';
    });
  }
}

async function handlePdfFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Bitte wählen Sie eine gültige PDF-Datei aus.');
    return;
  }

  const progressBox = document.getElementById('upload-progress-box');
  const progressText = document.getElementById('upload-progress-text');

  if (progressBox) progressBox.style.display = 'inline-flex';
  if (progressText) progressText.textContent = `Analysiere "${file.name}"...`;

  try {
    const res = await fetch('/api/analyze-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: file
    });

    if (!res.ok) {
      throw new Error(`Server antwortete mit Status ${res.status}`);
    }

    const report = await res.json();
    duplicateReport = report;
    resolvedPatterns = new Set();
    selectedGroup = null;
    currentPage = 1;

    if (progressText) progressText.textContent = 'Fertig!';

    setTimeout(() => {
      if (progressBox) progressBox.style.display = 'none';
    }, 1200);

    const subtitleEl = document.getElementById('app-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `${report.total_patterns.toLocaleString()} Muster analysiert (${file.name})`;
    }

    updateHeaderStats();
    applyFilters();
  } catch (err) {
    console.error('Fehler bei der PDF-Analyse:', err);
    alert('Fehler bei der Analyse: ' + err.message);
    if (progressBox) progressBox.style.display = 'none';
  }
}

// Update header stats with open/resolved counts
function updateHeaderStats() {
  const headerStats = document.getElementById('header-stats');
  if (!duplicateReport) {
    if (headerStats) headerStats.style.display = 'none';
    return;
  }

  if (headerStats) headerStats.style.display = 'flex';

  const totalPatternsEl = document.getElementById('stat-total-patterns');
  const uniqueClassesEl = document.getElementById('stat-unique-classes');
  const openGroupsEl = document.getElementById('stat-open-groups-num');
  const resolvedEl = document.getElementById('stat-resolved-num');

  if (totalPatternsEl) totalPatternsEl.textContent = duplicateReport.total_patterns.toLocaleString();
  if (uniqueClassesEl) uniqueClassesEl.textContent = duplicateReport.unique_symmetry_classes.toLocaleString();

  // Count open groups (< 2 open members = resolved)
  let openCount = 0;
  for (const g of duplicateReport.groups) {
    if (!isGroupResolved(g)) {
      openCount++;
    }
  }

  if (openGroupsEl) openGroupsEl.textContent = openCount.toLocaleString();
  if (resolvedEl) resolvedEl.textContent = resolvedPatterns.size.toLocaleString();
}

// Setup filters
function setupFilters() {
  const statusSelect = document.getElementById('filter-status');
  const pageInput = document.getElementById('search-page-input');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (statusSelect) statusSelect.addEventListener('change', () => { currentPage = 1; applyFilters(); });
  if (pageInput) pageInput.addEventListener('input', () => { currentPage = 1; applyFilters(); });

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
  if (!duplicateReport) {
    const badge = document.getElementById('results-count-badge');
    if (badge) badge.textContent = 'Kein PDF geladen';
    const container = document.getElementById('duplicate-groups-container');
    if (container) {
      container.innerHTML = '<div class="empty-state">Bitte oben auf „PDF laden & analysieren“ klicken, um ein Dokument zu laden.</div>';
    }
    const panel = document.getElementById('dup-detail-panel');
    if (panel) {
      panel.innerHTML = '<div class="empty-state">Noch kein Dokument geladen.</div>';
    }
    return;
  }

  const statusVal = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'open';
  const pageQuery = document.getElementById('search-page-input') ? document.getElementById('search-page-input').value.trim() : '';

  filteredGroups = duplicateReport.groups.filter(g => {
    const isResolved = isGroupResolved(g);

    // Status filter: "open" (Standard), "all", "resolved"
    if (statusVal === 'open' && isResolved) return false;
    if (statusVal === 'resolved' && !isResolved) return false;

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

  // Keep selected group if still in filtered list, else select first
  if (selectedGroup && filteredGroups.some(g => g.group_id === selectedGroup.group_id)) {
    // re-render the detail panel to update resolved status
    const currentG = filteredGroups.find(g => g.group_id === selectedGroup.group_id);
    selectGroup(currentG);
  } else if (filteredGroups.length > 0) {
    selectGroup(filteredGroups[0]);
  } else {
    selectedGroup = null;
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
    const isResolved = isGroupResolved(group);
    const openMembers = getOpenMembers(group);

    const item = document.createElement('div');
    item.className = `dup-group-item ${selectedGroup && selectedGroup.group_id === group.group_id ? 'active' : ''} ${isResolved ? 'group-resolved' : ''}`;

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
      <div class="group-title">
        Gruppe #${group.group_id} 
        ${isResolved ? '<span class="status-tag resolved">Gelöst</span>' : ''}
      </div>
      <div class="group-sub">Erstes: S.${firstLoc.page} (Sp.${firstLoc.col}, Z.${firstLoc.row})</div>
    `;

    preview.appendChild(miniGrid);
    preview.appendChild(meta);

    const countBadge = document.createElement('span');
    if (isResolved) {
      countBadge.className = 'badge-count badge-resolved';
      countBadge.textContent = '✓ Gelöst';
    } else if (openMembers.length < group.count) {
      countBadge.className = 'badge-count badge-partial';
      countBadge.textContent = `${openMembers.length}/${group.count} offen`;
    } else {
      countBadge.className = 'badge-count';
      countBadge.textContent = `${group.count}×`;
    }

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

  const openMembers = getOpenMembers(group);
  const isResolved = isGroupResolved(group);

  let membersHtml = '';
  group.members.forEach((m, idx) => {
    const isMemberDone = isPatternResolved(m);
    const relClass = m.relation_to_first === 'identisch' ? 'identisch' : '';

    let actionBtnHtml = '';
    if (m.is_first) {
      actionBtnHtml = `<span class="ref-preserve-badge" title="Originalmuster bleibt dauerhaft erhalten">Original (bleibt)</span>`;
    } else {
      actionBtnHtml = `
        <button class="btn btn-action ${isMemberDone ? 'btn-undo' : 'btn-done'}" 
                onclick="toggleResolvePattern(${m.page}, ${m.col}, ${m.row})"
                title="${isMemberDone ? 'Wieder als offen markieren' : 'Dieses Duplikat als erledigt markieren'}">
          ${isMemberDone ? '↩ Rückgängig' : '✓ Erledigt'}
        </button>
      `;
    }

    membersHtml += `
      <div class="member-card ${m.is_first ? 'is-rep' : ''} ${isMemberDone ? 'is-resolved' : ''}">
        <div class="member-header">
          <div class="member-loc-area">
            <span class="member-loc">Seite ${m.page} (Spalte ${m.col}, Zeile ${m.row})</span>
            <span class="member-rel-badge ${relClass}">${m.is_first ? '★ Referenz (Original)' : m.relation_name}</span>
            ${isMemberDone ? '<span class="member-done-badge">✓ Erledigt</span>' : ''}
          </div>
          ${actionBtnHtml}
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
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <h3>Duplikat-Gruppe #${group.group_id}</h3>
          ${isResolved ? '<span class="status-tag resolved">✓ Konflikt gelöst</span>' : ''}
        </div>
        <p style="color:var(--text-secondary); font-size:0.88rem; margin-top:0.3rem;">
          ${group.count} Vorkommen gesamt · <strong style="color:${isResolved ? 'var(--accent-emerald)' : 'var(--text-primary)'}">${openMembers.length} noch offen</strong>.
        </p>
      </div>
      <div>
        <span class="badge-count ${isResolved ? 'badge-resolved' : ''}" style="font-size:0.9rem; padding:0.35rem 0.8rem;">
          ${isResolved ? '✓ Gelöst' : `${openMembers.length} offene Fundstellen`}
        </span>
      </div>
    </div>

    <h4>Fundstellen dieses Musters:</h4>
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
