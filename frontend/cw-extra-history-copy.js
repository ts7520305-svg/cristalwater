(function(root){
  'use strict';
  const languages=["pt", "en", "fr", "es", "de"],messages={
  "center": [
    "Centro",
    "Centre",
    "Centre",
    "Centro",
    "Zentrale"
  ],
  "language": [
    "Idioma",
    "Language",
    "Langue",
    "Idioma",
    "Sprache"
  ],
  "search": [
    "Pesquisa",
    "Search",
    "Recherche",
    "Búsqueda",
    "Suche"
  ],
  "clientId": [
    "ID do cliente",
    "Customer ID",
    "ID du client",
    "ID del cliente",
    "Kunden-ID"
  ],
  "allClients": [
    "Todos os clientes",
    "All customers",
    "Tous les clients",
    "Todos los clientes",
    "Alle Kunden"
  ],
  "from": [
    "Desde",
    "From",
    "Du",
    "Desde",
    "Von"
  ],
  "to": [
    "Até",
    "To",
    "Au",
    "Hasta",
    "Bis"
  ],
  "refresh": [
    "Atualizar",
    "Refresh",
    "Actualiser",
    "Actualizar",
    "Aktualisieren"
  ],
  "first": [
    "Primeira página",
    "First page",
    "Première page",
    "Primera página",
    "Erste Seite"
  ],
  "previous": [
    "Anterior",
    "Previous",
    "Précédente",
    "Anterior",
    "Zurück"
  ],
  "next": [
    "Seguinte",
    "Next",
    "Suivante",
    "Siguiente",
    "Weiter"
  ],
  "session": [
    "A sessão mudou ou terminou. Reabra a página com a conta pretendida.",
    "The session changed or expired. Reopen the page with the intended account.",
    "La session a changé ou a expiré. Rouvrez la page avec le compte souhaité.",
    "La sesión cambió o caducó. Abra la página con la cuenta deseada.",
    "Die Sitzung wurde geändert oder ist abgelaufen. Öffnen Sie die Seite mit dem gewünschten Konto."
  ],
  "filters": [
    "Os filtros mudaram. Use Atualizar para confirmar os resultados.",
    "The filters changed. Select Refresh to confirm the results.",
    "Les filtres ont changé. Actualisez pour confirmer les résultats.",
    "Los filtros cambiaron. Pulse Actualizar para confirmar los resultados.",
    "Die Filter wurden geändert. Aktualisieren Sie, um die Ergebnisse zu bestätigen."
  ],
  "empty": [
    "Não há registos nos filtros confirmados.",
    "There are no records for the confirmed filters.",
    "Aucun enregistrement pour les filtres confirmés.",
    "No hay registros para los filtros confirmados.",
    "Keine Einträge für die bestätigten Filter."
  ],
  "range": [
    "Página {page} de {pages} · {total} registos",
    "Page {page} of {pages} · {total} records",
    "Page {page} sur {pages} · {total} enregistrements",
    "Página {page} de {pages} · {total} registros",
    "Seite {page} von {pages} · {total} Einträge"
  ],
  "outside": [
    "Esta página já não contém registos. Volte à primeira página para consultar o histórico atual.",
    "This page no longer contains records. Return to the first page to view the current history.",
    "Cette page ne contient plus de données. Revenez à la première page pour consulter l’historique actuel.",
    "Esta página ya no contiene registros. Vuelva a la primera página para consultar el historial actual.",
    "Diese Seite enthält keine Einträge mehr. Öffnen Sie die erste Seite für den aktuellen Verlauf."
  ],
  "asOf": [
    "Consulta confirmada em",
    "Query confirmed at",
    "Consultation confirmée à",
    "Consulta confirmada a las",
    "Abfrage bestätigt am"
  ],
  "notGiven": [
    "Não indicado",
    "Not provided",
    "Non indiqué",
    "No indicado",
    "Nicht angegeben"
  ],
  "notes": [
    "Notas originais",
    "Original notes",
    "Notes originales",
    "Notas originales",
    "Originalnotizen"
  ],
  "raw": [
    "Valor original",
    "Original amount",
    "Montant original",
    "Importe original",
    "Ursprünglicher Betrag"
  ],
  "title": [
    "Histórico de extras",
    "Extra visit history",
    "Historique des visites supplémentaires",
    "Historial de visitas extra",
    "Historie der Zusatzbesuche"
  ],
  "subtitle": [
    "Registos marcados como faturados, com o preço e o cliente guardados na visita.",
    "Visits marked as billed, with the price and customer stored on the visit.",
    "Visites marquées comme facturées, avec le prix et le client enregistrés dans la visite.",
    "Visitas marcadas como facturadas, con el precio y el cliente guardados en la visita.",
    "Besuche mit Abrechnungsmarkierung sowie dem im Besuch gespeicherten Preis und Kunden."
  ],
  "documents": [
    "Documentos internos",
    "Internal documents",
    "Documents internes",
    "Documentos internos",
    "Interne Dokumente"
  ],
  "payments": [
    "Pagamentos",
    "Payments",
    "Paiements",
    "Pagos",
    "Zahlungen"
  ],
  "searchHint": [
    "Nome atual, ID da visita/cliente/piscina ou notas",
    "Current name, visit/customer/pool ID or notes",
    "Nom actuel, ID de visite/client/piscine ou notes",
    "Nombre actual, ID de visita/cliente/piscina o notas",
    "Aktueller Name, Besuchs-/Kunden-/Pool-ID oder Notizen"
  ],
  "poolId": [
    "ID da piscina",
    "Pool ID",
    "ID de piscine",
    "ID de piscina",
    "Pool-ID"
  ],
  "allPools": [
    "Todas as piscinas",
    "All pools",
    "Toutes les piscines",
    "Todas las piscinas",
    "Alle Pools"
  ],
  "basis": [
    "A marcação «faturado» e o preço da visita não confirmam o montante de um documento, um pagamento ou a emissão de fatura fiscal.",
    "The billed marker and visit price do not confirm a document amount, payment or tax invoice issuance.",
    "La marque de facturation et le prix de visite ne confirment pas le montant d’un document, un paiement ou l’émission d’une facture fiscale.",
    "La marca de facturación y el precio de visita no confirman el importe de un documento, un pago o la emisión de una factura fiscal.",
    "Abrechnungsmarkierung und Besuchspreis bestätigen weder einen Dokumentbetrag noch eine Zahlung oder die Ausstellung einer Steuerrechnung."
  ],
  "names": [
    "O cliente é o guardado na visita, mesmo que a piscina mude de titular. Os nomes apresentados são atuais. Nomes e notas conservam o texto original.",
    "The customer is the one stored on the visit, even if the pool changes owner. Names shown are current. Names and notes retain their original text.",
    "Le client est celui enregistré dans la visite, même si la piscine change de titulaire. Les noms affichés sont actuels. Noms et notes conservent leur texte original.",
    "El cliente es el guardado en la visita, aunque la piscina cambie de titular. Los nombres mostrados son actuales. Nombres y notas conservan su texto original.",
    "Der Kunde stammt aus dem Besuch, auch wenn der Pool den Eigentümer wechselt. Angezeigt werden aktuelle Namen. Namen und Notizen bleiben im Original."
  ],
  "dateNote": [
    "Filtros pela data de marcação em UTC. Sem filtro de data, registos sem data aparecem no fim. Cada página é uma nova consulta.",
    "Filters use the marking date in UTC. Without date filters, undated records appear last. Each page is a new query.",
    "Les filtres utilisent la date de marquage en UTC. Sans filtre de date, les enregistrements non datés apparaissent en dernier. Chaque page est une nouvelle consultation.",
    "Los filtros usan la fecha de marca en UTC. Sin filtros de fecha, los registros sin fecha aparecen al final. Cada página es una consulta nueva.",
    "Filter verwenden das Markierungsdatum in UTC. Ohne Datumsfilter stehen undatierte Einträge am Ende. Jede Seite ist eine neue Abfrage."
  ],
  "loading": [
    "A confirmar o histórico de extras…",
    "Confirming extra visit history…",
    "Vérification de l’historique des visites supplémentaires…",
    "Confirmando el historial de visitas extra…",
    "Historie der Zusatzbesuche wird geprüft…"
  ],
  "error": [
    "Não foi possível confirmar o histórico. Use Atualizar para tentar novamente.",
    "The history could not be confirmed. Select Refresh to try again.",
    "Impossible de confirmer l’historique. Sélectionnez Actualiser pour réessayer.",
    "No se pudo confirmar el historial. Pulsa Actualizar para intentarlo de nuevo.",
    "Die Historie konnte nicht bestätigt werden. Wählen Sie Aktualisieren, um es erneut zu versuchen."
  ],
  "invalid": [
    "Reveja os IDs do cliente/piscina, datas, pesquisa e página. Nada foi consultado.",
    "Check customer/pool IDs, dates, search and page. No query was sent.",
    "Vérifiez les ID du client/de la piscine, dates, recherche et page. Aucune requête envoyée.",
    "Revisa los ID del cliente/piscina, fechas, búsqueda y página. No se envió ninguna consulta.",
    "Prüfen Sie Kunden-/Pool-IDs, Datum, Suche und Seite. Es wurde keine Abfrage gesendet."
  ],
  "price": [
    "Preço guardado na visita",
    "Stored visit price",
    "Prix enregistré de la visite",
    "Precio guardado de la visita",
    "Gespeicherter Besuchspreis"
  ],
  "client": [
    "Cliente guardado na visita · nome atual",
    "Customer stored on visit · current name",
    "Client enregistré dans la visite · nom actuel",
    "Cliente guardado en la visita · nombre actual",
    "Kunde im Besuch · aktueller Name"
  ],
  "pool": [
    "Piscina guardada na visita · nome atual",
    "Pool stored on visit · current name",
    "Piscine enregistrée dans la visite · nom actuel",
    "Piscina guardada en la visita · nombre actual",
    "Pool im Besuch · aktueller Name"
  ],
  "billedAt": [
    "Marcação registada · UTC",
    "Recorded marking · UTC",
    "Marquage enregistré · UTC",
    "Marca registrada · UTC",
    "Gespeicherte Markierung · UTC"
  ],
  "scheduledAt": [
    "Agendamento guardado · UTC",
    "Stored schedule · UTC",
    "Planification enregistrée · UTC",
    "Programación guardada · UTC",
    "Gespeicherte Planung · UTC"
  ],
  "status": [
    "Estado original",
    "Original status",
    "Statut original",
    "Estado original",
    "Originalstatus"
  ],
  "mode": [
    "Modo comercial original",
    "Original commercial mode",
    "Mode commercial original",
    "Modo comercial original",
    "Ursprünglicher Geschäftsmodus"
  ],
  "missingClient": [
    "Sem cliente associado na visita. Não foi atribuído ao cliente atual da piscina.",
    "No customer stored on the visit. It was not assigned to the pool’s current customer.",
    "Aucun client enregistré dans la visite. Elle n’a pas été attribuée au client actuel de la piscine.",
    "Sin cliente guardado en la visita. No se asignó al cliente actual de la piscina.",
    "Kein Kunde im Besuch gespeichert. Er wurde nicht dem aktuellen Poolkunden zugewiesen."
  ],
  "changedClient": [
    "A piscina pertence agora a outro cliente. O cliente guardado na visita foi conservado.",
    "The pool now belongs to another customer. The customer stored on the visit was retained.",
    "La piscine appartient désormais à un autre client. Le client enregistré dans la visite a été conservé.",
    "La piscina pertenece ahora a otro cliente. Se conservó el cliente guardado en la visita.",
    "Der Pool gehört jetzt einem anderen Kunden. Der im Besuch gespeicherte Kunde wurde beibehalten."
  ],
  "missingDate": [
    "Sem data de marcação registada",
    "No recorded marking date",
    "Aucune date de marquage enregistrée",
    "Sin fecha de marca registrada",
    "Kein Markierungsdatum gespeichert"
  ],
  "invalidAmount": [
    "O valor original não representa cêntimos exatos. Foi conservado sem arredondamento.",
    "The original value does not represent exact cents. It was retained without rounding.",
    "La valeur originale ne représente pas des centimes exacts. Elle a été conservée sans arrondi.",
    "El valor original no representa céntimos exactos. Se conservó sin redondear.",
    "Der Originalwert stellt keinen exakten Centbetrag dar. Er wurde ohne Rundung beibehalten."
  ],
  "negative": [
    "O preço original é negativo. Requer revisão; não foi alterado.",
    "The original price is negative. Review is required; it was not changed.",
    "Le prix original est négatif. Une vérification est nécessaire ; il n’a pas été modifié.",
    "El precio original es negativo. Requiere revisión; no se modificó.",
    "Der Originalpreis ist negativ. Eine Prüfung ist erforderlich; er wurde nicht geändert."
  ]
};
  const copy=Object.freeze(Object.fromEntries(languages.map((language,index)=>[language,Object.freeze(Object.fromEntries(Object.entries(messages).map(([key,values])=>[key,values[index]])))])));
  if(typeof module==='object'&&module.exports)module.exports=copy;else root.CWExtraHistoryCopy=copy;
}(typeof window==='undefined'?globalThis:window));
