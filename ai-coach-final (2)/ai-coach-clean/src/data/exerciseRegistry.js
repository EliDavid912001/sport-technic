'use strict';

/**
 * TrainIQ — canonical exercise registry (37 exercises).
 * Simple Hebrew target_muscles; equipment in name_he. No emojis.
 */

/** @typedef {'bodyweight'|'barbell'|'dumbbell'|'cable'|'machine'} EquipmentType */

const EXERCISE_REGISTRY = [
  // --- CALISTHENICS / BODYWEIGHT ---
  { id: 'muscle_up', name_he: 'עליות כוח (מאסל אפ)', equipment_type: 'bodyweight', target_muscles: ['גב', 'חזה', 'טרייספס', 'ליבה'] },
  { id: 'pull_up', name_he: 'עליות מתח', equipment_type: 'bodyweight', target_muscles: { primary: ['גב', 'ביספס'], secondary: [], stabilizers: ['ליבה'] } },
  { id: 'chin_up', name_he: 'עליות מתח באחיזה הפוכה (צ׳ין אפ)', equipment_type: 'bodyweight', target_muscles: { primary: ['גב', 'ביספס'], secondary: [], stabilizers: ['ליבה'] } },
  { id: 'dips', name_he: 'מקבילים', equipment_type: 'bodyweight', target_muscles: ['חזה תחתון', 'טרייספס'] },
  { id: 'pushups', name_he: 'שכיבות סמיכה', equipment_type: 'bodyweight', target_muscles: ['חזה', 'טרייספס', 'כתפיים'] },

  // --- BARBELL (מוט) ---
  { id: 'barbell_bench_press', name_he: 'בנץ׳ פרס כנגד מוט', equipment_type: 'barbell', target_muscles: ['חזה', 'טרייספס', 'כתפיים'] },
  { id: 'incline_bench_press', name_he: 'לחיצת חזה עליון כנגד מוט', equipment_type: 'barbell', target_muscles: ['חזה עליון', 'כתף קדמית', 'טרייספס'] },
  { id: 'barbell_shoulder_press', name_he: 'לחיצת כתפיים כנגד מוט', equipment_type: 'barbell', target_muscles: ['כתפיים', 'טרייספס', 'ליבה'] },
  { id: 'barbell_row', name_he: 'חתירה כנגד מוט', equipment_type: 'barbell', target_muscles: ['גב', 'ביספס', 'שכמות'] },
  { id: 'barbell_squat', name_he: 'סקוואט כנגד מוט', equipment_type: 'barbell', target_muscles: ['רגליים', 'גלוטאוס'] },
  { id: 'barbell_deadlift', name_he: 'דדליפט כנגד מוט', equipment_type: 'barbell', target_muscles: ['גב תחתון', 'גלוטאוס', 'המסטרינג'] },
  { id: 'romanian_deadlift', name_he: 'דדליפט רומני כנגד מוט (RDL)', equipment_type: 'barbell', target_muscles: ['המסטרינג', 'גלוטאוס', 'גב תחתון'] },
  { id: 'hip_thrust', name_he: 'היפ תראסט כנגד מוט', equipment_type: 'barbell', target_muscles: ['גלוטאוס', 'המסטרינג'] },

  // --- DUMBBELLS (משקולות יד) ---
  { id: 'dumbbell_bench_press', name_he: 'לחיצת חזה דאמבלים', equipment_type: 'dumbbell', target_muscles: ['חזה', 'טרייספס', 'כתפיים'] },
  { id: 'dumbbell_shoulder_press', name_he: 'לחיצת כתף ישיבה דאמבלים', equipment_type: 'dumbbell', target_muscles: ['כתפיים', 'טרייספס', 'ליבה'] },
  { id: 'dumbbell_row', name_he: 'חתירת דאמבל', equipment_type: 'dumbbell', target_muscles: ['גב', 'ביספס', 'שכמות'] },
  { id: 'dumbbell_curl', name_he: 'כפיפת מרפקים כנגד משקולות יד (בייספס קרל)', equipment_type: 'dumbbell', target_muscles: ['ביספס', 'ברכיאליס'] },
  { id: 'dumbbell_tricep_extension', name_he: 'פשיטת מרפקים מאחורי הראש כנגד משקולת יד', equipment_type: 'dumbbell', target_muscles: ['טרייספס'] },
  { id: 'dumbbell_lateral_raise', name_he: 'הרחקת כתפיים כנגד משקולות יד', equipment_type: 'dumbbell', target_muscles: ['דלתא אמצעית'] },
  { id: 'dumbbell_pullover', name_he: 'פול אובר כנגד משקולת יד', equipment_type: 'dumbbell', target_muscles: ['גב', 'ליבה', 'כתפיים'] },
  { id: 'lunges', name_he: 'לאנג׳ים כנגד דאמבלים', equipment_type: 'dumbbell', target_muscles: ['קוואדס', 'גלוטאוס', 'מייצבים'] },

  // --- CABLES (כבלים) ---
  { id: 'cable_fly', name_he: 'פרפר כנגד כבלים', equipment_type: 'cable', target_muscles: ['חזה', 'כתף קדמית'] },
  { id: 'face_pull', name_he: 'משיכת חבל לפנים כנגד כבל (פייס פול)', equipment_type: 'cable', target_muscles: ['דלתא אחורית', 'שכמות', 'טרפז'] },
  { id: 'cable_tricep_extension', name_he: 'פשיטת טרייספס כבל', equipment_type: 'cable', target_muscles: ['טרייספס'] },
  { id: 'cable_bicep_curl', name_he: 'כפיפת בייספס כבל', equipment_type: 'cable', target_muscles: ['ביספס'] },

  // --- MACHINES (מכונות) ---
  { id: 'lat_pulldown_machine', name_he: 'פולי עליון במכונה (לאט פולדאון)', equipment_type: 'machine', target_muscles: ['רחב גבי', 'ביספס'] },
  { id: 'machine_row', name_he: 'חתירה במכונה', equipment_type: 'machine', target_muscles: ['גב', 'ביספס'] },
  { id: 'chest_press_machine', name_he: 'לחיצת חזה במכונה', equipment_type: 'machine', target_muscles: ['חזה', 'טרייספס'] },
  { id: 'machine_shoulder_press', name_he: 'לחיצת כתפיים במכונה', equipment_type: 'machine', target_muscles: ['כתפיים', 'טרייספס'] },
  { id: 'leg_press_machine', name_he: 'לחיצת רגליים במכונה', equipment_type: 'machine', target_muscles: ['קוואדס', 'גלוטאוס'] },
  { id: 'hack_squat_machine', name_he: 'האק סקוואט במכונה', equipment_type: 'machine', target_muscles: ['קוואדס', 'גלוטאוס'] },
  { id: 'smith_machine_squat', name_he: 'סקוואט במכשיר סמית׳ משין', equipment_type: 'machine', target_muscles: ['רגליים', 'גלוטאוס'] },
  { id: 'reverse_pec_deck_machine', name_he: 'פרפר הפוך במכונה (הרחקה אחורית)', equipment_type: 'machine', target_muscles: ['דלתא אחורית', 'שכמות'] },
  { id: 'seated_calf_raise_machine', name_he: 'תאומים בישיבה במכונה', equipment_type: 'machine', target_muscles: ['תאומים', 'סולאוס'] },
  { id: 'standing_calf_raise', name_he: 'תאומים בעמידה / הרמות שוק', equipment_type: 'machine', target_muscles: ['תאומים', 'סולאוס'] },
  { id: 'leg_extension_machine', name_he: 'פשיטת ברך במכונה', equipment_type: 'machine', target_muscles: ['קוואדס'] },
  { id: 'leg_curl_machine', name_he: 'כפיפת ברך במכונה', equipment_type: 'machine', target_muscles: ['המסטרינג'] }
];

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

