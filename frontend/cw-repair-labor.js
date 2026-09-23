(function () {
  'use strict';
  const basisName = 'EXPLICIT_AUTHENTICATED_REPAIR_WORK_INTERVAL';
  const positive = n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
  const sha = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  const fields = ['type','id','clientId','poolId','status','startAt','endAt','executionBasis','executionProofId','executionFingerprint','materialMode'];
  const utc = s => typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
  const paid = b => b ? Object.fromEntries(['id','expenseId','technicianId','periodStart','periodEnd','paidMinutes'].map(k => [k, b[k]])) : null;
  const formatTime = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) + ' UTC' : 'Horário por rever';
  window.CWRepairLabor = { formatTime, create(host, invalidate) {
    const { el, node, hash, active, request } = host;
    let revision = 0, scope = '', rows = [], wanted = '';
    const needed = () => el('valuationKind').value === 'LABOR' && host.target()?.type === 'REPAIR';
    const signature = () => { const c = host.context(), t = host.target(); return JSON.stringify([c.epoch,c.detailEpoch,c.expense?.id,c.expense?.version,t?.type,t?.id,t?.hash]); };
    function clear(keepWanted = false) {
      revision++; rows = []; scope = '';
      if (!keepWanted) wanted = '';
      for (const id of ['repairWorkInterval','repairWorkStatus','repairWorkSelection']) el(id).replaceChildren();
    }
    function sync() {
      const stamp = signature();
      if (scope && scope !== stamp) clear();
      el('repairWorkChoice').hidden = !needed();
      el('repairWorkRefresh').disabled = !host.context().canWrite;
      el('repairWorkInterval').disabled = !host.context().canWrite || !rows.some(r => r.eligible);
    }
    async function validateWork(work, target) {
      const s = work?.snapshot;
      if (!positive(work?.id) || !sha(work.fingerprint) || !s || s.version !== 1 || s.basis !== basisName || s.repairId !== target?.id || s.clientId !== target?.clientId || s.poolId !== target?.poolId || !positive(s.technicianId) || typeof s.technicianName !== 'string' || !s.technicianName.trim() || !positive(s.durationSeconds) || !utc(s.startedAt) || !utc(s.endedAt) || Date.parse(s.endedAt) - Date.parse(s.startedAt) !== s.durationSeconds * 1000 || !Number.isFinite(Date.parse(s.repairCreatedAt)) || Date.parse(s.startedAt) < Date.parse(s.repairCreatedAt) || Date.parse(s.endedAt) > Date.parse(target.endAt) || !Number.isFinite(Date.parse(s.createdAt)) || Date.parse(s.createdAt) < Date.parse(s.endedAt) || typeof s.reason !== 'string' || s.reason.trim().length < 5 || typeof s.createdBy !== 'string' || !/^(ADMIN|TECH|USER:TECH):[1-9]\d*$/.test(s.createdBy) || !fields.every(k => s.source?.[k] === target?.[k]) || !sha(s.sourceHash)) throw Error('O intervalo recebido não corresponde à reparação revista.');
      if (await hash(s) !== work.fingerprint || await hash(s.source) !== s.sourceHash || await hash(Object.fromEntries(fields.map(k => [k,target[k]]))) !== s.sourceHash) throw Error('A prova do intervalo de trabalho não corresponde à execução revista.');
      return s;
    }
    function within(s, b) { return b && b.technicianId === s.technicianId && Date.parse(s.startedAt) >= Date.parse(b.periodStart + 'T00:00:00Z') && Date.parse(s.endedAt) <= Date.parse(b.periodEnd + 'T00:00:00Z') + 86400000; }
    function selection() { return rows.find(r => r.id === Number(el('repairWorkInterval').value) && r.eligible) || null; }
    function describe() {
      const row = selection(), s = row?.workInterval.snapshot;
      el('repairWorkSelection').textContent = s ? s.technicianName + ' · ' + formatTime(s.startedAt) + ' a ' + formatTime(s.endedAt) + ' · ' + s.durationSeconds + ' segundos declarados e confirmados. ' + s.reason : '';
    }
    async function load() {
      if (!needed() || !active() || !host.context().canWrite) return;
      wanted = el('repairWorkInterval').value || wanted; clear(true); scope = signature();
      invalidate(); const rev = ++revision, stamp = scope, c = host.context(), target = host.target(), b = paid(c.expense.laborBasis);
      el('repairWorkStatus').textContent = 'A consultar intervalos e fontes…'; sync();
      try {
        const response = await request('/' + c.expense.id + '/repair-work-intervals?repairId=' + target.id);
        if (!active() || rev !== revision || stamp !== signature()) return;
        const v = response.intervals;
        if (!v || v.version !== 1 || v.expenseId !== c.expense.id || v.expenseVersion !== c.expense.version || v.repairId !== target.id || v.targetHash !== target.hash || await hash(v.basis) !== await hash(b) || !Array.isArray(v.rows) || new Set(v.rows.map(r => r.id)).size !== v.rows.length) throw Error('Os intervalos recebidos pertencem a outro contexto.');
        for (const row of v.rows) {
          if (!positive(row.id) || row.workInterval?.id !== row.id || !['CONFIRMED','REVIEW','VOIDED'].includes(row.state) || typeof row.eligible !== 'boolean' || !Array.isArray(row.errors) || !row.errors.every(x => typeof x === 'string')) throw Error('Lista de intervalos incompleta.');
          // Historical evidence may itself need review. Never offer it for valuation.
          if (row.eligible) { const s = await validateWork(row.workInterval, target.snapshot); if (row.state !== 'CONFIRMED' || row.errors.length || !within(s,b)) throw Error('O técnico ou período do intervalo não corresponde à base paga.'); }
        }
        if (!active() || rev !== revision || stamp !== signature()) return;
        rows = v.rows;
        const blank = node(el('repairWorkInterval'),'option','Escolha o intervalo confirmado'); blank.value = '';
        for (const row of rows) { const s = row.workInterval?.snapshot; const option = node(el('repairWorkInterval'),'option','#' + row.id + ' · ' + (typeof s?.technicianName === 'string' ? s.technicianName : 'Técnico por rever') + ' · ' + formatTime(s?.startedAt) + (row.eligible ? '' : ' · indisponível')); option.value = String(row.id); option.disabled = !row.eligible; }
        if (rows.some(r => r.eligible && String(r.id) === wanted)) el('repairWorkInterval').value = wanted;
        el('repairWorkStatus').textContent = rows.some(r => r.eligible) ? 'Escolha o intervalo e calcule o custo atual. Os limites de tempo e valor são partilhados com as visitas desta despesa.' : 'Sem intervalos elegíveis para este técnico e período. Consulte os tempos da reparação e a base da despesa.';
        describe();
      } catch (error) { if (active() && rev === revision && stamp === signature()) { rows = []; el('repairWorkInterval').replaceChildren(); el('repairWorkSelection').replaceChildren(); el('repairWorkStatus').textContent = error.message; } } finally { sync(); }
    }
    async function validateSource(source, target, expectedId, expectedBasis) {
      if (source?.version !== 3 || source.kind !== 'LABOR' || source.workBasis !== basisName || source.workInterval?.id !== expectedId || !fields.every(k => source.service?.[k] === target?.[k])) throw Error('A origem do trabalho não corresponde à reparação revista.');
      const s = await validateWork(source.workInterval,target), b = source.basis;
      if (!b || !positive(b.id) || !positive(b.expenseId) || !positive(b.paidMinutes) || !within(s,b) || !positive(source.expenseAmountCents) || expectedBasis && await hash(b) !== await hash(paid(expectedBasis))) throw Error('A base paga não corresponde ao intervalo revisto.');
      return s;
    }
    async function preview(value, target, expense) {
      const row = selection();
      if (!row || value.workIntervalId !== row.id || await hash(value.source.workInterval) !== await hash(row.workInterval)) throw Error('O intervalo mudou. Consulte e reveja a seleção.');
      const s = await validateSource(value.source,target.snapshot,row.id,expense.laborBasis);
      if (value.source.basis.expenseId !== expense.id || value.source.expenseAmountCents !== expense.amountCents || value.quantity !== String(s.durationSeconds) || value.quantityUnit !== 'SECOND' || value.calculation.baseQuantity !== String(expense.laborBasis.paidMinutes * 60) || value.calculation.baseAmountCents !== expense.amountCents) throw Error('A duração ou custo de base não corresponde ao intervalo confirmado.');
    }
    async function receipt(a, d, expenseId) {
      const s = await validateSource(a.valuationSnapshot?.source,a.targetSnapshot,d.workIntervalId);
      if (a.valuationSnapshot.source.basis.expenseId !== expenseId || a.quantity !== String(s.durationSeconds) || a.quantityUnit !== 'SECOND' || a.activeMeasurementKey !== 'LABOR:REPAIR:' + a.repairId + ':INTERVAL:' + d.workIntervalId) throw Error('O recibo não corresponde ao intervalo valorizado.');
    }
    el('repairWorkRefresh').addEventListener('click', () => void load());
    el('repairWorkInterval').addEventListener('change', () => { wanted = el('repairWorkInterval').value; invalidate(); describe(); host.draft?.(); });
    return { clear, sync, selection, preview, receipt, id: () => el('repairWorkInterval').value || wanted, restore: value => { wanted = typeof value === 'string' ? value : ''; } };
  } };
})();
