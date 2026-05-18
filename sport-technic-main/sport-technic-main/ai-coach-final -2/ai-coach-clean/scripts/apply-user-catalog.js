'use strict';
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, '..', 'src', 'data', 'exerciseRegistry.js');
let src = fs.readFileSync(registryPath, 'utf8');

const catalogStart = src.indexOf('const { SUPPLEMENTAL_CATALOG');
const catalogEnd = src.indexOf('/**\n * Legacy client keys');
if (catalogStart < 0 || catalogEnd < 0) {
  console.error('catalog markers not found', catalogStart, catalogEnd);
  process.exit(1);
}

const newHeader = `'use strict';

const { exerciseCatalog: RAW_EXERCISE_CATALOG } = require('./exerciseCatalog.js');
const { SUPPLEMENTAL_HERITAGE } = require('./exerciseSupplement.generated.js');

/**
 * TrainIQ — Exercise Registry (canonical catalog + kinesiology knowledge graph)
 */

/** @typedef {{ id: string, nameHe: string, nameEn: string }} MuscleRef */
/** @typedef {{ fault_id: string, description: string, anatomical_consequence: string }} BiomechanicalCue */
/** @typedef {'bodyweight'|'barbell'|'dumbbell'|'cable'|'machine'} EquipmentType */

function normalizeTargetMuscles(tm) {
  if (Array.isArray(tm)) return { primary: tm, secondary: [], stabilizers: [] };
  if (tm && Array.isArray(tm.primary)) {
    return {
      primary: tm.primary,
      secondary: tm.secondary || [],
      stabilizers: tm.stabilizers || []
    };
  }
  return { primary: [], secondary: [], stabilizers: [] };
}

`;

const catalogBlock = `/** @type {import('./exerciseCatalog').CatalogEntry[]} */
const EXERCISE_CATALOG = RAW_EXERCISE_CATALOG.map((entry) => ({
  id: entry.id,
  name_he: entry.name_he,
  equipment_type: entry.equipment_type,
  target_muscles: normalizeTargetMuscles(entry.target_muscles)
}));

`;

src = newHeader + catalogBlock + src.slice(catalogEnd);

if (!src.includes('const HERITAGE_RAW = {')) {
  src = src.replace('const HERITAGE = {', 'const HERITAGE_RAW = {');
}

const heritageBuild = `
/** Map catalog id → legacy heritage key (kinesiology blocks keyed by old ids). */
const HERITAGE_SOURCE_KEY = {
  pushups: 'pushup',
  barbell_bench_press: 'benchpress',
  barbell_shoulder_press: 'overheadpress',
  barbell_squat: 'squat',
  barbell_deadlift: 'deadlift',
  hip_thrust: 'hipthrust',
  dumbbell_bench_press: 'dumbbellpress',
  dumbbell_shoulder_press: 'seateddumbbellpress',
  dumbbell_row: 'dumbbellrow',
  cable_tricep_extension: 'cablepushdown',
  cable_bicep_curl: 'cablecurl',
  machine_row: 'seatedrowmachine',
  machine_shoulder_press: 'shoulderpressmachine',
  leg_extension_machine: 'legextension',
  leg_curl_machine: 'legcurl'
};

function defaultHeritage(entry) {
  const iconBy = { bodyweight: '💪', barbell: '🏋️', dumbbell: '🏋️', cable: '🧵', machine: '🦿' };
  const modeBy = {
    bodyweight: 'vertical_pull',
    barbell: 'horizontal_push',
    dumbbell: 'elbow_flex',
    cable: 'horizontal_pull',
    machine: 'knee_dominant'
  };
  return {
    name_en: entry.id,
    icon: iconBy[entry.equipment_type] || '🏋️',
    mode: modeBy[entry.equipment_type] || 'unknown',
    biomechanical_cues: []
  };
}

/** @type {Record<string, object>} */
const HERITAGE = {};
for (const entry of EXERCISE_CATALOG) {
  const srcKey = HERITAGE_SOURCE_KEY[entry.id] || entry.id;
  HERITAGE[entry.id] =
    HERITAGE_RAW[entry.id] || HERITAGE_RAW[srcKey] || defaultHeritage(entry);
}

`;

if (!src.includes('const HERITAGE = {};')) {
  const insertAt = src.indexOf('function runtimeParamsFor(id)');
  if (insertAt < 0) {
    console.error('runtimeParamsFor not found');
    process.exit(1);
  }
  src = src.slice(0, insertAt) + heritageBuild + src.slice(insertAt);
}

