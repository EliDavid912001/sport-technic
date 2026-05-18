(function (global) {
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
const VERTICAL_PULL_ROM_KEYS = new Set(['pullup', 'chinup', 'latpulldown']);

function applyVerticalPullRomBoost(result, poseFrames, exerciseKey) {
  const key = String(exerciseKey || '').toLowerCase();
  if (!VERTICAL_PULL_ROM_KEYS.has(key) || !poseFrames || !result) return result;
  const complete = !!poseFrames.vertical_pull_rom_complete || !!poseFrames.suppress_chin_bar_fault;
  if (!complete) return result;
  const rom = Math.max(Number(result.rom) || 0, 100);
  const w = result.breakdown && result.breakdown.weights
    ? result.breakdown.weights
    : { rom: 0.4, symmetry: 0.3, tempo: 0.3 };
  const wr = Number(w.rom) || 0.4;
  const ws = Number(w.symmetry) || 0.3;
  const wt = Number(w.tempo) || 0.3;
  const sumW = wr + ws + wt || 1;
  const symmetry = Number(result.symmetry);
  const tempo = Number(result.tempo);
  const finalScore = Math.round(
    Math.max(0, Math.min(100, (rom * wr + symmetry * ws + tempo * wt) / sumW))
  );
  return Object.assign({}, result, {
    rom,
    finalScore,
    breakdown: Object.assign({}, result.breakdown, { vertical_pull_rom_override: true })
  });
}

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

  const symmetry = symBlock.score;
  const tempo = tempoBlock.score;

  const baseResult = {
    rom: romBlock.score,
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
  baseResult.finalScore = Math.round(
    Math.max(0, Math.min(100, (baseResult.rom * wr + symmetry * ws + tempo * wt) / sumW))
  );

  return applyVerticalPullRomBoost(baseResult, poseFrames, key);
}

/** Max score points deducted for tempo/momentum across a set (after merging duplicate cues). */
const TEMPO_DEDUCTION_CAP_POINTS = 15;
const TEMPO_DEDUCTION_CAP_PCT = TEMPO_DEDUCTION_CAP_POINTS;

function breakdownBucketKey(label) {
  const t = String(label || '').toLowerCase();
  if (/tempo|momentum|control\s*\/?\s*tempo|קצב|מומנטום|נדנוד|swing|kip|bounce|זריקה|מהיר מדי|חוסר שליטה/.test(t)) {
    return 'tempo';
  }
  if (/symmetry|סימטר/.test(t)) return 'symmetry';
  if (/\brom\b|טווח|lockout|נעילה/.test(t)) return 'rom';
  return 'other';
}

/**
 * Merge duplicate deduction rows (e.g. per-rep momentum) and cap tempo/momentum total.
 * @param {Array<{label:string,delta:number,reason?:string}>} items
 * @param {{ tempoCapPoints?: number, tempoCapPct?: number }} [opts]
 */
function consolidateDeductionBreakdown(items, opts) {
  const tempoCap =
    Number(opts && opts.tempoCapPoints) ||
    Number(opts && opts.tempoCapPct) ||
    TEMPO_DEDUCTION_CAP_POINTS;
  const positives = [];
  const buckets = Object.create(null);
  for (const item of items || []) {
    const delta = Number(item && item.delta);
    if (!Number.isFinite(delta) || delta === 0) continue;
    if (delta > 0) {
      positives.push(item);
      continue;
    }
    const bucket = breakdownBucketKey(item.label);
    const id = bucket === 'other' ? 'other:' + String(item.label || '').slice(0, 56) : bucket;
    if (!buckets[id]) {
      buckets[id] = { bucket, label: item.label, delta: 0, reasons: [] };
    }
    buckets[id].delta += delta;
    if (item.reason) buckets[id].reasons.push(String(item.reason));
    if (bucket === 'tempo') buckets[id].label = 'חוסר שליטה באקסצנטרי / תנופה';
    else if (bucket === 'rom') buckets[id].label = 'טווח תנועה';
    else if (bucket === 'symmetry') buckets[id].label = 'סימטריה';
  }
  const negatives = [];
  for (const b of Object.values(buckets)) {
    let d = Math.round(b.delta);
    if (b.bucket === 'tempo') d = Math.max(d, -tempoCap);
    const reason = [...new Set(b.reasons)].filter(Boolean)[0] || '';
    negatives.push({ label: b.label, delta: d, reason });
  }
  negatives.sort((a, b) => a.delta - b.delta);
  return positives.concat(negatives);
}

/** Injected into EVERY exercise LLM prompt — no camera/lighting complaints. */
const GLOBAL_LLM_CAMERA_GAG_RULE =
  '\n\n=== GLOBAL RULE — CAMERA & VISIBILITY (ALL EXERCISES, MANDATORY) ===\n' +
  'NEVER complain about the camera angle, lighting, framing, or visibility. ' +
  'NEVER tell the user to "film from the side", "improve the camera angle", "get better lighting", or "widen the frame". ' +
  'Your job is strictly biomechanical analysis of the visible joints. If a body part is out of frame, analyze only what is visible. ' +
  'Do NOT deduct points for camera placement. Return environmental_warnings as an empty array [].\n' +
  'עברית: אסור להתלונן על זווית מצלמה, תאורה או פריים. נתח רק מה שנראה — בלי עונש על צילום.\n';

/** Universal ROM — joint kinematics, not collision/contact (all exercises). */
const GLOBAL_LLM_ROM_RULE =
  '\n\n=== GLOBAL ROM RULE (ALL EXERCISES, MANDATORY) ===\n' +
  'Judge Range of Motion from maximum joint flexion/extension (e.g., peak elbow angle, shoulder elevation relative to hands, knee/hip angles) — ' +
  'NOT physical collision (e.g., "chest must touch the bar", "bar on chest"). Camera perspective distorts contact points; use joint kinematics only.\n' +
  'Vertical pull-ups/chin-ups: chin clearing the bar (or equivalent elbow flexion at the top) = FULL ROM — score as complete. NEVER deduct points because the chest did not touch the bar.\n' +
  'Chest-to-bar is an advanced coaching BONUS only (Pro Tip / Coach\'s Corner) — never a fault_id, never a score penalty, never in fixes as type=bad.\n' +
  'עברית: ROM לפי זוויות מפרקים בלבד — לא לפי מגע פיזי. סנטר מעל המוט = ROM מלא. חזה למוט = המלצת בונוס למתקדמים בלבד, בלי הורדת ניקוד.\n';

/** @deprecated — use GLOBAL_LLM_CAMERA_GAG_RULE + GLOBAL_LLM_ROM_RULE */
const CALISTHENICS_VERTICAL_PULL_CAMERA_RULE = GLOBAL_LLM_CAMERA_GAG_RULE + GLOBAL_LLM_ROM_RULE;

const UPPER_VISIBILITY_JOINT_IDS = [11, 12, 13, 14, 15, 16];
const LOWER_VISIBILITY_JOINT_IDS = [23, 24, 25, 26, 27, 28];
const CORE_VISIBILITY_JOINT_IDS = [23, 24];

const UPPER_MUSCLE_PATTERN =
  /גב|חזה|כתפ|ביספס|טרייספס|שכמ|דלתא|רחב|ליבה|גב תחתון|back|chest|shoulder|bicep|tricep|lat|delt|pec|rhomb|trap|core|abs|press|row|pull/i;
const LOWER_MUSCLE_PATTERN =
  /רגל|קוואד|המסטרינג|גלוטאוס|תאומ|ירך|quad|hamstring|glute|calf|leg|squat|deadlift|lunge|hack|leg press/i;

const FILMING_WARNING_PATTERN =
  /צילום|מצלמה|camera|תאורה|lighting|framing|פריים|visibility|נראות|זווית|angle|רעידות|shake|התקרב|הרחב|film|צלם|side view|מהצד|goblet|exposure|out of frame|חשוך|בוהק/i;

function flattenTargetMuscles(targetMuscles) {
  if (Array.isArray(targetMuscles)) return targetMuscles.map((x) => String(x || '').trim()).filter(Boolean);
  if (targetMuscles && typeof targetMuscles === 'object') {
    return []
      .concat(targetMuscles.primary || [], targetMuscles.secondary || [], targetMuscles.stabilizers || [])
      .map((x) => String(x || '').trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * @param {Array|object} targetMuscles registry target_muscles
 * @returns {'upper'|'lower'|'full'}
 */
function classifyRegionalFocus(targetMuscles) {
  const blob = flattenTargetMuscles(targetMuscles).join(' ');
  const hasUpper = UPPER_MUSCLE_PATTERN.test(blob);
  const hasLower = LOWER_MUSCLE_PATTERN.test(blob);
  if (hasUpper && hasLower) return 'full';
  if (hasLower && !hasUpper) return 'lower';
  if (hasUpper) return 'upper';
  return 'full';
}

/**
 * Visibility joints counted for confidence — irrelevant limbs excluded per exercise.
 */
function getVisibilityJointIdsForRegion(region, targetMuscles) {
  if (region === 'lower') return LOWER_VISIBILITY_JOINT_IDS.slice();
  if (region === 'upper') {
    const ids = UPPER_VISIBILITY_JOINT_IDS.slice();
    const blob = flattenTargetMuscles(targetMuscles).join(' ');
    if (/ליבה|core|abs|יציב|stabil/i.test(blob)) {
      for (const j of CORE_VISIBILITY_JOINT_IDS) {
        if (!ids.includes(j)) ids.push(j);
      }
    }
    return ids;
  }
  return UPPER_VISIBILITY_JOINT_IDS.concat(LOWER_VISIBILITY_JOINT_IDS);
}

function resolveVisibilityProfile(targetMuscles) {
  const region = classifyRegionalFocus(targetMuscles);
  const jointIds = getVisibilityJointIdsForRegion(region, targetMuscles);
  const ignoreLabels =
    region === 'upper'
      ? ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle']
      : region === 'lower'
        ? ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist']
        : [];
  return { region, jointIds, ignoreLabels };
}

function shouldIgnoreMissingJointLabel(label, region) {
  const l = String(label || '').toLowerCase();
  if (region === 'upper') return /hip|knee|ankle/.test(l);
  if (region === 'lower') return /shoulder|elbow|wrist/.test(l);
  return false;
}

function filterMissingJointsByRegion(missingLabels, region) {
  const list = Array.isArray(missingLabels) ? missingLabels : [];
  if (region === 'full') return list.slice();
  return list.filter((label) => !shouldIgnoreMissingJointLabel(label, region));
}

function filterEnvironmentalCameraWarnings(warnings) {
  return (Array.isArray(warnings) ? warnings : [])
    .map((w) => String(w == null ? '' : w).trim())
    .filter((w) => w && !FILMING_WARNING_PATTERN.test(w));
}

function isFilmingOrVisibilityFixText(text) {
  return FILMING_WARNING_PATTERN.test(String(text || ''));
}

function getGlobalPromptRules() {
  return GLOBAL_LLM_CAMERA_GAG_RULE + GLOBAL_LLM_ROM_RULE;
}

const NUMERIC_SCORE_IN_TEXT_RE =
  /-?\s*\d+(?:\.\d+)?\s*(?:נקודות|נק׳|נק'|pts?|points?)\b|-?\s*\d+(?:\.\d+)?\s*%|\b\d{1,3}\s*\/\s*100\b|(?:ירדו|הורד|עונש|penalty|deduction|minus)\s*-?\s*\d+/gi;

function stripLlmNumericScoring(text) {
  return String(text || '')
    .replace(NUMERIC_SCORE_IN_TEXT_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function formatImpactPointsHe(points, sign) {
  const pts = Math.abs(Math.round(Number(points) || 0));
  if (pts <= 0) return sign === '+' ? '+0 נקודות' : '0 נקודות';
  return (sign === '+' ? '+' : '-') + pts + ' נקודות';
}

/**
 * Deterministic deduction rows from ROM / symmetry / tempo sub-scores (matches UI score breakdown).
 */
function buildDeductionBreakdownFromSubscores(finalScore, sub, weights, reasonHints) {
  const wr = Number(weights && weights.rom) || 0.4;
  const ws = Number(weights && weights.symmetry) || 0.3;
  const wt = Number(weights && weights.tempo) || 0.3;
  const sum = wr + ws + wt || 1;
  const hints = reasonHints && typeof reasonHints === 'object' ? reasonHints : {};
  const labels = { rom: 'ROM', symmetry: 'Symmetry', tempo: 'Control / Tempo' };
  const out = [];
  for (const key of ['rom', 'symmetry', 'tempo']) {
    const cur = Number(sub && sub[key]);
    if (!Number.isFinite(cur)) continue;
    const gap = Math.max(0, 100 - cur);
    if (gap < 2) continue;
    const wKey = key === 'rom' ? wr : key === 'symmetry' ? ws : wt;
    const delta = -Math.max(1, Math.min(42, Math.round((gap * wKey) / sum)));
    const reason =
      hints[key] ||
      (key === 'tempo'
        ? 'שליטה באקסצנטרי; בקונצנטרי כוח מתפרץ בלי תנופת גו.'
        : 'מרכיב בציון המחושב אוטומטית מזוויות המפרקים והקצב.');
    out.push({ label: labels[key], delta, reason });
  }
  return consolidateDeductionBreakdown(out);
}

function inferFixBucketFromText(text) {
  const t = String(text || '').toLowerCase();
  if (/tempo|momentum|קצב|מומנטום|נדנוד|swing|kip|bounce|זריקה|מהיר|חוסר שליטה|תנופה/.test(t)) return 'tempo';
  if (/symmetry|סימטר|אסימטר|shoulder.*level|כתף/.test(t)) return 'symmetry';
  if (/\brom\b|טווח|lockout|נעילה|תלייה|סנטר|chin|bar/.test(t)) return 'rom';
  if (/visibility|צילום|מצלמה|camera|תאורה|פריים/.test(t)) return 'environment';
  return 'other';
}

/**
 * Strip LLM point math; attach engine deduction to impact; keep desc as reason-only Hebrew.
 */
function mergeEngineDeductionsIntoFixes(fixes, breakdownItems, opts) {
  const optsSafe = opts || {};
  const deductions = consolidateDeductionBreakdown(breakdownItems || []).filter((x) => Number(x.delta) < 0);
  const usedBuckets = Object.create(null);
  const pickForBucket = (bucket) => {
    const row = deductions.find((d) => breakdownBucketKey(d.label) === bucket && !usedBuckets[bucket]);
    if (row) usedBuckets[bucket] = true;
    return row;
  };
  const list = Array.isArray(fixes) ? fixes : [];
  return list.map((f) => {
    if (!f || typeof f !== 'object') return f;
    const isGood = f.type === 'good';
    const title = stripLlmNumericScoring(f.title || '');
    const desc = stripLlmNumericScoring(f.desc || '');
    if (isGood) {
      return Object.assign({}, f, {
        title: title || 'נקודה חיובית',
        desc: desc || 'ביצוע טוב.',
        impact: optsSafe.allowGoodImpact === true ? formatImpactPointsHe(parseInt(String(f.impact || '0'), 10) || 0, '+') : ''
      });
    }
    const bucket = inferFixBucketFromText(title + ' ' + desc);
    if (bucket === 'environment' || isFilmingOrVisibilityFixText(title + ' ' + desc)) {
      return null;
    }
    const row = pickForBucket(bucket) || pickForBucket('other');
    const pts = row ? Math.abs(Math.round(row.delta)) : 0;
    return Object.assign({}, f, {
      title: title || (row && row.label) || 'נקודה לשיפור',
      desc: desc || (row && row.reason) || 'שפר שליטה ויציבות בסט הבא.',
      impact: pts > 0 ? formatImpactPointsHe(pts, '-') : '',
      engine_label: row && row.label,
      engine_reason: row && row.reason
    });
  }).filter(Boolean);
}

function isValidBodyPoseFrame(frame) {
  if (!frame || typeof frame !== 'object') return false;
  const sy = frame.shoulderY;
  const hy = frame.hipY;
  if (!Number.isFinite(sy) || !Number.isFinite(hy)) return false;
  return Number.isFinite(frame.wristY) || Number.isFinite(frame.kneeY) || Number.isFinite(frame.ankleY);
}

function findActiveMotionTrimStartIndex(posFrames, depthMetricFn, exerciseKey) {
  if (!Array.isArray(posFrames) || posFrames.length < 8 || typeof depthMetricFn !== 'function') return 0;
  const SINGLE = 0.017;
  const WIN = 5;
  const CUM = 0.055;
  for (let i = 1; i < posFrames.length; i++) {
    const a = depthMetricFn(posFrames[i - 1], exerciseKey);
    const b = depthMetricFn(posFrames[i], exerciseKey);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const step = Math.abs(b - a);
    let cum = 0;
    const lo = Math.max(0, i - WIN);
    for (let k = lo; k < i; k++) {
      const x = depthMetricFn(posFrames[k], exerciseKey);
      const y = depthMetricFn(posFrames[k + 1], exerciseKey);
      if (Number.isFinite(x) && Number.isFinite(y)) cum += Math.abs(y - x);
    }
    if (step >= SINGLE || cum >= CUM) return Math.max(0, i - 1);
  }
  return 0;
}

function findActiveMotionTrimEndIndex(posFrames, depthMetricFn, exerciseKey) {
  if (!Array.isArray(posFrames) || posFrames.length < 8 || typeof depthMetricFn !== 'function') {
    return Math.max(0, (posFrames && posFrames.length ? posFrames.length : 1) - 1);
  }
  const SINGLE = 0.017;
  const WIN = 5;
  const CUM = 0.055;
  for (let i = posFrames.length - 2; i >= 0; i--) {
    const a = depthMetricFn(posFrames[i], exerciseKey);
    const b = depthMetricFn(posFrames[i + 1], exerciseKey);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const step = Math.abs(b - a);
    let cum = 0;
    const hi = Math.min(posFrames.length - 1, i + WIN);
    for (let k = i; k < hi; k++) {
      const x = depthMetricFn(posFrames[k], exerciseKey);
      const y = depthMetricFn(posFrames[k + 1], exerciseKey);
      if (Number.isFinite(x) && Number.isFinite(y)) cum += Math.abs(y - x);
    }
    if (step >= SINGLE || cum >= CUM) return Math.min(posFrames.length - 1, i + 1);
  }
  return posFrames.length - 1;
}

/**
 * First/last frame indices with valid body + active movement (ignores intro/outro dead air).
 * @param {Array} posFrames
 * @param {number[]} signalTs ms timestamps aligned to posFrames
 * @param {{ depthMetricFn?: function, exerciseKey?: string, analysisStartSec?: number, analysisDuration?: number }} opts
 */
function computeActivePoseWindow(posFrames, signalTs, opts) {
  const o = opts || {};
  const n = Array.isArray(posFrames) ? posFrames.length : 0;
  if (n < 2) {
    return { startIdx: 0, endIdx: Math.max(0, n - 1), applied: false, reason: 'too_short' };
  }
  let firstBody = -1;
  let lastBody = -1;
  for (let i = 0; i < n; i++) {
    if (isValidBodyPoseFrame(posFrames[i])) {
      if (firstBody < 0) firstBody = i;
      lastBody = i;
    }
  }
  if (firstBody < 0) {
    return { startIdx: 0, endIdx: n - 1, applied: false, reason: 'no_body_detected' };
  }
  let startIdx = firstBody;
  let endIdx = lastBody;
  if (typeof o.depthMetricFn === 'function') {
    const bodySlice = posFrames.slice(firstBody, lastBody + 1);
    const relStart = findActiveMotionTrimStartIndex(bodySlice, o.depthMetricFn, o.exerciseKey);
    const relEnd = findActiveMotionTrimEndIndex(bodySlice, o.depthMetricFn, o.exerciseKey);
    startIdx = firstBody + relStart;
    endIdx = firstBody + Math.max(relStart, relEnd);
  }
  const pad = Math.max(0, Number(o.edgePadFrames) || 0);
  startIdx = Math.max(0, startIdx - pad);
  endIdx = Math.min(n - 1, endIdx + pad);
  const applied = startIdx > 0 || endIdx < n - 1;
  const analysisStartSec = Number(o.analysisStartSec) || 0;
  const analysisDuration = Math.max(0.1, Number(o.analysisDuration) || 0);
  const span = Math.max(1, n - 1);
  const startSec = analysisStartSec + (startIdx / span) * analysisDuration;
  const endSec = analysisStartSec + ((endIdx + 1) / span) * analysisDuration;
  const idleLeadSec = (startIdx / span) * analysisDuration;
  const idleTailSec = ((n - 1 - endIdx) / span) * analysisDuration;
  return {
    startIdx,
    endIdx,
    applied,
    reason: applied ? 'body_and_motion_trim' : 'body_only',
    idleLeadSec,
    idleTailSec,
    active_analysis_window: {
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      durationSec: Number(Math.max(0.1, endSec - startSec).toFixed(2))
    },
    firstBodyIdx: firstBody,
    lastBodyIdx: lastBody
  };
}

global.TrainIQScoringEngine = Object.assign({}, global.TrainIQScoringEngine || {}, {
  calculateBiomechanicalScore,
  consolidateDeductionBreakdown,
  buildDeductionBreakdownFromSubscores,
  mergeEngineDeductionsIntoFixes,
  stripLlmNumericScoring,
  formatImpactPointsHe,
  computeActivePoseWindow,
  isValidBodyPoseFrame,
  breakdownBucketKey,
  classifyRegionalFocus,
  resolveVisibilityProfile,
  getVisibilityJointIdsForRegion,
  filterMissingJointsByRegion,
  filterEnvironmentalCameraWarnings,
  isFilmingOrVisibilityFixText,
  getGlobalPromptRules,
  GLOBAL_LLM_CAMERA_GAG_RULE,
  GLOBAL_LLM_ROM_RULE,
  CALISTHENICS_VERTICAL_PULL_CAMERA_RULE,
  TEMPO_DEDUCTION_CAP_POINTS,
  TEMPO_DEDUCTION_CAP_PCT
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateBiomechanicalScore,
    consolidateDeductionBreakdown,
    buildDeductionBreakdownFromSubscores,
    mergeEngineDeductionsIntoFixes,
    stripLlmNumericScoring,
    formatImpactPointsHe,
    computeActivePoseWindow,
    isValidBodyPoseFrame,
    breakdownBucketKey,
    classifyRegionalFocus,
    resolveVisibilityProfile,
    getVisibilityJointIdsForRegion,
    filterMissingJointsByRegion,
    filterEnvironmentalCameraWarnings,
    isFilmingOrVisibilityFixText,
    getGlobalPromptRules,
    GLOBAL_LLM_CAMERA_GAG_RULE,
    GLOBAL_LLM_ROM_RULE,
    CALISTHENICS_VERTICAL_PULL_CAMERA_RULE,
    TEMPO_DEDUCTION_CAP_POINTS,
    TEMPO_DEDUCTION_CAP_PCT
  };
}
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