const EXERCISE_CATALOG = EXERCISE_REGISTRY.map((entry) => ({
  id: entry.id,
  name_he: entry.name_he,
  equipment_type: entry.equipment_type,
  target_muscles: normalizeTargetMuscles(entry.target_muscles)
}));

const DEFAULT_RUNTIME_PARAMS = {
  upThreshold: 0.85,
  downThreshold: 0.15,
  debounceMs: 480,
  minRom: 12,
  minCycleAmp: 0.5,
  scoreFloor: 55,
  scoreFloorReps3: 60
};

const RUNTIME_OVERRIDES = {
  muscle_up: { upThreshold: 0.89, downThreshold: 0.11, debounceMs: 520, minRom: 16, minCycleAmp: 0.58, scoreFloor: 58, scoreFloorReps3: 64 },
  pull_up: { upThreshold: 0.88, downThreshold: 0.12, debounceMs: 500, minRom: 14, minCycleAmp: 0.54, scoreFloor: 55, scoreFloorReps3: 62 },
  chin_up: { upThreshold: 0.88, downThreshold: 0.12, debounceMs: 500, minRom: 14, minCycleAmp: 0.54, scoreFloor: 55, scoreFloorReps3: 62 },
  dumbbell_pullover: { upThreshold: 0.9, downThreshold: 0.1, debounceMs: 540, minRom: 18, minCycleAmp: 0.6, scoreFloor: 60, scoreFloorReps3: 66 },
  smith_machine_squat: { upThreshold: 0.86, downThreshold: 0.14, debounceMs: 520, minRom: 13, minCycleAmp: 0.52, scoreFloor: 55, scoreFloorReps3: 60 },
  romanian_deadlift: { upThreshold: 0.86, downThreshold: 0.14, debounceMs: 520, minRom: 13, minCycleAmp: 0.5, scoreFloor: 55, scoreFloorReps3: 60 },
  barbell_squat: { upThreshold: 0.86, downThreshold: 0.14, debounceMs: 520, minRom: 13, minCycleAmp: 0.52, scoreFloor: 55, scoreFloorReps3: 60 },
  barbell_deadlift: { upThreshold: 0.86, downThreshold: 0.14, debounceMs: 520, minRom: 13, minCycleAmp: 0.5, scoreFloor: 55, scoreFloorReps3: 60 }
};

