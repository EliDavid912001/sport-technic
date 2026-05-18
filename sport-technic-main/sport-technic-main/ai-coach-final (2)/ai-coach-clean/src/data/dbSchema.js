'use strict';

/**
 * TrainIQ — Progress / analysis persistence blueprint (JSON DB contract)
 *
 * Maps `detected_faults` to `fault_id` values defined in `exerciseRegistry.js`.
 * Intended for migration from minimal `analysis_history.json` rows.
 */

const ANALYSIS_RECORD_VERSION = 1;

/**
 * @typedef {object} AnalysisMetrics
 * @property {number|null} time_under_tension_sec — full set, first movement to last lockout; null if unknown
 * @property {number|null} stability_score — 0–100 normalized stability index; null if unavailable
 * @property {number|null} reps_completed — counted reps in analysis window
 * @property {number|null} [rpe_estimate] — optional session RPE 1–10
 * @property {number|null} [analyzed_duration_sec] — wall-clock span of trimmed analysis
 * @property {number|null} [objective_form_score] — CV-derived form score if present
 */

/**
 * @typedef {object} AnalysisRecord
 * @property {number} schema_version
 * @property {string} analysis_id — UUID or server-generated id
 * @property {string} user_id — stable user key (e.g. normalized username or future UUID)
 * @property {string} exercise_key — registry key (e.g. muscleup, overheadpress)
 * @property {number} timestamp — Unix ms when analysis completed
 * @property {number} final_score — 0–100 holistic score after calibration
 * @property {AnalysisMetrics} metrics
 * @property {string[]} detected_faults — `fault_id` strings from exerciseRegistry.biomechanical_cues
 * @property {string[]} positive_cues — short Hebrew (or bilingual) affirmations of what went well
 * @property {object} [llm_payload] — optional raw / normalized model output for audit
 * @property {object} [objective_metrics] — optional merged pose/CV metrics blob
 */

/** @type {AnalysisRecord} */
const EXAMPLE_ANALYSIS_RECORD = {
  schema_version: ANALYSIS_RECORD_VERSION,
  analysis_id: '019a8f3c-7b2d-7f00-8000-000000000001',
  user_id: 'trainiq_user_eli',
  exercise_key: 'muscleup',
  timestamp: Date.now(),
  final_score: 84,
  metrics: {
    time_under_tension_sec: 42.5,
    stability_score: 78,
    reps_completed: 6,
    rpe_estimate: 8,
    analyzed_duration_sec: 45.0,
    objective_form_score: 82
  },
  detected_faults: ['MU_CHICKEN_WING'],
  positive_cues: [
    'שליטה אקסצנטרית טובה בירידה',
    'קו כוח ברור בשלב המתח'
  ],
  llm_payload: {
    detected_exercise: 'מאסל אפ',
    grade: 'טוב',
    summary: 'דוגמה בלבד — שדה אופציונלי לשמירת תמונת מצב מלאה מהמודל.'
  },
  objective_metrics: {
    visibility_score: 0.88,
    kinematic_pattern: 'vertical_pull',
    estimated_reps_cv: 6
  }
};

/**
 * Factory for a new empty analysis row (fill before persist).
 * @param {Partial<AnalysisRecord>} [overrides]
 * @returns {AnalysisRecord}
 */
function createEmptyAnalysisRecord(overrides = {}) {
  const base = {
    schema_version: ANALYSIS_RECORD_VERSION,
    analysis_id: '',
    user_id: '',
    exercise_key: '',
    timestamp: Date.now(),
    final_score: 0,
    metrics: {
      time_under_tension_sec: null,
      stability_score: null,
      reps_completed: null,
      rpe_estimate: null,
      analyzed_duration_sec: null,
      objective_form_score: null
    },
    detected_faults: [],
    positive_cues: []
  };
  return {
    ...base,
    ...overrides,
    metrics: { ...base.metrics, ...(overrides.metrics || {}) },
    detected_faults: Array.isArray(overrides.detected_faults)
      ? overrides.detected_faults.slice()
      : base.detected_faults,
    positive_cues: Array.isArray(overrides.positive_cues)
      ? overrides.positive_cues.slice()
      : base.positive_cues
  };
}

/**
 * Lightweight structural validation (no registry cross-check).
 * @param {unknown} record
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
function validateAnalysisRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { ok: false, errors: ['record must be an object'] };
  }
  const r = /** @type {AnalysisRecord} */ (record);
  if (Number(r.schema_version) !== ANALYSIS_RECORD_VERSION) {
    errors.push('schema_version mismatch');
  }
  if (!String(r.analysis_id || '').trim()) errors.push('analysis_id required');
  if (!String(r.user_id || '').trim()) errors.push('user_id required');
  if (!String(r.exercise_key || '').trim()) errors.push('exercise_key required');
  if (!Number.isFinite(Number(r.timestamp))) errors.push('timestamp must be a finite number');
  const fs = Number(r.final_score);
  if (!Number.isFinite(fs) || fs < 0 || fs > 100) errors.push('final_score must be 0–100');
  if (!r.metrics || typeof r.metrics !== 'object') errors.push('metrics object required');
  else {
    const m = r.metrics;
    for (const k of ['time_under_tension_sec', 'stability_score', 'reps_completed', 'rpe_estimate', 'analyzed_duration_sec', 'objective_form_score']) {
      if (m[k] === undefined) continue;
      if (m[k] !== null && !Number.isFinite(Number(m[k]))) errors.push(`metrics.${k} must be number or null`);
    }
  }
  if (!Array.isArray(r.detected_faults)) errors.push('detected_faults must be an array');
  else if (!r.detected_faults.every(x => typeof x === 'string' && x.trim())) {
    errors.push('detected_faults must be non-empty strings');
  }
  if (!Array.isArray(r.positive_cues)) errors.push('positive_cues must be an array');
  else if (!r.positive_cues.every(x => typeof x === 'string')) {
    errors.push('positive_cues must be strings');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Human-readable field order for JSON export / DB migration scripts.
 */
const ANALYSIS_RECORD_FIELD_ORDER = [
  'schema_version',
  'analysis_id',
  'user_id',
  'exercise_key',
  'timestamp',
  'final_score',
  'metrics',
  'detected_faults',
  'positive_cues',
  'llm_payload',
  'objective_metrics'
];

module.exports = {
  ANALYSIS_RECORD_VERSION,
  EXAMPLE_ANALYSIS_RECORD,
  ANALYSIS_RECORD_FIELD_ORDER,
  createEmptyAnalysisRecord,
  validateAnalysisRecord
};
