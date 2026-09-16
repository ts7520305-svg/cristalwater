(function () {
  'use strict';
  const words = {
    title: ['Aplicar proposta à ficha técnica', 'Apply proposal to technical sheet', 'Appliquer la proposition à la fiche', 'Aplicar propuesta a la ficha técnica', 'Vorschlag im Datenblatt anwenden'],
    explanation: ['Reveja cada campo e o resultado calculado. Os campos que mudaram precisam de uma escolha explícita.', 'Review each field and the calculated result. Changed fields require an explicit choice.', 'Vérifiez chaque champ et le résultat calculé. Les champs modifiés nécessitent un choix explicite.', 'Revise cada campo y el resultado calculado. Los campos modificados requieren una elección explícita.', 'Jedes Feld und das berechnete Ergebnis prüfen. Geänderte Felder erfordern eine ausdrückliche Auswahl.'],
    before: ['Na proposta', 'At submission', 'À la soumission', 'Al enviar', 'Bei Einreichung'],
    current: ['Atual', 'Current', 'Actuel', 'Actual', 'Aktuell'],
    proposed: ['Proposto', 'Proposed', 'Proposé', 'Propuesto', 'Vorgeschlagen'],
    choose: ['Escolher…', 'Choose…', 'Choisir…', 'Elegir…', 'Auswählen…'],
    keep: ['Conservar valor atual', 'Keep current value', 'Conserver la valeur actuelle', 'Conservar el valor actual', 'Aktuellen Wert behalten'],
    use: ['Usar valor proposto', 'Use proposed value', 'Utiliser la valeur proposée', 'Usar el valor propuesto', 'Vorgeschlagenen Wert verwenden'],
    drift: ['Alterado desde a proposta', 'Changed since submission', 'Modifié depuis la soumission', 'Modificado desde el envío', 'Seit Einreichung geändert'],
    effects: ['Resultado a guardar', 'Result to save', 'Résultat à enregistrer', 'Resultado que se guardará', 'Zu speicherndes Ergebnis'],
    unchanged: ['Os valores atuais serão conservados.', 'Current values will be kept.', 'Les valeurs actuelles seront conservées.', 'Se conservarán los valores actuales.', 'Die aktuellen Werte bleiben erhalten.'],
    unresolved: ['Escolha o valor de todos os campos para calcular o resultado.', 'Choose a value for every field to calculate the result.', 'Choisissez une valeur pour chaque champ pour calculer le résultat.', 'Elija el valor de cada campo para calcular el resultado.', 'Für jedes Feld einen Wert auswählen, um das Ergebnis zu berechnen.'],
    conflict: ['As escolhas de volume ou profundidade média contradizem o cálculo. Altere as escolhas ou reveja a proposta antes de aplicar.', 'The volume or average-depth choices contradict the calculation. Change the choices or review the proposal before applying.', 'Les choix de volume ou de profondeur moyenne contredisent le calcul. Modifiez les choix ou revoyez la proposition avant d’appliquer.', 'Las elecciones de volumen o profundidad media contradicen el cálculo. Cámbielas o revise la propuesta antes de aplicar.', 'Volumen oder mittlere Tiefe widersprechen der Berechnung. Auswahl ändern oder Vorschlag vor der Anwendung prüfen.'],
    calculatedVolume: ['Volume para cálculos (m³)', 'Volume for calculations (m³)', 'Volume pour les calculs (m³)', 'Volumen para cálculos (m³)', 'Volumen für Berechnungen (m³)'],
    treatmentVolume: ['Volume para tratamento (m³)', 'Volume for treatment (m³)', 'Volume pour le traitement (m³)', 'Volumen para tratamiento (m³)', 'Volumen für Behandlung (m³)'],
    loading: ['A verificar os valores…', 'Checking values…', 'Vérification des valeurs…', 'Comprobando valores…', 'Werte werden geprüft…'],
    apply: ['Confirmar aplicação', 'Confirm application', 'Confirmer l’application', 'Confirmar aplicación', 'Anwendung bestätigen'],
    reopen: ['Reabrir comparação', 'Reopen comparison', 'Rouvrir la comparaison', 'Reabrir comparación', 'Vergleich erneut öffnen'],
    close: ['Fechar', 'Close', 'Fermer', 'Cerrar', 'Schließen'],
    invalid: ['Não foi possível confirmar a comparação. Reabra antes de aplicar.', 'The comparison could not be confirmed. Reopen it before applying.', 'La comparaison n’a pas pu être confirmée. Rouvrez-la avant d’appliquer.', 'No se pudo confirmar la comparación. Ábrala de nuevo antes de aplicar.', 'Der Vergleich konnte nicht bestätigt werden. Vor der Anwendung erneut öffnen.'],
  };
  const t = key => words[key][Math.max(0, ['pt', 'en', 'fr', 'es', 'de'].indexOf(String(window.CristalI18n?.readLanguage?.() || document.documentElement.lang || 'pt').slice(0, 2)))];
  function node(tag, text, attributes = {}) { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; Object.assign(item, attributes); return item; }
  const show = value => value == null || value === '' ? '—' : String(value);
  function label(field) { if (field === 'calculatedVolumeM3') return t('calculatedVolume'); if (field === 'treatmentVolumeM3') return t('treatmentVolume'); return document.querySelector('label[for="' + CSS.escape(field) + '"]')?.textContent || ({ notes: 'Notas', equipmentNotes: 'Notas do equipamento', technicalRoomNotes: 'Notas da casa de máquinas' })[field] || field; }
  function create(options) {
    const R = window.CWProposalRequests, dialog = node('dialog'); dialog.id = 'proposalApplicationDialog'; dialog.dataset.cwNoI18n = '';
    dialog.style.cssText = 'position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(720px,calc(100vw - 32px));max-height:86vh;overflow:auto;border:1px solid #98acc0;border-radius:16px;padding:24px;color:#18354a;background:#fff';
    dialog.setAttribute('aria-labelledby', 'proposalApplicationTitle'); document.body.append(dialog);
    let view = null, generation = 0;
    const close = () => { generation++; view = null; if (dialog.open) dialog.close(); dialog.replaceChildren(); };
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    const relevant = state => view === state && options.client.active() && dialog.open;
    async function validate(data, state, resolutions) {
      if (data?.ok !== true || data.scope !== 'TECHNICAL_PROPOSAL_APPLICATION' || data.poolId !== Number(options.poolId) || data.proposalId !== state.id || !/^technical-proposal-v1:[0-9a-f]{64}$/.test(data.version) || !/^technical-sheet-v1:[0-9a-f]{64}$/.test(data.sheetVersion) || !Array.isArray(data.fields) || !data.fields.length || !Array.isArray(data.effects) || data.effectsHash !== await R.hash({ effects: data.effects }) || typeof data.canApply !== 'boolean' || new Set(data.fields.map(f => f.field)).size !== data.fields.length || data.fields.some(f => typeof f.field !== 'string' || ![null, 'CURRENT', 'PROPOSED'].includes(f.choice)) || !R.equal(data.resolutions, Object.fromEntries(data.fields.map(f => [f.field, f.choice])))) throw Error(t('invalid'));
      if (resolutions && (!R.equal(resolutions, data.resolutions) || data.version !== state.initial.version || data.sheetVersion !== state.initial.sheetVersion || !R.equal(data.fields.map(f => f.field), state.initial.fields.map(f => f.field)))) throw Error(t('invalid'));
      return data;
    }
    function effects(state, data) {
      state.effects.replaceChildren(node('h3', t('effects')));
      if (!data.effects.length) { state.effects.append(node('p', t('unchanged'))); return; }
      const list = node('ul'); for (const effect of data.effects) list.append(node('li', label(effect.field) + ': ' + show(effect.before) + ' → ' + show(effect.after)));
      state.effects.append(list);
    }
    async function compare(state) {
      const currentGeneration = ++generation; state.reviewed = null; state.apply.disabled = true;
      const resolutions = Object.fromEntries([...state.inputs].map(([field, input]) => [field, input.value]));
      if (Object.values(resolutions).some(value => !value)) { state.effects.replaceChildren(); state.status.textContent = t('unresolved'); return; }
      state.status.textContent = t('loading');
      try {
        const data = await validate(await options.preview(state.id, { expectedVersion: state.initial.version, expectedSheetVersion: state.initial.sheetVersion, resolutions }), state, resolutions);
        if (!relevant(state) || generation !== currentGeneration) return;
        state.reviewed = data; effects(state, data); state.status.textContent = data.canApply ? '' : t('conflict'); state.apply.disabled = !data.canApply;
      } catch (error) { if (relevant(state) && generation === currentGeneration) { state.effects.replaceChildren(); state.status.textContent = error.message; } }
    }
    async function open(id) {
      close(); if (!options.client.active()) return;
      const state = { id: Number(id), inputs: new Map(), reviewed: null }, ownGeneration = ++generation; view = state;
      const title = node('h2', t('title'), { id: 'proposalApplicationTitle' }), closeButton = node('button', t('close'), { type: 'button', className: 'btn' });
      closeButton.dataset.proposalApplicationClose = ''; closeButton.onclick = close;
      state.status = node('p', t('loading')); state.status.setAttribute('role', 'status'); state.status.dataset.proposalApplicationStatus = '';
      dialog.append(title, node('p', t('explanation')), state.status, closeButton); dialog.showModal(); closeButton.focus();
      try {
        const data = await validate(await options.preview(state.id), state);
        if (!relevant(state) || generation !== ownGeneration) return;
        state.initial = data; state.reviewed = data;
        const fields = node('div'); fields.dataset.proposalApplicationFields = '';
        for (const field of data.fields) {
          const section = node('section'); section.style.cssText = 'border-top:1px solid #d7e2eb;padding:12px 0;overflow-wrap:anywhere';
          section.append(node('h3', label(field.field)));
          if (field.hasDrift) section.append(node('strong', t('drift')));
          section.append(node('p', t('before') + ': ' + show(field.before)), node('p', t('current') + ': ' + show(field.current)), node('p', t('proposed') + ': ' + show(field.after)));
          const input = node('select'); input.dataset.proposalResolution = field.field; input.setAttribute('aria-label', label(field.field));
          for (const [value, key] of [['', 'choose'], ['CURRENT', 'keep'], ['PROPOSED', 'use']]) input.append(node('option', t(key), { value }));
          input.value = field.choice || ''; input.onchange = () => { void compare(state); }; state.inputs.set(field.field, input); section.append(input); fields.append(section);
        }
        state.effects = node('div'); state.effects.dataset.proposalApplicationEffects = '';
        state.apply = node('button', t('apply'), { type: 'button', className: 'primary', disabled: !data.canApply }); state.apply.dataset.proposalApplicationConfirm = '';
        const reopen = node('button', t('reopen'), { type: 'button', className: 'btn' }); reopen.dataset.proposalApplicationReopen = ''; reopen.onclick = () => { void open(state.id); };
        state.apply.onclick = async () => {
          if (!relevant(state) || !state.reviewed?.canApply || state.apply.disabled) return;
          const reviewed = state.reviewed; state.apply.disabled = true; reopen.disabled = true; for (const input of state.inputs.values()) input.disabled = true;
          state.status.textContent = R.t('waiting');
          try { await options.client.send('APPLY', Number(options.poolId), state.id, { expectedVersion: reviewed.version, expectedSheetVersion: reviewed.sheetVersion, expectedEffectsHash: reviewed.effectsHash, resolutions: reviewed.resolutions }); if (relevant(state)) close(); }
          catch (error) { if (relevant(state)) { state.reviewed = null; state.status.textContent = error.message; reopen.disabled = false; } }
        };
        dialog.replaceChildren(title, node('p', t('explanation')), fields, state.effects, state.status, state.apply, document.createTextNode(' '), reopen, document.createTextNode(' '), closeButton);
        if (data.fields.every(field => !!field.choice)) { effects(state, data); state.status.textContent = data.canApply ? '' : t('conflict'); } else state.status.textContent = t('unresolved');
      } catch (error) { if (relevant(state)) state.status.textContent = error.message; }
    }
    return { open, close, confirmed: record => { if (record.action === 'APPLY' && record.poolId === Number(options.poolId) && view?.id === record.proposalId) close(); } };
  }
  window.CWProposalApplication = { create };
})();