/** Legacy client keys → canonical catalog id. */
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

const CV_BY_EQUIPMENT = {
  bodyweight: { category: 'bodyweight', primary_tracking_joints: [11, 12, 15, 16], movement_axis: 'y', motion: 'up' },
  barbell: { category: 'barbell', primary_tracking_joints: [15, 16], movement_axis: 'y', motion: 'down' },
  dumbbell: { category: 'dumbbell', primary_tracking_joints: [15, 16], movement_axis: 'y', motion: 'up' },
  cable: { category: 'cable', primary_tracking_joints: [15, 16], movement_axis: 'y', motion: 'down' },
  machine: { category: 'machine', primary_tracking_joints: [23, 24], movement_axis: 'y', motion: 'down' }
};

const MODE_BY_EQUIPMENT = {
  bodyweight: 'vertical_pull',
  barbell: 'horizontal_push',
  dumbbell: 'elbow_flex',
  cable: 'horizontal_pull',
  machine: 'knee_dominant'
};

const CV_OVERRIDES = {
  muscle_up: { category: 'bodyweight', primary_tracking_joints: [11, 12, 15, 16], movement_axis: 'y', motion: 'up' },
  pull_up: { category: 'bodyweight', primary_tracking_joints: [11, 12, 15, 16], movement_axis: 'y', motion: 'up' },
  chin_up: { category: 'bodyweight', primary_tracking_joints: [11, 12, 15, 16], movement_axis: 'y', motion: 'up' },
  barbell_row: { category: 'barbell', primary_tracking_joints: [15, 16], movement_axis: 'x', motion: 'in' },
  romanian_deadlift: { category: 'barbell', primary_tracking_joints: [23, 24], movement_axis: 'y', motion: 'down' },
  lat_pulldown_machine: { category: 'machine', primary_tracking_joints: [15, 16], movement_axis: 'y', motion: 'up' }
};

function runtimeParamsFor(id) {
  return { ...DEFAULT_RUNTIME_PARAMS, ...(RUNTIME_OVERRIDES[id] || {}) };
}

function cvProfileFor(entry) {
  const base = CV_BY_EQUIPMENT[entry.equipment_type] || CV_BY_EQUIPMENT.machine;
  return { ...base, ...(CV_OVERRIDES[entry.id] || {}) };
}

function slugifyMuscleId(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'muscle';
}

function parseMuscleLabel(line) {
  const s = String(line || '').trim();
  const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    return { id: slugifyMuscleId(m[2]), nameHe: m[1].trim(), nameEn: m[2].trim() };
  }
  return { id: slugifyMuscleId(s), nameHe: s, nameEn: s };
}

function linesToMuscleRefs(lines) {
  const seen = Object.create(null);
  const out = [];
  for (const line of lines || []) {
    const ref = parseMuscleLabel(line);
    if (seen[ref.id]) continue;
    seen[ref.id] = true;
    out.push(ref);
  }
  return out;
}

function targetMusclesToAnatomy(target_muscles) {
  const tm = normalizeTargetMuscles(target_muscles);
  return {
    primary: linesToMuscleRefs(tm.primary),
    secondary: linesToMuscleRefs(tm.secondary),
    stabilizers: linesToMuscleRefs(tm.stabilizers)
  };
}

function normalizeLookupKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

