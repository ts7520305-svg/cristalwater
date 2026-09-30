'use strict';
// Separate execution budget for temporal boundaries, fallback names and account isolation.
process.env.CW_NOW_BOARD_SCENARIO='time';
require('./test-field-current-visit-languages.js');
