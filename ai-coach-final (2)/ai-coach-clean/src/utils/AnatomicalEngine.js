/**
 * TrainIQ — Anatomical Truth Engine (rule-based muscle lists from exerciseLibrary.json).
 * Browser: preloads JSON via fetch; exposes global TrainIQAnatomicalEngine.
 * Node: require() reads JSON from disk synchronously.
 */
(function (global) {
  'use strict';

  /** @type {Record<string, string>} TrainIQ registry exercise key → exerciseLibrary.json id */
  var REGISTRY_TO_LIBRARY_ID = {
    benchpress: 'bench_press',
    overheadpress: 'overhead_press',
    row: 'row',
    latpulldown: 'lat_pulldown',
    legextension: 'leg_extension',
    legcurl: 'leg_curl',
    chestpressmachine: 'machine_chest_press',
    seatedrowmachine: 'machine_row',
    shoulderpressmachine: 'machine_shoulder_press',
    seatedcalfraise: 'seated_calf_raise',
    cablepushdown: 'tricep_pushdown',
    cablecurl: 'bicep_cable_curl',
    dumbbellrow: 'db_row',
    dumbbellpress: 'db_bench_press',
    inclinepress: 'incline_db_press',
    lateralraise: 'lateral_raise',
    rearfly: 'reverse_fly',
    legpress: 'leg_press',
    hacksquat: 'hack_squat',
    cablefly: 'cable_fly',
    facepull: 'face_pull',
    squat: 'squat',
    deadlift: 'deadlift',
    hipthrust: 'hip_thrust',
    muscleup: 'muscle_up',
    muscle_up: 'muscle_up',
    pullup: 'pull_up',
    pull_up: 'pull_up',
    inclinepress: 'incline_db_press',
    incline_bench_press: 'incline_db_press',
    row: 'row',
    barbell_row: 'row',
    rdl: 'deadlift',
    romanian_deadlift: 'deadlift',
    lateralraise: 'lateral_raise',
    dumbbell_lateral_raise: 'lateral_raise',
    cablefly: 'cable_fly',
    cable_fly: 'cable_fly',
    facepull: 'face_pull',
    face_pull: 'face_pull',
    latpulldown: 'lat_pulldown',
    lat_pulldown_machine: 'lat_pulldown',
    chestpressmachine: 'machine_chest_press',
    chest_press_machine: 'machine_chest_press',
    legpress: 'leg_press',
    leg_press_machine: 'leg_press',
    hacksquat: 'hack_squat',
    hack_squat_machine: 'hack_squat',
    smithsquat: 'squat',
    smith_machine_squat: 'squat',
    rearfly: 'reverse_fly',
    reverse_pec_deck_machine: 'reverse_fly',
    seatedcalfraise: 'seated_calf_raise',
    seated_calf_raise_machine: 'seated_calf_raise',
    pushup: 'push_up'
  };

  var SECTION_LABELS_HE = {
    primaryTitle: 'המנועים הראשיים',
    primarySub: '(המנוע של התנועה)',
    secondaryTitle: 'שרירים מסייעים',
    secondarySub: '(העוזרים)',
    stabilizersTitle: 'מייצבים',
    stabilizersSub: '(שומרים על הגוף יציב)'
  };

  var _browserLoadPromise = null;

  function loadLibraryNode() {
    if (typeof require === 'undefined') return null;
    var fs = require('fs');
    var path = require('path');
    var p = path.join(__dirname, '..', 'data', 'exerciseLibrary.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  function ensureLibrary() {
    if (typeof global.fetch !== 'undefined' && typeof global.document !== 'undefined') {
      if (global.__TIQ_EXERCISE_LIBRARY__) return Promise.resolve(global.__TIQ_EXERCISE_LIBRARY__);
      if (!_browserLoadPromise) {
        _browserLoadPromise = global
          .fetch('src/data/exerciseLibrary.json', { cache: 'no-store' })
          .then(function (r) {
            if (!r.ok) throw new Error('exerciseLibrary load failed');
            return r.json();
          })
          .then(function (j) {
            global.__TIQ_EXERCISE_LIBRARY__ = j;
            return j;
          })
          .catch(function () {
            global.__TIQ_EXERCISE_LIBRARY__ = null;
            return null;
          });
      }
      return _browserLoadPromise;
    }
    try {
      var lib = loadLibraryNode();
      return Promise.resolve(lib);
    } catch (_) {
      return Promise.resolve(null);
    }
  }

  function getLibrarySync() {
    if (global.__TIQ_EXERCISE_LIBRARY__) return global.__TIQ_EXERCISE_LIBRARY__;
    try {
      var lib = loadLibraryNode();
      if (lib) global.__TIQ_EXERCISE_LIBRARY__ = lib;
      return lib;
    } catch (_) {
      return null;
    }
  }

  function cleanStr(s) {
    return String(s == null ? '' : s)
      .trim()
      .replace(/\s+/g, ' ');
  }

  function muscleMatchesForbidden(label, forbiddenEntry) {
    var low = cleanStr(label).toLowerCase();
    if (!low) return false;
    var forbidden = Array.isArray(forbiddenEntry) ? forbiddenEntry : [];
    for (var i = 0; i < forbidden.length; i++) {
      var token = cleanStr(forbidden[i]).toLowerCase();
      if (!token) continue;
      if (low.indexOf(token) !== -1 || token.indexOf(low) !== -1) return true;
    }
    return false;
  }

  function filterListByForbidden(arr, forbidden) {
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < (arr || []).length; i++) {
      var m = cleanStr(arr[i]);
      if (!m || muscleMatchesForbidden(m, forbidden)) continue;
      var k = m.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      out.push(m);
    }
    return out;
  }

  function dedupeHierarchy(primary, secondary, stabilizers) {
    var p = filterListByForbidden(primary, []);
    var secRaw = filterListByForbidden(secondary, []);
    var stRaw = filterListByForbidden(stabilizers, []);
    var pset = Object.create(null);
    for (var i = 0; i < p.length; i++) pset[p[i].toLowerCase()] = true;
    var sec = [];
    for (var j = 0; j < secRaw.length; j++) {
      if (!pset[secRaw[j].toLowerCase()]) sec.push(secRaw[j]);
    }
    var sset = Object.create(null);
    for (var k = 0; k < sec.length; k++) sset[sec[k].toLowerCase()] = true;
    var st = [];
    for (var n = 0; n < stRaw.length; n++) {
      var t = stRaw[n].toLowerCase();
      if (!pset[t] && !sset[t]) st.push(stRaw[n]);
    }
    return { primary: p, secondary: sec, stabilizers: st };
  }

  function findEntryByLibraryId(lib, libraryId) {
    if (!lib || !Array.isArray(lib.exercises)) return null;
    for (var i = 0; i < lib.exercises.length; i++) {
      if (lib.exercises[i] && lib.exercises[i].id === libraryId) return lib.exercises[i];
    }
    return null;
  }

  /**
   * Merge library canonical lists with optional AI strings; drop any AI line matching forbidden.
   * When useAiExtras is false (default for TrainIQ), only library lists are used after forbidden filter.
   */
  function buildMusclesForEntry(entry, aiMuscles, useAiExtras) {
    var forbidden = entry.forbidden || [];
    var primary = filterListByForbidden(entry.primary || [], forbidden);
    var secondary = filterListByForbidden(entry.secondary || [], forbidden);
    var stabilizers = filterListByForbidden(entry.stabilizers || [], forbidden);
    if (useAiExtras && aiMuscles) {
      var add = function (target, from) {
        var arr = Array.isArray(from) ? from : [];
        for (var i = 0; i < arr.length; i++) {
          var s = cleanStr(arr[i]);
          if (!s || muscleMatchesForbidden(s, forbidden)) continue;
          if (target.indexOf(s) === -1) target.push(s);
        }
      };
      add(primary, aiMuscles.primary);
      add(secondary, aiMuscles.secondary);
      add(stabilizers, aiMuscles.stabilizers);
    }
    return dedupeHierarchy(primary, secondary, stabilizers);
  }

  /**
   * @param {string} registryKey - e.g. benchpress
   * @param {{primary?:string[],secondary?:string[],stabilizers?:string[]}} [aiMuscles]
   * @param {{useAiExtras?:boolean}} [opts]
   */
  function getTruthForRegistryKey(registryKey, aiMuscles, opts) {
    var lib = getLibrarySync();
    if (!lib) return null;
    var k = String(registryKey || '')
      .trim()
      .toLowerCase();
    var libId = REGISTRY_TO_LIBRARY_ID[k];
    if (!libId) return null;
    var entry = findEntryByLibraryId(lib, libId);
    if (!entry) return null;
    var useAiExtras = !!(opts && opts.useAiExtras);
    var muscles = buildMusclesForEntry(entry, aiMuscles || {}, useAiExtras);
    return {
      fromLibrary: true,
      libraryId: entry.id,
      nameHe: entry.name_he || '',
      muscles: muscles,
      forbidden: entry.forbidden || [],
      sectionLabelsHe: SECTION_LABELS_HE
    };
  }

  var api = {
    REGISTRY_TO_LIBRARY_ID: REGISTRY_TO_LIBRARY_ID,
    SECTION_LABELS_HE: SECTION_LABELS_HE,
    ensureLibrary: ensureLibrary,
    getTruthForRegistryKey: getTruthForRegistryKey,
    muscleMatchesForbidden: muscleMatchesForbidden,
    dedupeHierarchy: dedupeHierarchy
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.TrainIQAnatomicalEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
