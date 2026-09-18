'use strict';
const { language, locales } = require('./visitReportLanguage');
// Application-owned text only. Stored identities, statuses, methods and notes stay unchanged.
const messages = {
  "title": {
    "pt": "Relatório mensal",
    "en": "Monthly report",
    "fr": "Rapport mensuel",
    "es": "Informe mensual"
  },
  "print": {
    "pt": "Imprimir / Guardar PDF",
    "en": "Print / Save PDF",
    "fr": "Imprimer / Enregistrer le PDF",
    "es": "Imprimir / Guardar PDF"
  },
  "review": {
    "pt": "Por rever",
    "en": "To be reviewed",
    "fr": "À vérifier",
    "es": "Por revisar"
  },
  "notGiven": {
    "pt": "Não indicado",
    "en": "Not provided",
    "fr": "Non indiqué",
    "es": "No indicado"
  },
  "notGivenF": {
    "pt": "Não indicada",
    "en": "Not provided",
    "fr": "Non indiquée",
    "es": "No indicada"
  },
  "yes": {
    "pt": "Sim",
    "en": "Yes",
    "fr": "Oui",
    "es": "Sí"
  },
  "no": {
    "pt": "Não",
    "en": "No",
    "fr": "Non",
    "es": "No"
  },
  "clientPrefix": {
    "pt": "Cliente #",
    "en": "Client #",
    "fr": "Client n°",
    "es": "Cliente n.º"
  },
  "poolPrefix": {
    "pt": "Instalação #",
    "en": "Facility #",
    "fr": "Installation n°",
    "es": "Instalación n.º"
  },
  "documentPrefix": {
    "pt": "Documento #",
    "en": "Document #",
    "fr": "Document n°",
    "es": "Documento n.º"
  },
  "registeredNumber": {
    "pt": "N.º registado:",
    "en": "Recorded no.:",
    "fr": "N° enregistré :",
    "es": "N.º registrado:"
  },
  "monthReference": {
    "pt": "Referência mensal:",
    "en": "Monthly reference:",
    "fr": "Référence mensuelle :",
    "es": "Referencia mensual:"
  },
  "recordedStatus": {
    "pt": "Estado registado:",
    "en": "Recorded status:",
    "fr": "État enregistré :",
    "es": "Estado registrado:"
  },
  "requiresInvoice": {
    "pt": "Requer fatura:",
    "en": "Invoice required:",
    "fr": "Facture requise :",
    "es": "Requiere factura:"
  },
  "creditExcluded": {
    "pt": "Depósito de crédito - excluído dos totais documentais",
    "en": "Credit deposit - excluded from document totals",
    "fr": "Dépôt de crédit - exclu des totaux des documents",
    "es": "Depósito de crédito - excluido de los totales de documentos"
  },
  "statusExcluded": {
    "pt": "Excluído dos totais documentais pelo estado registado",
    "en": "Excluded from document totals due to recorded status",
    "fr": "Exclu des totaux des documents selon l’état enregistré",
    "es": "Excluido de los totales de documentos por el estado registrado"
  },
  "statusReview": {
    "pt": "Estado por rever - totais documentais indisponíveis",
    "en": "Status to be reviewed - document totals unavailable",
    "fr": "État à vérifier - totaux des documents indisponibles",
    "es": "Estado por revisar - totales de documentos no disponibles"
  },
  "amountReview": {
    "pt": "Montantes por rever - totais documentais indisponíveis",
    "en": "Amounts to be reviewed - document totals unavailable",
    "fr": "Montants à vérifier - totaux des documents indisponibles",
    "es": "Importes por revisar - totales de documentos no disponibles"
  },
  "included": {
    "pt": "Incluído nos totais documentais",
    "en": "Included in document totals",
    "fr": "Inclus dans les totaux des documents",
    "es": "Incluido en los totales de documentos"
  },
  "notIncluded": {
    "pt": "Não incluído",
    "en": "Not included",
    "fr": "Non inclus",
    "es": "No incluido"
  },
  "documentAmount": {
    "pt": "Valor do documento",
    "en": "Document amount",
    "fr": "Montant du document",
    "es": "Importe del documento"
  },
  "paidAmount": {
    "pt": "Liquidado registado",
    "en": "Recorded settled amount",
    "fr": "Montant réglé enregistré",
    "es": "Importe liquidado registrado"
  },
  "openAmount": {
    "pt": "Saldo atual",
    "en": "Current balance",
    "fr": "Solde actuel",
    "es": "Saldo actual"
  },
  "balanceNotice": {
    "pt": "O liquidado pode incluir crédito interno e pagamentos de outros meses. O saldo é o valor atual, não o saldo no fim do mês escolhido.",
    "en": "The settled amount may include internal credit and payments from other months. The balance is the current amount, not the balance at the end of the selected month.",
    "fr": "Le montant réglé peut inclure du crédit interne et des paiements d’autres mois. Le solde est le montant actuel, et non celui à la fin du mois choisi.",
    "es": "El importe liquidado puede incluir crédito interno y pagos de otros meses. El saldo es el importe actual, no el saldo al cierre del mes elegido."
  },
  "currentClient": {
    "pt": "Ficha atual do cliente #",
    "en": "Current client record #",
    "fr": "Fiche actuelle du client n°",
    "es": "Ficha actual del cliente n.º"
  },
  "phone": {
    "pt": "Telefone:",
    "en": "Phone:",
    "fr": "Téléphone :",
    "es": "Teléfono:"
  },
  "email": {
    "pt": "Email:",
    "en": "Email:",
    "fr": "E-mail :",
    "es": "Correo electrónico:"
  },
  "address": {
    "pt": "Morada:",
    "en": "Address:",
    "fr": "Adresse :",
    "es": "Dirección:"
  },
  "currentPools": {
    "pt": "Instalações - registo atual",
    "en": "Facilities - current record",
    "fr": "Installations - fiche actuelle",
    "es": "Instalaciones - registro actual"
  },
  "pool": {
    "pt": "Instalação",
    "en": "Facility",
    "fr": "Installation",
    "es": "Instalación"
  },
  "zone": {
    "pt": "Zona",
    "en": "Area",
    "fr": "Zone",
    "es": "Zona"
  },
  "noPools": {
    "pt": "Sem instalações no registo atual.",
    "en": "No facilities in the current record.",
    "fr": "Aucune installation dans la fiche actuelle.",
    "es": "Sin instalaciones en el registro actual."
  },
  "registryNotice": {
    "pt": "O cadastro atual não identifica, por si só, as instalações ou os serviços faturados neste mês.",
    "en": "The current client record alone does not identify the facilities or services billed this month.",
    "fr": "La fiche actuelle ne permet pas, à elle seule, d’identifier les installations ou les services facturés ce mois-ci.",
    "es": "La ficha actual no identifica, por sí sola, las instalaciones o los servicios facturados este mes."
  },
  "filterRequired": {
    "pt": "Filtro: apenas documentos marcados como «Requer fatura» e recebimentos associados a documentos com essa marca.",
    "en": "Filter: only documents marked “Invoice required” and receipts linked to documents with that flag.",
    "fr": "Filtre : uniquement les documents marqués « Facture requise » et les encaissements associés à ces documents.",
    "es": "Filtro: solo documentos marcados como «Requiere factura» y cobros asociados a documentos con esa marca."
  },
  "filterAll": {
    "pt": "Filtro: todos os documentos e recebimentos do período, segundo as fontes abaixo.",
    "en": "Filter: all documents and receipts for the period, according to the sources below.",
    "fr": "Filtre : tous les documents et encaissements de la période, selon les sources ci-dessous.",
    "es": "Filtro: todos los documentos y cobros del período, según las fuentes indicadas a continuación."
  },
  "generated": {
    "pt": "Consulta gerada em {date} UTC. Valores em EUR.",
    "en": "Report generated on {date} UTC. Amounts in EUR.",
    "fr": "Rapport généré le {date} UTC. Montants en EUR.",
    "es": "Informe generado el {date} UTC. Importes en EUR."
  },
  "clientCount": {
    "pt": "Clientes nos documentos do mês",
    "en": "Clients in this month’s documents",
    "fr": "Clients dans les documents du mois",
    "es": "Clientes en los documentos del mes"
  },
  "documentCount": {
    "pt": "Documentos do mês",
    "en": "Documents for the month",
    "fr": "Documents du mois",
    "es": "Documentos del mes"
  },
  "receivableAmount": {
    "pt": "Valor dos documentos cobráveis",
    "en": "Amount of receivable documents",
    "fr": "Montant des documents à encaisser",
    "es": "Importe de los documentos cobrables"
  },
  "currentOpen": {
    "pt": "Saldo atual desses documentos",
    "en": "Current balance of these documents",
    "fr": "Solde actuel de ces documents",
    "es": "Saldo actual de estos documentos"
  },
  "cashAmount": {
    "pt": "Recebimentos registados no mês",
    "en": "Receipts recorded this month",
    "fr": "Encaissements enregistrés ce mois-ci",
    "es": "Cobros registrados en el mes"
  },
  "paymentCount": {
    "pt": "Registos de recebimento",
    "en": "Receipt records",
    "fr": "Enregistrements d’encaissement",
    "es": "Registros de cobro"
  },
  "basisHeading": {
    "pt": "Como ler os valores",
    "en": "How to read the amounts",
    "fr": "Comment lire les montants",
    "es": "Cómo interpretar los importes"
  },
  "documentBasis": {
    "pt": "Documentos: referência mensal guardada, incluindo os formatos históricos. {receivable} com estado de cobrança reconhecido; {excluded} excluídos; {unknown} com estado por rever; {invalid} com montantes por rever.",
    "en": "Documents: stored monthly reference, including historical formats. {receivable} with a recognized collection status; {excluded} excluded; {unknown} with status to be reviewed; {invalid} with amounts to be reviewed.",
    "fr": "Documents : référence mensuelle enregistrée, y compris les anciens formats. {receivable} avec un état de recouvrement reconnu ; {excluded} exclus ; {unknown} avec un état à vérifier ; {invalid} avec des montants à vérifier.",
    "es": "Documentos: referencia mensual guardada, incluidos los formatos históricos. {receivable} con estado de cobro reconocido; {excluded} excluidos; {unknown} con estado por revisar; {invalid} con importes por revisar."
  },
  "currentBasis": {
    "pt": "O valor documental e o saldo usam os registos atuais. Não representam um fecho histórico. Rascunhos, documentos retirados da cobrança e depósitos de crédito não entram nesses totais.",
    "en": "Document amounts and balances use current records. They do not represent a historical closing balance. Drafts, documents removed from collection and credit deposits are excluded from these totals.",
    "fr": "Les montants des documents et les soldes utilisent les données actuelles. Ils ne représentent pas une clôture historique. Les brouillons, les documents retirés du recouvrement et les dépôts de crédit sont exclus de ces totaux.",
    "es": "Los importes documentales y los saldos usan los registros actuales. No representan un cierre histórico. Los borradores, los documentos retirados del cobro y los depósitos de crédito quedan excluidos de estos totales."
  },
  "cashBasis": {
    "pt": "Recebimentos: data registada entre {start} (incluída) e {end} (excluída), em UTC. Incluem recebimentos de documentos de outros meses e depósitos pagos. Aplicações e ajustes de crédito interno ficam excluídos.",
    "en": "Receipts: recorded date from {start} (inclusive) to {end} (exclusive), in UTC. Includes receipts for documents from other months and paid deposits. Internal credit applications and adjustments are excluded.",
    "fr": "Encaissements : date enregistrée entre {start} (incluse) et {end} (exclue), en UTC. Ils incluent les encaissements de documents d’autres mois et les dépôts payés. Les utilisations et ajustements de crédit interne sont exclus.",
    "es": "Cobros: fecha registrada entre {start} (incluida) y {end} (excluida), en UTC. Incluyen cobros de documentos de otros meses y depósitos pagados. Se excluyen las aplicaciones y los ajustes de crédito interno."
  },
  "filterBasis": {
    "pt": "A marca «Requer fatura» é a do documento, não a preferência atual do cliente. No filtro ativo, a mesma marca rege os documentos e os recebimentos; o mês do documento não limita os recebimentos.",
    "en": "The “Invoice required” flag belongs to the document, not the client’s current preference. With the filter enabled, that same flag governs documents and receipts; the document month does not restrict receipts.",
    "fr": "La mention « Facture requise » est celle du document, et non la préférence actuelle du client. Lorsque le filtre est actif, cette même mention régit les documents et les encaissements ; le mois du document ne limite pas les encaissements.",
    "es": "La marca «Requiere factura» es la del documento, no la preferencia actual del cliente. Con el filtro activo, la misma marca rige los documentos y los cobros; el mes del documento no limita los cobros."
  },
  "documentWarning": {
    "pt": "Totais documentais por rever. Existem estados ou montantes que não permitem apresentar um total confirmado, ou a soma excede o limite de cálculo. Os documentos válidos continuam identificados abaixo.",
    "en": "Document totals need review. Some statuses or amounts prevent a confirmed total, or the sum exceeds the calculation limit. Valid documents remain identified below.",
    "fr": "Totaux des documents à vérifier. Certains états ou montants empêchent de présenter un total confirmé, ou la somme dépasse la limite de calcul. Les documents valides restent identifiés ci-dessous.",
    "es": "Totales de documentos por revisar. Existen estados o importes que impiden presentar un total confirmado, o la suma supera el límite de cálculo. Los documentos válidos siguen identificados a continuación."
  },
  "cashWarning": {
    "pt": "Total de recebimentos por rever. Existem montantes inválidos ou a soma excede o limite de cálculo. Não foi apresentado um total parcial como total do mês.",
    "en": "Receipt total needs review. Some amounts are invalid or the sum exceeds the calculation limit. No partial total has been presented as the total for the month.",
    "fr": "Total des encaissements à vérifier. Certains montants sont invalides ou la somme dépasse la limite de calcul. Aucun total partiel n’a été présenté comme le total du mois.",
    "es": "Total de cobros por revisar. Existen importes no válidos o la suma supera el límite de cálculo. No se ha presentado un total parcial como total del mes."
  },
  "emptyDocuments": {
    "pt": "Sem documentos para este mês e filtro.",
    "en": "No documents for this month and filter.",
    "fr": "Aucun document pour ce mois et ce filtre.",
    "es": "Sin documentos para este mes y filtro."
  },
  "cashHeading": {
    "pt": "Recebimentos do mês",
    "en": "Receipts for the month",
    "fr": "Encaissements du mois",
    "es": "Cobros del mes"
  },
  "cashNotice": {
    "pt": "Lista independente dos documentos acima, por data de recebimento (UTC). O estado atual de um documento não apaga um recebimento registado.",
    "en": "A list independent of the documents above, by receipt date (UTC). A document’s current status does not remove a recorded receipt.",
    "fr": "Liste indépendante des documents ci-dessus, selon la date d’encaissement (UTC). L’état actuel d’un document n’efface pas un encaissement enregistré.",
    "es": "Lista independiente de los documentos anteriores, por fecha de cobro (UTC). El estado actual de un documento no elimina un cobro registrado."
  },
  "cashTable": {
    "pt": "Tabela de recebimentos",
    "en": "Receipts table",
    "fr": "Tableau des encaissements",
    "es": "Tabla de cobros"
  },
  "date": {
    "pt": "Data (UTC)",
    "en": "Date (UTC)",
    "fr": "Date (UTC)",
    "es": "Fecha (UTC)"
  },
  "currentClientLabel": {
    "pt": "Cliente atual",
    "en": "Current client",
    "fr": "Client actuel",
    "es": "Cliente actual"
  },
  "document": {
    "pt": "Documento",
    "en": "Document",
    "fr": "Document",
    "es": "Documento"
  },
  "method": {
    "pt": "Método",
    "en": "Method",
    "fr": "Méthode",
    "es": "Método"
  },
  "amount": {
    "pt": "Valor",
    "en": "Amount",
    "fr": "Montant",
    "es": "Importe"
  },
  "paymentNotes": {
    "pt": "Notas do recebimento #",
    "en": "Receipt notes #",
    "fr": "Notes de l’encaissement n°",
    "es": "Notas del cobro n.º"
  },
  "emptyPayments": {
    "pt": "Sem recebimentos registados para este mês e filtro.",
    "en": "No receipts recorded for this month and filter.",
    "fr": "Aucun encaissement enregistré pour ce mois et ce filtre.",
    "es": "Sin cobros registrados para este mes y filtro."
  },
  "closing": {
    "pt": "Contactos, nomes e instalações refletem a ficha atual do cliente. A leitura do relatório não altera documentos, pagamentos ou configurações.",
    "en": "Contact details, names and facilities reflect the client’s current record. Reading this report does not change documents, payments or settings.",
    "fr": "Les coordonnées, noms et installations reflètent la fiche actuelle du client. La consultation du rapport ne modifie ni les documents, ni les paiements, ni les paramètres.",
    "es": "Los contactos, nombres e instalaciones reflejan la ficha actual del cliente. La consulta del informe no modifica documentos, pagos ni configuraciones."
  }
};
function presentation(rawLanguage) {
  const lang = language(rawLanguage);
  const t = (key, params = {}) => {
    if (!Object.hasOwn(messages, key)) throw Error('Unknown monthly report message: ' + key);
    return messages[key][lang].replace(/\{([a-z]+)\}/g, (match, name) => {
      if (!Object.hasOwn(params, name)) throw Error('Missing monthly report parameter: ' + name);
      return String(params[name]);
    });
  };
  return { lang, t, money: cents => cents === null ? t('review') : new Intl.NumberFormat(locales[lang], { style: 'currency', currency: 'EUR' }).format(cents / 100),
    date: value => new Intl.DateTimeFormat(locales[lang], { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' }).format(value) };
}
module.exports = { presentation, language };
