'use strict';
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const start = html.indexOf('applyExerciseCatalogRows([');
const end = html.indexOf('const EXERCISE_CV_CONFIG', start);
if (start < 0 || end < 0) {
  console.error('Could not find hardcoded catalog block', start, end);
  process.exit(1);
}

const replacement = `let CATALOG_ROWS = [];
let catalogLoadPromise = null;

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function getExerciseDisplayName(keyOrId) {
  const id = canonExKey(keyOrId);
  if (id && EX[id] && EX[id].n) return EX[id].n;
  const row = CATALOG_ROWS.find(function (r) { return r.id === id; });
  if (row && row.name_he) return row.name_he;
  return String(keyOrId || 'לא זוהה');
}

async function fetchExerciseCatalogFromApi() {
  const r = await fetch(apiUrl('/api/exercise-catalog'), {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  if (!r.ok) throw new Error('catalog HTTP ' + r.status);
  const j = await r.json();
  if (!j || j.ok !== true || !Array.isArray(j.exercises) || !j.exercises.length) {
    throw new Error('invalid catalog JSON');
  }
  return j.exercises;
}

function populateExerciseSelects() {
  const sorted = CATALOG_ROWS.slice().sort(function (a, b) {
    return String(a.name_he || '').localeCompare(String(b.name_he || ''), 'he');
  });
  const opts =
    '<option value="">— בחר תרגיל —</option>' +
    sorted
      .map(function (e) {
        return (
          '<option value="' +
          escapeAttr(e.id) +
          '">' +
          escapeHtml(e.name_he || e.id) +
          '</option>'
        );
      })
      .join('');

  const mainSel = document.getElementById('exercise-select');
  if (mainSel) {
    mainSel.innerHTML = opts;
    if (selEx && EX[selEx]) mainSel.value = selEx;
  }
  fillProgressExerciseSelect();
}

function onExerciseSelectChange() {
  const sel = document.getElementById('exercise-select');
  if (!sel || !sel.value) return;
  markExerciseSelection(sel.value);
  chk();
}

function showCatalogLoadError(err) {
  const msg =
    '<div style="text-align:center;color:var(--muted);padding:22px 12px;font-size:13px;line-height:1.6">' +
    'לא נטען קטלוג התרגילים. הפעל את השרת (npm start) ופתח ' +
    '<a href="http://localhost:3847" style="color:var(--green)">http://localhost:3847</a>' +
    '<br><span style="font-size:11px;opacity:.8">' +
    escapeHtml(err && err.message ? err.message : err) +
    '</span></div>';
  const grid = document.getElementById('ex-grid');
  const lib = document.getElementById('ex-grid-library');
  if (grid) grid.innerHTML = msg;
  if (lib) lib.innerHTML = msg;
}

function ensureExerciseCatalogLoaded() {
  if (!catalogLoadPromise) {
    catalogLoadPromise = fetchExerciseCatalogFromApi()
      .then(function (rows) {
        CATALOG_ROWS = rows;
        applyExerciseCatalogRows(rows);
        populateExerciseSelects();
        renderExerciseGrid(
          'ex-grid-library',
          'lib-ex',
          'pickLibraryEx',
          'copyExerciseGuideLibraryFor',
          true
        );
        refreshMainExerciseGrid();
        return rows;
      })
      .catch(function (err) {
        console.error('[catalog] load failed', err);
        showCatalogLoadError(err);
        catalogLoadPromise = null;
        throw err;
      });
  }
  return catalogLoadPromise;
}

async function initExerciseCatalog() {
  return ensureExerciseCatalogLoaded();
}

`;

html = html.slice(0, start) + replacement + html.slice(end);

const gridInsert =
  '      <label class="exercise-select-label" for="exercise-select">בחירה מהירה מתוך הקטלוג</label>\n' +
  '      <select id="exercise-select" class="exercise-select" dir="rtl" onchange="onExerciseSelectChange()">\n' +
  '        <option value="">טוען קטלוג תרגילים...</option>\n' +
  '      </select>\n' +
  '      <div class="ex-grid" id="ex-grid"></div>';

if (html.includes('      <motion-div class="ex-grid" id="ex-grid"></motion-div>')) {
  // noop
}
if (html.includes('      <div class="ex-grid" id="ex-grid"></div>') && !html.includes('id="exercise-select"')) {
  html = html.replace('      <div class="ex-grid" id="ex-grid"></div>', gridInsert);
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Wired catalog UI — removed embedded JSON array');
