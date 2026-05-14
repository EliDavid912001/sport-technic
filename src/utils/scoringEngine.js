'use strict';

/**
 * TrainIQ — Deterministic biomechanical scoring (client bundle).
 *
 * Consumes per-frame series from extractPoseMetrics (`pose_frames_for_scoring`)
 * and optional `scoring_rules` from exerciseRegistry.js.
 *
 * @typedef {{
 *   timestamps_ms: number[],
 *   left_elbow_deg?: number[],
 *   right_elbow_deg?: number[],
 *   left_knee_deg?: number[],
 *   right_knee_deg?: number[],
 *   wrist_mid_y?: number[],
 *   shoulder_mid_y?: number[]
 * }} PoseFrameSeries
 */

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function meanFinite(values) {
  const xs = (values || []).filter((v) => Number.isFinite(v));
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function percentile(arr, p) {
  const xs = arr.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!xs.length) return NaN;
  const idx = clamp01(p) * (xs.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return xs[lo];
  return xs[lo] + (xs[hi] - xs[lo]) * (idx - lo);
}

function jointSeries(poseFrames, joint) {
  const L = poseFrames && poseFrames.left_elbow_deg;
  const R = poseFrames && poseFrames.right_elbow_deg;
  const Lk = poseFrames && poseFrames.left_knee_deg;
  const Rk = poseFrames && poseFrames.right_knee_deg;
  const n = Math.max(
    Array.isArray(L) ? L.length : 0,
    Array.isArray(R) ? R.length : 0
  );
  const out = [];
  for (let i = 0; i < n; i++) {
    if (joint === 'elbow_avg') {
      const a = L && L[i];
      const b = R && R[i];
      if (Number.isFinite(a) && Number.isFinite(b)) out.push((a + b) / 2);
      else out.push(NaN);
    } else if (joint === 'left_elbow') out.push(L && Number.isFinite(L[i]) ? L[i] : NaN);
    else if (joint === 'right_elbow') out.push(R && Number.isFinite(R[i]) ? R[i] : NaN);
    else if (joint === 'knee_avg') {
      const a = Lk && Lk[i];
      const b = Rk && Rk[i];
      if (Number.isFinite(a) && Number.isFinite(b)) out.push((a + b) / 2);
      else out.push(NaN);
    } else out.push(NaN);
  }
  return out;
}

function aggregateSeries(series, how) {
  const xs = series.filter(Number.isFinite);
  if (!xs.length) return NaN;
  if (how === 'min') return Math.min(...xs);
  if (how === 'max') return Math.max(...xs);
  if (how === 'range') return Math.max(...xs) - Math.min(...xs);
  return NaN;
}

function romMetricScore(value, target, tolerance, direction) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) {
    return 55;
  }
  let err = 0;
  if (direction === 'higher_better') err = Math.max(0, target - value);
  else if (direction === 'lower_better') err = Math.max(0, value - target);
  else err = Math.abs(value - target);
  return 100 * clamp01(1 - err / (2 * tolerance));
}

function scoreRom(poseFrames, romRules) {
  const entries = romRules && typeof romRules === 'object' ? Object.entries(romRules) : [];
  if (!entries.length) return { score: 65, detail: {} };
  let sum = 0;
  let n = 0;
  const detail = {};
  for (const [name, spec] of entries) {
    if (!spec || typeof spec !== 'object') continue;
    const joint = spec.joint || 'elbow_avg';
    const agg = spec.aggregate || 'max';
    const series = jointSeries(poseFrames, joint);
    const v = aggregateSeries(series, agg);
    const piece = romMetricScore(
      v,
      Number(spec.target),
      Number(spec.tolerance),
      spec.direction === 'lower_better' ? 'lower_better' : 'higher_better'
    );
    detail[name] = { value: v, piece };
    sum += piece;
    n += 1;
  }
  return { score: n ? sum / n : 65, detail };
}

function scoreSymmetry(poseFrames, symRules) {
  const L = poseFrames && poseFrames.left_elbow_deg;
  const R = poseFrames && poseFrames.right_elbow_deg;
  const Lk = poseFrames && poseFrames.left_knee_deg;
  const Rk = poseFrames && poseFrames.right_knee_deg;
  const elbowTol = Number(symRules && symRules.elbow_angle_mean_abs_diff_max) || 14;
  const kneeTol = Number(symRules && symRules.knee_angle_mean_abs_diff_max) || 20;
  const diffs = [];
  const n = Math.max(
    Array.isArray(L) ? L.length : 0,
    Array.isArray(R) ? R.length : 0
  );
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(L && L[i]) && Number.isFinite(R && R[i])) {
      diffs.push(Math.abs(L[i] - R[i]));
    }
  }
  let elbowScore = 72;
  if (diffs.length) {
    const m = meanFinite(diffs);
    elbowScore = 100 * clamp01(1 - m / (2 * elbowTol));
  }
  const kneeDiffs = [];
  const nk = Math.max(
    Array.isArray(Lk) ? Lk.length : 0,
    Array.isArray(Rk) ? Rk.length : 0
  );
  for (let i = 0; i < nk; i++) {
    if (Number.isFinite(Lk && Lk[i]) && Number.isFinite(Rk && Rk[i])) {
      kneeDiffs.push(Math.abs(Lk[i] - Rk[i]));
    }
  }
  let kneeScore = 75;
  if (kneeDiffs.length) {
    const m = meanFinite(kneeDiffs);
    kneeScore = 100 * clamp01(1 - m / (2 * kneeTol));
  }
  const hasKnee = kneeDiffs.length > 2;
  const score = hasKnee ? (elbowScore * 0.65 + kneeScore * 0.35) : elbowScore;
  return { score, detail: { elbow_mean_abs_deg: diffs.length ? meanFinite(diffs) : null, knee_mean_abs_deg: kneeDiffs.length ? meanFinite(kneeDiffs) : null } };
}