const legacyBlock = `/**
 * Legacy client keys (index.html) → canonical catalog id.
 * @type {Record<string, string>}
 */
const LEGACY_KEY_ALIASES = {
  muscleup: 'muscle_up',
  pullup: 'pull_up',
  chinup: 'chin_up',
  pushup: 'pushups',
  benchpress: 'barbell_bench_press',
  overheadpress: 'barbell_shoulder_press',
  squat: 'barbell_squat',
  deadlift: 'barbell_deadlift',
  hipthrust: 'hip_thrust',
  dumbbellpress: 'dumbbell_bench_press',
  seateddumbbellpress: 'dumbbell_shoulder_press',
  dumbbellrow: 'dumbbell_row',
  cablepushdown: 'cable_tricep_extension',
  cablecurl: 'cable_bicep_curl',
  curl: 'dumbbell_curl',
  tricep: 'dumbbell_tricep_extension',
  seatedrowmachine: 'machine_row',
  row: 'barbell_row',
  shoulderpressmachine: 'machine_shoulder_press',
  legextension: 'leg_extension_machine',
  legcurl: 'leg_curl_machine',
  inclinepress: 'incline_bench_press',
  rdl: 'romanian_deadlift',
  lateralraise: 'dumbbell_lateral_raise',
  pullover: 'dumbbell_pullover',
  cablefly: 'cable_fly',
  facepull: 'face_pull',
  latpulldown: 'lat_pulldown_machine',
  chestpressmachine: 'chest_press_machine',
  legpress: 'leg_press_machine',
  hacksquat: 'hack_squat_machine',
  smithsquat: 'smith_machine_squat',
  rearfly: 'reverse_pec_deck_machine',
  seatedcalfraise: 'seated_calf_raise_machine',
  calfraise: 'standing_calf_raise'
};

`;

src = src.replace(
  /\/\*\*\n \* Legacy client keys[\s\S]*?^};\n\n/m,
  legacyBlock
);

src = src.replace(
  'function targetMusclesToAnatomy(target_muscles) {\n  const tm = target_muscles || {};',
  'function targetMusclesToAnatomy(target_muscles) {\n  const tm = normalizeTargetMuscles(target_muscles);'
);

src = src.replace(
  `function summarizeMusclesShort(target_muscles, maxItems = 4) {
  const primary = (target_muscles && target_muscles.primary) || [];
  const secondary = (target_muscles && target_muscles.secondary) || [];
  const lines = [...primary, ...secondary].slice(0, maxItems).map(hebrewMuscleLabel);
  const short = lines.map((he) => {
    if (/רחב גבי|גבי/.test(he)) return 'רחב גבי';
    if (/חזה/.test(he)) return /עליון/.test(he) ? 'חזה עליון' : 'חזה';
    if (/תלת|טרייספס/.test(he)) return 'טריספס';
    if (/דלתא/.test(he)) return /אחור/.test(he) ? 'דלתא אחורית' : /אמצע/.test(he) ? 'דלתא אמצעית' : 'כתפיים';
    if (/דו ראשי|בייספס/.test(he)) return 'ביספס';
    if (/המסטרינג/.test(he)) return 'המסטרינג';
    if (/גלוטאוס|ישבן/.test(he)) return 'גלוטאוס';
    if (/ותוס|ארבע/.test(he)) return 'קוואדס';
    if (/מעוין|שכמ/.test(he)) return 'שכמות';
    if (/טרפז/.test(he)) return 'טרפז';
    if (/תאום|סולאוס/.test(he)) return 'תאומים';
    if (/ליבה|בטן|ישר בטני/.test(he)) return 'ליבה';
    if (/זוקפי|גב תחתון/.test(he)) return 'גב תחתון';
    return he.length > 22 ? he.slice(0, 20) + '…' : he;
  });
  const seen = Object.create(null);
  const out = [];
  for (const s of short) {
    if (!s || seen[s]) continue;
    seen[s] = true;
    out.push(s);
  }
  return out.join(', ');
}`,
  `function summarizeMusclesShort(target_muscles, maxItems = 4) {
  const tm = normalizeTargetMuscles(target_muscles);
  const lines = [...tm.primary, ...tm.secondary].slice(0, maxItems);
  return lines.join(', ');
}`
);

fs.writeFileSync(registryPath, src, 'utf8');
console.log('Applied user catalog to exerciseRegistry.js');
