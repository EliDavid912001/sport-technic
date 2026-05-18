'use strict';
const fs = require('fs');
const path = require('path');
const { listCatalogForUi } = require('../src/data/exerciseRegistry.js');

const htmlPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const start = html.indexOf('applyExerciseCatalogRows([');
const afterMarker = 'const EXERCISE_CV_CONFIG';
const after = html.indexOf(afterMarker, start);
if (start < 0 || after < 0) {
  console.error('markers not found', start, after);
  process.exit(1);
}

const rows = listCatalogForUi();
const block =
  'applyExerciseCatalogRows(' + JSON.stringify(rows, null, 2) + ');\n\n';
html = html.slice(0, start) + block + html.slice(after);
fs.writeFileSync(htmlPath, html);
console.log('Patched index.html catalog fallback:', rows.length, 'exercises');
