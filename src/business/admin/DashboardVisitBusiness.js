'use strict';
const { group } = require('../../../frontend/cw-admin-day-rules');

function summarize(visits) {
  const summary = { visitsDoneThisMonth: 0, visitsPlannedThisMonth: 0, visitsNotDoneThisMonth: 0 };
  for (const visit of visits) {
    // Share exact aliases with the day view, including impeded visits.
    const category = group(visit.status);
    if (category === 'DONE') summary.visitsDoneThisMonth++;
    else if (category === 'NOT_DONE') summary.visitsNotDoneThisMonth++;
    // The existing API field includes work in progress; the UI names both.
    else if (category === 'PLANNED' || category === 'IN_PROGRESS') summary.visitsPlannedThisMonth++;
    // Cancelled and unrecognised states remain in the unclassified remainder.
  }
  return summary;
}

module.exports = { summarize };
