import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const inheritedNames = Object.getOwnPropertyNames(Object.prototype);
const files = { operational: ['aiOperationalService.js', 'analyzeOperationalData'], predictive: ['aiPredictiveService.js', 'buildPredictiveAnalysis'] };
const sources = Object.fromEntries(Object.entries(files).map(([kind, [file]]) => [kind,
  process.env.CW_AI_ZONE_BASELINE === 'true'
    ? execFileSync('git', ['show', '89108f338cafd968a8b7711523c8d5b5c3f3a162:src/services/' + file], { encoding: 'utf8' })
    : readFileSync(new URL('../src/services/' + file, import.meta.url), 'utf8'),
]));
const visits = (zone, count) => Array.from({ length: count }, (_, index) => ({ id: index + 1, technicianId: 7, pool: { zone } }));
const alerts = (zone, count) => Array.from({ length: count }, (_, index) => ({ id: index + 1, pool: { zone } }));
const plain = value => JSON.parse(JSON.stringify(value));
const prototypeSnapshot = 'JSON.stringify([Object.prototype, ...Object.values(Object.getOwnPropertyDescriptors(Object.prototype)).map(d => d.value).filter(v => typeof v === "function")].map(o => Object.getOwnPropertyDescriptors(o)))';

function engine(kind) {
  // The old predictive engine mutates inherited objects. Keep regression runs
  // inside a fresh realm so they cannot contaminate Vitest or another test.
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(sources[kind], context);
  const originalPrototype = vm.runInContext(prototypeSnapshot, context);
  return input => {
    const before = plain(input);
    const fn = context.module.exports[files[kind][1]];
    const result = kind === 'operational'
      ? fn(input.technicians || [], input.alerts || [], input.visits || [])
      : fn(input);
    expect(input).toEqual(before);
    const prototypeUnchanged = vm.runInContext(prototypeSnapshot, context) === originalPrototype;
    return { result: plain(result), prototypeUnchanged };
  };
}

describe.each(['operational', 'predictive'])('%s zone grouping', kind => {
  it.each(inheritedNames)('treats %s as an exact zone name', zone => {
    const { result, prototypeUnchanged } = engine(kind)({ visits: visits(zone, 10), alerts: alerts(zone, 3) });
    expect(prototypeUnchanged).toBe(true);
    expect(kind === 'operational' ? result.criticalZones : result.tomorrowRiskZones).toEqual([
      kind === 'operational' ? { zone, visits: 10 } : { zone, visits: 10, alerts: 3 },
    ]);
    expect(result.recommendations).toContainEqual({ type: kind === 'operational' ? 'ZONE_OVERLOAD' : 'ZONE_RISK', message: kind === 'operational' ? `Zona ${zone} sobrecarregada` : `Zona ${zone} poderá ficar crítica amanhã` });
  });

  it('preserves literal names, distinct case, fallback and empty results', () => {
    const run = engine(kind), threshold = kind === 'operational' ? 10 : 8;
    const names = ['Lagos', 'lagos', '  Lagos  ', '<img src=x onerror=alert(1)>', '1', '01', 'Sem zona'];
    const input = names.flatMap(zone => visits(zone, threshold));
    input.push(...Array.from({ length: threshold }, () => ({ pool: null })), ...visits('', threshold));
    const { result, prototypeUnchanged } = run({ visits: input });
    const rows = kind === 'operational' ? result.criticalZones : result.tomorrowRiskZones;
    expect(new Set(rows.map(row => row.zone))).toEqual(new Set(names));
    expect(rows.find(row => row.zone === 'Sem zona').visits).toBe(threshold * 3);
    expect(rows.reduce((sum, row) => sum + row.visits, 0)).toBe(input.length);
    expect(prototypeUnchanged).toBe(true);
    const empty = run({}).result;
    expect(kind === 'operational' ? empty.criticalZones : empty.tomorrowRiskZones).toEqual([]);
  });

  it('is repeatable across order changes and hundreds of distinct zones', () => {
    const run = engine(kind), names = [...inheritedNames, ...Array.from({ length: 512 }, (_, index) => 'Zone ' + index)];
    const input = { visits: names.flatMap(zone => visits(zone, 10)), alerts: names.flatMap(zone => alerts(zone, 3)) };
    const normalize = result => (kind === 'operational' ? result.criticalZones : result.tomorrowRiskZones).sort((a, b) => a.zone.localeCompare(b.zone));
    const first = run(input), repeated = run(input), reversed = run({ visits: [...input.visits].reverse(), alerts: [...input.alerts].reverse() });
    expect(normalize(first.result)).toEqual(normalize(repeated.result));
    expect(normalize(first.result)).toEqual(normalize(reversed.result));
    expect(normalize(first.result)).toHaveLength(names.length);
    expect(first.prototypeUnchanged && repeated.prototypeUnchanged && reversed.prototypeUnchanged).toBe(true);
  });
});

describe('existing operational and predictive thresholds', () => {
  it('preserves operational zone, technician and high-alert limits', () => {
    const run = engine('operational');
    const input = { technicians: [{ id: 7, name: 'Técnico literal' }, { id: 8, name: 'Disponível' }], visits: [...visits('A', 9), ...visits('B', 10)], alerts: alerts('A', 5) };
    const { result } = run(input);
    expect(result.criticalZones).toEqual([{ zone: 'B', visits: 10 }]);
    expect(result.overloadedTechs).toEqual([{ technician: 'Técnico literal', visits: 19 }]);
    expect(result.recommendations).toContainEqual({ type: 'AVAILABLE', message: 'Disponível disponível para ajudar' });
    expect(result.alerts).toHaveLength(1);
    expect(run({ visits: visits('A', 11), technicians: input.technicians, alerts: alerts('A', 4) }).result.overloadedTechs).toEqual([]);
    expect(run({ alerts: alerts('A', 4) }).result.alerts).toEqual([]);
  });

  it('preserves predictive visit/alert OR rule and alert-only zones', () => {
    const { result } = engine('predictive')({ visits: [...visits('Below', 7), ...visits('At limit', 8)], alerts: [...alerts('Below', 2), ...alerts('Alerts only', 3)] });
    expect(result.tomorrowRiskZones).toEqual([{ zone: 'At limit', visits: 8, alerts: 0 }, { zone: 'Alerts only', visits: 0, alerts: 3 }]);
  });

  it('preserves predictive technician overload and availability boundaries', () => {
    const run = engine('predictive'), technicians = [{ id: 7, name: 'Técnico' }];
    expect(run({ technicians, visits: visits('A', 9) }).result.overloadedTomorrow).toEqual([]);
    expect(run({ technicians, visits: visits('A', 10) }).result.overloadedTomorrow).toEqual([{ technician: 'Técnico', visits: 10 }]);
    expect(run({ technicians, visits: visits('A', 4) }).result.availableTomorrow).toEqual([{ technician: 'Técnico', visits: 4 }]);
    expect(run({ technicians, visits: visits('A', 5) }).result.availableTomorrow).toEqual([]);
  });
});
