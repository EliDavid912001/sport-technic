'use strict';

/**
 * TrainIQ — Exercise Registry (kinesiology knowledge graph)
 *
 * Single source of truth for exercise metadata, structured anatomy,
 * catalogued faults (fault_id → rules engine / progress DB),
 * and CV rep-detection runtime thresholds (migrated from index.html).
 *
 * Anatomy entries are objects — never comma-joined muscle strings.
 */

/** @typedef {{ id: string, nameHe: string, nameEn: string }} MuscleRef */
/** @typedef {{ fault_id: string, description: string, anatomical_consequence: string }} BiomechanicalCue */

/** Same numeric fields as legacy EXERCISE_RUNTIME_PARAMS.default + overrides */
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
  muscleup: {
    upThreshold: 0.89,
    downThreshold: 0.11,
    debounceMs: 520,
    minRom: 16,
    minCycleAmp: 0.58,
    scoreFloor: 58,
    scoreFloorReps3: 64
  },
  pullover: {
    upThreshold: 0.9,
    downThreshold: 0.1,
    debounceMs: 540,
    minRom: 18,
    minCycleAmp: 0.6,
    scoreFloor: 60,
    scoreFloorReps3: 66
  },
  pullup: {
    upThreshold: 0.88,
    downThreshold: 0.12,
    debounceMs: 500,
    minRom: 14,
    minCycleAmp: 0.54,
    scoreFloor: 55,
    scoreFloorReps3: 62
  },
  chinup: {
    upThreshold: 0.88,
    downThreshold: 0.12,
    debounceMs: 500,
    minRom: 14,
    minCycleAmp: 0.54,
    scoreFloor: 55,
    scoreFloorReps3: 62
  },
  dips: {
    upThreshold: 0.86,
    downThreshold: 0.14,
    debounceMs: 460,
    minRom: 12,
    minCycleAmp: 0.5,
    scoreFloor: 55,
    scoreFloorReps3: 60
  },
  pushup: {
    upThreshold: 0.84,
    downThreshold: 0.16,
    debounceMs: 430,
    minRom: 11,
    minCycleAmp: 0.46,
    scoreFloor: 58,
    scoreFloorReps3: 63
  },
  squat: {
    upThreshold: 0.86,
    downThreshold: 0.14,
    debounceMs: 520,
    minRom: 13,
    minCycleAmp: 0.52,
    scoreFloor: 55,
    scoreFloorReps3: 60
  },
  deadlift: {
    upThreshold: 0.86,
    downThreshold: 0.14,
    debounceMs: 520,
    minRom: 13,
    minCycleAmp: 0.5,
    scoreFloor: 55,
    scoreFloorReps3: 60
  }
};

function runtimeParamsFor(key) {
  return { ...DEFAULT_RUNTIME_PARAMS, ...(RUNTIME_OVERRIDES[key] || {}) };
}

/** Optional MediaPipe / CV profile (legacy EXERCISE_CV_CONFIG + inferred). */
function cvProfile(partial) {
  return {
    category: partial.category,
    primary_tracking_joints: partial.primary_tracking_joints,
    movement_axis: partial.movement_axis,
    motion: partial.motion
  };
}

/**
 * @type {Record<string, {
 *   key: string,
 *   metadata: { name: { he: string, en: string }, icon: string, category: string, mode: string },
 *   anatomy: { primary: MuscleRef[], secondary: MuscleRef[], stabilizers: MuscleRef[] },
 *   biomechanical_cues: BiomechanicalCue[],
 *   runtime_params: typeof DEFAULT_RUNTIME_PARAMS,
 *   cv_profile?: ReturnType<typeof cvProfile>
 * }>}
 */