function ySeries(poseFrames, key) {
  const arr =
    key === 'shoulder_mid_y' ? poseFrames && poseFrames.shoulder_mid_y : poseFrames && poseFrames.wrist_mid_y;
  return Array.isArray(arr) ? arr : [];
}

function scoreTempo(poseFrames, tempoRules) {
  const ts = poseFrames && poseFrames.timestamps_ms;
  const ys = ySeries(poseFrames, tempoRules && tempoRules.y_series);
  const soft = Number(tempoRules && tempoRules.max_norm_velocity_soft) || 3.2;
  const hard = Number(tempoRules && tempoRules.max_norm_velocity_hard) || 6.8;
  const usePositive = !(tempoRules && tempoRules.eccentric_dy_positive === false);
  if (!Array.isArray(ts) || !Array.isArray(ys) || ts.length < 4 || ys.length !== ts.length) {
    return { score: 68, detail: { note: 'insufficient_tempo_series' } };
  }
  const vels = [];
  for (let i = 1; i < ys.length; i++) {
    const dy = ys[i] - ys[i - 1];
    const dt = Math.max(1, (ts[i] - ts[i - 1]) / 1000);
    if (!Number.isFinite(dy) || !Number.isFinite(dt) || dt <= 0) continue;
    const v = dy / dt;
    if (usePositive && dy > 0.0004) vels.push(Math.abs(v));
    if (!usePositive && dy < -0.0004) vels.push(Math.abs(v));
  }
  if (!vels.length) return { score: 72, detail: { note: 'no_eccentric_segments' } };
  const p90 = percentile(vels, 0.9);
  if (!Number.isFinite(p90)) return { score: 70, detail: {} };
  let s = 100 * (1 - clamp01((p90 - soft) / Math.max(0.001, hard - soft)));
  s = Math.max(35, Math.min(100, s));
  return { score: s, detail: { eccentric_p90_norm_velocity: p90 } };
}

/**
 * Strict 0–100 biomechanical score from pose series + registry scoring_rules.
 * @param {PoseFrameSeries|null} poseFrames
 * @param {string} exerciseKey registry key (e.g. pullup, overheadpress, muscleup)
 * @param {object|null} registryExercise full exercise object from GET /api/exercise-registry (optional)
 * @returns {{ finalScore: number|null, rom: number, symmetry: number, tempo: number, breakdown: object, skipped?: boolean }}
 */
function calculateBiomechanicalScore(poseFrames, exerciseKey, registryExercise) {
  const key = String(exerciseKey || '').toLowerCase();
  const rules = registryExercise && registryExercise.scoring_rules;
  if (!poseFrames || typeof poseFrames !== 'object' || !rules || typeof rules !== 'object') {
    return { finalScore: null, rom: NaN, symmetry: NaN, tempo: NaN, breakdown: { reason: 'no_rules_or_series' }, skipped: true, exerciseKey: key };
  }
  const w = rules.weights || { rom: 0.4, symmetry: 0.3, tempo: 0.3 };
  const wr = Number(w.rom) || 0.4;
  const ws = Number(w.symmetry) || 0.3;
  const wt = Number(w.tempo) || 0.3;
  const sumW = wr + ws + wt || 1;

  const romBlock = scoreRom(poseFrames, rules.rom || {});
  const symBlock = scoreSymmetry(poseFrames, rules.symmetry || {});
  const tempoBlock = scoreTempo(poseFrames, rules.tempo || {});

  const rom = romBlock.score;
  const symmetry = symBlock.score;
  const tempo = tempoBlock.score;

  const finalScore = Math.round(
    Math.max(0, Math.min(100, (rom * wr + symmetry * ws + tempo * wt) / sumW))
  );

  return {
    finalScore,
    rom,
    symmetry,
    tempo,
    exerciseKey: key,
    breakdown: {
      rom: romBlock.detail,
      symmetry: symBlock.detail,
      tempo: tempoBlock.detail,
      weights: { rom: wr, symmetry: ws, tempo: wt }
    }
  };
}

const root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global;
root.TrainIQScoringEngine = Object.assign({}, root.TrainIQScoringEngine || {}, {
  calculateBiomechanicalScore
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateBiomechanicalScore };
}
