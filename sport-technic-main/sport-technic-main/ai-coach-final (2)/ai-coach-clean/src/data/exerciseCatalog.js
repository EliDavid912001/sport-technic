'use strict';

/** Re-export canonical catalog from exerciseRegistry (single source of truth). */
const { EXERCISE_CATALOG } = require('./exerciseRegistry.js');

module.exports = { exerciseCatalog: EXERCISE_CATALOG };
