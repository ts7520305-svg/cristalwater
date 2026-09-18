'use strict';
// Match the existing client PDF fallback. Persisted choices always take precedence.
const defaults = Object.freeze({
  showClientName: true, showPoolName: true, showZone: true, showAddress: false,
  showTechnicianName: false, showStatus: true, showPlannedDate: true, showStartEnd: false,
  showWaterParameters: true, showChecklist: true, showChemicals: false,
  showEquipment: false, showTechnicalRoom: false, showNotes: true, showPhotos: false,
});
const keys = Object.freeze(Object.keys(defaults));
const effective = record => record ? Object.fromEntries(keys.map(key => [key, record[key]])) : { ...defaults };
const valid = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)) && keys.every(key => typeof value[key] === 'boolean');
module.exports = { defaults, keys, effective, valid };
