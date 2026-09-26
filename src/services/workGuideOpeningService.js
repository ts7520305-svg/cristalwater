'use strict';
// Kept for internal compatibility: all new openings require a signed review.
async function start(){throw Object.assign(Error('Reveja a abertura em /work-guide-start.'),{code:'WORK_START_REVIEW_REQUIRED',statusCode:409});}
module.exports={start};
