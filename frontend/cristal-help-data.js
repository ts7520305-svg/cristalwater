(function(){
  const adminRoutes = {
  "operationalFlow": "/admin-master-control",
  "dashboard": "/admin-dashboard",
  "aiAdmin": "/admin-ai",
  "aiOps": "/admin-ai",
  "ai": "/admin-ai",
  "rounds": "/admin-rounds",
  "visits": "/admin-visits",
  "technicians": "/admin-technicians",
  "clients": "/admin-clients",
  "pools": "/admin-pools",
  "priorities": "/admin-priority",
  "finance": "/billing-center",
  "invoices": "/invoices",
  "alerts": "/admin-alerts",
  "map": "/admin-live-map",
  "chat": "/chat",
  "reports": "/report-center",
  "incidents": "/incident-center",
  "inventory": "/admin-inventory",
  "customerPortal": "/admin-clients",
  "themes": "/admin-ui-settings",
  "vehicles": "/admin-vehicles",
  "settings": "/admin-operational-settings"
};
  const adminGuides = {
  "pt": {
    "operationalFlow": [
      "Centro de operações",
      "Acompanhe o dia e abra os módulos de trabalho.",
      "Confirme a data e o estado da consulta. Abra o registo correspondente antes de tomar uma decisão."
    ],
    "dashboard": [
      "Painel administrativo",
      "Consulte os indicadores e os resumos disponíveis.",
      "Verifique o período e a atualização dos dados. Uma consulta falhada não significa que não existam pendências."
    ],
    "aiAdmin": [
      "Assistente operacional",
      "Consulte o modo disponível, as recomendações e as propostas.",
      "Leia as capacidades indicadas no ecrã. Reveja cada proposta antes de aprovar e confirme o resultado apresentado; uma recomendação não é uma ação concluída."
    ],
    "rounds": [
      "Rondas e planeamento",
      "Organize piscinas, dias e técnicos.",
      "Confirme a atribuição e a ordem antes de gerar visitas. Depois consulte a rota do dia para verificar o resultado."
    ],
    "visits": [
      "Visitas e serviços",
      "Consulte o trabalho planeado e os registos de execução.",
      "Confirme a piscina, a data e se a visita é regular ou extra. Abra o detalhe para consultar o estado, as medições e o trabalho registado."
    ],
    "technicians": [
      "Equipa técnica",
      "Consulte os técnicos e as suas atribuições.",
      "Confirme o perfil, o estado ativo e a viatura do técnico antes de alterar a organização do trabalho."
    ],
    "clients": [
      "Clientes",
      "Consulte e edite as fichas dos clientes.",
      "Selecione a ficha correta. Ao editar, reveja as alterações e aguarde a confirmação; se os dados tiverem mudado, compare os valores apresentados."
    ],
    "pools": [
      "Piscinas e ficha técnica",
      "Abra a piscina e confirme o cliente associado.",
      "Reveja os campos antes de guardar. Uma alteração de cliente exige atenção à associação; consulte o histórico depois de uma alteração confirmada."
    ],
    "priorities": [
      "Prioridades das piscinas",
      "Consulte a classificação Normal, Alta ou Urgente.",
      "Abra a edição da piscina, escolha a prioridade e guarde. Se houver um pedido pendente ou um conflito, use a confirmação ou a revisão apresentada antes de enviar outra alteração."
    ],
    "finance": [
      "Cobranças e recebimentos",
      "Consulte os saldos e registe os recebimentos.",
      "Confirme o cliente, o valor e a forma de pagamento. Aguarde o resultado da operação e use a recuperação de pedidos pendentes quando necessário."
    ],
    "invoices": [
      "Faturas e documentos",
      "Consulte rascunhos, documentos emitidos e pagamentos.",
      "Reveja linhas, valores e estado antes de emitir ou enviar. Um rascunho ainda não é uma cobrança. A emissão fiscal externa tem um percurso próprio."
    ],
    "alerts": [
      "Alertas e notificações",
      "Consulte os avisos e abra a ocorrência correspondente.",
      "Marcar como lido não resolve a origem do alerta. Trate a ocorrência no respetivo módulo e confirme o estado resultante."
    ],
    "map": [
      "Mapa e localização",
      "Consulte as posições e os destinos disponíveis.",
      "Verifique a data da última posição. Uma posição antiga ou uma consulta falhada não confirma a localização atual do técnico."
    ],
    "chat": [
      "Conversas com clientes",
      "Selecione o cliente e consulte a conversa.",
      "Confirme o destinatário antes de escrever ou anexar ficheiros. Aguarde a confirmação de envio e recupere pedidos pendentes na própria conversa."
    ],
    "reports": [
      "Relatórios e exportação",
      "Escolha o relatório e o período pretendidos.",
      "Confirme os filtros e os registos incluídos. Antes de partilhar um documento, verifique o conteúdo e o destinatário."
    ],
    "incidents": [
      "Incidentes",
      "Consulte as ocorrências que precisam de acompanhamento.",
      "Abra o incidente e reveja a descrição, o estado e os registos disponíveis. Confirme o resultado de cada atualização."
    ],
    "inventory": [
      "Stock e produtos",
      "Consulte produtos, unidades e movimentos.",
      "Confirme o produto, a unidade e a origem antes de registar um movimento. Aguarde a confirmação e confira o saldo atualizado."
    ],
    "customerPortal": [
      "Apoio ao cliente",
      "Consulte a ficha interna para apoiar o cliente.",
      "O cliente utiliza a sua própria sessão. Confirme a ficha e os dados associados antes de orientar a consulta de serviços, documentos ou mensagens."
    ],
    "themes": [
      "Tema e aparência",
      "Ajuste as opções de apresentação disponíveis.",
      "Escolha a opção apresentada e verifique a legibilidade e os controlos no dispositivo que vai utilizar."
    ],
    "vehicles": [
      "Frota, guias e stock",
      "Consulte viaturas, documentos e material.",
      "Confirme a viatura, a origem e a validade dos documentos. Uma cópia guardada pode não incluir alterações recentes."
    ],
    "settings": [
      "Configurações operacionais",
      "Reveja as opções gerais e os avisos de manutenção.",
      "Confirme a gravação de cada alteração. As preferências de som da conta estão na opção Preferências de som do menu."
    ]
  },
  "en": {
    "operationalFlow": [
      "Operations centre",
      "Review the day and open the work modules.",
      "Check the date and loading status. Open the relevant record before making a decision."
    ],
    "dashboard": [
      "Administration dashboard",
      "View the available indicators and summaries.",
      "Check the period and data freshness. A failed request does not mean that nothing is pending."
    ],
    "aiAdmin": [
      "Operations assistant",
      "Check the available mode, recommendations and proposals.",
      "Read the capabilities shown on screen. Review each proposal before approval and check the result; a recommendation is not a completed action."
    ],
    "rounds": [
      "Rounds and planning",
      "Organise pools, days and technicians.",
      "Check assignments and order before generating visits. Then open the daily route to verify the result."
    ],
    "visits": [
      "Visits and services",
      "View planned work and execution records.",
      "Check the pool, date and whether the visit is regular or extra. Open its details to review status, measurements and recorded work."
    ],
    "technicians": [
      "Field team",
      "View technicians and their assignments.",
      "Check the technician’s role, active status and vehicle before changing work assignments."
    ],
    "clients": [
      "Customers",
      "View and edit customer records.",
      "Select the correct record. Review edits and wait for confirmation; compare the displayed values if the data has changed."
    ],
    "pools": [
      "Pools and technical details",
      "Open a pool and check its linked customer.",
      "Review fields before saving. Check the assignment carefully when changing the customer, and consult the history after a confirmed change."
    ],
    "priorities": [
      "Pool priorities",
      "View Normal, High and Urgent classifications.",
      "Open the pool editor, choose a priority and save. If a request is pending or a conflict occurs, use the confirmation or review controls before submitting another edit."
    ],
    "finance": [
      "Collections and receipts",
      "View balances and record receipts.",
      "Check the customer, amount and payment method. Wait for the operation result and recover pending requests when necessary."
    ],
    "invoices": [
      "Invoices and documents",
      "View drafts, issued documents and payments.",
      "Review lines, amounts and status before issuing or sending. A draft is not yet a charge. External fiscal issuance has its own workflow."
    ],
    "alerts": [
      "Alerts and notifications",
      "View notices and open the related event.",
      "Marking a notice as read does not resolve its cause. Handle the event in its module and check the resulting status."
    ],
    "map": [
      "Map and location",
      "View available positions and destinations.",
      "Check the timestamp of the latest position. An old position or a failed request does not confirm the technician’s current location."
    ],
    "chat": [
      "Customer conversations",
      "Select the customer and view the conversation.",
      "Check the recipient before writing or attaching files. Wait for send confirmation and recover pending requests in the conversation."
    ],
    "reports": [
      "Reports and exports",
      "Choose a report and the required period.",
      "Check filters and included records. Before sharing a document, review its content and recipient."
    ],
    "incidents": [
      "Incidents",
      "View events that need follow-up.",
      "Open the incident and review its description, status and available records. Check the result of each update."
    ],
    "inventory": [
      "Stock and products",
      "View products, units and movements.",
      "Check the product, unit and source before recording a movement. Wait for confirmation and check the updated balance."
    ],
    "customerPortal": [
      "Customer support",
      "Use the internal record to assist a customer.",
      "Customers use their own sessions. Check the record and associated data before guiding them through services, documents or messages."
    ],
    "themes": [
      "Theme and appearance",
      "Adjust the available display options.",
      "Choose a displayed option and check readability and controls on the device you will use."
    ],
    "vehicles": [
      "Fleet, guides and stock",
      "View vehicles, documents and materials.",
      "Check the vehicle, source and document validity. A saved copy may not include recent changes."
    ],
    "settings": [
      "Operational settings",
      "Review general options and maintenance reminders.",
      "Confirm that each change was saved. Account sound preferences are available under Sound preferences in the menu."
    ]
  },
  "es": {
    "operationalFlow": [
      "Centro de operaciones",
      "Revise el día y abra los módulos de trabajo.",
      "Compruebe la fecha y el estado de carga. Abra el registro correspondiente antes de tomar una decisión."
    ],
    "dashboard": [
      "Panel administrativo",
      "Consulte los indicadores y resúmenes disponibles.",
      "Compruebe el período y la actualización de los datos. Una consulta fallida no significa que no haya asuntos pendientes."
    ],
    "aiAdmin": [
      "Asistente operativo",
      "Consulte el modo disponible, las recomendaciones y las propuestas.",
      "Lea las capacidades indicadas. Revise cada propuesta antes de aprobarla y compruebe el resultado; una recomendación no es una acción completada."
    ],
    "rounds": [
      "Rondas y planificación",
      "Organice piscinas, días y técnicos.",
      "Compruebe la asignación y el orden antes de generar visitas. Después consulte la ruta del día para verificar el resultado."
    ],
    "visits": [
      "Visitas y servicios",
      "Consulte el trabajo previsto y los registros de ejecución.",
      "Compruebe la piscina, la fecha y si la visita es regular o extra. Abra el detalle para consultar el estado, las mediciones y el trabajo registrado."
    ],
    "technicians": [
      "Equipo técnico",
      "Consulte los técnicos y sus asignaciones.",
      "Compruebe el perfil, el estado activo y el vehículo del técnico antes de cambiar la organización del trabajo."
    ],
    "clients": [
      "Clientes",
      "Consulte y edite las fichas de los clientes.",
      "Seleccione la ficha correcta. Revise las modificaciones y espere la confirmación; compare los valores mostrados si los datos han cambiado."
    ],
    "pools": [
      "Piscinas y ficha técnica",
      "Abra la piscina y compruebe el cliente asociado.",
      "Revise los campos antes de guardar. Compruebe la asociación al cambiar el cliente y consulte el historial después de una modificación confirmada."
    ],
    "priorities": [
      "Prioridades de las piscinas",
      "Consulte las categorías Normal, Alta y Urgente.",
      "Abra la edición, elija la prioridad y guarde. Si hay una solicitud pendiente o un conflicto, use la confirmación o revisión antes de enviar otra modificación."
    ],
    "finance": [
      "Cobros y recibos",
      "Consulte saldos y registre cobros.",
      "Compruebe el cliente, el importe y el método de pago. Espere el resultado y recupere las solicitudes pendientes cuando sea necesario."
    ],
    "invoices": [
      "Facturas y documentos",
      "Consulte borradores, documentos emitidos y pagos.",
      "Revise líneas, importes y estado antes de emitir o enviar. Un borrador todavía no es un cargo. La emisión fiscal externa tiene su propio proceso."
    ],
    "alerts": [
      "Alertas y notificaciones",
      "Consulte los avisos y abra la incidencia correspondiente.",
      "Marcar un aviso como leído no resuelve su causa. Trate la incidencia en su módulo y compruebe el estado resultante."
    ],
    "map": [
      "Mapa y ubicación",
      "Consulte las posiciones y destinos disponibles.",
      "Compruebe la fecha de la última posición. Una posición antigua o una consulta fallida no confirma la ubicación actual del técnico."
    ],
    "chat": [
      "Conversaciones con clientes",
      "Seleccione el cliente y consulte la conversación.",
      "Compruebe el destinatario antes de escribir o adjuntar archivos. Espere la confirmación de envío y recupere las solicitudes pendientes en la conversación."
    ],
    "reports": [
      "Informes y exportación",
      "Elija el informe y el período deseado.",
      "Compruebe los filtros y registros incluidos. Antes de compartir un documento, revise su contenido y destinatario."
    ],
    "incidents": [
      "Incidencias",
      "Consulte los asuntos que necesitan seguimiento.",
      "Abra la incidencia y revise su descripción, estado y registros disponibles. Compruebe el resultado de cada actualización."
    ],
    "inventory": [
      "Existencias y productos",
      "Consulte productos, unidades y movimientos.",
      "Compruebe el producto, la unidad y el origen antes de registrar un movimiento. Espere la confirmación y revise el saldo actualizado."
    ],
    "customerPortal": [
      "Atención al cliente",
      "Consulte la ficha interna para ayudar al cliente.",
      "El cliente utiliza su propia sesión. Compruebe la ficha y los datos asociados antes de orientarle sobre servicios, documentos o mensajes."
    ],
    "themes": [
      "Tema y apariencia",
      "Ajuste las opciones de presentación disponibles.",
      "Elija una opción y compruebe la legibilidad y los controles en el dispositivo que utilizará."
    ],
    "vehicles": [
      "Flota, guías y existencias",
      "Consulte vehículos, documentos y materiales.",
      "Compruebe el vehículo, el origen y la validez de los documentos. Una copia guardada puede no incluir cambios recientes."
    ],
    "settings": [
      "Configuración operativa",
      "Revise las opciones generales y los avisos de mantenimiento.",
      "Confirme que se guarda cada cambio. Las preferencias de sonido de la cuenta están en la opción correspondiente del menú."
    ]
  },
  "fr": {
    "operationalFlow": [
      "Centre des opérations",
      "Consultez la journée et ouvrez les modules de travail.",
      "Vérifiez la date et l’état du chargement. Ouvrez la fiche concernée avant de prendre une décision."
    ],
    "dashboard": [
      "Tableau de bord administratif",
      "Consultez les indicateurs et résumés disponibles.",
      "Vérifiez la période et l’actualisation des données. Un échec de consultation ne signifie pas qu’il n’y a rien en attente."
    ],
    "aiAdmin": [
      "Assistant opérationnel",
      "Consultez le mode disponible, les recommandations et les propositions.",
      "Lisez les capacités affichées. Examinez chaque proposition avant approbation et vérifiez le résultat ; une recommandation n’est pas une action terminée."
    ],
    "rounds": [
      "Tournées et planification",
      "Organisez les piscines, les jours et les techniciens.",
      "Vérifiez les affectations et l’ordre avant de générer les visites. Consultez ensuite la tournée du jour pour vérifier le résultat."
    ],
    "visits": [
      "Visites et services",
      "Consultez le travail prévu et les comptes rendus.",
      "Vérifiez la piscine, la date et le type de visite, régulière ou supplémentaire. Ouvrez le détail pour consulter l’état, les mesures et le travail enregistré."
    ],
    "technicians": [
      "Équipe technique",
      "Consultez les techniciens et leurs affectations.",
      "Vérifiez le profil, le statut actif et le véhicule du technicien avant de modifier l’organisation du travail."
    ],
    "clients": [
      "Clients",
      "Consultez et modifiez les fiches clients.",
      "Sélectionnez la bonne fiche. Vérifiez les modifications et attendez la confirmation ; comparez les valeurs affichées si les données ont changé."
    ],
    "pools": [
      "Piscines et fiche technique",
      "Ouvrez une piscine et vérifiez le client associé.",
      "Vérifiez les champs avant d’enregistrer. Contrôlez l’association lors d’un changement de client et consultez l’historique après confirmation."
    ],
    "priorities": [
      "Priorités des piscines",
      "Consultez les catégories Normale, Haute et Urgente.",
      "Ouvrez la modification, choisissez la priorité et enregistrez. En cas de demande en attente ou de conflit, utilisez la confirmation ou la révision avant une nouvelle modification."
    ],
    "finance": [
      "Recouvrement et encaissements",
      "Consultez les soldes et enregistrez les encaissements.",
      "Vérifiez le client, le montant et le mode de paiement. Attendez le résultat et récupérez les demandes en attente si nécessaire."
    ],
    "invoices": [
      "Factures et documents",
      "Consultez les brouillons, documents émis et paiements.",
      "Vérifiez les lignes, montants et états avant émission ou envoi. Un brouillon ne constitue pas encore une créance. L’émission fiscale externe suit un parcours distinct."
    ],
    "alerts": [
      "Alertes et notifications",
      "Consultez les avis et ouvrez l’événement concerné.",
      "Marquer un avis comme lu ne résout pas sa cause. Traitez l’événement dans son module et vérifiez l’état obtenu."
    ],
    "map": [
      "Carte et localisation",
      "Consultez les positions et destinations disponibles.",
      "Vérifiez la date de la dernière position. Une ancienne position ou un échec de consultation ne confirme pas la localisation actuelle du technicien."
    ],
    "chat": [
      "Conversations clients",
      "Sélectionnez le client et consultez la conversation.",
      "Vérifiez le destinataire avant d’écrire ou de joindre des fichiers. Attendez la confirmation d’envoi et récupérez les demandes en attente dans la conversation."
    ],
    "reports": [
      "Rapports et exportation",
      "Choisissez un rapport et la période souhaitée.",
      "Vérifiez les filtres et les fiches incluses. Avant de partager un document, contrôlez son contenu et son destinataire."
    ],
    "incidents": [
      "Incidents",
      "Consultez les événements nécessitant un suivi.",
      "Ouvrez l’incident et examinez sa description, son état et les informations disponibles. Vérifiez le résultat de chaque mise à jour."
    ],
    "inventory": [
      "Stock et produits",
      "Consultez les produits, unités et mouvements.",
      "Vérifiez le produit, l’unité et l’origine avant d’enregistrer un mouvement. Attendez la confirmation et contrôlez le solde actualisé."
    ],
    "customerPortal": [
      "Assistance client",
      "Utilisez la fiche interne pour aider le client.",
      "Le client utilise sa propre session. Vérifiez la fiche et les données associées avant de le guider vers les services, documents ou messages."
    ],
    "themes": [
      "Thème et apparence",
      "Ajustez les options d’affichage disponibles.",
      "Choisissez une option et vérifiez la lisibilité et les commandes sur l’appareil utilisé."
    ],
    "vehicles": [
      "Flotte, guides et stock",
      "Consultez les véhicules, documents et matériels.",
      "Vérifiez le véhicule, l’origine et la validité des documents. Une copie enregistrée peut ne pas inclure les changements récents."
    ],
    "settings": [
      "Paramètres opérationnels",
      "Vérifiez les options générales et les rappels de maintenance.",
      "Confirmez l’enregistrement de chaque modification. Les préférences sonores du compte sont accessibles dans l’option correspondante du menu."
    ]
  },
  "de": {
    "operationalFlow": [
      "Betriebszentrale",
      "Prüfen Sie den Tag und öffnen Sie die Arbeitsmodule.",
      "Prüfen Sie Datum und Ladestatus. Öffnen Sie den zugehörigen Datensatz, bevor Sie eine Entscheidung treffen."
    ],
    "dashboard": [
      "Verwaltungsübersicht",
      "Sehen Sie die verfügbaren Kennzahlen und Zusammenfassungen.",
      "Prüfen Sie Zeitraum und Aktualität der Daten. Eine fehlgeschlagene Abfrage bedeutet nicht, dass keine Aufgaben offen sind."
    ],
    "aiAdmin": [
      "Betriebsassistent",
      "Prüfen Sie den verfügbaren Modus, Empfehlungen und Vorschläge.",
      "Lesen Sie die angezeigten Funktionen. Prüfen Sie jeden Vorschlag vor der Freigabe und kontrollieren Sie das Ergebnis; eine Empfehlung ist noch keine ausgeführte Aktion."
    ],
    "rounds": [
      "Routen und Planung",
      "Organisieren Sie Pools, Tage und Techniker.",
      "Prüfen Sie Zuweisungen und Reihenfolge vor dem Erstellen von Besuchen. Kontrollieren Sie danach die Tagesroute."
    ],
    "visits": [
      "Besuche und Leistungen",
      "Sehen Sie geplante Arbeiten und Ausführungsprotokolle.",
      "Prüfen Sie Pool, Datum und Besuchsart: regulär oder zusätzlich. Öffnen Sie die Details für Status, Messwerte und erfasste Arbeiten."
    ],
    "technicians": [
      "Technisches Team",
      "Sehen Sie Techniker und ihre Zuweisungen.",
      "Prüfen Sie Rolle, Aktivstatus und Fahrzeug des Technikers, bevor Sie die Arbeitsorganisation ändern."
    ],
    "clients": [
      "Kunden",
      "Sehen und bearbeiten Sie Kundendatensätze.",
      "Wählen Sie den richtigen Datensatz. Prüfen Sie Änderungen und warten Sie auf die Bestätigung; vergleichen Sie bei geänderten Daten die angezeigten Werte."
    ],
    "pools": [
      "Pools und technische Daten",
      "Öffnen Sie einen Pool und prüfen Sie den zugeordneten Kunden.",
      "Prüfen Sie die Felder vor dem Speichern. Kontrollieren Sie bei einem Kundenwechsel die Zuordnung und sehen Sie nach Bestätigung in den Verlauf."
    ],
    "priorities": [
      "Poolprioritäten",
      "Sehen Sie die Einstufungen Normal, Hoch und Dringend.",
      "Öffnen Sie die Bearbeitung, wählen Sie die Priorität und speichern Sie. Nutzen Sie bei offenen Anfragen oder Konflikten die Bestätigung beziehungsweise Prüfung vor einer weiteren Änderung."
    ],
    "finance": [
      "Forderungen und Zahlungseingänge",
      "Sehen Sie Salden und erfassen Sie Zahlungseingänge.",
      "Prüfen Sie Kunde, Betrag und Zahlungsart. Warten Sie auf das Ergebnis und stellen Sie bei Bedarf offene Anfragen wieder her."
    ],
    "invoices": [
      "Rechnungen und Dokumente",
      "Sehen Sie Entwürfe, ausgestellte Dokumente und Zahlungen.",
      "Prüfen Sie Positionen, Beträge und Status vor Ausstellung oder Versand. Ein Entwurf ist noch keine Forderung. Die externe steuerliche Ausstellung hat einen eigenen Ablauf."
    ],
    "alerts": [
      "Warnungen und Benachrichtigungen",
      "Sehen Sie Hinweise und öffnen Sie den zugehörigen Vorgang.",
      "Das Markieren als gelesen behebt nicht die Ursache. Bearbeiten Sie den Vorgang im jeweiligen Modul und prüfen Sie den neuen Status."
    ],
    "map": [
      "Karte und Standort",
      "Sehen Sie verfügbare Positionen und Ziele.",
      "Prüfen Sie den Zeitstempel der letzten Position. Eine alte Position oder fehlgeschlagene Abfrage bestätigt nicht den aktuellen Standort des Technikers."
    ],
    "chat": [
      "Kundengespräche",
      "Wählen Sie einen Kunden und öffnen Sie das Gespräch.",
      "Prüfen Sie den Empfänger vor Nachrichten oder Anhängen. Warten Sie auf die Sendebestätigung und stellen Sie offene Anfragen im Gespräch wieder her."
    ],
    "reports": [
      "Berichte und Export",
      "Wählen Sie einen Bericht und den gewünschten Zeitraum.",
      "Prüfen Sie Filter und enthaltene Datensätze. Kontrollieren Sie vor dem Teilen Inhalt und Empfänger."
    ],
    "incidents": [
      "Vorfälle",
      "Sehen Sie Vorgänge, die weitere Bearbeitung benötigen.",
      "Öffnen Sie den Vorfall und prüfen Sie Beschreibung, Status und verfügbare Aufzeichnungen. Kontrollieren Sie das Ergebnis jeder Änderung."
    ],
    "inventory": [
      "Bestand und Produkte",
      "Sehen Sie Produkte, Einheiten und Bestandsbewegungen.",
      "Prüfen Sie Produkt, Einheit und Herkunft vor einer Buchung. Warten Sie auf die Bestätigung und kontrollieren Sie den aktualisierten Bestand."
    ],
    "customerPortal": [
      "Kundenunterstützung",
      "Nutzen Sie den internen Datensatz zur Kundenbetreuung.",
      "Kunden verwenden ihre eigene Sitzung. Prüfen Sie Datensatz und zugehörige Daten, bevor Sie bei Leistungen, Dokumenten oder Nachrichten helfen."
    ],
    "themes": [
      "Design und Darstellung",
      "Passen Sie die verfügbaren Anzeigeoptionen an.",
      "Wählen Sie eine angezeigte Option und prüfen Sie Lesbarkeit und Bedienelemente auf dem verwendeten Gerät."
    ],
    "vehicles": [
      "Fuhrpark, Belege und Bestand",
      "Sehen Sie Fahrzeuge, Dokumente und Material.",
      "Prüfen Sie Fahrzeug, Herkunft und Gültigkeit der Dokumente. Eine gespeicherte Kopie enthält möglicherweise keine aktuellen Änderungen."
    ],
    "settings": [
      "Betriebseinstellungen",
      "Prüfen Sie allgemeine Optionen und Wartungshinweise.",
      "Bestätigen Sie das Speichern jeder Änderung. Die Toneinstellungen des Kontos finden Sie in der entsprechenden Menüoption."
    ]
  }
};
  const words = {
    pt: { title: 'Centro de Ajuda Cristal Water', intro: 'Guias e atalhos para o seu perfil. Use Ctrl/Cmd+K para pesquisar os atalhos.', search: 'Pesquisar ajuda', empty: 'Nenhum tópico corresponde à pesquisa.', unavailable: 'Este tópico não está disponível para o seu perfil. Escolha outro tópico.', session: 'A sessão mudou ou terminou. Abra novamente a ajuda depois de entrar na conta pretendida.', open: 'Abrir página', actions: 'Ações principais', full: 'Abrir centro completo', close: 'Fechar', command: 'Comando rápido', hover: 'Mostrar dicas ao manter o cursor', press: 'No telemóvel, mantenha o elemento premido durante três segundos.', help: 'Ajuda', helpSummary: 'Escolha um tópico ou procure um atalho.', helpDetail: 'A ajuda apresenta apenas os percursos do seu perfil. Antes de agir, confirme a conta, o dia e o registo selecionado.' },
    en: { title: 'Cristal Water Help Centre', intro: 'Guides and shortcuts for your role. Use Ctrl/Cmd+K to search shortcuts.', search: 'Search help', empty: 'No topics match your search.', unavailable: 'This topic is unavailable for your role. Choose another topic.', session: 'The session changed or ended. Reopen help after signing in to the intended account.', open: 'Open page', actions: 'Main actions', full: 'Open full help centre', close: 'Close', command: 'Quick commands', hover: 'Show tips on prolonged hover', press: 'On mobile, press and hold the element for three seconds.', help: 'Help', helpSummary: 'Choose a topic or find a shortcut.', helpDetail: 'Help shows the routes available to your role. Before acting, check the account, date and selected record.' },
    es: { title: 'Centro de ayuda Cristal Water', intro: 'Guías y accesos para su perfil. Use Ctrl/Cmd+K para buscar accesos.', search: 'Buscar ayuda', empty: 'Ningún tema coincide con la búsqueda.', unavailable: 'Este tema no está disponible para su perfil. Elija otro tema.', session: 'La sesión cambió o terminó. Abra la ayuda después de entrar en la cuenta deseada.', open: 'Abrir página', actions: 'Acciones principales', full: 'Abrir el centro completo', close: 'Cerrar', command: 'Comandos rápidos', hover: 'Mostrar consejos al mantener el cursor', press: 'En el móvil, mantenga pulsado el elemento durante tres segundos.', help: 'Ayuda', helpSummary: 'Elija un tema o busque un acceso.', helpDetail: 'La ayuda muestra las rutas de su perfil. Antes de actuar, compruebe la cuenta, la fecha y el registro seleccionado.' },
    fr: { title: 'Centre d’aide Cristal Water', intro: 'Guides et raccourcis pour votre profil. Utilisez Ctrl/Cmd+K pour chercher un raccourci.', search: 'Rechercher dans l’aide', empty: 'Aucun sujet ne correspond à la recherche.', unavailable: 'Ce sujet est indisponible pour votre profil. Choisissez un autre sujet.', session: 'La session a changé ou a expiré. Rouvrez l’aide après connexion au compte souhaité.', open: 'Ouvrir la page', actions: 'Actions principales', full: 'Ouvrir le centre complet', close: 'Fermer', command: 'Commandes rapides', hover: 'Afficher les conseils au survol prolongé', press: 'Sur mobile, maintenez l’élément enfoncé pendant trois secondes.', help: 'Aide', helpSummary: 'Choisissez un sujet ou un raccourci.', helpDetail: 'L’aide présente les parcours de votre profil. Avant toute action, vérifiez le compte, la date et la fiche sélectionnée.' },
    de: { title: 'Cristal Water Hilfezentrum', intro: 'Anleitungen und Verknüpfungen für Ihre Rolle. Suchen Sie mit Strg/Cmd+K nach Verknüpfungen.', search: 'Hilfe durchsuchen', empty: 'Keine passenden Themen gefunden.', unavailable: 'Dieses Thema ist für Ihre Rolle nicht verfügbar. Wählen Sie ein anderes Thema.', session: 'Die Sitzung wurde geändert oder beendet. Melden Sie sich mit dem gewünschten Konto an und öffnen Sie die Hilfe erneut.', open: 'Seite öffnen', actions: 'Wichtige Aktionen', full: 'Hilfezentrum öffnen', close: 'Schließen', command: 'Schnellbefehle', hover: 'Tipps bei längerem Verweilen anzeigen', press: 'Halten Sie das Element auf dem Mobilgerät drei Sekunden lang gedrückt.', help: 'Hilfe', helpSummary: 'Wählen Sie ein Thema oder eine Verknüpfung.', helpDetail: 'Die Hilfe zeigt die verfügbaren Seiten Ihrer Rolle. Prüfen Sie vor jeder Aktion Konto, Datum und ausgewählten Datensatz.' }
  };
  // Role-scoped task guides describe available routes; they do not grant API access.
  const guideCopy = {
    pt: {
      customerPortal: ['A minha piscina', 'Consulte os dados e serviços associados à sua conta.', 'Abra o portal e confirme a piscina antes de consultar os registos.'],
      reports: ['Histórico de serviços', 'Consulte as visitas e os registos disponibilizados.', 'Abra o histórico e confirme a data da visita. Uma falha de consulta não significa que não existam serviços.'],
      finance: ['Pagamentos e faturas', 'Consulte os valores e os documentos da sua conta.', 'Verifique o documento e o saldo apresentados. Se a consulta falhar, atualize antes de concluir que está tudo pago.'],
      visits: ['Rota do dia', 'Abra as visitas atribuídas e confirme o dia selecionado.', 'Confirme a piscina e o tipo de visita antes de começar. Um pedido pendente não equivale a uma conclusão confirmada pelo servidor.'],
      vehicles: ['Guias e documentos', 'Consulte os documentos e o stock da viatura.', 'Verifique a viatura, a data e a indicação de origem. Uma cópia guardada pode não refletir as alterações mais recentes.'],
      safety: ['Alertas de campo', 'Consulte os avisos durante a visita e no fecho do dia.', 'Ler ou assumir um alerta não fecha a água nem altera a bomba. Resolva a causa e confirme o registo da operação.'],
      chat: ['Mensagens', 'Abra a conversa da sua conta ou equipa.', 'Aguarde a confirmação de envio. Se a resposta se perder, use a recuperação disponibilizada na conversa.'],
      alerts: ['Notificações', 'Consulte os avisos disponíveis para a sua conta.', 'Marcar um aviso como lido não resolve a ocorrência que lhe deu origem. Abra a operação correspondente.'],
      settings: ['O meu perfil', 'Consulte a conta e as opções disponíveis.', 'Confirme a identidade antes de mudar de conta. Os rascunhos e pedidos pendentes pertencem à conta que os criou.']
    },
    en: {
      customerPortal: ['My pool', 'View the details and services linked to your account.', 'Open the portal and check the pool before viewing its records.'],
      reports: ['Service history', 'View the available visits and records.', 'Open the history and check the visit date. A failed request does not mean there are no services.'],
      finance: ['Payments and invoices', 'View amounts and documents for your account.', 'Check the document and balance shown. If loading fails, refresh before assuming everything is paid.'],
      visits: ['Daily route', 'Open assigned visits and check the selected date.', 'Check the pool and visit type before starting. A pending request is not a completion confirmed by the server.'],
      vehicles: ['Guides and documents', 'View vehicle documents and stock.', 'Check the vehicle, date and source label. A saved copy may not include the latest changes.'],
      safety: ['Field alerts', 'Review warnings during visits and at the end of the day.', 'Reading or accepting an alert does not turn off water or change a pump. Address the cause and confirm the operation record.'],
      chat: ['Messages', 'Open the conversation for your account or team.', 'Wait for send confirmation. If the response is lost, use the recovery option in the conversation.'],
      alerts: ['Notifications', 'View the notices available to your account.', 'Marking a notice as read does not resolve its cause. Open the related operation.'],
      settings: ['My profile', 'View your account and available options.', 'Check your identity before switching accounts. Drafts and pending requests belong to the account that created them.']
    },
    es: {
      customerPortal: ['Mi piscina', 'Consulte los datos y servicios de su cuenta.', 'Abra el portal y compruebe la piscina antes de consultar los registros.'],
      reports: ['Historial de servicios', 'Consulte las visitas y los registros disponibles.', 'Abra el historial y compruebe la fecha. Un error de consulta no significa que no existan servicios.'],
      finance: ['Pagos y facturas', 'Consulte los importes y documentos de su cuenta.', 'Compruebe el documento y el saldo. Si la consulta falla, actualice antes de asumir que todo está pagado.'],
      visits: ['Ruta del día', 'Abra las visitas asignadas y compruebe la fecha.', 'Compruebe la piscina y el tipo de visita. Una solicitud pendiente no equivale a una finalización confirmada por el servidor.'],
      vehicles: ['Guías y documentos', 'Consulte los documentos y el stock del vehículo.', 'Compruebe el vehículo, la fecha y el origen. Una copia guardada puede no incluir los cambios recientes.'],
      safety: ['Alertas de campo', 'Revise los avisos durante la visita y al cerrar el día.', 'Leer o asumir una alerta no cierra el agua ni cambia la bomba. Resuelva la causa y confirme el registro.'],
      chat: ['Mensajes', 'Abra la conversación de su cuenta o equipo.', 'Espere la confirmación del envío. Si se pierde la respuesta, use la recuperación disponible en la conversación.'],
      alerts: ['Notificaciones', 'Consulte los avisos de su cuenta.', 'Marcar un aviso como leído no resuelve su causa. Abra la operación correspondiente.'],
      settings: ['Mi perfil', 'Consulte la cuenta y las opciones disponibles.', 'Compruebe la identidad antes de cambiar de cuenta. Los borradores y las solicitudes pendientes pertenecen a la cuenta que los creó.']
    },
    fr: {
      customerPortal: ['Ma piscine', 'Consultez les données et services de votre compte.', 'Ouvrez le portail et vérifiez la piscine avant de consulter les fiches.'],
      reports: ['Historique des services', 'Consultez les visites et les fiches disponibles.', 'Ouvrez l’historique et vérifiez la date. Un échec de chargement ne signifie pas une absence de services.'],
      finance: ['Paiements et factures', 'Consultez les montants et documents de votre compte.', 'Vérifiez le document et le solde affichés. En cas d’échec, actualisez avant de considérer que tout est payé.'],
      visits: ['Tournée du jour', 'Ouvrez les visites attribuées et vérifiez la date.', 'Vérifiez la piscine et le type de visite. Une demande en attente ne vaut pas une clôture confirmée par le serveur.'],
      vehicles: ['Bons et documents', 'Consultez les documents et le stock du véhicule.', 'Vérifiez le véhicule, la date et la provenance. Une copie enregistrée peut ne pas inclure les dernières modifications.'],
      safety: ['Alertes de terrain', 'Consultez les avertissements pendant la visite et en fin de journée.', 'Lire ou prendre en charge une alerte ne ferme pas l’eau et ne modifie pas la pompe. Traitez la cause et confirmez l’enregistrement.'],
      chat: ['Messages', 'Ouvrez la conversation de votre compte ou équipe.', 'Attendez la confirmation de l’envoi. En cas de réponse perdue, utilisez la récupération proposée dans la conversation.'],
      alerts: ['Notifications', 'Consultez les avis de votre compte.', 'Marquer un avis comme lu ne résout pas sa cause. Ouvrez l’opération correspondante.'],
      settings: ['Mon profil', 'Consultez le compte et les options disponibles.', 'Vérifiez l’identité avant de changer de compte. Les brouillons et demandes en attente appartiennent au compte qui les a créés.']
    },
    de: {
      customerPortal: ['Mein Pool', 'Sehen Sie die Daten und Leistungen Ihres Kontos.', 'Öffnen Sie das Portal und prüfen Sie den Pool, bevor Sie die Einträge ansehen.'],
      reports: ['Serviceverlauf', 'Sehen Sie verfügbare Besuche und Einträge.', 'Öffnen Sie den Verlauf und prüfen Sie das Datum. Ein Ladefehler bedeutet nicht, dass keine Leistungen vorhanden sind.'],
      finance: ['Zahlungen und Rechnungen', 'Sehen Sie Beträge und Dokumente Ihres Kontos.', 'Prüfen Sie Dokument und Kontostand. Aktualisieren Sie nach einem Fehler, bevor Sie von vollständiger Zahlung ausgehen.'],
      visits: ['Tagesroute', 'Öffnen Sie zugewiesene Besuche und prüfen Sie das Datum.', 'Prüfen Sie Pool und Besuchsart. Eine ausstehende Anfrage ist kein vom Server bestätigter Abschluss.'],
      vehicles: ['Belege und Dokumente', 'Sehen Sie Dokumente und Fahrzeugbestand.', 'Prüfen Sie Fahrzeug, Datum und Herkunft. Eine gespeicherte Kopie enthält möglicherweise nicht die neuesten Änderungen.'],
      safety: ['Warnungen im Außendienst', 'Prüfen Sie Hinweise während des Besuchs und zum Tagesabschluss.', 'Das Lesen oder Übernehmen einer Warnung schließt kein Wasser und ändert keine Pumpe. Beheben Sie die Ursache und bestätigen Sie den Eintrag.'],
      chat: ['Nachrichten', 'Öffnen Sie die Unterhaltung Ihres Kontos oder Teams.', 'Warten Sie auf die Sendebestätigung. Bei verlorener Antwort nutzen Sie die Wiederherstellung in der Unterhaltung.'],
      alerts: ['Benachrichtigungen', 'Sehen Sie die Hinweise Ihres Kontos.', 'Das Markieren als gelesen behebt nicht die Ursache. Öffnen Sie den zugehörigen Vorgang.'],
      settings: ['Mein Profil', 'Sehen Sie Ihr Konto und die verfügbaren Optionen.', 'Prüfen Sie vor einem Kontowechsel Ihre Identität. Entwürfe und ausstehende Anfragen gehören zum Konto, das sie erstellt hat.']
    }
  };
  let language;
  try { language = localStorage.getItem('cw_language'); } catch (_) {}
  const locale = () => words[String(language || document.documentElement.lang || 'pt').slice(0, 2)] ? String(language || document.documentElement.lang || 'pt').slice(0, 2) : 'pt';
  function session() {
    try {
      const token = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || '{}');
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const role = String(payload.role || '').trim().toUpperCase(), id = Number(payload.userId || payload.id || payload.technicianId || payload.clientId);
      if (!Number.isSafeInteger(id) || id <= 0 || id !== Number(user.userId || user.id || user.technicianId || user.clientId) || role !== String(user.role || '').trim().toUpperCase() || !['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER'].includes(role) || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
      return { role, id, token };
    } catch (_) { return null; }
  }
  function currentTopics() {
    const owner = session(); if (!owner) return {};
    const text = words[locale()];
    const help = { title: text.help, summary: text.helpSummary, detail: text.helpDetail, actions: [], href: '/help-center' };
    if (owner.role === 'ADMIN') {
      const result = { help };
      for (const [key, href] of Object.entries(adminRoutes)) {
        const [title, summary, detail] = adminGuides[locale()][['aiOps', 'ai'].includes(key) ? 'aiAdmin' : key];
        result[key] = { title, summary, detail, actions: [], href, ...(['aiOps', 'ai'].includes(key) ? { aliasFor: 'aiAdmin' } : {}) };
      }
      return result;
    }
    const routes = owner.role === 'CLIENT'
      ? { customerPortal: '/client-portal', reports: '/client-history', finance: '/client-payments', chat: '/client_chat', alerts: '/client-notifications' }
      : { visits: '/technician-field-mode', vehicles: '/technician-guide', safety: '/technician-field-mode', chat: '/technician-chat', alerts: '/technician-chat#noticesTitle', settings: '/technician-profile' };
    const result = { help };
    for (const [key, href] of Object.entries(routes)) {
      const [title, summary, detail] = guideCopy[locale()][key]; result[key] = { title, summary, detail, actions: [], href };
    }
    return result;
  }
  function currentActions() {
    const owner = session(); if (!owner) return [];
    if (owner.role === 'ADMIN') {
      const guides = currentTopics();
      return ['operationalFlow', 'visits', 'clients', 'pools', 'finance', 'invoices', 'rounds', 'technicians', 'alerts', 'priorities', 'vehicles', 'inventory', 'reports', 'chat', 'map', 'aiAdmin', 'settings', 'themes', 'help']
        .map(topic => ({ topic, href: guides[topic].href, label: guides[topic].title, icon: topic === 'help' ? '?' : '→' }));
    }
    return Object.entries(currentTopics()).map(([topic, guide]) => ({ topic, href: guide.href, label: guide.title, icon: topic === 'help' ? '?' : '→' }));
  }
  window.CristalHelp = Object.freeze({ session, topics: currentTopics, actions: currentActions, words: () => words[locale()] });
  Object.defineProperty(window, 'CRISTAL_HELP_TOPICS', { configurable: true, get: currentTopics });
  Object.defineProperty(window, 'CRISTAL_QUICK_ACTIONS', { configurable: true, get: currentActions });
  window.addEventListener('cw-language-change', event => { language = event.detail?.language || 'pt'; });
  window.addEventListener('storage', event => { if (event.key === 'cw_language') language = event.newValue; });
})();
