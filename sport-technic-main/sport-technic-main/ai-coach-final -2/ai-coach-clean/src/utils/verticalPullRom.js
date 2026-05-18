(function (global) {
'use strict';

/**
 * Angle-agnostic ROM verification for vertical pull patterns (pull-up, chin-up, lat pulldown).
 * Reduces false "chin did not cross bar" flags from low/tilted camera perspective.
 */

const VERTICAL_PULL_EXERCISE_KEYS = new Set(['pullup', 'chinup', 'latpulldown']);

const DEFAULTS = {
  occlusionConfidence: 0.65,
  primaryElbowDeg: 50,
  shoulderAdductionDeg: 72,
  yMarginTorsoRatio: 0.12,
  yMarginTorsoRatioMax: 0.15,
  minRepCompleteRatio: 0.5
};

const CHIN_FAULT_RE =
  /סנטר\s*(לא|לא\s*עבר|לא\s*הגיע|לא\s*חצה|לא\s*עלה)|לא\s*חצה\s*את\s*המוט|chin\s*(did\s*not|didn't|never)\s*(cross|clear|reach)|chin\s*below|partial\s*pull[\s-]?up|מתח\s*לא\s*מלא|טווח\s*חלקי.*סנטר|סנטר\s*מתחת/i;

const CHEST_TO_BAR_PENALTY_RE =
  /חזה\s*למוט|chest\s*to\s*bar|הביא.*חזה.*מוט|רק.*סנטר.*(לא|במקום)|לא\s*הגיע.*חזה/i;

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function meanFinite(values) {
  const xs = (values || []).filter(Number.isFinite);
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function isVerticalPullExercise(exerciseKey) {
  return VERTICAL_PULL_EXERCISE_KEYS.has(String(exerciseKey || '').toLowerCase());
}

function landmarkVis(lm, idx) {
  const p = lm && lm[idx];
  if (!p) return 0;
  const v = Number(p.visibility);
  return Number.isFinite(v) ? v : 0;
}

function buildFrameSnapshot(lm, helpers) {
  const angle3 = helpers && helpers.angle3;
  const meanFiniteFn = helpers && helpers.meanFinite ? helpers.meanFinite : meanFinite;
  if (!lm || typeof angle3 !== 'function') return null;

  const p11 = lm[11];
  const p12 = lm[12];
  const p13 = lm[13];
  const p14 = lm[14];
  const p15 = lm[15];
  const p16 = lm[16];
  const p23 = lm[23];
  const p24 = lm[24];
  const p0 = lm[0];

  const shoulderMidY = meanFiniteFn([p11 && p11.y, p12 && p12.y]);
  const wristMidY = meanFiniteFn([p15 && p15.y, p16 && p16.y]);
  const hipMidY = meanFiniteFn([p23 && p23.y, p24 && p24.y]);
  const shoulderMidX = meanFiniteFn([p11 && p11.x, p12 && p12.x]);
  const hipMidX = meanFiniteFn([p23 && p23.x, p24 && p24.x]);
  const elbowMidY = meanFiniteFn([p13 && p13.y, p14 && p14.y]);

  const lElbow = angle3(p11, p13, p15);
  const rElbow = angle3(p12, p14, p16);
  const lShoulder = angle3(p13, p11, p23);
  const rShoulder = angle3(p14, p12, p24);

  const torsoLen = (Number.isFinite(shoulderMidY) && Number.isFinite(hipMidY) && Number.isFinite(shoulderMidX) && Number.isFinite(hipMidX))
    ? Math.hypot(shoulderMidX - hipMidX, shoulderMidY - hipMidY)
    : NaN;

  const noseY = p0 && Number.isFinite(p0.y) ? p0.y : NaN;
  const chinProxyY = Number.isFinite(noseY) ? noseY : (Number.isFinite(shoulderMidY) ? shoulderMidY - (Number.isFinite(torsoLen) ? torsoLen * 0.08 : 0.02) : NaN);

  return {
    elbow_deg: meanFiniteFn([lElbow, rElbow]),
    shoulder_deg: meanFiniteFn([lShoulder, rShoulder]),
    nose_y: chinProxyY,
    wrist_mid_y: wristMidY,
    shoulder_mid_y: shoulderMidY,
    torso_len: torsoLen,
    nose_vis: landmarkVis(lm, 0),
    wrist_vis: meanFiniteFn([landmarkVis(lm, 15), landmarkVis(lm, 16)]),
    elbow_mid_y: elbowMidY
  };
}

function dynamicElbowThreshold(peakElbows, cfg) {
  const base = Number(cfg.primaryElbowDeg) || DEFAULTS.primaryElbowDeg;
  const peaks = (peakElbows || []).filter((v) => Number.isFinite(v) && v > 20);
  if (peaks.length < 2) return base;
  const best = Math.min(...peaks);
  return Math.min(base, Math.max(38, best + 8));
}

function primaryElbowCheck(elbowDeg, threshold) {
  return Number.isFinite(elbowDeg) && elbowDeg <= threshold;
}

function secondaryShoulderCheck(shoulderDeg, cfg) {
  const limit = Number(cfg.shoulderAdductionDeg) || DEFAULTS.shoulderAdductionDeg;
  return Number.isFinite(shoulderDeg) && shoulderDeg <= limit;
}

function yAxisChinCheck(frame, cfg) {
  const chinY = frame.nose_y;
  const barY = frame.wrist_mid_y;
  const torsoLen = frame.torso_len;
  if (!Number.isFinite(chinY) || !Number.isFinite(barY) || !Number.isFinite(torsoLen) || torsoLen <= 0) {
    return { pass: false, skipped: true, reason: 'missing_y_inputs' };
  }
  const ratio = Number(cfg.yMarginTorsoRatio) || DEFAULTS.yMarginTorsoRatio;
  const margin = torsoLen * Math.min(
    Number(cfg.yMarginTorsoRatioMax) || DEFAULTS.yMarginTorsoRatioMax,
    Math.max(0.1, ratio)
  );
  const pass = chinY <= barY + margin;
  return { pass, skipped: false, margin, chin_y: chinY, bar_y: barY };
}

function repPeakIndex(frames, start, end, depthSeries) {
  let bestIdx = start;
  let bestDepth = -Infinity;
  for (let i = start; i <= end; i++) {
    const d = depthSeries && depthSeries[i];
    if (Number.isFinite(d) && d > bestDepth) {
      bestDepth = d;
      bestIdx = i;
    }
  }
  if (bestDepth === -Infinity) {
    let minElbow = Infinity;
    for (let i = start; i <= end; i++) {
      const e = frames[i] && frames[i].elbow_deg;
      if (Number.isFinite(e) && e < minElbow) {
        minElbow = e;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

function evaluateRepAtPeak(frame, cfg, elbowThreshold) {
  const occlusion =
    (Number.isFinite(frame.nose_vis) && frame.nose_vis < cfg.occlusionConfidence) ||
    (Number.isFinite(frame.wrist_vis) && frame.wrist_vis < cfg.occlusionConfidence);

  const primary = primaryElbowCheck(frame.elbow_deg, elbowThreshold);
  const secondary = secondaryShoulderCheck(frame.shoulder_deg, cfg);

  let yCheck = { pass: false, skipped: true };
  if (!occlusion) {
    yCheck = yAxisChinCheck(frame, cfg);
  }

  const kinematicComplete = primary || secondary;
  const chinOverBarOk = !occlusion && yCheck.pass;
  const complete = kinematicComplete || chinOverBarOk;

  return {
    complete,
    primary_elbow: primary,
    secondary_shoulder: secondary,
    y_axis: yCheck,
    occlusion_fallback: occlusion,
    elbow_deg_peak: frame.elbow_deg,
    shoulder_deg_peak: frame.shoulder_deg,
    elbow_threshold_deg: elbowThreshold
  };
}

/**
 * @param {object} input
 * @param {string} input.exerciseKey
 * @param {Array<object>} input.frames per-frame snapshots from buildFrameSnapshot
 * @param {Array<{startIndex:number,endIndex:number}>} input.repWindows
 * @param {number[]} [input.depthSeries]
 * @param {object} [input.config]
 */
function evaluateVerticalPullRom(input) {
  const exerciseKey = String((input && input.exerciseKey) || '').toLowerCase();
  if (!isVerticalPullExercise(exerciseKey)) {
    return { skipped: true, exerciseKey, rom_score_percent: null, rom_complete: false };
  }

  const cfg = Object.assign({}, DEFAULTS, (input && input.config) || {});
  const frames = Array.isArray(input.frames) ? input.frames : [];
  const repWindows = Array.isArray(input.repWindows) ? input.repWindows : [];
  const depthSeries = Array.isArray(input.depthSeries) ? input.depthSeries : [];

  if (!frames.length) {
    return {
      skipped: false,
      exerciseKey,
      rom_score_percent: 55,
      rom_complete: false,
      rep_results: [],
      suppress_chin_bar_fault: false
    };
  }

  const peakElbows = [];
  const repResults = [];

  for (let r = 0; r < repWindows.length; r++) {
    const w = repWindows[r] || {};
    const start = Math.max(0, Math.min(frames.length - 1, Number(w.startIndex) || 0));
    const end = Math.max(start, Math.min(frames.length - 1, Number(w.endIndex) || start));
    const peakIdx = repPeakIndex(frames, start, end, depthSeries);
    const frame = frames[peakIdx] || {};
    peakElbows.push(frame.elbow_deg);
  }

  const elbowThreshold = dynamicElbowThreshold(peakElbows, cfg);

  if (!repWindows.length) {
    let peakFrame = frames[0];
    let minElbow = Infinity;
    for (let i = 0; i < frames.length; i++) {
      const e = frames[i].elbow_deg;
      if (Number.isFinite(e) && e < minElbow) {
        minElbow = e;
        peakFrame = frames[i];
      }
    }
    const single = evaluateRepAtPeak(peakFrame, cfg, elbowThreshold);
    const romComplete = !!single.complete;
    return {
      skipped: false,
      exerciseKey,
      rom_score_percent: romComplete ? 100 : 58,
      rom_complete: romComplete,
      rep_results: [{ rep: 1, peak_index: 0, ...single }],
      suppress_chin_bar_fault: !!(single.primary_elbow || single.secondary_shoulder),
      checks: {
        primary_elbow_deg_threshold: elbowThreshold,
        aggregate: single
      }
    };
  }

  for (let r = 0; r < repWindows.length; r++) {
    const w = repWindows[r] || {};
    const start = Math.max(0, Math.min(frames.length - 1, Number(w.startIndex) || 0));
    const end = Math.max(start, Math.min(frames.length - 1, Number(w.endIndex) || start));
    const peakIdx = repPeakIndex(frames, start, end, depthSeries);
    const repEval = evaluateRepAtPeak(frames[peakIdx] || {}, cfg, elbowThreshold);
    repResults.push({ rep: r + 1, peak_index: peakIdx, ...repEval });
  }

  const completeReps = repResults.filter((x) => x.complete).length;
  const ratio = repResults.length ? completeReps / repResults.length : 0;
  const kinematicHits = repResults.filter((x) => x.primary_elbow || x.secondary_shoulder).length;
  const kinematicRatio = repResults.length ? kinematicHits / repResults.length : 0;

  const romComplete = ratio >= cfg.minRepCompleteRatio || kinematicRatio >= cfg.minRepCompleteRatio;
  const romScorePercent = romComplete ? 100 : Math.round(Math.max(45, Math.min(94, ratio * 100)));

  return {
    skipped: false,
    exerciseKey,
    rom_score_percent: romScorePercent,
    rom_complete: romComplete,
    rep_complete_ratio: Number(ratio.toFixed(3)),
    kinematic_confirm_ratio: Number(kinematicRatio.toFixed(3)),
    rep_results: repResults,
    suppress_chin_bar_fault: kinematicRatio >= cfg.minRepCompleteRatio || romComplete,
    checks: {
      primary_elbow_deg_threshold: elbowThreshold,
      shoulder_adduction_deg_max: cfg.shoulderAdductionDeg,
      occlusion_confidence_min: cfg.occlusionConfidence,
      y_margin_torso_ratio: cfg.yMarginTorsoRatio
    }
  };
}

function textImpliesChinBarFault(text) {
  return CHIN_FAULT_RE.test(String(text || ''));
}

function applyVerticalPullFeedbackSanitizer(text, metrics) {
  const s = String(text || '');
  if (!s) return s;
  if (!metrics || !metrics.suppress_chin_bar_fault) return s;
  if (!textImpliesChinBarFault(s)) return s;
  return s
    .replace(/[^.!?\n]*סנטר[^.!?\n]*(לא|לא\s*עבר|לא\s*חצה|מתחת)[^.!?\n]*[.!?]?/gi, 'טווח תנועה מלא מאושר לפי זווית מרפק וכתף (עמיד לזווית מצלמה). ')
    .replace(/[^.!?\n]*chin[^.!?\n]*(did not|didn't|never|below|not cross)[^.!?\n]*[.!?]?/gi, 'Full ROM confirmed by elbow flexion at the top (camera-angle robust). ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sanitizeVerticalPullAnalysisPayload(out, exerciseKey) {
  if (!out || typeof out !== 'object') return out;
  const key = String(exerciseKey || '').toLowerCase();
  if (!isVerticalPullExercise(key)) return out;

  const om = out.objective_metrics && typeof out.objective_metrics === 'object' ? out.objective_metrics : {};
  const vpr = om.vertical_pull_rom && typeof om.vertical_pull_rom === 'object' ? om.vertical_pull_rom : null;
  const suppress = !!(vpr && vpr.suppress_chin_bar_fault) || !!om.vertical_pull_rom_complete;

  if (!suppress) return out;

  out.summary = applyVerticalPullFeedbackSanitizer(out.summary, { suppress_chin_bar_fault: true });
  out.tips = applyVerticalPullFeedbackSanitizer(out.tips, { suppress_chin_bar_fault: true });

  if (Array.isArray(out.fixes)) {
    out.fixes = out.fixes.filter((f) => {
      const fid = String((f && f.fault_id) || '').toUpperCase();
      if (/PULLUP_PARTIAL_ROM|CHINUP_PARTIAL|LATPD_PARTIAL_ROM/.test(fid)) return false;
      const blob = String((f && f.title) || '') + ' ' + String((f && f.desc) || '');
      if (CHEST_TO_BAR_PENALTY_RE.test(blob)) return false;
      return !textImpliesChinBarFault(blob);
    });
  }
  if (Array.isArray(out.recommendations)) {
    out.recommendations = out.recommendations.filter((line) => {
      const t = String(line || '');
      if (CHEST_TO_BAR_PENALTY_RE.test(t)) return false;
      return !textImpliesChinBarFault(t);
    });
  }
  if (Array.isArray(out.reps)) {
    out.reps = out.reps.map((r) => ({
      ...r,
      note: applyVerticalPullFeedbackSanitizer(r && r.note, { suppress_chin_bar_fault: true })
    }));
  }

  if (vpr && vpr.rom_complete) {
    om.rom_score = 100;
    om.vertical_pull_rom_score_percent = 100;
    om.vertical_pull_rom_complete = true;
    om.suppress_chin_bar_fault = true;
  }
  if (suppress) {
    om.vertical_pull_rom_complete = om.vertical_pull_rom_complete !== false;
  }

  out.objective_metrics = om;
  return out;
}

global.TrainIQVerticalPullRom = Object.assign({}, global.TrainIQVerticalPullRom || {}, {
  VERTICAL_PULL_EXERCISE_KEYS,
  DEFAULTS,
  isVerticalPullExercise,
  buildFrameSnapshot,
  evaluateVerticalPullRom,
  applyVerticalPullFeedbackSanitizer,
  sanitizeVerticalPullAnalysisPayload,
  textImpliesChinBarFault
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = global.TrainIQVerticalPullRom;
}
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
