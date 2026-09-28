'use strict';
const { group } = require('../../../frontend/cw-admin-day-rules');

function summarize(visits) {
  const summary = { visitsDoneThisMonth: 0, visitsPlannedThisMonth: 0, visitsNotDoneThisMonth: 0 };
  for (const visit of visits) {
    // Reuse the day view's exact aliases. Keep the dashboard's historical
    // impediment states in the not-done category, never in planned work too.
    const category = ['BLOCKED', 'RETAINED', 'IMPEDIDO'].includes(String(visit.status ?? '').trim().toUpperCase())
      ? 'NOT_DONE' : group(visit.status);
    if (category === 'DONE') summary.visitsDoneThisMonth++;
    else if (category === 'NOT_DONE') summary.visitsNotDoneThisMonth++;
    // The existing API field includes work in progress; the UI names both.
    else if (category === 'PLANNED' || category === 'IN_PROGRESS') summary.visitsPlannedThisMonth++;
    // Cancelled and unrecognised states remain in the unclassified remainder.
  }
  return summary;
}

module.exports = { summarize };