function resolveCanonicalId(key) {
  const k = normalizeLookupKey(key);
  if (!k) return '';
  if (EXERCISE_CATALOG.some((e) => e.id === k)) return k;
  return LEGACY_KEY_ALIASES[k] || '';
}

const LEG_MACHINE_IDS = new Set([
  'leg_press_machine',
  'hack_squat_machine',
  'smith_machine_squat',
  'leg_extension_machine',
  'leg_curl_machine',
  'seated_calf_raise_machine',
  'standing_calf_raise'
]);

/** UI icon from equipment_type + exercise id (UTF-8 via \\u escapes; no stored icon strings). */
function getExerciseIcon(id, equipmentType) {
  const key = String(id || '').trim().toLowerCase();
  const eq = String(equipmentType || '').trim().toLowerCase();

  if (key === 'dips') return '\u26A1';
  if (key === 'barbell_deadlift' || key === 'romanian_deadlift') return '\u{1F3C6}';

  switch (eq) {
    case 'bodyweight':
      return '\u{1F525}';
    case 'barbell':
      return '\u{1F3CB}\uFE0F';
    case 'dumbbell':
      return '\u{1F4AA}';
    case 'cable':
      return '\u{1F9F5}';
    case 'machine':
      return LEG_MACHINE_IDS.has(key) ? '\u{1F9B5}' : '\u{1F916}';
    default:
      return '\u{1F3CB}\uFE0F';
  }
}

function buildRegistryEntry(catalogEntry) {
  return {
    id: catalogEntry.id,
    key: catalogEntry.id,
    name_he: catalogEntry.name_he,
    equipment_type: catalogEntry.equipment_type,
    target_muscles: catalogEntry.target_muscles,
    metadata: {
      name: { he: catalogEntry.name_he, en: catalogEntry.id },
      icon: getExerciseIcon(catalogEntry.id, catalogEntry.equipment_type),
      category: catalogEntry.equipment_type,
      mode: MODE_BY_EQUIPMENT[catalogEntry.equipment_type] || 'unknown'
    },
    anatomy: targetMusclesToAnatomy(catalogEntry.target_muscles),
    biomechanical_cues: [],
    runtime_params: runtimeParamsFor(catalogEntry.id),
    cv_profile: cvProfileFor(catalogEntry)
  };
}

/** @type {Record<string, ReturnType<typeof buildRegistryEntry>>} */
const exerciseRegistry = Object.fromEntries(
  EXERCISE_CATALOG.map((entry) => [entry.id, buildRegistryEntry(entry)])
);

function getCatalogEntry(id) {
  const canonical = resolveCanonicalId(id);
  return EXERCISE_CATALOG.find((e) => e.id === canonical) || null;
}

function getExercise(key) {
  const canonical = resolveCanonicalId(key);
  if (!canonical) return null;
  return exerciseRegistry[canonical] || null;
}

function listExerciseKeys() {
  return EXERCISE_CATALOG.map((e) => e.id).sort();
}

function listCatalog() {
  return EXERCISE_CATALOG.slice();
}

function getExercisesByEquipmentType(equipmentType) {
  const t = String(equipmentType || '').trim().toLowerCase();
  return EXERCISE_CATALOG.filter((e) => e.equipment_type === t);
}

function getFaultCatalog() {
  return {};
}

function summarizeMusclesShort(target_muscles, maxItems = 4) {
  const tm = normalizeTargetMuscles(target_muscles);
  return [...tm.primary, ...tm.secondary].slice(0, maxItems).join(', ');
}

function listCatalogForUi() {
  return EXERCISE_CATALOG.map((entry) => ({
    id: entry.id,
    name_he: entry.name_he,
    equipment_type: entry.equipment_type,
    target_muscles: entry.target_muscles,
    muscles_short: summarizeMusclesShort(entry.target_muscles),
    icon: getExerciseIcon(entry.id, entry.equipment_type),
    mode: MODE_BY_EQUIPMENT[entry.equipment_type] || 'unknown',
    en: entry.id
  }));
}

module.exports = {
  EXERCISE_REGISTRY,
  exerciseCatalog: EXERCISE_CATALOG,
  DEFAULT_RUNTIME_PARAMS,
  RUNTIME_OVERRIDES,
  EXERCISE_CATALOG,
  LEGACY_KEY_ALIASES,
  exerciseRegistry,
  getCatalogEntry,
  getExercise,
  listCatalog,
  listExerciseKeys,
  getExercisesByEquipmentType,
  getFaultCatalog,
  resolveCanonicalId,
  runtimeParamsFor,
  summarizeMusclesShort,
  getExerciseIcon,
  listCatalogForUi
};
