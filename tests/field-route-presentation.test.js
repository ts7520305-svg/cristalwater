import { describe, it, expect } from 'vitest';
const fs = require('node:fs'), vm = require('node:vm');
const words = {
  "session": [
    "A sessão mudou. Reabra o modo de campo com a conta atual.",
    "The session changed. Reopen field mode with the current account.",
    "La session a changé. Rouvrez le mode terrain avec le compte actuel.",
    "La sesión ha cambiado. Vuelve a abrir el modo de campo con la cuenta actual.",
    "Die Sitzung hat sich geändert. Öffnen Sie den Außendienstmodus erneut mit dem aktuellen Konto."
  ],
  "role": [
    "A conta não permite consultar esta ronda.",
    "This account cannot view this round.",
    "Ce compte ne permet pas de consulter cette tournée.",
    "Esta cuenta no permite consultar esta ronda.",
    "Dieses Konto darf diese Tour nicht anzeigen."
  ],
  "changed": [
    "A sessão ou o dia mudou. Atualize a ronda da conta atual.",
    "The session or day changed. Refresh the round for the current account.",
    "La session ou le jour a changé. Actualisez la tournée du compte actuel.",
    "La sesión o el día ha cambiado. Actualiza la ronda de la cuenta actual.",
    "Die Sitzung oder der Tag hat sich geändert. Aktualisieren Sie die Tour des aktuellen Kontos."
  ],
  "mismatch": [
    "A ronda guardada não corresponde à conta/dia ou está ilegível. Os dados foram preservados.",
    "The saved round does not match this account/day or is unreadable. The data has been preserved.",
    "La tournée enregistrée ne correspond pas à ce compte ou à ce jour, ou elle est illisible. Les données ont été conservées.",
    "La ronda guardada no corresponde a esta cuenta o día, o no se puede leer. Se han conservado los datos.",
    "Die gespeicherte Tour passt nicht zu diesem Konto oder Tag oder ist unlesbar. Die Daten bleiben erhalten."
  ],
  "response": [
    "A resposta não confirma a ronda completa desta conta e deste dia.",
    "The response does not confirm the complete round for this account and day.",
    "La réponse ne confirme pas la tournée complète de ce compte pour ce jour.",
    "La respuesta no confirma la ronda completa de esta cuenta para este día.",
    "Die Antwort bestätigt nicht die vollständige Tour dieses Kontos für diesen Tag."
  ],
  "legacyIncomplete": [
    "A ronda antiga pode estar incompleta. Foi preservada; consulte a ronda completa com rede antes de trabalhar offline.",
    "The old round may be incomplete. It has been preserved; check the complete round online before working offline.",
    "L’ancienne tournée peut être incomplète. Elle a été conservée ; consultez la tournée complète en ligne avant de travailler hors connexion.",
    "La ronda antigua puede estar incompleta. Se ha conservado; consulta la ronda completa con conexión antes de trabajar sin conexión.",
    "Die alte Tour ist möglicherweise unvollständig. Sie bleibt erhalten; prüfen Sie die vollständige Tour online, bevor Sie offline arbeiten."
  ],
  "legacyUnattributed": [
    "Existe uma ronda antiga sem conta/dia comprovados. Foi preservada; consulte a ronda atual com rede.",
    "There is an old round without a verified account/day. It has been preserved; check the current round online.",
    "Une ancienne tournée n’a pas de compte ou de jour vérifiés. Elle a été conservée ; consultez la tournée actuelle en ligne.",
    "Existe una ronda antigua sin cuenta o día verificados. Se ha conservado; consulta la ronda actual con conexión.",
    "Eine alte Tour hat kein bestätigtes Konto oder Datum. Sie bleibt erhalten; prüfen Sie die aktuelle Tour online."
  ],
  "unreadable": [
    "A ronda guardada está ilegível. Os dados foram preservados; peça apoio ao escritório.",
    "The saved round is unreadable. The data has been preserved; ask the office for help.",
    "La tournée enregistrée est illisible. Les données ont été conservées ; demandez de l’aide au bureau.",
    "No se puede leer la ronda guardada. Se han conservado los datos; pide ayuda a la oficina.",
    "Die gespeicherte Tour ist unlesbar. Die Daten bleiben erhalten; bitten Sie das Büro um Hilfe."
  ],
  "readback": [
    "Não foi possível confirmar a gravação da ronda neste dispositivo.",
    "Could not confirm that the round was saved on this device.",
    "Impossible de confirmer l’enregistrement de la tournée sur cet appareil.",
    "No se pudo confirmar que la ronda se guardó en este dispositivo.",
    "Das Speichern der Tour auf diesem Gerät konnte nicht bestätigt werden."
  ]
};
function harness({ readback = true } = {}) {
  const stored = new Map(), calls = { read: 0, write: 0 };
  const token = role => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64') + '.signature';
  const session = { owner: 'TECH:7', technicianId: 7, token: token('TECHNICIAN') };
  let active = true;
  const window = { CWFieldWriteStore: { session: () => session, same: captured => active && captured === session } };
  const context = { window, atob: raw => Buffer.from(raw, 'base64').toString(), localStorage: {
    getItem(key) { calls.read++; return readback ? stored.get(key) ?? null : null; },
    setItem(key, raw) { calls.write++; stored.set(key, raw); }
  } };
  vm.runInNewContext(fs.readFileSync('frontend/cw-field-route-cache.js', 'utf8'), context);
  const cache = window.CWFieldRouteCache, scope = cache.scope();
  const response = { ok: true, complete: true, date: scope.day, technicianId: 7, total: 1, visits: [{ id: 9, visitType: 'REGULAR', technician: { id: 7 }, status: 'PLANNED' }] };
  const snapshot = cache.fromResponse(response, scope);
  return { cache, scope, response, snapshot, stored, calls, session, token, context, change: () => { active = false; } };
}
const producers = {
  session: h => { h.change(); h.cache.scope(); },
  role: h => { h.session.token = h.token('ADMIN'); h.cache.scope(); },
  changed: h => h.cache.read({ ...h.scope, day: '2000-01-01' }),
  mismatch: h => h.cache.validate({ ...h.snapshot, owner: 'TECH:8' }, h.scope),
  response: h => h.cache.fromResponse({ ...h.response, complete: false }, h.scope),
  legacyIncomplete: h => { h.stored.set(h.cache.key(h.scope).replace(':v3:', ':v2:'), '{"private":"old incomplete"}'); h.cache.read(h.scope); },
  legacyUnattributed: h => { h.stored.set('cwFieldRoute:7', '{"private":"unknown account/day"}'); h.cache.read(h.scope); },
  unreadable: h => { h.stored.set(h.cache.key(h.scope), '{broken private route'); h.cache.read(h.scope); },
  readback: h => h.cache.save(h.snapshot, h.scope)
};
describe('Owned route-cache error presentation', () => {
  it.each(Object.keys(producers))('keeps the %s guard and original error while formatting five languages without storage access', key => {
    const h = harness({ readback: key !== 'readback' }); let failure;
    try { producers[key](h); } catch (error) { failure = error; }
    expect(failure?.message).toBe(words[key][0]); expect(failure.name).toBe('Error');
    const entry = h.cache.presentation.error(failure), original = failure.message, properties = Object.getOwnPropertyNames(failure);
    expect(entry).toBeTruthy(); expect(Object.isFrozen(entry)).toBe(true);
    const stored = [...h.stored], calls = { ...h.calls };
    for (const [index, language] of ['pt', 'en', 'fr', 'es', 'de'].entries()) {
      expect(h.cache.presentation.format(entry, language)).toBe(words[key][index]);
      expect(failure.message).toBe(original); expect(Object.getOwnPropertyNames(failure)).toEqual(properties);
      expect(h.cache.presentation.error(failure)).toBe(entry); expect([...h.stored]).toEqual(stored); expect(h.calls).toEqual(calls);
    }
    expect(h.cache.presentation.format(entry, 'de-DE')).toBe(words[key][4]);
    expect(h.cache.presentation.format(entry, 'invalid')).toBe(words[key][0]);
    expect(h.cache.presentation.format(entry)).toBe(words[key][0]);
  });
  it('requires private error identity even for identical text and copied public metadata', () => {
    const h = harness(); let owned; try { h.cache.fromResponse({ ...h.response, total: 2 }, h.scope); } catch (error) { owned = error; }
    const foreign = Error(owned.message); Object.assign(foreign, owned);
    expect(h.cache.presentation.error(foreign)).toBe(null);
    expect(h.cache.presentation.format(foreign.message, 'en')).toBe(owned.message);
    const genuine = h.cache.presentation.error(owned);
    expect(h.cache.presentation.format({ ...genuine }, 'en')).toBe('[object Object]');
    expect(h.cache.presentation.format({ key: 'response' }, 'en')).toBe('[object Object]');
  });
  it('keeps caller errors, raw details and valid snapshot serialization literal', () => {
    const h = harness(), raw = new TypeError('Raw <b>{day}</b> — ' + words.unreadable[0]);
    expect(h.cache.presentation.error(raw)).toBe(null);
    expect(h.cache.presentation.format(raw.message, 'de')).toBe(raw.message);
    expect(h.cache.save(h.snapshot, h.scope)).toBe(h.snapshot);
    expect(h.cache.read(h.scope)).toEqual(h.snapshot);
    expect(h.stored.get(h.cache.key(h.scope))).toBe(JSON.stringify(h.snapshot));
    expect(h.stored.get(h.cache.key(h.scope))).not.toContain(h.session.token);
    expect(Object.isFrozen(h.cache.presentation)).toBe(true);
  });
  it('preserves a foreign quota error object and the stored bytes', () => {
    const h = harness(), key = h.cache.key(h.scope); h.cache.save(h.snapshot, h.scope); const original = h.stored.get(key);
    const quota = new DOMException('Raw quota <b>{day}</b>', 'QuotaExceededError');
    h.context.localStorage.setItem = () => { throw quota; };
    let thrown; try { h.cache.save(h.snapshot, h.scope); } catch (error) { thrown = error; }
    expect(thrown).toBe(quota); expect(h.cache.presentation.error(thrown)).toBe(null); expect(h.stored.get(key)).toBe(original);
  });
});
