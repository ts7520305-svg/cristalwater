(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CWFieldDocumentCopy = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const locales = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' };
  const copy = {
    pt: {
      transport: 'Guia AT', work: 'Guia de obra', insurance: 'Seguro e inspeção',
      live: 'Consultado online em {date}', cache: 'Cópia guardada · consultada em {date}',
      unavailable: 'Consulta indisponível', loading: 'A consultar documentos…',
      unavailableHelp: 'Não foi possível confirmar estes dados. Atualize com ligação.',
      cacheHelp: 'Esta cópia pode não incluir alterações posteriores.',
      summary: 'Consumos por local · resumo', confirmed: 'Últimos {shown} de {total} consumos da guia nesta consulta.',
      legacy: '{shown} de {available} consumos disponíveis nesta cópia. Total da guia por confirmar.',
      empty: 'Sem consumos registados nesta guia na data da consulta.',
      legacyEmpty: 'Sem consumos nesta cópia. Total da guia por confirmar.',
      full: 'Consultar movimentos da obra atual', connection: 'A lista completa e os PDFs precisam de ligação.',
      unit: 'Unidade não indicada',
    },
    en: {
      transport: 'Transport document', work: 'Work guide', insurance: 'Insurance and inspection',
      live: 'Checked online on {date}', cache: 'Saved copy · checked on {date}',
      unavailable: 'Information unavailable', loading: 'Checking documents…',
      unavailableHelp: 'These details could not be confirmed. Refresh with a connection.',
      cacheHelp: 'This copy may not include later changes.',
      summary: 'Consumption by location · summary', confirmed: 'Latest {shown} of {total} consumption records in this guide at this check.',
      legacy: '{shown} of {available} consumption records available in this copy. Guide total is unconfirmed.',
      empty: 'No consumption recorded in this guide at the time of this check.',
      legacyEmpty: 'No consumption records in this copy. Guide total is unconfirmed.',
      full: 'View movements for the current work guide', connection: 'The complete list and PDFs require a connection.',
      unit: 'Unit not provided',
    },
    fr: {
      transport: 'Document de transport', work: 'Fiche de travail', insurance: 'Assurance et contrôle',
      live: 'Consulté en ligne le {date}', cache: 'Copie enregistrée · consultée le {date}',
      unavailable: 'Consultation indisponible', loading: 'Consultation des documents…',
      unavailableHelp: 'Ces données n’ont pas pu être confirmées. Actualisez avec une connexion.',
      cacheHelp: 'Cette copie peut ne pas inclure les modifications ultérieures.',
      summary: 'Consommations par lieu · résumé', confirmed: '{shown} dernières consommations sur {total} dans cette fiche lors de la consultation.',
      legacy: '{shown} consommations sur {available} disponibles dans cette copie. Total de la fiche non confirmé.',
      empty: 'Aucune consommation enregistrée dans cette fiche à la date de consultation.',
      legacyEmpty: 'Aucune consommation dans cette copie. Total de la fiche non confirmé.',
      full: 'Consulter les mouvements de la fiche actuelle', connection: 'La liste complète et les PDF nécessitent une connexion.',
      unit: 'Unité non indiquée',
    },
    es: {
      transport: 'Documento de transporte', work: 'Parte de trabajo', insurance: 'Seguro e inspección',
      live: 'Consultado en línea el {date}', cache: 'Copia guardada · consultada el {date}',
      unavailable: 'Consulta no disponible', loading: 'Consultando documentos…',
      unavailableHelp: 'No se pudieron confirmar estos datos. Actualice con conexión.',
      cacheHelp: 'Esta copia puede no incluir cambios posteriores.',
      summary: 'Consumos por lugar · resumen', confirmed: 'Últimos {shown} de {total} consumos del parte en esta consulta.',
      legacy: '{shown} de {available} consumos disponibles en esta copia. Total del parte sin confirmar.',
      empty: 'Sin consumos registrados en este parte en la fecha de consulta.',
      legacyEmpty: 'Sin consumos en esta copia. Total del parte sin confirmar.',
      full: 'Consultar movimientos del parte actual', connection: 'La lista completa y los PDF requieren conexión.',
      unit: 'Unidad no indicada',
    },
    de: {
      transport: 'Transportbeleg', work: 'Arbeitsbeleg', insurance: 'Versicherung und Prüfung',
      live: 'Online abgerufen am {date}', cache: 'Gespeicherte Kopie · abgerufen am {date}',
      unavailable: 'Abfrage nicht verfügbar', loading: 'Dokumente werden abgerufen…',
      unavailableHelp: 'Diese Angaben konnten nicht bestätigt werden. Mit Verbindung aktualisieren.',
      cacheHelp: 'Diese Kopie enthält möglicherweise keine späteren Änderungen.',
      summary: 'Verbrauch nach Ort · Übersicht', confirmed: 'Letzte {shown} von {total} Verbrauchseinträgen dieses Belegs bei dieser Abfrage.',
      legacy: '{shown} von {available} verfügbaren Verbrauchseinträgen in dieser Kopie. Gesamtzahl des Belegs unbestätigt.',
      empty: 'Bei dieser Abfrage war kein Verbrauch in diesem Beleg erfasst.',
      legacyEmpty: 'Keine Verbrauchseinträge in dieser Kopie. Gesamtzahl des Belegs unbestätigt.',
      full: 'Bewegungen des aktuellen Arbeitsbelegs anzeigen', connection: 'Die vollständige Liste und die PDFs benötigen eine Verbindung.',
      unit: 'Einheit nicht angegeben',
    },
  };
  function text(key, values = {}, language = 'pt') {
    return (copy[language] || copy.pt)[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }
  function date(value, language = 'pt') {
    return new Intl.DateTimeFormat(locales[language] || locales.pt, { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
  }
  return { text, date, locales, keys: Object.keys(copy.pt) };
}));
