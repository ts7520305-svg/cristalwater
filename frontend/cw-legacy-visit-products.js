(function () {
  'use strict';
  const store = window.CWFieldWriteStore, actor = store.session(), R = window.CWVisitProductIdentity, rules = window.CWLegacyProductRules, readRules = window.CWTechnicianGuideReadRules;
  const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon' }).format(new Date()), day = today();
  const cacheKey = 'cwLegacyVisitProducts:v1:' + actor?.owner + ':' + day, editors = new Map();
  let snapshot = null, source = 'loading', warning = '', loading = false, revision = 0, controller = null, suspended = false;
  const copy = {
    pt: { language: 'Idioma dos produtos', title: 'Produtos utilizados', add: 'Adicionar produto', notes: 'Notas do produto', refresh: 'Atualizar guia', live: 'Guia consultada online em ', cache: 'Cópia guardada da guia · consultada em ', loading: 'A consultar a guia…', unavailable: 'Guia indisponível. Os produtos do rascunho foram conservados.', unassigned: 'Sem viatura atribuída nesta consulta.', noGuide: 'Sem guia aberta nesta consulta.', previous: 'Texto anterior dos produtos', previousHelp: 'O texto original fica guardado neste rascunho. Reveja-o e indique cada produto, unidade e quantidade na lista.', convert: 'Preparar lista de produtos', review: 'Reveja o texto anterior antes de concluir.', empty: 'Sem produtos adicionados.', cacheHelp: 'Esta cópia pode não incluir alterações recentes. O servidor confirma o saldo e a guia ao receber a visita.', session: 'A sessão ou o dia mudou. Reabra a página. Os rascunhos foram preservados.', invalid: 'A cópia da guia está ilegível ou pertence a outro contexto. Foi preservada.', save: 'Não foi possível confirmar a gravação da guia neste dispositivo.', response: 'A consulta não confirmou a conta, a viatura ou a guia.', denied: 'Acesso à guia recusado. Atualize com a conta e viatura atribuídas.', retained: 'Registo anterior guardado apenas neste rascunho do dispositivo.' },
    en: { language: 'Product language', title: 'Products used', add: 'Add product', notes: 'Product notes', refresh: 'Refresh guide', live: 'Guide checked online at ', cache: 'Saved guide copy · checked at ', loading: 'Checking the guide…', unavailable: 'Guide unavailable. Draft products have been kept.', unassigned: 'No vehicle assigned at this check.', noGuide: 'No open guide at this check.', previous: 'Previous product text', previousHelp: 'The original text stays in this draft. Review it and enter each product, unit and quantity in the list.', convert: 'Prepare product list', review: 'Review the previous text before completing.', empty: 'No products added.', cacheHelp: 'This copy may not include recent changes. The server checks the balance and guide when it receives the visit.', session: 'The session or day changed. Reopen the page. Drafts have been kept.', invalid: 'The saved guide is unreadable or belongs to another context. It has been kept.', save: 'The guide could not be confirmed as saved on this device.', response: 'The response did not confirm the account, vehicle or guide.', denied: 'Guide access denied. Refresh with the assigned account and vehicle.', retained: 'Previous record kept only in this draft on this device.' },
    fr: { language: 'Langue des produits', title: 'Produits utilisés', add: 'Ajouter un produit', notes: 'Notes du produit', refresh: 'Actualiser la fiche', live: 'Fiche consultée en ligne le ', cache: 'Copie enregistrée · consultée le ', loading: 'Consultation de la fiche…', unavailable: 'Fiche indisponible. Les produits du brouillon sont conservés.', unassigned: 'Aucun véhicule attribué lors de cette consultation.', noGuide: 'Aucune fiche ouverte lors de cette consultation.', previous: 'Ancien texte des produits', previousHelp: 'Le texte original reste dans ce brouillon. Vérifiez-le et indiquez chaque produit, unité et quantité dans la liste.', convert: 'Préparer la liste des produits', review: 'Vérifiez le texte précédent avant de terminer.', empty: 'Aucun produit ajouté.', cacheHelp: 'Cette copie peut ne pas inclure les dernières modifications. Le serveur vérifie le stock et la fiche à la réception de la visite.', session: 'La session ou la date a changé. Rouvrez la page. Les brouillons sont conservés.', invalid: 'La copie est illisible ou appartient à un autre contexte. Elle est conservée.', save: 'L’enregistrement de la fiche sur cet appareil n’a pas pu être confirmé.', response: 'La réponse ne confirme pas le compte, le véhicule ou la fiche.', denied: 'Accès refusé. Actualisez avec le compte et le véhicule attribués.', retained: 'Ancien texte conservé uniquement dans ce brouillon sur cet appareil.' },
    es: { language: 'Idioma de los productos', title: 'Productos utilizados', add: 'Añadir producto', notes: 'Notas del producto', refresh: 'Actualizar guía', live: 'Guía consultada en línea el ', cache: 'Copia guardada · consultada el ', loading: 'Consultando la guía…', unavailable: 'Guía no disponible. Los productos del borrador se han conservado.', unassigned: 'Sin vehículo asignado en esta consulta.', noGuide: 'Sin guía abierta en esta consulta.', previous: 'Texto anterior de productos', previousHelp: 'El texto original permanece en este borrador. Revíselo e indique cada producto, unidad y cantidad en la lista.', convert: 'Preparar lista de productos', review: 'Revise el texto anterior antes de finalizar.', empty: 'No se han añadido productos.', cacheHelp: 'Esta copia puede no incluir cambios recientes. El servidor confirma el saldo y la guía al recibir la visita.', session: 'La sesión o el día han cambiado. Abra de nuevo la página. Los borradores se han conservado.', invalid: 'La copia es ilegible o pertenece a otro contexto. Se ha conservado.', save: 'No se pudo confirmar que la guía se guardara en este dispositivo.', response: 'La respuesta no confirmó la cuenta, el vehículo o la guía.', denied: 'Acceso denegado. Actualice con la cuenta y el vehículo asignados.', retained: 'Registro anterior conservado solo en este borrador del dispositivo.' },
    de: { language: 'Sprache der Produkte', title: 'Verwendete Produkte', add: 'Produkt hinzufügen', notes: 'Produktnotizen', refresh: 'Beleg aktualisieren', live: 'Beleg online abgerufen am ', cache: 'Gespeicherte Kopie · abgerufen am ', loading: 'Beleg wird abgerufen…', unavailable: 'Beleg nicht verfügbar. Die Produkte im Entwurf bleiben erhalten.', unassigned: 'Bei dieser Abfrage ist kein Fahrzeug zugewiesen.', noGuide: 'Bei dieser Abfrage ist kein Beleg offen.', previous: 'Bisheriger Produkttext', previousHelp: 'Der Originaltext bleibt in diesem Entwurf. Prüfen Sie ihn und tragen Sie jedes Produkt mit Einheit und Menge in die Liste ein.', convert: 'Produktliste vorbereiten', review: 'Prüfen Sie den bisherigen Text vor dem Abschluss.', empty: 'Keine Produkte hinzugefügt.', cacheHelp: 'Diese Kopie enthält möglicherweise keine aktuellen Änderungen. Der Server prüft Bestand und Beleg beim Empfang des Besuchs.', session: 'Sitzung oder Datum geändert. Öffnen Sie die Seite erneut. Die Entwürfe bleiben erhalten.', invalid: 'Die Kopie ist unlesbar oder gehört zu einem anderen Kontext. Sie bleibt erhalten.', save: 'Das Speichern des Belegs auf diesem Gerät konnte nicht bestätigt werden.', response: 'Die Antwort bestätigt Konto, Fahrzeug oder Beleg nicht.', denied: 'Zugriff verweigert. Mit zugewiesenem Konto und Fahrzeug aktualisieren.', retained: 'Bisheriger Text bleibt nur in diesem Entwurf auf diesem Gerät.' },
  };
  const language = () => copy[document.documentElement.lang] ? document.documentElement.lang : 'pt';
  const t = key => copy[language()][key], common = (key, values) => window.CWFieldDocumentCopy.text(key, values, language());
  const active = () => !suspended && store.same(actor) && day === today();
  const requireActive = () => { if (!active()) throw Error(t('session')); };
  const node = (tag, text = '') => { const el = document.createElement(tag); el.textContent = text; return el; };
  function valid(value) {
    return value && Object.keys(value).length === 8 && value.v === 1 && value.owner === actor.owner && value.technicianId === actor.technicianId && value.day === day && Number.isFinite(value.requestedAt) && typeof value.confirmedAt === 'string' && Number.isFinite(Date.parse(value.confirmedAt)) && readRules.vehicles(value.assignment, actor) && (value.assignment.scope.vehicleId === null ? value.stock === null : readRules.stock(value.stock, actor, value.assignment.scope.vehicleId));
  }
  function readCache() {
    requireActive(); const raw = localStorage.getItem(cacheKey); if (!raw) return null;
    let value; try { value = JSON.parse(raw); } catch (_) { throw Error(t('invalid')); }
    if (!valid(value)) throw Error(t('invalid')); return value;
  }
  async function request(path, signal) {
    const response = await fetch('/api/guides' + path, { headers: { Authorization: 'Bearer ' + actor.token }, cache: 'no-store', redirect: 'error', signal });
    requireActive(); if ([401, 403].includes(response.status)) throw Object.assign(Error(t('denied')), { denied: true });
    if (response.status !== 200 || response.headers.get('x-cw-owner') !== actor.owner || response.headers.get('x-cw-field-guides') !== 'field-guides-v1' || response.headers.get('cache-control') !== 'private, no-store') throw Error(t('response'));
    const value = await response.json(); requireActive(); return value;
  }
  async function refresh() {
    if (!active()) return; const ticket = ++revision, requestedAt = Date.now(); controller?.abort(); controller = new AbortController(); const currentController = controller;
    loading = true; snapshot = null; source = 'loading'; warning = ''; let cached = null, assigned = null;
    try { cached = readCache(); } catch (error) { warning = error.message; } renderAll();
    const timer = setTimeout(() => currentController.abort(), 12000);
    try {
      if (!navigator.onLine) { snapshot = cached; source = cached ? 'cache' : 'unavailable'; return; }
      const nextAssignment = await request('/vehicles', currentController.signal); if (!readRules.vehicles(nextAssignment, actor)) throw Error(t('response')); assigned = nextAssignment;
      const vehicleId = assigned.scope.vehicleId, stock = vehicleId === null ? null : await request('/stock/' + vehicleId + '?includeMovements=false', currentController.signal);
      if (ticket !== revision || !active()) return;
      const value = { v: 1, owner: actor.owner, technicianId: actor.technicianId, day, requestedAt, confirmedAt: new Date().toISOString(), assignment: assigned, stock };
      if (!valid(value)) throw Error(t('response')); snapshot = value; source = 'live';
      try {
        if (!navigator.locks?.request) throw Error(t('save'));
        await navigator.locks.request(cacheKey, async () => {
          requireActive(); if (ticket !== revision) return;
          const previous = readCache(); if (previous && previous.requestedAt > value.requestedAt) return;
          const raw = JSON.stringify(value); localStorage.setItem(cacheKey, raw); if (localStorage.getItem(cacheKey) !== raw) throw Error(t('save'));
        });
      } catch (error) { warning = error.message; }
    } catch (error) {
      if (ticket !== revision || !active()) return;
      snapshot = !error.denied && cached && (!assigned || assigned.scope.vehicleId === cached.assignment.scope.vehicleId) ? cached : null;
      source = snapshot ? 'cache' : 'unavailable'; warning = error.message;
    } finally { clearTimeout(timer); if (ticket === revision) { loading = false; renderAll(); } }
  }
  function options(select, row) {
    const work = snapshot?.stock?.workGuide, items = snapshot?.stock?.stock || []; let found = false;
    select.append(new Option(common('productChoose'), ''));
    for (const [index, item] of items.entries()) {
      const option = new Option(common('productRow', { number: index + 1 }) + ' · ' + item.name + ' · ' + item.quantity + ' ' + (R.text(item.unit) ? item.unit : common('unit')), String(item.id));
      option.disabled = !R.text(item.name) || !R.text(item.unit); select.append(option);
      if (row.workGuideId === work.id && row.workGuideItemId === item.id && row.name === item.name && row.unit === item.unit && !option.disabled) { option.selected = true; found = true; }
    }
    if (!found && (row.name || row.productName || R.hasIdentity(row))) { const option = new Option((row.name || row.productName || common('productUnknown')) + ' · ' + (row.unit || common('unit')) + ' · ' + common('productSaved'), 'saved'); select.append(option); option.selected = true; }
  }
  function changed(editor, value, redraw = false) {
    if (!active() || editor.blocked) return;
    editor.raw = rules.encode(value.rows, value.originalText); editor.input.value = editor.raw; editor.input.dispatchEvent(new Event('input', { bubbles: true }));
    if (redraw) render(editor, true);
  }
  function render(editor, force = false) {
    if (!editor.box.isConnected) return;
    const unavailable = !active(), disabled = unavailable || editor.blocked;
    editor.status.textContent = unavailable ? t('session') : source === 'live' || source === 'cache'
      ? t(source) + window.CWFieldDocumentCopy.date(snapshot.confirmedAt, language()) + '. ' + (snapshot.assignment.scope.vehicleId === null ? t('unassigned') : !snapshot.stock?.workGuide ? t('noGuide') : common('work') + ' #' + snapshot.stock.workGuide.id) + (source === 'cache' ? ' ' + t('cacheHelp') : '') + (warning ? ' ' + warning : '')
      : t(source) + (warning ? ' ' + warning : '');
    editor.languageLabel.textContent = t('language'); editor.languagePicker.value = language(); editor.languagePicker.disabled = unavailable;
    editor.refresh.textContent = t('refresh'); editor.refresh.disabled = unavailable || loading;
    if (unavailable) { editor.rows.replaceChildren(); editor.previous.replaceChildren(); editor.add.disabled = true; return; }
    const raw = editor.input.value;
    if (force || raw !== editor.raw || editor.language !== language() || editor.guideRevision !== revision) {
      editor.raw = raw; editor.language = language(); editor.guideRevision = revision; const value = rules.read(raw);
      editor.title.textContent = t('title'); editor.add.textContent = t('add'); editor.previous.replaceChildren(); editor.rows.replaceChildren();
      if (value.originalText !== null) {
        editor.previous.append(node('strong', t('previous')), node('p', value.originalText), node('p', value.kind === 'text' ? t('previousHelp') : t('retained')));
        if (value.kind === 'text') { const button = node('button', t('convert')); button.type = 'button'; button.dataset.productConvert = ''; button.onclick = () => changed(editor, { rows: [], originalText: value.originalText }, true); editor.previous.append(button); }
      }
      if (value.kind === 'rows' && !value.rows.length) editor.rows.append(node('p', t('empty')));
      value.rows.forEach((product, index) => {
        const card = node('div'); card.className = 'legacy-product-row'; card.dataset.productRow = String(index);
        const select = node('select'); select.dataset.productField = 'name'; select.setAttribute('aria-label', common('productUsed')); options(select, product);
        const quantity = node('input'); quantity.dataset.productField = 'quantity'; quantity.inputMode = 'decimal'; quantity.value = product.quantity ?? ''; quantity.setAttribute('aria-label', common('productQuantity')); quantity.placeholder = common('productQuantity');
        const unit = node('input'); unit.dataset.productField = 'unit'; unit.value = product.unit ?? ''; unit.readOnly = true; unit.setAttribute('aria-label', common('productUnit'));
        const notes = node('textarea'); notes.dataset.productField = 'notes'; notes.value = product.notes ?? ''; notes.placeholder = t('notes'); notes.setAttribute('aria-label', t('notes')); notes.maxLength = 1000;
        const remove = node('button', common('productRemove')); remove.type = 'button'; remove.dataset.productRemove = '';
        select.onchange = () => { if (!active() || editor.blocked || select.value === 'saved') return; const row = { ...product }; if (!select.value) { row.name = ''; row.unit = ''; delete row.productName; delete row.workGuideId; delete row.workGuideItemId; } else { const item = snapshot?.stock?.stock.find(item => item.id === Number(select.value)); Object.assign(row, R.fromItem(item, snapshot?.stock?.workGuide.id)); delete row.productName; } value.rows[index] = row; changed(editor, value, true); };
        quantity.oninput = () => { product.quantity = quantity.value; changed(editor, value); }; notes.oninput = () => { product.notes = notes.value; changed(editor, value); };
        remove.onclick = () => { value.rows.splice(index, 1); changed(editor, value, true); };
        card.append(select, quantity, unit, notes, remove); editor.rows.append(card);
      });
      editor.add.onclick = () => { if (value.kind !== 'rows' || value.rows.length >= 50) return; value.rows.push({ name: '', quantity: '', unit: '', notes: '' }); changed(editor, value, true); };
      editor.add.hidden = value.kind !== 'rows'; editor.add.disabled = disabled || value.rows.length >= 50;
    }
    for (const control of editor.box.querySelectorAll('input,select,textarea,button')) if (control !== editor.refresh && control !== editor.languagePicker) control.disabled = disabled || control === editor.add && rules.read(editor.raw).rows.length >= 50;
  }
  function renderAll() { for (const editor of editors.values()) render(editor, true); }
  function bind(element, visit) {
    const input = element.querySelector('#products-' + visit.id); input.style.display = 'none'; input.setAttribute('aria-hidden', 'true');
    const box = node('section'); box.className = 'legacy-products'; box.dataset.cwNoI18n = ''; box.dataset.cwStateManaged = 'manual'; box.dataset.cwFormMemory = 'managed'; box.id = 'legacyProducts-' + visit.id;
    const title = node('h3'), status = node('p'), refreshButton = node('button'), previous = node('div'), rows = node('div'), add = node('button'); status.setAttribute('role', 'status'); previous.className = 'legacy-product-previous'; refreshButton.type = add.type = 'button'; refreshButton.dataset.productRefresh = ''; add.dataset.productAdd = ''; refreshButton.onclick = refresh;
    const languageHolder = node('label'), languageLabel = node('span'), languagePicker = node('select'); languagePicker.dataset.productLanguage = ''; languageHolder.append(languageLabel, languagePicker);
    for (const [code, name] of [['pt','Português'],['en','English'],['fr','Français'],['es','Español'],['de','Deutsch']]) languagePicker.append(new Option(name, code));
    languagePicker.onchange = () => { if (!active() || !copy[languagePicker.value]) return; document.documentElement.lang = languagePicker.value; try { localStorage.setItem('cwLegacyProductLanguage:' + actor.owner, languagePicker.value); } catch (_) {} };
    box.append(title, languageHolder, status, refreshButton, previous, rows, add); element.querySelector('.visit-actions').before(box);
    const editor = { input, box, title, status, languageLabel, languagePicker, refresh: refreshButton, previous, rows, add, raw: null, blocked: true }; editors.set(visit.id, editor); render(editor, true);
  }
  function paint(id, blocked) { const editor = editors.get(id); if (!editor) return; editor.blocked = blocked; render(editor); }
  function completion(raw) { requireActive(); return rules.payload(raw, snapshot?.stock); }
  const style = node('style'); style.textContent = '.legacy-products{margin:16px 0;padding:14px;border:1px solid #94aca5;border-radius:12px;background:#f5faf8;color:#173c32;min-width:0;grid-column:1/-1}.legacy-products *{box-sizing:border-box;max-width:100%;overflow-wrap:anywhere}.legacy-products>label{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:10px 0}.legacy-products>label>select{min-height:44px;padding:8px;background:white;color:#173c32;border:1px solid #789b8f;border-radius:7px;font-size:16px}.legacy-products [hidden]{display:none!important}.legacy-products [role=status]{font-size:14px;line-height:1.5}.legacy-products button{min-height:44px;padding:10px 14px;background:#075c4c;color:white;border:1px solid #075c4c;border-radius:8px;font-size:16px;white-space:normal}.legacy-products button:disabled{opacity:.65}.legacy-product-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr);gap:8px;margin:14px 0;padding:12px;border:1px solid #94aca5;border-radius:10px}.legacy-product-row input,.legacy-product-row select,.legacy-product-row textarea{min-width:0;width:100%;min-height:44px;margin:0;padding:10px;border:1px solid #789b8f;border-radius:7px;background:white;color:#173c32;font-size:16px}.legacy-product-row textarea{grid-column:1/-1;min-height:64px}.legacy-product-row button{justify-self:start}.legacy-product-previous p{white-space:pre-wrap}.legacy-products button:focus-visible,.legacy-products input:focus-visible,.legacy-products select:focus-visible,.legacy-products textarea:focus-visible{outline:3px solid #0079ba;outline-offset:3px}@media(max-width:650px){.legacy-product-row{grid-template-columns:minmax(0,1fr)}}'; document.head.append(style);
  new MutationObserver(renderAll).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  function protect() { if (!active()) { ++revision; controller?.abort(); snapshot = null; loading = false; renderAll(); } }
  addEventListener('storage', protect); addEventListener('online', refresh); addEventListener('offline', () => { if (snapshot) source = 'cache'; renderAll(); });
  addEventListener('pagehide', () => { suspended = true; protect(); }); addEventListener('pageshow', event => { if (event.persisted) { suspended = false; refresh(); } }); setInterval(protect, 1000);
  try { const preferred = new URL(location.href).searchParams.get('lang') || localStorage.getItem('cwLegacyProductLanguage:' + actor.owner); if (copy[preferred]) document.documentElement.lang = preferred; } catch (_) {}
  window.CWLegacyVisitProducts = { bind, paint, completion, refresh }; refresh();
}());
