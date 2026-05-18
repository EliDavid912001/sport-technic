/**
 * Bulletproof exercise UI — loads BEFORE main bundle.
 * Category tiles, library overlay, tile clicks (inline onclick).
 */
(function (global) {
  var CALI_IDS = {
    muscle_up: 1, pull_up: 1, chin_up: 1, dips: 1, pushups: 1
  };

  /** Offline fallback — mirrors exerciseRegistry.js (37 exercises) */
  global.TrainIQFallbackCatalog = [
    { id: 'muscle_up', name_he: 'עליות כוח (מאסל אפ)', equipment_type: 'bodyweight', target_muscles: ['גב', 'חזה', 'טרייספס', 'ליבה'] },
    { id: 'pull_up', name_he: 'עליות מתח', equipment_type: 'bodyweight', target_muscles: ['גב', 'ביספס', 'ליבה'] },
    { id: 'chin_up', name_he: 'עליות מתח באחיזה הפוכה (צ׳ין אפ)', equipment_type: 'bodyweight', target_muscles: ['גב', 'ביספס', 'ליבה'] },
    { id: 'dips', name_he: 'מקבילים', equipment_type: 'bodyweight', target_muscles: ['חזה תחתון', 'טרייספס'] },
    { id: 'pushups', name_he: 'שכיבות סמיכה', equipment_type: 'bodyweight', target_muscles: ['חזה', 'טרייספס', 'כתפיים'] },
    { id: 'barbell_bench_press', name_he: 'בנץ׳ פרס כנגד מוט', equipment_type: 'barbell', target_muscles: ['חזה', 'טרייספס', 'כתפיים'] },
    { id: 'incline_bench_press', name_he: 'לחיצת חזה עליון כנגד מוט', equipment_type: 'barbell', target_muscles: ['חזה עליון', 'כתף קדמית', 'טרייספס'] },
    { id: 'barbell_shoulder_press', name_he: 'לחיצת כתפיים כנגד מוט', equipment_type: 'barbell', target_muscles: ['כתפיים', 'טרייספס', 'ליבה'] },
    { id: 'barbell_row', name_he: 'חתירה כנגד מוט', equipment_type: 'barbell', target_muscles: ['גב', 'ביספס', 'שכמות'] },
    { id: 'barbell_squat', name_he: 'סקוואט כנגד מוט', equipment_type: 'barbell', target_muscles: ['רגליים', 'גלוטאוס'] },
    { id: 'barbell_deadlift', name_he: 'דדליפט כנגד מוט', equipment_type: 'barbell', target_muscles: ['גב תחתון', 'גלוטאוס', 'המסטרינג'] },
    { id: 'romanian_deadlift', name_he: 'דדליפט רומני כנגד מוט (RDL)', equipment_type: 'barbell', target_muscles: ['המסטרינג', 'גלוטאוס', 'גב תחתון'] },
    { id: 'hip_thrust', name_he: 'היפ תראסט כנגד מוט', equipment_type: 'barbell', target_muscles: ['גלוטאוס', 'המסטרינג'] },
    { id: 'dumbbell_bench_press', name_he: 'לחיצת חזה דאמבלים', equipment_type: 'dumbbell', target_muscles: ['חזה', 'טרייספס', 'כתפיים'] },
    { id: 'dumbbell_shoulder_press', name_he: 'לחיצת כתף ישיבה דאמבלים', equipment_type: 'dumbbell', target_muscles: ['כתפיים', 'טרייספס', 'ליבה'] },
    { id: 'dumbbell_row', name_he: 'חתירת דאמבל', equipment_type: 'dumbbell', target_muscles: ['גב', 'ביספס', 'שכמות'] },
    { id: 'dumbbell_curl', name_he: 'כפיפת מרפקים כנגד משקולות יד', equipment_type: 'dumbbell', target_muscles: ['ביספס'] },
    { id: 'dumbbell_tricep_extension', name_he: 'פשיטת מרפקים מאחורי הראש', equipment_type: 'dumbbell', target_muscles: ['טרייספס'] },
    { id: 'dumbbell_lateral_raise', name_he: 'הרחקת כתפיים דאמבלים', equipment_type: 'dumbbell', target_muscles: ['דלתא אמצעית'] },
    { id: 'dumbbell_pullover', name_he: 'פול אובר דאמבל', equipment_type: 'dumbbell', target_muscles: ['גב', 'ליבה', 'כתפיים'] },
    { id: 'lunges', name_he: 'לאנג׳ים כנגד דאמבלים', equipment_type: 'dumbbell', target_muscles: ['קוואדס', 'גלוטאוס'] },
    { id: 'cable_fly', name_he: 'פרפר כבלים', equipment_type: 'cable', target_muscles: ['חזה', 'כתף קדמית'] },
    { id: 'face_pull', name_he: 'פייס פול כבל', equipment_type: 'cable', target_muscles: ['דלתא אחורית', 'שכמות'] },
    { id: 'cable_tricep_extension', name_he: 'פשיטת טרייספס כבל', equipment_type: 'cable', target_muscles: ['טרייספס'] },
    { id: 'cable_bicep_curl', name_he: 'כפיפת בייספס כבל', equipment_type: 'cable', target_muscles: ['ביספס'] },
    { id: 'lat_pulldown_machine', name_he: 'פולי עליון (לאט פולדאון)', equipment_type: 'machine', target_muscles: ['רחב גבי', 'ביספס'] },
    { id: 'machine_row', name_he: 'חתירה במכונה', equipment_type: 'machine', target_muscles: ['גב', 'ביספס'] },
    { id: 'chest_press_machine', name_he: 'לחיצת חזה במכונה', equipment_type: 'machine', target_muscles: ['חזה', 'טרייספס'] },
    { id: 'machine_shoulder_press', name_he: 'לחיצת כתפיים במכונה', equipment_type: 'machine', target_muscles: ['כתפיים', 'טרייספס'] },
    { id: 'leg_press_machine', name_he: 'לחיצת רגליים במכונה', equipment_type: 'machine', target_muscles: ['קוואדס', 'גלוטאוס'] },
    { id: 'hack_squat_machine', name_he: 'האק סקוואט במכונה', equipment_type: 'machine', target_muscles: ['קוואדס', 'גלוטאוס'] },
    { id: 'smith_machine_squat', name_he: 'סקוואט סמית׳', equipment_type: 'machine', target_muscles: ['רגליים', 'גלוטאוס'] },
    { id: 'reverse_pec_deck_machine', name_he: 'פרפר הפוך במכונה', equipment_type: 'machine', target_muscles: ['דלתא אחורית', 'שכמות'] },
    { id: 'seated_calf_raise_machine', name_he: 'תאומים בישיבה', equipment_type: 'machine', target_muscles: ['תאומים'] },
    { id: 'standing_calf_raise', name_he: 'תאומים בעמידה', equipment_type: 'machine', target_muscles: ['תאומים'] },
    { id: 'leg_extension_machine', name_he: 'פשיטת ברך במכונה', equipment_type: 'machine', target_muscles: ['קוואדס'] },
    { id: 'leg_curl_machine', name_he: 'כפיפת ברך במכונה', equipment_type: 'machine', target_muscles: ['המסטרינג'] }
  ];

  var reg = global.exerciseRegistry;
  global.exerciseRegistry =
    reg && reg.length ? reg : global.TrainIQFallbackCatalog.slice();
  global.__lastExerciseDetailId = '';
  global.__exerciseCategoryFilter = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function apiBase() {
    try {
      var u = new URL(global.location.href);
      var q = u.searchParams.get('api');
      if (q && /^https?:\/\//i.test(q)) return q.replace(/\/+$/, '');
    } catch (_) {}
    try {
      var ls = global.localStorage.getItem('TRAINIQ_API_BASE');
      if (ls && /^https?:\/\//i.test(ls)) return ls.replace(/\/+$/, '');
    } catch (_) {}
    var w = global.TRAINIQ_API_BASE;
    if (typeof w === 'string' && /^https?:\/\//i.test(w)) return w.replace(/\/+$/, '');
    return '';
  }

  function iconFor(eq) {
    if (eq === 'bodyweight') return '\u{1F525}';
    if (eq === 'barbell') return '\u{1F3CB}\uFE0F';
    if (eq === 'dumbbell') return '\u{1F4AA}';
    if (eq === 'cable') return '\u{1F9F5}';
    if (eq === 'machine') return '\u{1F916}';
    return '\u{1F3CB}\uFE0F';
  }

  function matchesCat(id, cat) {
    if (!cat) return false;
    var isCali = !!CALI_IDS[id];
    if (cat === 'cali') return isCali;
    if (cat === 'gym') return !isCali;
    return true;
  }

  function applyRowsToMain(rows) {
    global.exerciseRegistry = (rows || []).slice();
    if (typeof global.applyExerciseCatalogRows === 'function') {
      try {
        global.applyExerciseCatalogRows(rows);
      } catch (e) {
        console.error('[catalog] applyExerciseCatalogRows', e);
      }
    }
    if (typeof global.populateExerciseSelects === 'function') {
      try {
        global.populateExerciseSelects();
      } catch (_) {}
    }
  }

  function renderGrid(targetId, prefix, cat, withGuide) {
    var target = document.getElementById(targetId);
    if (!target) return;
    var reg = global.exerciseRegistry || [];
    if (!cat) {
      target.innerHTML =
        '<div style="text-align:center;color:#94a3b8;padding:22px 12px;font-size:13px;line-height:1.6">בחר קטגוריה למעלה — חדר כושר או קליסטניקס.</div>';
      return;
    }
    var parts = [];
    for (var i = 0; i < reg.length; i++) {
      var e = reg[i];
      if (!e || !e.id || !matchesCat(e.id, cat)) continue;
      var id = e.id;
      var ico = iconFor(e.equipment_type);
      var nm = esc(e.name_he || id);
      var ms = esc((e.muscles_short || (e.target_muscles && e.target_muscles[0]) || '').toString());
      parts.push(
        '<div class="ex-btn exercise-tile" id="' + prefix + '-' + id + '" role="button" tabindex="0" ' +
          'onclick="forceSelectExercise(\'' + id + '\', false);return false;">' +
          '<span class="ex-ico">' + ico + '</span><div class="ex-nm">' + nm + '</div><div class="ex-ms">' + ms + '</div></div>'
      );
    }
    target.innerHTML = parts.length
      ? parts.join('')
      : '<div style="text-align:center;color:#94a3b8;padding:22px">אין תרגילים בקטגוריה זו</div>';
  }

  function renderLibrary() {
    if (typeof global.renderLibraryAccordion === 'function') {
      global.renderLibraryAccordion();
      return;
    }
    var reg = global.exerciseRegistry || [];
    var target = document.getElementById('ex-grid-library');
    if (!target) return;
    var parts = [];
    for (var i = 0; i < reg.length; i++) {
      var e = reg[i];
      if (!e || !e.id) continue;
      var id = e.id;
      parts.push(
        '<div class="library-tile" id="lib-tile-' + id + '" data-exercise-id="' + id + '" role="listitem" tabindex="0" ' +
          'onclick="toggleLibraryTile(this, \'' + id + '\')">' +
          '<div class="library-tile-header"><h4>' + esc(e.name_he || id) + '</h4>' +
          '<span class="toggle-icon" aria-hidden="true">▼</span></div>' +
          '<div class="library-tile-content">' +
          '<p><strong>ציוד:</strong> ' + esc(e.equipment_type || '—') + '</p>' +
          '<p><strong>שרירים:</strong> ' + esc(musclesText(e)) + '</p>' +
          '<button type="button" class="library-tile-copy" onclick="copyExerciseDetails(event, \'' + id + '\')">העתק פרטים</button>' +
          '</div></div>'
      );
    }
    target.className = 'library-accordion-list';
    target.innerHTML = parts.join('');
  }

  global.pickExerciseCategory = function pickExerciseCategory(cat) {
    try {
      console.log('[UI] pickExerciseCategory', cat);
      cat = cat === 'gym' || cat === 'cali' ? cat : null;
      global.__exerciseCategoryFilter = cat;
      var g = document.getElementById('cat-gym');
      var c = document.getElementById('cat-cali');
      if (g) g.classList.toggle('sel', cat === 'gym');
      if (c) c.classList.toggle('sel', cat === 'cali');
      if (typeof global.__pickExerciseCategoryMain === 'function') {
        global.__pickExerciseCategoryMain(cat);
        return;
      }
      if (!global.exerciseRegistry.length) {
        applyRowsToMain(global.TrainIQFallbackCatalog);
      }
      if (typeof global.refreshMainExerciseGrid === 'function') {
        global.refreshMainExerciseGrid();
      } else {
        renderGrid('ex-grid', 'ex', cat, false);
      }
    } catch (err) {
      console.error('[UI] pickExerciseCategory failed', err);
    }
  };

  global.setTopLabel = function setTopLabel(mode) {
    try {
      console.log('[UI] setTopLabel', mode);
      if (typeof global.__setTopLabelMain === 'function') {
        global.__setTopLabelMain(mode);
        return;
      }
      var overlay = document.getElementById('exercise-library-overlay');
      if (overlay) overlay.classList.toggle('show', mode === 'guides');
      if (mode === 'guides') {
        if (!global.exerciseRegistry.length) applyRowsToMain(global.TrainIQFallbackCatalog);
        renderLibrary();
      }
    } catch (err) {
      console.error('[UI] setTopLabel failed', err);
    }
  };

  function findRegistryExercise(exerciseId) {
    var id = String(exerciseId || '');
    var reg = global.exerciseRegistry || [];
    for (var i = 0; i < reg.length; i++) {
      if (reg[i] && reg[i].id === id) return reg[i];
    }
    return null;
  }

  function musclesText(ex) {
    if (!ex) return '—';
    var tm = ex.target_muscles;
    if (Array.isArray(tm)) return tm.join(', ');
    return String(tm || '—');
  }

  function populateExerciseDetailCard(id, ex) {
    var titleEl = document.getElementById('detail-card-title');
    var equipEl = document.getElementById('detail-card-equipment');
    var musclesEl = document.getElementById('detail-card-muscles');
    var techEl = document.getElementById('detail-card-technique');
    var card = document.getElementById('exercise-detail-card');
    if (!ex) {
      if (titleEl) titleEl.textContent = 'תרגיל לא נמצא: ' + id;
      if (card) card.style.display = 'block';
      return;
    }
    global.__lastExerciseDetailId = id;
    if (titleEl) titleEl.textContent = ex.name_he || id;
    if (equipEl) equipEl.textContent = ex.equipment_type || '—';
    if (musclesEl) musclesEl.textContent = musclesText(ex);
    if (techEl) {
      techEl.textContent =
        typeof global.__getExerciseTechniqueText === 'function'
          ? global.__getExerciseTechniqueText(id)
          : '—';
    }
    if (card) {
      card.style.display = 'block';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  global.forceSelectExercise = function forceSelectExercise(exerciseId, showDetailCard) {
    try {
      var id = String(exerciseId || '');
      var showDetail = showDetailCard === true;
      var ex = findRegistryExercise(id);
      var card = document.getElementById('exercise-detail-card');

      if (!ex) {
        console.error('Exercise not found in registry:', id);
        if (showDetail) populateExerciseDetailCard(id, null);
        return;
      }

      document.querySelectorAll('.ex-btn.exercise-tile, .library-tile').forEach(function (el) {
        el.classList.remove('sel');
      });
      var mainBtn = document.getElementById('ex-' + id);
      var libTile = document.getElementById('lib-tile-' + id);
      if (mainBtn) mainBtn.classList.add('sel');
      if (libTile) libTile.classList.add('sel');

      if (showDetail && card) {
        populateExerciseDetailCard(id, ex);
      } else if (card) {
        card.style.display = 'none';
      }

      if (typeof global.__onExerciseForceSelected === 'function') {
        global.__onExerciseForceSelected(id, { fromLibrary: !!libTile });
      }
    } catch (error) {
      console.error('Click failed:', error);
    }
  };

  global.copyExerciseDetails = function copyExerciseDetails(event, exerciseId) {
    try {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      var id = String(exerciseId || global.__lastExerciseDetailId || '');
      var ex = findRegistryExercise(id);
      if (!ex) return;
      var tech =
        typeof global.__getExerciseTechniqueText === 'function'
          ? global.__getExerciseTechniqueText(id)
          : '';
      var text = [
        ex.name_he,
        'ציוד: ' + (ex.equipment_type || '—'),
        'שרירים: ' + musclesText(ex),
        'טכניקה:',
        tech || '—'
      ].join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          if (typeof global.showFunToast === 'function') global.showFunToast('הפרטים הועתקו');
        });
      }
    } catch (e) {
      console.error('copyExerciseDetails failed:', e);
    }
  };

  var catalogPromise = null;

  function loadCatalog() {
    if (catalogPromise) return catalogPromise;
    var base = apiBase();
    var url = (base || '') + '/api/exercise-catalog';
    catalogPromise = fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.exercises || !j.exercises.length) throw new Error('empty catalog');
        applyRowsToMain(j.exercises);
        console.log('[catalog] loaded', j.exercises.length, 'exercises');
        if (global.__exerciseCategoryFilter) global.pickExerciseCategory(global.__exerciseCategoryFilter);
        return j.exercises;
      })
      .catch(function (err) {
        console.warn('[catalog] API failed, using fallback', err);
        applyRowsToMain(global.TrainIQFallbackCatalog);
        if (global.__exerciseCategoryFilter) global.pickExerciseCategory(global.__exerciseCategoryFilter);
        return global.TrainIQFallbackCatalog;
      });
    return catalogPromise;
  }

  global.TrainIQLoadExerciseCatalog = loadCatalog;
  applyRowsToMain(global.TrainIQFallbackCatalog);
  loadCatalog();
})(typeof window !== 'undefined' ? window : globalThis);