const exerciseRegistry = {
  muscleup: {
    key: 'muscleup',
    metadata: {
      name: { he: 'מאסל אפ', en: 'Muscle-up' },
      icon: '🔥',
      category: 'bodyweight',
      mode: 'vertical_pull'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'teres_major', nameHe: 'שריר גדול עגול', nameEn: 'Teres major' },
        { id: 'pectoralis_major_sternal', nameHe: 'חזה גדול — אזוריי', nameEn: 'Pectoralis major (sternal head)' },
        { id: 'triceps_brachii_long', nameHe: 'תלת ראשי — ראש ארוך', nameEn: 'Triceps brachii (long head)' }
      ],
      secondary: [
        { id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' },
        { id: 'brachialis', nameHe: 'ברכיאליס', nameEn: 'Brachialis' },
        { id: 'brachioradialis', nameHe: 'ברכיורדיאליס', nameEn: 'Brachioradialis' },
        { id: 'middle_deltoid', nameHe: 'דלתא אמצעית', nameEn: 'Middle deltoid' }
      ],
      stabilizers: [
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' },
        { id: 'external_oblique', nameHe: 'אלכסון חיצוני', nameEn: 'External oblique' },
        { id: 'lower_trapezius', nameHe: 'טרפז תחתון', nameEn: 'Lower trapezius' },
        { id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }
      ]
    },
    /** Deterministic client scoring (ROM / symmetry / eccentric control) — see src/utils/scoringEngine.js */
    scoring_rules: {
      weights: { rom: 0.4, symmetry: 0.3, tempo: 0.3 },
      rom: {
        bottom_elbow_extension: {
          joint: 'elbow_avg',
          aggregate: 'max',
          target: 168,
          tolerance: 18,
          direction: 'higher_better'
        },
        top_elbow_flexion: {
          joint: 'elbow_avg',
          aggregate: 'min',
          target: 72,
          tolerance: 26,
          direction: 'lower_better'
        }
      },
      symmetry: {
        elbow_angle_mean_abs_diff_max: 14,
        knee_angle_mean_abs_diff_max: 18
      },
      tempo: {
        y_series: 'wrist_mid_y',
        eccentric_dy_positive: true,
        max_norm_velocity_soft: 3.4,
        max_norm_velocity_hard: 7.0
      }
    },
    biomechanical_cues: [
      {
        fault_id: 'MU_CHICKEN_WING',
        description: 'מרפק אחד עובר מעל המוט לפני השני במעבר.',
        anatomical_consequence: 'עומס אסימטרי על כתף (גלאנומרל) וסיכון לפגיעה רוטטורית.'
      },
      {
        fault_id: 'MU_INCOMPLETE_PULL_HEIGHT',
        description: 'גובה מתח לפני המעבר לא מספיק — חוסר קו כוח.',
        anatomical_consequence: 'מומנט כתף-מרפק לא מנוצל; עומס מיותר על שורש כף היד.'
      },
      {
        fault_id: 'MU_LOST_GLOBAL_EXTENSION',
        description: 'אובדן קשיחות גוף (hip/trunk) לפני המעבר.',
        anatomical_consequence: 'דליפת מומנט; פחות שימוש בשרשרת האחורית (posterior chain).'
      },
      {
        fault_id: 'MU_ASYMMETRIC_TRANSITION',
        description: 'רוטציה/הטיה צידית במעבר מעל המוט.',
        anatomical_consequence: 'גאיט תנועתי לא סימטרי; עומס על קפסולה אחורית של הכתף.'
      },
      {
        fault_id: 'MU_DIP_LOCKOUT_FAIL',
        description: 'כישלון נעילה יציבה בשלב הדחיקה העליונה.',
        anatomical_consequence: 'טרנספורציה לקויה של כוח לטרייספס ודלתא.'
      }
    ],
    runtime_params: runtimeParamsFor('muscleup'),
    cv_profile: cvProfile({
      category: 'bodyweight',
      primary_tracking_joints: [11, 12, 15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  planche: {
    key: 'planche',
    metadata: {
      name: { he: 'פלאנץ׳', en: 'Planche' },
      icon: '🤸',
      category: 'gymnastics',
      mode: 'isometric_horizontal'
    },
    anatomy: {
      primary: [
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' },
        { id: 'pectoralis_major_clavicular', nameHe: 'חזה גדול — בריחי', nameEn: 'Pectoralis major (clavicular head)' },
        { id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' },
        { id: 'triceps_brachii_medial_lateral', nameHe: 'תלת ראשי — ראשים מדיאלי ולטרלי', nameEn: 'Triceps brachii (medial & lateral heads)' }
      ],
      secondary: [
        { id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' },
        { id: 'coracobrachialis', nameHe: 'קורקוברכיאליס', nameEn: 'Coracobrachialis' },
        { id: 'wrist_flexors', nameHe: 'כפיפי שורש כף יד', nameEn: 'Wrist flexors' }
      ],
      stabilizers: [
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' },
        { id: 'transverse_abdominis', nameHe: 'רוחבי בטן', nameEn: 'Transverse abdominis' },
        { id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' },
        { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'PLANCHE_LUMBAR_HYPEREXTENSION',
        description: 'היפר-אקסטנציה מותנית כדי להרים רגליים.',
        anatomical_consequence: 'עומס ממוקד על פאסט משחקים מותניים; איבוד ניטרוליות שדרתית.'
      },
      {
        fault_id: 'PLANCHE_SCAPULAR_WINGING',
        description: 'כנפיים — שקעת שכמה בולטת.',
        anatomical_consequence: 'חוסר יציבות שכמית; העברת עומס מסוכנת לראש הזרוע.'
      },
      {
        fault_id: 'PLANCHE_ELBOW_HYPEREXTENSION',
        description: 'פשיטת מרפק יתר (carrying angle מוגזם).',
        anatomical_consequence: 'עומס על קפסולה אלכסונית ורצועה מדיאלית של מרפק.'
      },
      {
        fault_id: 'PLANCHE_PROTRACTED_NECK',
        description: 'צוואר בולט קדימה (forward head).',
        anatomical_consequence: 'עומס על מפרקות צוואר; פיצוי בשרשרת האחורית.'
      },
      {
        fault_id: 'PLANCHE_HIP_SAG',
        description: 'ירכיים נופלות מתחת לקו הגוף.',
        anatomical_consequence: 'דליפת מומנט מהליבה; פחות שימוש בישר בטני ורוחבי.'
      }
    ],
    runtime_params: runtimeParamsFor('planche'),
    cv_profile: cvProfile({
      category: 'gymnastics',
      primary_tracking_joints: [11, 12, 15, 16, 23, 24],
      movement_axis: 'y',
      motion: 'isometric'
    })
  },

  overheadpress: {
    key: 'overheadpress',
    metadata: {
      name: { he: 'לחיצת כתפיים', en: 'Overhead press' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'vertical_push'
    },
    anatomy: {
      primary: [
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' },
        { id: 'middle_deltoid', nameHe: 'דלתא אמצעית', nameEn: 'Middle deltoid' },
        { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' },
        { id: 'upper_pectoralis_major', nameHe: 'חזה עליון', nameEn: 'Upper pectoralis major' }
      ],
      secondary: [
        { id: 'trapezius_upper', nameHe: 'טרפז עליון', nameEn: 'Upper trapezius' },
        { id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }
      ],
      stabilizers: [
        { id: 'transverse_abdominis', nameHe: 'רוחבי בטן', nameEn: 'Transverse abdominis' },
        { id: 'internal_oblique', nameHe: 'אלכסון פנימי', nameEn: 'Internal oblique' },
        { id: 'multifidus', nameHe: 'מולטיפידוס', nameEn: 'Multifidus' },
        { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }
      ]
    },
    scoring_rules: {
      weights: { rom: 0.4, symmetry: 0.3, tempo: 0.3 },
      rom: {
        eccentric_bottom_elbow_angle: {
          joint: 'elbow_avg',
          aggregate: 'min',
          target: 88,
          tolerance: 18,
          direction: 'lower_better'
        },
        concentric_lockout_elbow_angle: {
          joint: 'elbow_avg',
          aggregate: 'max',
          target: 172,
          tolerance: 14,
          direction: 'higher_better'
        }
      },
      symmetry: {
        elbow_angle_mean_abs_diff_max: 12,
        knee_angle_mean_abs_diff_max: 16
      },
      tempo: {
        y_series: 'wrist_mid_y',
        eccentric_dy_positive: false,
        max_norm_velocity_soft: 2.9,
        max_norm_velocity_hard: 6.2
      }
    },
    biomechanical_cues: [
      {
        fault_id: 'OHP_ELBOW_FLARE',
        description: 'מרפקים פתוחים הצידה במקום מתחת לשורש כף היד.',
        anatomical_consequence: 'מומנט כפיפה מוגבר על הכתף; סיכון אימפינג׳מנט.'
      },
      {
        fault_id: 'OHP_LUMBAR_EXTENSION',
        description: 'הרחבת מותנית (arching) להעברת המוט.',
        anatomical_consequence: 'דחיפת עומס לדיסקים ופאסט משחקים מותניים במקום דלתא.'
      },
      {
        fault_id: 'OHP_FORWARD_BAR_PATH',
        description: 'מסלול המוט נשאר מול הפנים במקום קשת אחורית קלה.',
        anatomical_consequence: 'עומס מוגבר על קפסולה אחורית ורוטטורים.'
      },
      {
        fault_id: 'OHP_INCOMPLETE_LOCKOUT',
        description: 'נעילה חלקית של מרפקים בראש.',
        anatomical_consequence: 'טרייספס לא משלים אקסטנציה; עומס שארידי על דלתא.'
      }
    ],
    runtime_params: runtimeParamsFor('overheadpress'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  pullover: {
    key: 'pullover',
    metadata: {
      name: { he: 'פול-אובר', en: 'Pullover' },
      icon: '🌀',
      category: 'bodyweight',
      mode: 'full_rotation'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'teres_major', nameHe: 'שריר גדול עגול', nameEn: 'Teres major' }
      ],
      secondary: [
        { id: 'pectoralis_major_sternal', nameHe: 'חזה גדול — אזוריי', nameEn: 'Pectoralis major (sternal head)' },
        { id: 'triceps_brachii_long', nameHe: 'תלת ראשי — ראש ארוך', nameEn: 'Triceps brachii (long head)' }
      ],
      stabilizers: [
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' },
        { id: 'obliques', nameHe: 'אלכסונים', nameEn: 'Obliques' },
        { id: 'middle_deltoid', nameHe: 'דלתא אמצעית', nameEn: 'Middle deltoid' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'PULLOVER_EXCESSIVE_LUMBAR_ARCH',
        description: 'קשת מותנית מוגזמת להארכת ROM.',
        anatomical_consequence: 'דליפת מומנט מהגב במקום מפרק הכתף.'
      },
      {
        fault_id: 'PULLOVER_SHOULDER_IR_COMPROMISE',
        description: 'איבוד רוטציה פנימית בשיא האקסטנציה מעל הראש.',
        anatomical_consequence: 'עומס על קפסולה אחורית ומסובבים פנימיים.'
      }
    ],
    runtime_params: runtimeParamsFor('pullover'),
    cv_profile: cvProfile({
      category: 'bodyweight',
      primary_tracking_joints: [23, 24, 15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  pullup: {
    key: 'pullup',
    metadata: {
      name: { he: 'מתח', en: 'Pull-up' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'vertical_pull'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'teres_major', nameHe: 'שריר גדול עגול', nameEn: 'Teres major' }
      ],
      secondary: [
        { id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' },
        { id: 'brachialis', nameHe: 'ברכיאליס', nameEn: 'Brachialis' }
      ],
      stabilizers: [
        { id: 'middle_lower_trapezius', nameHe: 'טרפז אמצעי ותחתון', nameEn: 'Middle & lower trapezius' },
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' }
      ]
    },
    scoring_rules: {
      weights: { rom: 0.4, symmetry: 0.3, tempo: 0.3 },
      rom: {
        eccentric_bottom_elbow_angle: {
          joint: 'elbow_avg',
          aggregate: 'max',
          target: 175,
          tolerance: 15,
          direction: 'higher_better'
        },
        concentric_top_elbow_flexion: {
          joint: 'elbow_avg',
          aggregate: 'min',
          target: 68,
          tolerance: 22,
          direction: 'lower_better'
        }
      },
      symmetry: {
        elbow_angle_mean_abs_diff_max: 12,
        knee_angle_mean_abs_diff_max: 18
      },
      tempo: {
        y_series: 'wrist_mid_y',
        eccentric_dy_positive: true,
        max_norm_velocity_soft: 3.0,
        max_norm_velocity_hard: 6.5
      }
    },
    biomechanical_cues: [
      {
        fault_id: 'PULLUP_PARTIAL_ROM',
        description: 'סנטר לא מגיע מעל המוט / מתח לא מלא.',
        anatomical_consequence: 'ROM קצר מקטין עומס על רחב גבי ומעביר לזרועות.'
      },
      {
        fault_id: 'PULLUP_SHOULDER_ELEVATION',
        description: 'הרמת כתפיים (shrug) במקום depression.',
        anatomical_consequence: 'דחיסת מסלול תנועה; עומס על טרפז עליון.'
      }
    ],
    runtime_params: runtimeParamsFor('pullup'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [11, 12, 15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  chinup: {
    key: 'chinup',
    metadata: {
      name: { he: 'צ׳ין אפ', en: 'Chin-up' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'vertical_pull'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' }
      ],
      secondary: [
        { id: 'brachialis', nameHe: 'ברכיאליס', nameEn: 'Brachialis' },
        { id: 'teres_major', nameHe: 'שריר גדול עגול', nameEn: 'Teres major' }
      ],
      stabilizers: [
        { id: 'middle_lower_trapezius', nameHe: 'טרפז אמצעי ותחתון', nameEn: 'Middle & lower trapezius' },
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'CHINUP_SUPINATED_WRIST_STRAIN',
        description: 'אחיזה צרה או כפיפת שורש כף יד מוגזמת.',
        anatomical_consequence: 'עומס על פלקסורים של שורש כף היד.'
      },
      {
        fault_id: 'CHINUP_KIPPING_UNCONTROLLED',
        description: 'ניתוק ליבה ללא שליטה במומנטום.',
        anatomical_consequence: 'עומס גאיטי על כתף ומרפק.'
      }
    ],
    runtime_params: runtimeParamsFor('chinup'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [11, 12, 15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  dips: {
    key: 'dips',
    metadata: {
      name: { he: 'מקבילים', en: 'Dips' },
      icon: '⚡',
      category: 'free_movement',
      mode: 'vertical_push'
    },
    anatomy: {
      primary: [
        { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' },
        { id: 'lower_pectoralis_major', nameHe: 'חזה תחתון', nameEn: 'Lower pectoralis major' }
      ],
      secondary: [
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' }
      ],
      stabilizers: [
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' },
        { id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'DIP_SHOULDER_DEPRESSION_FAIL',
        description: 'כתף לא מורדת לפני כיפוף מרפק.',
        anatomical_consequence: 'סיכון אימפינג׳מנט ועומס על קפסולה אחורית.'
      },
      {
        fault_id: 'DIP_VALGUS_COLLAPSE',
        description: 'כיפוף מרפק פנימה (valgus).',
        anatomical_consequence: 'עומס על רצועה מדיאלית של מרפק.'
      }
    ],
    runtime_params: runtimeParamsFor('dips'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [11, 12],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  pushup: {
    key: 'pushup',
    metadata: {
      name: { he: 'שכיבות סמיכה', en: 'Push-up' },
      icon: '💪',
      category: 'free_movement',
      mode: 'horizontal_push'
    },
    anatomy: {
      primary: [
        { id: 'pectoralis_major', nameHe: 'חזה גדול', nameEn: 'Pectoralis major' },
        { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' },
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' }
      ],
      secondary: [{ id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }],
      stabilizers: [
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' },
        { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'PUSHUP_HIP_PIKE',
        description: 'עליית ישבן (pike) במקום גוף שטוח.',
        anatomical_consequence: 'קיצור ROM בחזה; פחות עומס על פקטורליס.'
      },
      {
        fault_id: 'PUSHUP_SAGGING_HIPS',
        description: 'ירכיים צונחות.',
        anatomical_consequence: 'היפר-אקסטנציה מותנית; עומס על פאסט משחקים מותניים.'
      }
    ],
    runtime_params: runtimeParamsFor('pushup'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [11, 12],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  benchpress: {
    key: 'benchpress',
    metadata: {
      name: { he: 'בנץ׳ פרס', en: 'Bench press' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'horizontal_push'
    },
    anatomy: {
      primary: [
        { id: 'pectoralis_major', nameHe: 'חזה גדול', nameEn: 'Pectoralis major' },
        { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' },
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' }
      ],
      secondary: [{ id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }],
      stabilizers: [
        { id: 'rotator_cuff', nameHe: 'שלד הכתף (רוטטור קאף)', nameEn: 'Rotator cuff' },
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'BENCH_ELBOW_FLARE',
        description: 'מרפקים בזווית רחבה מדי ביחס לגו.',
        anatomical_consequence: 'מומנט כפיפה על הכתף; סיכון אימפינג׳מנט.'
      },
      {
        fault_id: 'BENCH_ASYMMETRIC_PRESS',
        description: 'צד אחד מוביל את המוט.',
        anatomical_consequence: 'עומס מסובבים וסימטריה לקויה של הכתף.'
      }
    ],
    scoring_rules: {
      weights: { rom: 0.4, symmetry: 0.35, tempo: 0.25 },
      rom: {
        bottom_elbow_flexion: {
          joint: 'elbow_avg',
          aggregate: 'max',
          target: 100,
          tolerance: 18,
          direction: 'lower_better'
        },
        top_elbow_extension: {
          joint: 'elbow_avg',
          aggregate: 'min',
          target: 166,
          tolerance: 14,
          direction: 'higher_better'
        }
      },
      symmetry: { elbow_angle_mean_abs_diff_max: 10, knee_angle_mean_abs_diff_max: 22 },
      tempo: {
        y_series: 'wrist_mid_y',
        eccentric_dy_positive: true,
        max_norm_velocity_soft: 3.2,
        max_norm_velocity_hard: 7
      }
    },
    runtime_params: runtimeParamsFor('benchpress'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  row: {
    key: 'row',
    metadata: {
      name: { he: 'חתירה', en: 'Row' },
      icon: '🚣',
      category: 'free_movement',
      mode: 'horizontal_pull'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'rhomboids', nameHe: 'מעוין', nameEn: 'Rhomboids' },
        { id: 'middle_trapezius', nameHe: 'טרפז אמצעי', nameEn: 'Middle trapezius' }
      ],
      secondary: [
        { id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' },
        { id: 'posterior_deltoid', nameHe: 'דלתא אחורית', nameEn: 'Posterior deltoid' }
      ],
      stabilizers: [
        { id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' },
        { id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'ROW_THORACIC_KYPHOSIS_PULL',
        description: 'כיפוף חזה במקום הרחבת חזה.',
        anatomical_consequence: 'דליפת מומנט מהגב; פחות שימוש בלטסים.'
      }
    ],
    runtime_params: runtimeParamsFor('row'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'x',
      motion: 'in'
    })
  },

  latpulldown: {
    key: 'latpulldown',
    metadata: {
      name: { he: 'לאט פולדאון', en: 'Lat pulldown' },
      icon: '🧲',
      category: 'machine',
      mode: 'vertical_pull'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'teres_major', nameHe: 'שריר גדול עגול', nameEn: 'Teres major' }
      ],
      secondary: [
        { id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' },
        { id: 'brachialis', nameHe: 'ברכיאליס', nameEn: 'Brachialis' }
      ],
      stabilizers: [
        { id: 'middle_lower_trapezius', nameHe: 'טרפז אמצעי ותחתון', nameEn: 'Middle & lower trapezius' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'LATPD_PULL_BEHIND_NECK',
        description: 'משיכה מאחורי הראש.',
        anatomical_consequence: 'סיכון אימפינג׳מנט ורוטציה חיצונית מוגזמת.'
      }
    ],
    runtime_params: runtimeParamsFor('latpulldown'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  legextension: {
    key: 'legextension',
    metadata: {
      name: { he: 'פשיטת ברך במכונה', en: 'Leg extension' },
      icon: '🦿',
      category: 'machine',
      mode: 'ankle'
    },
    anatomy: {
      primary: [{ id: 'vastus_lateralis', nameHe: 'ותוס לטרלי', nameEn: 'Vastus lateralis' }, { id: 'rectus_femoris', nameHe: 'ישר ירך', nameEn: 'Rectus femoris' }, { id: 'vastus_medialis', nameHe: 'ותוס מדיאלי', nameEn: 'Vastus medialis' }],
      secondary: [{ id: 'vastus_intermedius', nameHe: 'ותוס אינטרמדיוס', nameEn: 'Vastus intermedius' }],
      stabilizers: [{ id: 'hip_flexors', nameHe: 'כופפי ירך', nameEn: 'Hip flexors' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'LEGEXT_VALGUS_KNEE',
        description: 'ברך נכנסת פנימה (valgus).',
        anatomical_consequence: 'עומס על רצועה מדיאלית ומניסקוס מדיאלי.'
      }
    ],
    runtime_params: runtimeParamsFor('legextension'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [27, 28],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  legcurl: {
    key: 'legcurl',
    metadata: {
      name: { he: 'כפיפת ברך במכונה', en: 'Leg curl' },
      icon: '🦿',
      category: 'machine',
      mode: 'ankle'
    },
    anatomy: {
      primary: [
        { id: 'biceps_femoris', nameHe: 'ביספס ירך', nameEn: 'Biceps femoris' },
        { id: 'semitendinosus', nameHe: 'חצי גידי', nameEn: 'Semitendinosus' },
        { id: 'semimembranosus', nameHe: 'חצי קרומי', nameEn: 'Semimembranosus' }
      ],
      secondary: [{ id: 'gastrocnemius', nameHe: 'תאום רחב', nameEn: 'Gastrocnemius' }],
      stabilizers: [{ id: 'popliteus', nameHe: 'פופליטאוס', nameEn: 'Popliteus' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'LEGCURL_HIP_FLEXION_CHEAT',
        description: 'הרמת ישבן להקטנת עומס על המסטרינג.',
        anatomical_consequence: 'ROM אפקטיבי קצר; פחות עומס על כפיפי ברך.'
      }
    ],
    runtime_params: runtimeParamsFor('legcurl'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [27, 28],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  chestpressmachine: {
    key: 'chestpressmachine',
    metadata: {
      name: { he: 'צ׳סט פרס מכונה', en: 'Chest press machine' },
      icon: '🏋️',
      category: 'machine',
      mode: 'horizontal_push'
    },
    anatomy: {
      primary: [{ id: 'pectoralis_major', nameHe: 'חזה גדול', nameEn: 'Pectoralis major' }, { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' }],
      secondary: [{ id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' }],
      stabilizers: [{ id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'CPM_SHOULDER_BLADE_OFF_PAD',
        description: 'שכמות לא צמודות למשענת.',
        anatomical_consequence: 'איבוד יציבות שכמית; עומס על כתף.'
      }
    ],
    runtime_params: runtimeParamsFor('chestpressmachine'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  seatedrowmachine: {
    key: 'seatedrowmachine',
    metadata: {
      name: { he: 'חתירה מכונה', en: 'Seated row machine' },
      icon: '🚣',
      category: 'machine',
      mode: 'horizontal_pull'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'rhomboids', nameHe: 'מעוין', nameEn: 'Rhomboids' }
      ],
      secondary: [{ id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' }],
      stabilizers: [{ id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'SRM_EXCESSIVE_BODY_ENGLISH',
        description: 'נדנוד מותני להשלמת משיכה.',
        anatomical_consequence: 'דליפת מומנט מהגב התחתון.'
      }
    ],
    runtime_params: runtimeParamsFor('seatedrowmachine'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'x',
      motion: 'in'
    })
  },

  shoulderpressmachine: {
    key: 'shoulderpressmachine',
    metadata: {
      name: { he: 'לחיצת כתפיים מכונה', en: 'Shoulder press machine' },
      icon: '🏋️',
      category: 'machine',
      mode: 'vertical_push'
    },
    anatomy: {
      primary: [
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' },
        { id: 'middle_deltoid', nameHe: 'דלתא אמצעית', nameEn: 'Middle deltoid' },
        { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' }
      ],
      secondary: [{ id: 'upper_pectoralis_major', nameHe: 'חזה עליון', nameEn: 'Upper pectoralis major' }],
      stabilizers: [{ id: 'transverse_abdominis', nameHe: 'רוחבי בטן', nameEn: 'Transverse abdominis' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'OHP_ELBOW_FLARE',
        description: 'מרפקים פתוחים הצידה.',
        anatomical_consequence: 'מומנט כפיפה מוגבר על הכתף.'
      },
      {
        fault_id: 'OHP_LUMBAR_EXTENSION',
        description: 'הרחבת מותנית.',
        anatomical_consequence: 'עומס על מותן במקום דלתא.'
      }
    ],
    runtime_params: runtimeParamsFor('shoulderpressmachine'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  seatedcalfraise: {
    key: 'seatedcalfraise',
    metadata: {
      name: { he: 'תאומים ישיבה', en: 'Seated calf raise' },
      icon: '🦶',
      category: 'machine',
      mode: 'ankle'
    },
    anatomy: {
      primary: [{ id: 'soleus', nameHe: 'סולאוס', nameEn: 'Soleus' }],
      secondary: [{ id: 'gastrocnemius', nameHe: 'תאום רחב', nameEn: 'Gastrocnemius' }],
      stabilizers: [{ id: 'tibialis_posterior', nameHe: 'טיביאליס פוסטריור', nameEn: 'Tibialis posterior' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'SCR_BOUNCING_REPS',
        description: 'ניתור בתחתית ללא שליטה אקסצנטרית.',
        anatomical_consequence: 'עומס גאיטי על אכילס.'
      }
    ],
    runtime_params: runtimeParamsFor('seatedcalfraise'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [27, 28],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  cablepushdown: {
    key: 'cablepushdown',
    metadata: {
      name: { he: 'פשיטת טרייספס כבל', en: 'Cable triceps pushdown' },
      icon: '🦾',
      category: 'machine',
      mode: 'elbow_extend'
    },
    anatomy: {
      primary: [{ id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' }],
      secondary: [{ id: 'anconeus', nameHe: 'אנקונאוס', nameEn: 'Anconeus' }],
      stabilizers: [{ id: 'wrist_extensors', nameHe: 'פושטי שורש כף יד', nameEn: 'Wrist extensors' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'CPD_FORWARD_LEAN',
        description: 'הטיה קדימה עם משקל גוף.',
        anatomical_consequence: 'דליפת מומנט מהחזה והכתף.'
      }
    ],
    runtime_params: runtimeParamsFor('cablepushdown'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  cablecurl: {
    key: 'cablecurl',
    metadata: {
      name: { he: 'כפיפת בייספס כבל', en: 'Cable bicep curl' },
      icon: '💪',
      category: 'machine',
      mode: 'elbow_flex'
    },
    anatomy: {
      primary: [{ id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' }],
      secondary: [{ id: 'brachialis', nameHe: 'ברכיאליס', nameEn: 'Brachialis' }],
      stabilizers: [{ id: 'brachioradialis', nameHe: 'ברכיורדיאליס', nameEn: 'Brachioradialis' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'CCURL_ELBOW_DRIFT',
        description: 'מרפק זז קדימה מהגוף.',
        anatomical_consequence: 'קיצור מומנט על הזרוע.'
      }
    ],
    runtime_params: runtimeParamsFor('cablecurl'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  curl: {
    key: 'curl',
    metadata: {
      name: { he: 'בייספס קרל', en: 'Bicep curl' },
      icon: '💪',
      category: 'free_movement',
      mode: 'elbow_flex'
    },
    anatomy: {
      primary: [{ id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' }],
      secondary: [{ id: 'brachialis', nameHe: 'ברכיאליס', nameEn: 'Brachialis' }],
      stabilizers: [{ id: 'brachioradialis', nameHe: 'ברכיורדיאליס', nameEn: 'Brachioradialis' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'CURL_SWINGING_TORSO',
        description: 'נדנוד גוף להשלמת כפיפה.',
        anatomical_consequence: 'דליפת מומנט מהגב.'
      }
    ],
    runtime_params: runtimeParamsFor('curl'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  tricep: {
    key: 'tricep',
    metadata: {
      name: { he: 'טרייספס פשיטה', en: 'Tricep extension' },
      icon: '🦾',
      category: 'free_movement',
      mode: 'elbow_extend'
    },
    anatomy: {
      primary: [{ id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' }],
      secondary: [{ id: 'anconeus', nameHe: 'אנקונאוס', nameEn: 'Anconeus' }],
      stabilizers: [{ id: 'wrist_extensors', nameHe: 'פושטי שורש כף יד', nameEn: 'Wrist extensors' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'TRI_ELBOW_FLARE_OUT',
        description: 'מרפק נפתח הצידה.',
        anatomical_consequence: 'עומס על רצועה מדיאלית של מרפק.'
      }
    ],
    runtime_params: runtimeParamsFor('tricep'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  dumbbellrow: {
    key: 'dumbbellrow',
    metadata: {
      name: { he: 'חתירת דאמבל', en: 'Dumbbell row' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'horizontal_pull'
    },
    anatomy: {
      primary: [
        { id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' },
        { id: 'rhomboids', nameHe: 'מעוין', nameEn: 'Rhomboids' }
      ],
      secondary: [{ id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' }, { id: 'posterior_deltoid', nameHe: 'דלתא אחורית', nameEn: 'Posterior deltoid' }],
      stabilizers: [{ id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'DBROW_TORSO_ROTATION',
        description: 'סיבוב גוף להשלמת משיכה.',
        anatomical_consequence: 'דליפת מומנט מהמותן.'
      }
    ],
    runtime_params: runtimeParamsFor('dumbbellrow'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'x',
      motion: 'in'
    })
  },

  dumbbellpress: {
    key: 'dumbbellpress',
    metadata: {
      name: { he: 'לחיצת חזה דאמבלים', en: 'Dumbbell bench press' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'horizontal_push'
    },
    anatomy: {
      primary: [{ id: 'pectoralis_major', nameHe: 'חזה גדול', nameEn: 'Pectoralis major' }, { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' }, { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' }],
      secondary: [{ id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }],
      stabilizers: [{ id: 'rotator_cuff', nameHe: 'רוטטור קאף', nameEn: 'Rotator cuff' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'BENCH_ELBOW_FLARE',
        description: 'מרפקים רחבים מדי.',
        anatomical_consequence: 'עומס על כתף.'
      }
    ],
    runtime_params: runtimeParamsFor('dumbbellpress'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  seateddumbbellpress: {
    key: 'seateddumbbellpress',
    metadata: {
      name: { he: 'לחיצת כתף ישיבה דאמבלים', en: 'Seated dumbbell press' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'vertical_push'
    },
    anatomy: {
      primary: [
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' },
        { id: 'middle_deltoid', nameHe: 'דלתא אמצעית', nameEn: 'Middle deltoid' },
        { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' }
      ],
      secondary: [{ id: 'upper_pectoralis_major', nameHe: 'חזה עליון', nameEn: 'Upper pectoralis major' }],
      stabilizers: [
        { id: 'transverse_abdominis', nameHe: 'רוחבי בטן', nameEn: 'Transverse abdominis' },
        { id: 'multifidus', nameHe: 'מולטיפידוס', nameEn: 'Multifidus' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'OHP_ELBOW_FLARE',
        description: 'מרפקים פתוחים הצידה.',
        anatomical_consequence: 'מומנט כפיפה על הכתף.'
      },
      {
        fault_id: 'OHP_LUMBAR_EXTENSION',
        description: 'הרחבת מותנית.',
        anatomical_consequence: 'עומס על מותן.'
      }
    ],
    runtime_params: runtimeParamsFor('seateddumbbellpress'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  inclinepress: {
    key: 'inclinepress',
    metadata: {
      name: { he: 'לחיצת חזה עליון', en: 'Incline press' },
      icon: '🏋️',
      category: 'free_movement',
      mode: 'horizontal_push'
    },
    anatomy: {
      primary: [
        { id: 'clavicular_pectoralis', nameHe: 'חזה עליון (בריחי)', nameEn: 'Clavicular pectoralis major' },
        { id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' },
        { id: 'triceps_brachii', nameHe: 'תלת ראשי', nameEn: 'Triceps brachii' }
      ],
      secondary: [{ id: 'middle_deltoid', nameHe: 'דלתא אמצעית', nameEn: 'Middle deltoid' }],
      stabilizers: [{ id: 'serratus_anterior', nameHe: 'משונן', nameEn: 'Serratus anterior' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'INCLINE_FLARED_RIBS',
        description: 'צלעות בולטות (ribs flare).',
        anatomical_consequence: 'היפר-אקסטנציה מותנית; פחות ניטרוליות.'
      }
    ],
    runtime_params: runtimeParamsFor('inclinepress'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  lateralraise: {
    key: 'lateralraise',
    metadata: {
      name: { he: 'הרחקת כתפיים', en: 'Lateral raise' },
      icon: '🪽',
      category: 'free_movement',
      mode: 'vertical_push'
    },
    anatomy: {
      primary: [{ id: 'middle_deltoid', nameHe: 'דלתא אמצעית', nameEn: 'Middle deltoid' }],
      secondary: [{ id: 'supraspinatus', nameHe: 'מעל השיא', nameEn: 'Supraspinatus' }],
      stabilizers: [{ id: 'trapezius_upper', nameHe: 'טרפז עליון', nameEn: 'Upper trapezius' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'LR_SHRUGGING',
        description: 'הרמת כתפיים במקום הרחקה.',
        anatomical_consequence: 'טרפז עליון דומיננטי על דלתא אמצעית.'
      }
    ],
    runtime_params: runtimeParamsFor('lateralraise'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  rearfly: {
    key: 'rearfly',
    metadata: {
      name: { he: 'הרחקה אחורית', en: 'Rear delt fly' },
      icon: '🪽',
      category: 'free_movement',
      mode: 'horizontal_pull'
    },
    anatomy: {
      primary: [{ id: 'posterior_deltoid', nameHe: 'דלתא אחורית', nameEn: 'Posterior deltoid' }, { id: 'infraspinatus', nameHe: 'מתחת לשיא', nameEn: 'Infraspinatus' }],
      secondary: [{ id: 'teres_minor', nameHe: 'שריר קטן עגול', nameEn: 'Teres minor' }],
      stabilizers: [{ id: 'rhomboids', nameHe: 'מעוין', nameEn: 'Rhomboids' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'REARFLY_TRAP_DOMINANCE',
        description: 'כיווץ טרפז במקום הרחקה אחורית.',
        anatomical_consequence: 'פחות עומס על דלתא אחורית.'
      }
    ],
    runtime_params: runtimeParamsFor('rearfly'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [15, 16],
      movement_axis: 'x',
      motion: 'in'
    })
  },

  legpress: {
    key: 'legpress',
    metadata: {
      name: { he: 'לחיצת רגליים', en: 'Leg press' },
      icon: '🦿',
      category: 'machine',
      mode: 'knee_dominant'
    },
    anatomy: {
      primary: [{ id: 'vastus_lateralis', nameHe: 'ותוס לטרלי', nameEn: 'Vastus lateralis' }, { id: 'vastus_medialis', nameHe: 'ותוס מדיאלי', nameEn: 'Vastus medialis' }, { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }],
      secondary: [{ id: 'rectus_femoris', nameHe: 'ישר ירך', nameEn: 'Rectus femoris' }],
      stabilizers: [{ id: 'adductor_magnus', nameHe: 'מכנס מגנוס', nameEn: 'Adductor magnus' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'LP_KNEE_VALGUS',
        description: 'ברכיים נכנסות פנימה.',
        anatomical_consequence: 'עומס על רצועה מדיאלית.'
      }
    ],
    runtime_params: runtimeParamsFor('legpress'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  hacksquat: {
    key: 'hacksquat',
    metadata: {
      name: { he: 'האק סקוואט', en: 'Hack squat' },
      icon: '🦿',
      category: 'machine',
      mode: 'knee_dominant'
    },
    anatomy: {
      primary: [{ id: 'vastus_lateralis', nameHe: 'ותוס לטרלי', nameEn: 'Vastus lateralis' }, { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }],
      secondary: [{ id: 'rectus_femoris', nameHe: 'ישר ירך', nameEn: 'Rectus femoris' }],
      stabilizers: [{ id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'HSQUAT_HEEL_LIFT',
        description: 'עקבים עולים מהמשטח.',
        anatomical_consequence: 'העברת עומס לברך; פחות שימוש בישבן.'
      }
    ],
    runtime_params: runtimeParamsFor('hacksquat'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  smithsquat: {
    key: 'smithsquat',
    metadata: {
      name: { he: 'סקוואט סמית׳', en: 'Smith machine squat' },
      icon: '🦿',
      category: 'machine',
      mode: 'knee_dominant'
    },
    anatomy: {
      primary: [{ id: 'quadriceps', nameHe: 'ארבע ראשי', nameEn: 'Quadriceps femoris' }, { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }],
      secondary: [{ id: 'adductor_magnus', nameHe: 'מכנס מגנוס', nameEn: 'Adductor magnus' }],
      stabilizers: [{ id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'SMITH_FEET_TOO_FORWARD',
        description: 'כפות רגליים רחוקות מדי קדימה.',
        anatomical_consequence: 'היפר-אקסטנציה מותנית; עומס על ברך.'
      }
    ],
    runtime_params: runtimeParamsFor('smithsquat'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  cablefly: {
    key: 'cablefly',
    metadata: {
      name: { he: 'קבל פליי', en: 'Cable fly' },
      icon: '🧵',
      category: 'machine',
      mode: 'horizontal_push'
    },
    anatomy: {
      primary: [{ id: 'pectoralis_major', nameHe: 'חזה גדול', nameEn: 'Pectoralis major' }],
      secondary: [{ id: 'anterior_deltoid', nameHe: 'דלתא קדמית', nameEn: 'Anterior deltoid' }],
      stabilizers: [{ id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'CFLY_OVERSTRETCH_SHOULDER',
        description: 'מתיחה מוגזמת מאחורי קו הגוף.',
        anatomical_consequence: 'עומס על קפסולה אחורית של הכתף.'
      }
    ],
    runtime_params: runtimeParamsFor('cablefly'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  facepull: {
    key: 'facepull',
    metadata: {
      name: { he: 'פייס פול', en: 'Face pull' },
      icon: '🧵',
      category: 'machine',
      mode: 'horizontal_pull'
    },
    anatomy: {
      primary: [
        { id: 'posterior_deltoid', nameHe: 'דלתא אחורית', nameEn: 'Posterior deltoid' },
        { id: 'middle_trapezius', nameHe: 'טרפז אמצעי', nameEn: 'Middle trapezius' },
        { id: 'lower_trapezius', nameHe: 'טרפז תחתון', nameEn: 'Lower trapezius' }
      ],
      secondary: [{ id: 'infraspinatus', nameHe: 'מתחת לשיא', nameEn: 'Infraspinatus' }],
      stabilizers: [{ id: 'biceps_brachii', nameHe: 'שריר דו ראשי', nameEn: 'Biceps brachii' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'FPULL_HIGH_ELBOW_DROP',
        description: 'מרפקים נופלים מתחת לגובה כתף.',
        anatomical_consequence: 'פחות חיצונית כתף; דומיננטיות של מתיחה אופקית.'
      }
    ],
    runtime_params: runtimeParamsFor('facepull'),
    cv_profile: cvProfile({
      category: 'machine',
      primary_tracking_joints: [15, 16],
      movement_axis: 'x',
      motion: 'in'
    })
  },

  squat: {
    key: 'squat',
    metadata: {
      name: { he: 'סקוואט', en: 'Squat' },
      icon: '🦵',
      category: 'free_movement',
      mode: 'knee_dominant'
    },
    anatomy: {
      primary: [
        { id: 'quadriceps', nameHe: 'ארבע ראשי', nameEn: 'Quadriceps femoris' },
        { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }
      ],
      secondary: [{ id: 'adductor_magnus', nameHe: 'מכנס מגנוס', nameEn: 'Adductor magnus' }],
      stabilizers: [
        { id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' },
        { id: 'transverse_abdominis', nameHe: 'רוחבי בטן', nameEn: 'Transverse abdominis' }
      ]
    },
    biomechanical_cues: [
      {
        fault_id: 'SQUAT_VALGUS_COLLAPSE',
        description: 'כיפוף ברך פנימה (knee valgus).',
        anatomical_consequence: 'עומס על MCL ומניסקוס מדיאלי.'
      },
      {
        fault_id: 'SQUAT_FORWARD_LEAN_EXCESS',
        description: 'הטיה קדימה מוגזמת של גו.',
        anatomical_consequence: 'העברת מומנט לכיפוף מותני.'
      }
    ],
    scoring_rules: {
      weights: { rom: 0.42, symmetry: 0.33, tempo: 0.25 },
      rom: {
        bottom_knee_flexion: {
          joint: 'knee_avg',
          aggregate: 'min',
          target: 102,
          tolerance: 22,
          direction: 'lower_better'
        },
        top_knee_extension: {
          joint: 'knee_avg',
          aggregate: 'max',
          target: 168,
          tolerance: 14,
          direction: 'higher_better'
        }
      },
      symmetry: { elbow_angle_mean_abs_diff_max: 16, knee_angle_mean_abs_diff_max: 14 },
      tempo: {
        y_series: 'shoulder_mid_y',
        eccentric_dy_positive: true,
        max_norm_velocity_soft: 3.0,
        max_norm_velocity_hard: 6.6
      }
    },
    runtime_params: runtimeParamsFor('squat'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  lunges: {
    key: 'lunges',
    metadata: {
      name: { he: 'לאנג׳ים', en: 'Lunges' },
      icon: '🦵',
      category: 'free_movement',
      mode: 'knee_dominant'
    },
    anatomy: {
      primary: [{ id: 'quadriceps', nameHe: 'ארבע ראשי', nameEn: 'Quadriceps femoris' }, { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }],
      secondary: [{ id: 'hamstrings', nameHe: 'המסטרינג', nameEn: 'Hamstrings' }],
      stabilizers: [{ id: 'gluteus_medius', nameHe: 'גלוטאוס מדיוס', nameEn: 'Gluteus medius' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'LUNGE_KNEE_PAST_TOE',
        description: 'ברך קדמית עוברת קו אצבעות רגליים.',
        anatomical_consequence: 'עומס שיאי על פיקה.'
      }
    ],
    runtime_params: runtimeParamsFor('lunges'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  deadlift: {
    key: 'deadlift',
    metadata: {
      name: { he: 'דדליפט', en: 'Deadlift' },
      icon: '🏆',
      category: 'free_movement',
      mode: 'hinge'
    },
    anatomy: {
      primary: [
        { id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' },
        { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' },
        { id: 'hamstrings', nameHe: 'המסטרינג', nameEn: 'Hamstrings' }
      ],
      secondary: [{ id: 'quadriceps', nameHe: 'ארבע ראשי', nameEn: 'Quadriceps femoris' }],
      stabilizers: [{ id: 'latissimus_dorsi', nameHe: 'שריר רחב גבי', nameEn: 'Latissimus dorsi' }, { id: 'trapezius', nameHe: 'טרפז', nameEn: 'Trapezius' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'DL_ROUNDED_THORACIC',
        description: 'עמוד שדרה מעוגל בזמן הרמה.',
        anatomical_consequence: 'עומס על דיסקים ופאסט משחקים מותניים.'
      },
      {
        fault_id: 'DL_BAR_DRIFT_FORWARD',
        description: 'המוט זז קדימה מהשוק.',
        anatomical_consequence: 'מומנט כפיפה על מותן; ארכיית כתף.'
      }
    ],
    runtime_params: runtimeParamsFor('deadlift'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  rdl: {
    key: 'rdl',
    metadata: {
      name: { he: 'RDL', en: 'Romanian deadlift' },
      icon: '🏆',
      category: 'free_movement',
      mode: 'hinge'
    },
    anatomy: {
      primary: [{ id: 'hamstrings', nameHe: 'המסטרינג', nameEn: 'Hamstrings' }, { id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }],
      secondary: [{ id: 'erector_spinae', nameHe: 'זוקפי עמוד השדרה', nameEn: 'Erector spinae' }],
      stabilizers: [{ id: 'forearm_flexors', nameHe: 'כופפי אצבעות', nameEn: 'Forearm flexors' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'RDL_NECK_HYPEREXTENSION',
        description: 'צוואר בולט אחורה.',
        anatomical_consequence: 'עומס צווארי; פיצוי על עמוד שדרה.'
      }
    ],
    runtime_params: runtimeParamsFor('rdl'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'down'
    })
  },

  hipthrust: {
    key: 'hipthrust',
    metadata: {
      name: { he: 'היפ תראסט', en: 'Hip thrust' },
      icon: '🍑',
      category: 'free_movement',
      mode: 'hinge'
    },
    anatomy: {
      primary: [{ id: 'gluteus_maximus', nameHe: 'גלוטאוס מקסימוס', nameEn: 'Gluteus maximus' }],
      secondary: [{ id: 'hamstrings', nameHe: 'המסטרינג', nameEn: 'Hamstrings' }],
      stabilizers: [{ id: 'rectus_abdominis', nameHe: 'ישר בטני', nameEn: 'Rectus abdominis' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'HT_RIB_FLARE',
        description: 'צלעות בולטות בראש הנעילה.',
        anatomical_consequence: 'היפר-אקסטנציה מותנית במקום הארכת ירך.'
      }
    ],
    runtime_params: runtimeParamsFor('hipthrust'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [23, 24],
      movement_axis: 'y',
      motion: 'up'
    })
  },

  calfraise: {
    key: 'calfraise',
    metadata: {
      name: { he: 'הרמות שוק', en: 'Calf raise' },
      icon: '🦶',
      category: 'free_movement',
      mode: 'ankle'
    },
    anatomy: {
      primary: [{ id: 'gastrocnemius', nameHe: 'תאום רחב', nameEn: 'Gastrocnemius' }, { id: 'soleus', nameHe: 'סולאוס', nameEn: 'Soleus' }],
      secondary: [{ id: 'plantaris', nameHe: 'פלנטריס', nameEn: 'Plantaris' }],
      stabilizers: [{ id: 'tibialis_anterior', nameHe: 'טיביאליס אנטיריור', nameEn: 'Tibialis anterior' }]
    },
    biomechanical_cues: [
      {
        fault_id: 'CR_SHORT_ROM',
        description: 'טווח תנועה קצר בתחתית.',
        anatomical_consequence: 'פחות מתיחה אקסצנטרית על סולאוס/תאום.'
      }
    ],
    runtime_params: runtimeParamsFor('calfraise'),
    cv_profile: cvProfile({
      category: 'free_movement',
      primary_tracking_joints: [27, 28],
      movement_axis: 'y',
      motion: 'up'
    })
  }
};

function getExercise(key) {
  const k = String(key || '').trim().toLowerCase();
  return exerciseRegistry[k] || null;
}

function listExerciseKeys() {
  return Object.keys(exerciseRegistry).sort();
}

function getFaultCatalog() {
  /** @type {Record<string, BiomechanicalCue>} */
  const byId = {};
  for (const ex of Object.values(exerciseRegistry)) {
    for (const cue of ex.biomechanical_cues || []) {
      if (cue && cue.fault_id && !byId[cue.fault_id]) byId[cue.fault_id] = cue;
    }
  }
  return byId;
}

module.exports = {
  DEFAULT_RUNTIME_PARAMS,
  RUNTIME_OVERRIDES,
  exerciseRegistry,
  getExercise,
  listExerciseKeys,
  getFaultCatalog,
  runtimeParamsFor
};
