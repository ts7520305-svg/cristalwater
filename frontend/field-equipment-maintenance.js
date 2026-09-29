(() => {
  'use strict';
  const root = document.getElementById('fieldEquipmentMaintenance'), store = window.CWFieldWriteStore;
  if (!root || !store) return;
  const messages={
  "heading": [
    "Revisões dos equipamentos",
    "Equipment maintenance",
    "Entretien des équipements",
    "Revisiones de los equipos",
    "Gerätewartung"
  ],
  "intro": [
    "Consulte o trabalho previsto e registe apenas as revisões realizadas.",
    "Consult the planned work and record only maintenance performed.",
    "Consultez le travail prévu et enregistrez uniquement les entretiens effectués.",
    "Consulte el trabajo previsto y registre solo las revisiones realizadas.",
    "Prüfen Sie die geplanten Arbeiten und erfassen Sie nur ausgeführte Wartungen."
  ],
  "refresh": [
    "Atualizar revisões",
    "Refresh maintenance",
    "Actualiser les entretiens",
    "Actualizar revisiones",
    "Wartungen aktualisieren"
  ],
  "connection": [
    "Não foi possível confirmar a ligação. O pedido continua guardado.",
    "Could not confirm the connection. The request remains saved.",
    "Impossible de confirmer la connexion. La demande reste enregistrée.",
    "No se ha podido confirmar la conexión. La solicitud sigue guardada.",
    "Die Verbindung konnte nicht bestätigt werden. Die Anfrage bleibt gespeichert."
  ],
  "materialsMissing": [
    "Materiais próprios não registados.",
    "Materials for this maintenance not recorded.",
    "Matériaux propres à cet entretien non enregistrés.",
    "Materiales de esta revisión no registrados.",
    "Materialien für diese Wartung nicht erfasst."
  ],
  "materialsNone": [
    "Sem materiais, por declaração explícita.",
    "No materials, as explicitly declared.",
    "Aucun matériau, selon une déclaration explicite.",
    "Sin materiales, según declaración expresa.",
    "Keine Materialien, ausdrücklich angegeben."
  ],
  "materialsList": [
    "Materiais declarados: {items}",
    "Declared materials: {items}",
    "Matériaux déclarés : {items}",
    "Materiales declarados: {items}",
    "Angegebene Materialien: {items}"
  ],
  "productMissing": [
    "(produto por indicar)",
    "(product not specified)",
    "(produit à préciser)",
    "(producto sin indicar)",
    "(Produkt nicht angegeben)"
  ],
  "unitMissing": [
    "(unidade por indicar)",
    "(unit not specified)",
    "(unité à préciser)",
    "(unidad sin indicar)",
    "(Einheit nicht angegeben)"
  ],
  "recordReview": [
    "registo por rever",
    "record to review",
    "enregistrement à vérifier",
    "registro por revisar",
    "Eintrag zu prüfen"
  ],
  "materialLine": [
    "{product} · {quantity} {unit}",
    "{product} · {quantity} {unit}",
    "{product} · {quantity} {unit}",
    "{product} · {quantity} {unit}",
    "{product} · {quantity} {unit}"
  ],
  "materialsWithdrawn": [
    "Declaração de materiais anulada pela administração. Os materiais utilizados estão por confirmar.",
    "Material declaration withdrawn by administration. The materials used remain unconfirmed.",
    "Déclaration de matériaux annulée par l’administration. Les matériaux utilisés restent à confirmer.",
    "Declaración de materiales anulada por administración. Los materiales utilizados están por confirmar.",
    "Materialangabe von der Verwaltung zurückgenommen. Die verwendeten Materialien sind noch zu bestätigen."
  ],
  "materialsDeclared": [
    "Materiais declarados; aguardam o fecho e os consumos da visita.",
    "Materials declared; awaiting visit closure and consumption.",
    "Matériaux déclarés ; en attente de la clôture et des consommations de la visite.",
    "Materiales declarados; pendientes del cierre y los consumos de la visita.",
    "Materialien angegeben; Besuchsabschluss und Verbrauch stehen aus."
  ],
  "materialsMatched": [
    "Quantidades compatíveis com o consumo líquido atual da visita.",
    "Quantities compatible with the current net visit consumption.",
    "Quantités compatibles avec la consommation nette actuelle de la visite.",
    "Cantidades compatibles con el consumo neto actual de la visita.",
    "Mengen stimmen mit dem aktuellen Nettoverbrauch des Besuchs überein."
  ],
  "materialsReview": [
    "Materiais por rever: a declaração, a origem ou o consumo da visita não permite confirmar a repartição.",
    "Materials to review: the declaration, source or visit consumption does not allow the allocation to be confirmed.",
    "Matériaux à vérifier : la déclaration, l’origine ou la consommation de la visite ne permet pas de confirmer la répartition.",
    "Materiales por revisar: la declaración, el origen o el consumo de la visita no permite confirmar el reparto.",
    "Materialien zu prüfen: Angabe, Herkunft oder Besuchsverbrauch erlauben keine Bestätigung der Aufteilung."
  ],
  "materialsRevision": [
    "Declaração revista pela administração; o registo original foi conservado.",
    "Declaration revised by administration; the original record was preserved.",
    "Déclaration révisée par l’administration ; l’enregistrement original a été conservé.",
    "Declaración revisada por administración; se ha conservado el registro original.",
    "Angabe von der Verwaltung überarbeitet; der ursprüngliche Eintrag wurde aufbewahrt."
  ],
  "materialComparison": [
    "{product} · {unit}: visita {visit}; total declarado nas revisões {declared}; ainda sem parcela declarada {unassigned}.",
    "{product} · {unit}: visit {visit}; total declared for maintenance {declared}; still without a declared share {unassigned}.",
    "{product} · {unit} : visite {visit} ; total déclaré pour les entretiens {declared} ; part encore non déclarée {unassigned}.",
    "{product} · {unit}: visita {visit}; total declarado en revisiones {declared}; aún sin parte declarada {unassigned}.",
    "{product} · {unit}: Besuch {visit}; insgesamt für Wartungen angegeben {declared}; noch ohne angegebenen Anteil {unassigned}."
  ],
  "materialsNotice": [
    "Esta declaração não movimenta stock nem atribui custo em euros. Inclua estas quantidades no consumo total da visita uma única vez.",
    "This declaration does not move stock or assign a cost in euros. Include these quantities in the total visit consumption only once.",
    "Cette déclaration ne modifie pas le stock et n’attribue aucun coût en euros. Incluez ces quantités une seule fois dans la consommation totale de la visite.",
    "Esta declaración no mueve existencias ni asigna un coste en euros. Incluya estas cantidades una sola vez en el consumo total de la visita.",
    "Diese Angabe verändert keinen Bestand und weist keine Kosten in Euro zu. Berücksichtigen Sie diese Mengen nur einmal im Gesamtverbrauch des Besuchs."
  ],
  "timeMissing": [
    "Tempo próprio não registado.",
    "Time for this maintenance not recorded.",
    "Temps propre à cet entretien non enregistré.",
    "Tiempo de esta revisión no registrado.",
    "Zeit für diese Wartung nicht erfasst."
  ],
  "timeInterval": [
    "Intervalo {index}: {start}{end}",
    "Interval {index}: {start}{end}",
    "Intervalle {index} : {start}{end}",
    "Intervalo {index}: {start}{end}",
    "Intervall {index}: {start}{end}"
  ],
  "timeEndMissing": [
    ". Falta marcar o fim.",
    ". The end has not been marked.",
    ". La fin reste à marquer.",
    ". Falta marcar el fin.",
    ". Das Ende muss noch markiert werden."
  ],
  "timeStart": [
    "Início: {start}{end}",
    "Start: {start}{end}",
    "Début : {start}{end}",
    "Inicio: {start}{end}",
    "Beginn: {start}{end}"
  ],
  "timeClosed": [
    "{start} → {end} · {minutes} min {seconds} s registados.",
    "{start} → {end} · {minutes} min {seconds} s recorded.",
    "{start} → {end} · {minutes} min {seconds} s enregistrés.",
    "{start} → {end} · {minutes} min {seconds} s registrados.",
    "{start} → {end} · {minutes} min {seconds} s erfasst."
  ],
  "timeTotal": [
    "{seconds} segundos efetivos; pausas excluídas.",
    "{seconds} effective seconds; pauses excluded.",
    "{seconds} secondes effectives ; pauses exclues.",
    "{seconds} segundos efectivos; pausas excluidas.",
    "{seconds} effektive Sekunden; Pausen ausgeschlossen."
  ],
  "session": [
    "A sessão mudou. Os dados da conta original foram preservados.",
    "The session changed. The original account data was preserved.",
    "La session a changé. Les données du compte d’origine ont été conservées.",
    "La sesión ha cambiado. Se han conservado los datos de la cuenta original.",
    "Die Sitzung hat sich geändert. Die Daten des ursprünglichen Kontos wurden aufbewahrt."
  ],
  "draftUnreadable": [
    "Rascunho de revisão ilegível. Preserve os dados e peça apoio ao escritório.",
    "Unreadable maintenance draft. Preserve the data and ask the office for support.",
    "Brouillon d’entretien illisible. Conservez les données et demandez de l’aide au bureau.",
    "Borrador de revisión ilegible. Conserve los datos y solicite ayuda a la oficina.",
    "Unlesbarer Wartungsentwurf. Bewahren Sie die Daten auf und bitten Sie das Büro um Hilfe."
  ],
  "draftInvalid": [
    "O rascunho de revisão precisa de verificação. Os dados foram preservados.",
    "The maintenance draft needs checking. The data was preserved.",
    "Le brouillon d’entretien doit être vérifié. Les données ont été conservées.",
    "El borrador de revisión necesita comprobación. Se han conservado los datos.",
    "Der Wartungsentwurf muss geprüft werden. Die Daten wurden aufbewahrt."
  ],
  "draftTimeInvalid": [
    "O tempo guardado precisa de verificação. Os dados foram preservados.",
    "The saved time needs checking. The data was preserved.",
    "Le temps enregistré doit être vérifié. Les données ont été conservées.",
    "El tiempo guardado necesita comprobación. Se han conservado los datos.",
    "Die gespeicherte Zeit muss geprüft werden. Die Daten wurden aufbewahrt."
  ],
  "draftMaterialsInvalid": [
    "Os materiais guardados precisam de verificação. Os dados foram preservados.",
    "The saved materials need checking. The data was preserved.",
    "Les matériaux enregistrés doivent être vérifiés. Les données ont été conservées.",
    "Los materiales guardados necesitan comprobación. Se han conservado los datos.",
    "Die gespeicherten Materialien müssen geprüft werden. Die Daten wurden aufbewahrt."
  ],
  "poolChanged": [
    "A piscina deste rascunho mudou. Preserve as notas e peça apoio ao escritório.",
    "The pool for this draft changed. Preserve the notes and ask the office for support.",
    "La piscine de ce brouillon a changé. Conservez les notes et demandez de l’aide au bureau.",
    "La piscina de este borrador ha cambiado. Conserve las notas y solicite ayuda a la oficina.",
    "Der Pool dieses Entwurfs hat sich geändert. Bewahren Sie die Notizen auf und bitten Sie das Büro um Hilfe."
  ],
  "locksUnavailable": [
    "Este navegador não permite proteger as notas entre janelas.",
    "This browser cannot protect notes across windows.",
    "Ce navigateur ne permet pas de protéger les notes entre fenêtres.",
    "Este navegador no permite proteger las notas entre ventanas.",
    "Dieser Browser kann Notizen nicht über mehrere Fenster hinweg schützen."
  ],
  "notesConflict": [
    "Outra janela alterou estas notas. Atualize para recuperar o rascunho guardado.",
    "Another window changed these notes. Refresh to recover the saved draft.",
    "Une autre fenêtre a modifié ces notes. Actualisez pour récupérer le brouillon enregistré.",
    "Otra ventana ha cambiado estas notas. Actualice para recuperar el borrador guardado.",
    "Ein anderes Fenster hat diese Notizen geändert. Aktualisieren Sie, um den gespeicherten Entwurf wiederherzustellen."
  ],
  "notesNotSaved": [
    "As notas não ficaram guardadas.",
    "The notes were not saved.",
    "Les notes n’ont pas été enregistrées.",
    "Las notas no se han guardado.",
    "Die Notizen wurden nicht gespeichert."
  ],
  "confirmFirst": [
    "Confirme primeiro o pedido guardado. As notas foram preservadas.",
    "Confirm the saved request first. The notes were preserved.",
    "Confirmez d’abord la demande enregistrée. Les notes ont été conservées.",
    "Confirme primero la solicitud guardada. Se han conservado las notas.",
    "Bestätigen Sie zuerst die gespeicherte Anfrage. Die Notizen wurden aufbewahrt."
  ],
  "discardConflict": [
    "Outra janela alterou estas notas. Atualize antes de descartar.",
    "Another window changed these notes. Refresh before discarding.",
    "Une autre fenêtre a modifié ces notes. Actualisez avant de supprimer.",
    "Otra ventana ha cambiado estas notas. Actualice antes de descartar.",
    "Ein anderes Fenster hat diese Notizen geändert. Aktualisieren Sie vor dem Verwerfen."
  ],
  "viewMismatch": [
    "A consulta não corresponde a esta visita e piscina.",
    "The view does not match this visit and pool.",
    "La consultation ne correspond pas à cette visite et à cette piscine.",
    "La consulta no corresponde a esta visita y piscina.",
    "Die Ansicht stimmt nicht mit diesem Besuch und Pool überein."
  ],
  "viewIncomplete": [
    "A lista de revisões está incompleta. Atualize antes de registar.",
    "The maintenance list is incomplete. Refresh before recording.",
    "La liste des entretiens est incomplète. Actualisez avant d’enregistrer.",
    "La lista de revisiones está incompleta. Actualice antes de registrar.",
    "Die Wartungsliste ist unvollständig. Aktualisieren Sie vor dem Erfassen."
  ],
  "cacheInvalid": [
    "Consulta guardada inválida.",
    "Invalid saved view.",
    "Consultation enregistrée invalide.",
    "Consulta guardada no válida.",
    "Ungültige gespeicherte Ansicht."
  ],
  "viewUnavailable": [
    "Consulta indisponível.",
    "View unavailable.",
    "Consultation indisponible.",
    "Consulta no disponible.",
    "Ansicht nicht verfügbar."
  ],
  "regularVisit": [
    "Visita {id}",
    "Visit {id}",
    "Visite {id}",
    "Visita {id}",
    "Besuch {id}"
  ],
  "extraVisit": [
    "Visita extra {id}",
    "Extra visit {id}",
    "Visite supplémentaire {id}",
    "Visita extra {id}",
    "Zusatzbesuch {id}"
  ],
  "regularLower": [
    "visita {id}",
    "visit {id}",
    "la visite {id}",
    "la visita {id}",
    "Besuch {id}"
  ],
  "extraLower": [
    "visita extra {id}",
    "extra visit {id}",
    "la visite supplémentaire {id}",
    "la visita extra {id}",
    "Zusatzbesuch {id}"
  ],
  "queueTitle": [
    "Revisões de equipamento por resolver",
    "Equipment maintenance to resolve",
    "Entretiens d’équipement à traiter",
    "Revisiones de equipos por resolver",
    "Zu klärende Gerätewartungen"
  ],
  "queueLabel": [
    "{visit} · {title}",
    "{visit} · {title}",
    "{visit} · {title}",
    "{visit} · {title}",
    "{visit} · {title}"
  ],
  "rejected": [
    "Revisão não aplicada. {detail}",
    "Maintenance not applied. {detail}",
    "Entretien non appliqué. {detail}",
    "Revisión no aplicada. {detail}",
    "Wartung nicht übernommen. {detail}"
  ],
  "pending": [
    "Pedido guardado; aguarda confirmação do servidor.",
    "Request saved; awaiting server confirmation.",
    "Demande enregistrée ; en attente de confirmation du serveur.",
    "Solicitud guardada; pendiente de confirmación del servidor.",
    "Anfrage gespeichert; Serverbestätigung steht aus."
  ],
  "acknowledge": [
    "Tomei conhecimento da recusa",
    "I have reviewed the rejection",
    "J’ai pris connaissance du refus",
    "He revisado el rechazo",
    "Ich habe die Ablehnung zur Kenntnis genommen"
  ],
  "retry": [
    "Repetir a mesma confirmação",
    "Repeat the same confirmation",
    "Répéter la même confirmation",
    "Repetir la misma confirmación",
    "Dieselbe Bestätigung wiederholen"
  ],
  "queueDraft": [
    "{visit} · {title}: rascunho guardado, ainda não enviado",
    "{visit} · {title}: draft saved, not sent yet",
    "{visit} · {title} : brouillon enregistré, pas encore envoyé",
    "{visit} · {title}: borrador guardado, aún no enviado",
    "{visit} · {title}: Entwurf gespeichert, noch nicht gesendet"
  ],
  "discardMaterials": [
    "Descartar rascunho com materiais",
    "Discard draft with materials",
    "Supprimer le brouillon avec matériaux",
    "Descartar borrador con materiales",
    "Entwurf mit Materialien verwerfen"
  ],
  "discardTime": [
    "Descartar notas e tempo guardados",
    "Discard saved notes and time",
    "Supprimer les notes et le temps enregistrés",
    "Descartar notas y tiempo guardados",
    "Gespeicherte Notizen und Zeit verwerfen"
  ],
  "discardNotes": [
    "Descartar notas guardadas",
    "Discard saved notes",
    "Supprimer les notes enregistrées",
    "Descartar notas guardadas",
    "Gespeicherte Notizen verwerfen"
  ],
  "empty": [
    "Sem revisões preventivas ativas para esta visita.",
    "No active preventive maintenance for this visit.",
    "Aucun entretien préventif actif pour cette visite.",
    "No hay revisiones preventivas activas para esta visita.",
    "Keine aktiven vorbeugenden Wartungen für diesen Besuch."
  ],
  "filter": [
    "Filtro",
    "Filter",
    "Filtre",
    "Filtro",
    "Filter"
  ],
  "chlorinator": [
    "Clorador",
    "Chlorinator",
    "Chlorateur",
    "Clorador",
    "Chlorinator"
  ],
  "pump": [
    "Bomba",
    "Pump",
    "Pompe",
    "Bomba",
    "Pumpe"
  ],
  "other": [
    "Outro",
    "Other",
    "Autre",
    "Otro",
    "Sonstiges"
  ],
  "overdue": [
    "Em atraso",
    "Overdue",
    "En retard",
    "Atrasada",
    "Überfällig"
  ],
  "today": [
    "Previsto para hoje",
    "Due today",
    "Prévu aujourd’hui",
    "Prevista para hoy",
    "Heute fällig"
  ],
  "next": [
    "Próxima revisão",
    "Next maintenance",
    "Prochain entretien",
    "Próxima revisión",
    "Nächste Wartung"
  ],
  "due": [
    "{state} · {date}",
    "{state} · {date}",
    "{state} · {date}",
    "{state} · {date}",
    "{state} · {date}"
  ],
  "lastExecution": [
    "Última execução: {date}",
    "Last performed: {date}",
    "Dernière exécution : {date}",
    "Última ejecución: {date}",
    "Zuletzt ausgeführt: {date}"
  ],
  "neverExecuted": [
    "Sem execução registada",
    "No execution recorded",
    "Aucune exécution enregistrée",
    "Sin ejecución registrada",
    "Keine Ausführung erfasst"
  ],
  "pendingOriginal": [
    "Resultado incerto. O pedido original foi preservado. Use a confirmação guardada acima, mesmo que o plano já tenha mudado.",
    "Uncertain result. The original request was preserved. Use the saved confirmation above, even if the plan has changed.",
    "Résultat incertain. La demande d’origine a été conservée. Utilisez la confirmation enregistrée ci-dessus, même si le plan a changé.",
    "Resultado incierto. Se ha conservado la solicitud original. Utilice la confirmación guardada arriba, aunque el plan haya cambiado.",
    "Ergebnis ungewiss. Die ursprüngliche Anfrage wurde aufbewahrt. Verwenden Sie die oben gespeicherte Bestätigung, auch wenn sich der Plan geändert hat."
  ],
  "rejectionNotice": [
    "Existe uma recusa por rever no aviso acima. As notas foram preservadas.",
    "There is a rejection to review in the notice above. The notes were preserved.",
    "Un refus reste à vérifier dans l’avis ci-dessus. Les notes ont été conservées.",
    "Hay un rechazo por revisar en el aviso de arriba. Se han conservado las notas.",
    "Im Hinweis oben ist eine Ablehnung zu prüfen. Die Notizen wurden aufbewahrt."
  ],
  "completed": [
    "Revisão já registada nesta visita.",
    "Maintenance already recorded for this visit.",
    "Entretien déjà enregistré pour cette visite.",
    "Revisión ya registrada en esta visita.",
    "Wartung für diesen Besuch bereits erfasst."
  ],
  "timeWithdrawn": [
    "Declaração de tempo anulada pela administração; tempo próprio por confirmar.",
    "Time declaration withdrawn by administration; maintenance time remains unconfirmed.",
    "Déclaration de temps annulée par l’administration ; temps propre à l’entretien à confirmer.",
    "Declaración de tiempo anulada por administración; tiempo propio por confirmar.",
    "Zeitangabe von der Verwaltung zurückgenommen; Wartungszeit noch zu bestätigen."
  ],
  "timeReview": [
    "Tempo por rever: os intervalos ou a visita de origem mudaram.",
    "Time to review: the intervals or source visit changed.",
    "Temps à vérifier : les intervalles ou la visite d’origine ont changé.",
    "Tiempo por revisar: los intervalos o la visita de origen han cambiado.",
    "Zeit zu prüfen: Intervalle oder ursprünglicher Besuch haben sich geändert."
  ],
  "timeRevision": [
    "Tempos revistos pela administração; o registo original foi conservado.",
    "Times revised by administration; the original record was preserved.",
    "Temps révisés par l’administration ; l’enregistrement original a été conservé.",
    "Tiempos revisados por administración; se ha conservado el registro original.",
    "Zeiten von der Verwaltung überarbeitet; der ursprüngliche Eintrag wurde aufbewahrt."
  ],
  "originalRecord": [
    "Registo original: {record}",
    "Original record: {record}",
    "Enregistrement original : {record}",
    "Registro original: {record}",
    "Ursprünglicher Eintrag: {record}"
  ],
  "originalReview": [
    "O registo original precisa de verificação.",
    "The original record needs checking.",
    "L’enregistrement original doit être vérifié.",
    "El registro original necesita comprobación.",
    "Der ursprüngliche Eintrag muss geprüft werden."
  ],
  "offlineReadOnly": [
    "Consulta guardada; confirme a ligação para registar trabalho.",
    "Saved view; confirm the connection to record work.",
    "Consultation enregistrée ; confirmez la connexion pour enregistrer du travail.",
    "Consulta guardada; confirme la conexión para registrar trabajo.",
    "Gespeicherte Ansicht; bestätigen Sie die Verbindung, um Arbeit zu erfassen."
  ],
  "readOnly": [
    "Esta visita não permite registar revisões neste momento.",
    "This visit does not allow maintenance to be recorded now.",
    "Cette visite ne permet pas d’enregistrer des entretiens actuellement.",
    "Esta visita no permite registrar revisiones en este momento.",
    "Für diesen Besuch können derzeit keine Wartungen erfasst werden."
  ],
  "savedNotes": [
    "Notas guardadas: {notes}",
    "Saved notes: {notes}",
    "Notes enregistrées : {notes}",
    "Notas guardadas: {notes}",
    "Gespeicherte Notizen: {notes}"
  ],
  "savedTime": [
    "Tempo guardado: {time}",
    "Saved time: {time}",
    "Temps enregistré : {time}",
    "Tiempo guardado: {time}",
    "Gespeicherte Zeit: {time}"
  ],
  "draftMaterials": [
    "Rascunho: {materials}",
    "Draft: {materials}",
    "Brouillon : {materials}",
    "Borrador: {materials}",
    "Entwurf: {materials}"
  ],
  "planUpdated": [
    "O plano foi atualizado. Reveja as instruções atuais antes de confirmar as notas guardadas.",
    "The plan was updated. Review the current instructions before confirming the saved notes.",
    "Le plan a été actualisé. Vérifiez les instructions actuelles avant de confirmer les notes enregistrées.",
    "El plan se ha actualizado. Revise las instrucciones actuales antes de confirmar las notas guardadas.",
    "Der Plan wurde aktualisiert. Prüfen Sie die aktuellen Anweisungen, bevor Sie die gespeicherten Notizen bestätigen."
  ],
  "notesLabel": [
    "Trabalho realizado / observações",
    "Work performed / observations",
    "Travail effectué / observations",
    "Trabajo realizado / observaciones",
    "Ausgeführte Arbeit / Beobachtungen"
  ],
  "timeLegend": [
    "Tempo desta revisão (opcional)",
    "Time for this maintenance (optional)",
    "Temps de cet entretien (facultatif)",
    "Tiempo de esta revisión (opcional)",
    "Zeit für diese Wartung (optional)"
  ],
  "timeHelp": [
    "Marque o início e o fim de cada período de trabalho. Retome após uma pausa, até 20 intervalos; as pausas não contam para a duração nem para o custo. Confirme as horas do dispositivo antes de enviar.",
    "Mark the start and end of each work period. Resume after a pause, up to 20 intervals; pauses do not count towards duration or cost. Check the device times before sending.",
    "Marquez le début et la fin de chaque période de travail. Reprenez après une pause, jusqu’à 20 intervalles ; les pauses ne comptent ni dans la durée ni dans le coût. Vérifiez les heures de l’appareil avant l’envoi.",
    "Marque el inicio y el fin de cada período de trabajo. Reanude después de una pausa, hasta 20 intervalos; las pausas no cuentan para la duración ni el coste. Compruebe las horas del dispositivo antes de enviar.",
    "Markieren Sie Beginn und Ende jedes Arbeitsabschnitts. Setzen Sie die Arbeit nach einer Pause fort, bis zu 20 Intervalle; Pausen zählen weder zur Dauer noch zu den Kosten. Prüfen Sie vor dem Senden die Gerätezeiten."
  ],
  "start": [
    "Marcar início",
    "Mark start",
    "Marquer le début",
    "Marcar inicio",
    "Beginn markieren"
  ],
  "end": [
    "Marcar fim",
    "Mark end",
    "Marquer la fin",
    "Marcar fin",
    "Ende markieren"
  ],
  "resume": [
    "Retomar trabalho",
    "Resume work",
    "Reprendre le travail",
    "Reanudar trabajo",
    "Arbeit fortsetzen"
  ],
  "removeTime": [
    "Remover último intervalo",
    "Remove last interval",
    "Supprimer le dernier intervalle",
    "Eliminar último intervalo",
    "Letztes Intervall entfernen"
  ],
  "clearTime": [
    "Limpar tempo registado",
    "Clear recorded time",
    "Effacer le temps enregistré",
    "Borrar tiempo registrado",
    "Erfasste Zeit löschen"
  ],
  "materialsLegend": [
    "Materiais desta revisão (opcional)",
    "Materials for this maintenance (optional)",
    "Matériaux de cet entretien (facultatif)",
    "Materiales de esta revisión (opcional)",
    "Materialien für diese Wartung (optional)"
  ],
  "materialsHelp": [
    "Declare apenas a parte usada nesta revisão. Use o nome e a unidade do consumo da visita, sem conversões. Estas quantidades já fazem parte do total da visita: não as some novamente. A declaração não retira stock nem atribui euros.",
    "Declare only the share used for this maintenance. Use the name and unit from the visit consumption, without conversions. These quantities are already part of the visit total: do not add them again. The declaration does not deduct stock or assign euros.",
    "Déclarez uniquement la part utilisée pour cet entretien. Utilisez le nom et l’unité de la consommation de la visite, sans conversion. Ces quantités font déjà partie du total de la visite : ne les ajoutez pas à nouveau. La déclaration ne déduit aucun stock et n’attribue aucun montant en euros.",
    "Declare solo la parte usada en esta revisión. Utilice el nombre y la unidad del consumo de la visita, sin conversiones. Estas cantidades ya forman parte del total de la visita: no las sume de nuevo. La declaración no descuenta existencias ni asigna euros.",
    "Geben Sie nur den für diese Wartung verwendeten Anteil an. Verwenden Sie Name und Einheit des Besuchsverbrauchs ohne Umrechnung. Diese Mengen sind bereits im Besuchsgesamtwert enthalten: addieren Sie sie nicht erneut. Die Angabe zieht keinen Bestand ab und weist keine Eurobeträge zu."
  ],
  "materialsMode": [
    "Registo de materiais",
    "Material record",
    "Enregistrement des matériaux",
    "Registro de materiales",
    "Materialerfassung"
  ],
  "modeUnset": [
    "Não registar materiais agora",
    "Do not record materials now",
    "Ne pas enregistrer de matériaux maintenant",
    "No registrar materiales ahora",
    "Jetzt keine Materialien erfassen"
  ],
  "modeNone": [
    "Confirmar sem materiais",
    "Confirm no materials",
    "Confirmer sans matériaux",
    "Confirmar sin materiales",
    "Ohne Materialien bestätigen"
  ],
  "modeDeclared": [
    "Indicar materiais usados",
    "Specify materials",
    "Matériaux utilisés",
    "Indicar materiales",
    "Materialien angeben"
  ],
  "addMaterial": [
    "Adicionar material",
    "Add material",
    "Ajouter un matériau",
    "Añadir material",
    "Material hinzufügen"
  ],
  "confirmedWork": [
    "Confirmo que executei esta revisão do equipamento.",
    "I confirm that I performed this equipment maintenance.",
    "Je confirme avoir effectué cet entretien de l’équipement.",
    "Confirmo que he realizado esta revisión del equipo.",
    "Ich bestätige, dass ich diese Gerätewartung ausgeführt habe."
  ],
  "submit": [
    "Registar revisão realizada",
    "Record completed maintenance",
    "Enregistrer l’entretien effectué",
    "Registrar revisión realizada",
    "Ausgeführte Wartung erfassen"
  ],
  "materialsSaved": [
    "Materiais guardados neste dispositivo; revisão ainda não enviada.",
    "Materials saved on this device; maintenance not sent yet.",
    "Matériaux enregistrés sur cet appareil ; entretien pas encore envoyé.",
    "Materiales guardados en este dispositivo; revisión aún no enviada.",
    "Materialien auf diesem Gerät gespeichert; Wartung noch nicht gesendet."
  ],
  "product": [
    "Produto",
    "Product",
    "Produit",
    "Producto",
    "Produkt"
  ],
  "quantity": [
    "Quantidade",
    "Quantity",
    "Quantité",
    "Cantidad",
    "Menge"
  ],
  "unit": [
    "Unidade",
    "Unit",
    "Unité",
    "Unidad",
    "Einheit"
  ],
  "indexedLabel": [
    "{label} {index}",
    "{label} {index}",
    "{label} {index}",
    "{label} {index}",
    "{label} {index}"
  ],
  "removeMaterial": [
    "Remover material {index}",
    "Remove material {index}",
    "Supprimer le matériau {index}",
    "Eliminar material {index}",
    "Material {index} entfernen"
  ],
  "modeProtected": [
    "Remova primeiro as linhas de materiais para mudar este registo. As quantidades foram preservadas.",
    "Remove the material lines first to change this record. The quantities were preserved.",
    "Supprimez d’abord les lignes de matériaux pour modifier cet enregistrement. Les quantités ont été conservées.",
    "Elimine primero las líneas de materiales para cambiar este registro. Se han conservado las cantidades.",
    "Entfernen Sie zuerst die Materialzeilen, um diesen Eintrag zu ändern. Die Mengen wurden aufbewahrt."
  ],
  "timeInvalid": [
    "Reveja os intervalos guardados antes de continuar.",
    "Review the saved intervals before continuing.",
    "Vérifiez les intervalles enregistrés avant de continuer.",
    "Revise los intervalos guardados antes de continuar.",
    "Prüfen Sie die gespeicherten Intervalle, bevor Sie fortfahren."
  ],
  "timeSaved": [
    "Tempo guardado neste dispositivo; revisão ainda não enviada.",
    "Time saved on this device; maintenance not sent yet.",
    "Temps enregistré sur cet appareil ; entretien pas encore envoyé.",
    "Tiempo guardado en este dispositivo; revisión aún no enviada.",
    "Zeit auf diesem Gerät gespeichert; Wartung noch nicht gesendet."
  ],
  "clockEnd": [
    "O relógio do dispositivo mudou. Reveja o início antes de marcar o fim.",
    "The device clock changed. Review the start before marking the end.",
    "L’horloge de l’appareil a changé. Vérifiez le début avant de marquer la fin.",
    "El reloj del dispositivo ha cambiado. Revise el inicio antes de marcar el fin.",
    "Die Geräteuhr hat sich geändert. Prüfen Sie den Beginn, bevor Sie das Ende markieren."
  ],
  "clockResume": [
    "O relógio do dispositivo mudou. O novo início tem de ser posterior ao fim guardado.",
    "The device clock changed. The new start must be after the saved end.",
    "L’horloge de l’appareil a changé. Le nouveau début doit être postérieur à la fin enregistrée.",
    "El reloj del dispositivo ha cambiado. El nuevo inicio debe ser posterior al fin guardado.",
    "Die Geräteuhr hat sich geändert. Der neue Beginn muss nach dem gespeicherten Ende liegen."
  ],
  "notesSaved": [
    "Notas guardadas neste dispositivo; revisão ainda não enviada.",
    "Notes saved on this device; maintenance not sent yet.",
    "Notes enregistrées sur cet appareil ; entretien pas encore envoyé.",
    "Notas guardadas en este dispositivo; revisión aún no enviada.",
    "Notizen auf diesem Gerät gespeichert; Wartung noch nicht gesendet."
  ],
  "uncertain": [
    "Resultado incerto. {detail}",
    "Uncertain result. {detail}",
    "Résultat incertain. {detail}",
    "Resultado incierto. {detail}",
    "Ergebnis ungewiss. {detail}"
  ],
  "confirmed": [
    "Revisão registada no servidor.",
    "Maintenance recorded on the server.",
    "Entretien enregistré sur le serveur.",
    "Revisión registrada en el servidor.",
    "Wartung auf dem Server erfasst."
  ],
  "chooseVisit": [
    "Escolha uma visita.",
    "Choose a visit.",
    "Choisissez une visite.",
    "Elija una visita.",
    "Wählen Sie einen Besuch."
  ],
  "loading": [
    "A consultar equipamentos da {visit}…",
    "Consulting equipment for {visit}…",
    "Consultation des équipements pour {visit}…",
    "Consultando equipos de {visit}…",
    "Geräte für {visit} werden abgerufen…"
  ],
  "updated": [
    "Equipamentos da {visit} atualizados.{warning}",
    "Equipment for {visit} refreshed.{warning}",
    "Équipements pour {visit} actualisés.{warning}",
    "Equipos de {visit} actualizados.{warning}",
    "Geräte für {visit} aktualisiert.{warning}"
  ],
  "cacheWarning": [
    " Não foi possível guardar a consulta para uso sem rede.",
    " Could not save the view for offline use.",
    " Impossible d’enregistrer la consultation pour une utilisation hors ligne.",
    " No se ha podido guardar la consulta para usarla sin conexión.",
    " Die Ansicht konnte nicht zur Offlinenutzung gespeichert werden."
  ],
  "cached": [
    "Consulta guardada da {visit}, de {date}. Não foi possível atualizar. {detail}",
    "Saved view for {visit}, from {date}. Could not refresh. {detail}",
    "Consultation enregistrée pour {visit}, du {date}. Actualisation impossible. {detail}",
    "Consulta guardada de {visit}, del {date}. No se ha podido actualizar. {detail}",
    "Gespeicherte Ansicht für {visit}, vom {date}. Aktualisierung nicht möglich. {detail}"
  ],
  "loadFailed": [
    "Não foi possível consultar os equipamentos da {visit}. {detail}",
    "Could not consult equipment for {visit}. {detail}",
    "Impossible de consulter les équipements pour {visit}. {detail}",
    "No se han podido consultar los equipos de {visit}. {detail}",
    "Geräte konnten nicht abgerufen werden für {visit}. {detail}"
  ]
};
  const descriptors=new WeakSet(),bindings=new WeakMap(),errorCopies=new WeakMap();
  const languages=['pt','en','fr','es','de'],locales=['pt-PT','en-GB','fr-FR','es-ES','de-DE'];
  const descriptor=value=>{descriptors.add(value);return value;};
  const copy=(key,params={})=>descriptor({key,params});
  const dateCopy=(value,options={})=>descriptor({kind:'date',value,options});
  const numberCopy=(value,options={})=>descriptor({kind:'number',value,options});
  const joinCopy=(values,separator)=>descriptor({kind:'join',values,separator});
  function text(value,language=document.documentElement.lang||'pt') {
    if(!value||typeof value!=='object'||!descriptors.has(value))return String(value);
    const index=Math.max(0,languages.indexOf(String(language).toLowerCase().split('-')[0]));
    if(value.kind==='date')return new Date(value.value).toLocaleString(locales[index],value.options);
    if(value.kind==='number')return value.value.toLocaleString(locales[index],value.options);
    if(value.kind==='join')return value.values.map(part=>text(part,language)).join(value.separator);
    if(value.translations)return value.translations[languages[index]];
    return messages[value.key][index].replace(/\{(\w+)\}/g,(_,key)=>text(value.params[key],language));
  }
  function setCopy(element,value) {
    let binding=bindings.get(element);
    if(!binding||binding.node.parentNode!==element){binding={node:document.createTextNode(''),value};element.replaceChildren(binding.node);bindings.set(element,binding);}
    binding.value=value;const rendered=text(value);if(binding.node.nodeValue!==rendered)binding.node.nodeValue=rendered;
    element.setAttribute('data-cw-equipment-copy','');element.setAttribute('data-cw-no-i18n','');
  }
  function repaintCopy(){for(const element of document.querySelectorAll('[data-cw-equipment-copy]')){const binding=bindings.get(element);if(binding?.node.parentNode===element){const rendered=text(binding.value);if(binding.node.nodeValue!==rendered)binding.node.nodeValue=rendered;}}}
  function ownError(key){const value=copy(key),error=Error(text(value,'pt'));errorCopies.set(error,value);return error;}
  function errorCopy(error){
    const own=errorCopies.get(error);if(own)return own;
    if(error.copy?.key==='fieldWriteError'&&typeof error.copy.params?.code==='string')return descriptor({translations:Object.freeze(Object.fromEntries(languages.map(language=>[language,store.message(error.copy.params.code,language)])))});
    return error.message;
  }
  const scope = 'EQUIPMENT_MAINTENANCE', captured = store.session();
  const list = document.getElementById('fieldEquipmentList'), status = document.getElementById('fieldEquipmentStatus'), refresh = document.getElementById('fieldEquipmentRefresh');
  const queue = document.createElement('aside'); queue.id = 'cwEquipmentSyncStatus'; queue.className = 'card'; queue.hidden = true; root.before(queue);
  let selected = null, revision = 0, busy = false, syncing = false, closed = false, queueRevision = 0;
  const prefix = `cwEquipmentDraft:v1:${captured?.owner}:`, states = new Map();
  const explain = value => /Failed to fetch|NetworkError|Load failed|fetch.*failed|aborted|timed out/i.test(text(value,'pt')) ? copy('connection') : value;
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const times=store.equipmentTimes,lastTime=value=>times(value).at(-1);
  const validTime=value=>{try{store.equipmentTime(value,true);return true;}catch(_){return false;}};
  const storedTimeInput=v=>Array.isArray(v?.intervals)?{intervals:v.intervals.map(w=>({startAt:w?.startAt,endAt:w?.endAt}))}:{startAt:v?.startAt,endAt:v?.endAt};
  const sameTime=(a,b)=>!a&&!b||!!a&&!!b&&JSON.stringify(store.equipmentTime(a,true))===JSON.stringify(store.equipmentTime(b,true));
  const validMaterialDraft = value => value && ['NONE', 'DECLARED'].includes(value.mode) && Array.isArray(value.items) && value.items.length <= 20 && Object.keys(value).length === 2 && value.items.every(item => item && Object.keys(item).length === 3 && [['productName', 160], ['unit', 24], ['quantity', 30]].every(([key, max]) => typeof item[key] === 'string' && item[key].length <= max)) && (value.mode !== 'NONE' || !value.items.length);
  const hasDraft = draft => draft.notes.trim() || draft.workTime || draft.materials;
  function sameMaterials(a, b) { try { return !a && !b || !!a && !!b && JSON.stringify(store.equipmentMaterials(a)) === JSON.stringify(store.equipmentMaterials(b)); } catch (_) { return false; } }
  const acknowledgedDraft = (row, draft) => row.response.applied && row.payload.notes.trim() === draft.notes.trim() && sameTime(row.payload.workTime, draft.workTime) && sameMaterials(row.payload.materials, draft.materials);
  function materialsText(value) {
    if (!value) return copy('materialsMissing');
    if (value.mode === 'NONE') return copy('materialsNone');
    return copy('materialsList',{items:Array.isArray(value.items)?joinCopy(value.items.map(item=>copy('materialLine',{product:item.productName||copy('productMissing'),quantity:item.quantity||'?',unit:item.unit||copy('unitMissing')})),'; '):copy('recordReview')});
  }
  function materialsView(saved, parent) {
    const box = node('div', null, parent); box.className = 'field-equipment-material-view'; box.style.overflowWrap = 'anywhere';
    node('p', ({ MISSING: copy('materialsMissing'), WITHDRAWN: copy('materialsWithdrawn'), NONE: copy('materialsNone'), DECLARED: copy('materialsDeclared'), MATCHED: copy('materialsMatched'), REVIEW: copy('materialsReview') })[saved?.state] || copy('materialsMissing'), box);
    if (saved?.revision) node('p', copy('materialsRevision'), box);
    if (saved?.record?.mode === 'DECLARED') node('p', materialsText(saved.record), box);
    if (saved?.state === 'MATCHED') for (const line of saved.comparison?.lines || []) node('p', copy('materialComparison',{product:line.productName,unit:line.unit,visit:line.visitQuantity,declared:line.declaredMaintenanceQuantity,unassigned:line.unassignedQuantity}), box);
    if (saved?.record?.mode === 'DECLARED') node('small', copy('materialsNotice'), box);
  }
  function timeText(value) {
    const format = at => dateCopy(at,{timeZoneName:'short'});
    if (!value) return copy('timeMissing');
    if(value.intervals){const ms=value.intervals.reduce((sum,w)=>sum+(w.endAt?Date.parse(w.endAt)-Date.parse(w.startAt):0),0);return joinCopy([...value.intervals.map((w,i)=>copy('timeInterval',{index:i+1,start:format(w.startAt),end:w.endAt?joinCopy([' → ',format(w.endAt)],''):copy('timeEndMissing')})),copy('timeTotal',{seconds:numberCopy(ms/1000,{maximumFractionDigits:3})})],'\n');}
    if (!value.endAt) return copy('timeStart',{start:format(value.startAt),end:copy('timeEndMissing')});
    const seconds = Math.floor((Date.parse(value.endAt) - Date.parse(value.startAt)) / 1000);
    return copy('timeClosed',{start:format(value.startAt),end:format(value.endAt),minutes:Math.floor(seconds/60),seconds:seconds%60});
  }
  const key = visit => `${visit.visitType}:${visit.visitId}`;
  const sameVisit = (a, b) => a && b && key(a) === key(b) && a.poolId === b.poolId;
  const node = (tag, value, parent) => { const n = document.createElement(tag); if (value != null) setCopy(n,value); if (parent) parent.append(n); return n; };
  function protect() {
    if (!captured || !store.same(captured)) { closed = true; ++revision; ++queueRevision; root.hidden = queue.hidden = true; list.replaceChildren(); queue.replaceChildren(); return false; }
    return !closed;
  }
  function valid(visit, rev) { return protect() && sameVisit(visit, selected) && rev === revision; }
  function assertSession() { if (!protect()) throw ownError('session'); }
  function label(visit, lower = false) { return copy(visit.visitType==='EXTRA'?(lower?'extraLower':'extraVisit'):(lower?'regularLower':'regularVisit'),{id:visit.visitId}); }
  function draftKey(visit, planId) { return prefix + key(visit) + ':' + planId; }
  function parseDraft(raw, storageKey) {
    let draft; try { draft = JSON.parse(raw); } catch (_) { throw ownError('draftUnreadable'); }
    if (draft?.v !== 1 || draft.owner !== captured.owner || !['REGULAR','EXTRA'].includes(draft.visitType) || !positive(draft.visitId) || !positive(draft.poolId) || !positive(draft.planId) || !positive(draft.expectedVersion) || !positive(draft.revision) || typeof draft.notes !== 'string' || draft.notes.length > 3000 || typeof draft.title !== 'string' || draftKey(draft, draft.planId) !== storageKey) throw ownError('draftInvalid');
    if (Object.hasOwn(draft, 'workTime') && !validTime(draft.workTime)) throw ownError('draftTimeInvalid');
    if (Object.hasOwn(draft, 'materials') && !validMaterialDraft(draft.materials)) throw ownError('draftMaterialsInvalid');
    return draft;
  }
  function draftState(visit, plan) {
    const storageKey = draftKey(visit, plan.id), raw = localStorage.getItem(storageKey), draft = raw ? parseDraft(raw, storageKey) : null;
    if (draft && draft.poolId !== visit.poolId) throw ownError('poolChanged');
    const state = { storageKey, raw, draft, saving: Promise.resolve(), failed: false, visit, plan };
    states.set(storageKey, state); return state;
  }
  function saveDraft(state, notes, workTime, materials) {
    const value = { v: 1, owner: captured.owner, ...state.visit, planId: state.plan.id, expectedVersion: state.plan.version, title: state.plan.title, notes, ...(workTime ? { workTime } : {}), ...(materials ? { materials: structuredClone(materials) } : {}) };
    state.saving = state.saving.then(async () => {
      assertSession(); if (!navigator.locks?.request) throw ownError('locksUnavailable');
      await navigator.locks.request(state.storageKey, async () => {
        assertSession(); if (localStorage.getItem(state.storageKey) !== state.raw) throw ownError('notesConflict');
        const next = JSON.stringify({ ...value, revision: (state.draft?.revision || 0) + 1 });
        localStorage.setItem(state.storageKey, next); if (localStorage.getItem(state.storageKey) !== next) throw ownError('notesNotSaved');
        state.raw = next; state.draft = JSON.parse(next);
      });
    });
    state.saving.catch(() => { state.failed = true; }); return state.saving;
  }
  function matching(row, draft) { return row.resourceId === draft.planId && sameVisit(row.payload, draft); }
  async function cleanConfirmed(row) {
    if (row.response?.applied !== true) return;
    const storageKey = draftKey(row.payload, row.resourceId);
    if (!navigator.locks?.request) return;
    await navigator.locks.request(storageKey, async () => {
      assertSession(); const raw = localStorage.getItem(storageKey); if (!raw) return;
      const draft = parseDraft(raw, storageKey);
      if (matching(row, draft) && acknowledgedDraft(row, draft)) { localStorage.removeItem(storageKey); states.delete(storageKey); }
    });
  }
  async function discardDraft(storageKey, raw) {
    assertSession(); const draft = parseDraft(raw, storageKey);
    if ((await store.records(scope, captured)).some(row => matching(row, draft))) throw ownError('confirmFirst');
    if (!navigator.locks?.request) throw ownError('locksUnavailable');
    await navigator.locks.request(storageKey, async () => {
      assertSession(); if (localStorage.getItem(storageKey) !== raw) throw ownError('discardConflict');
      localStorage.removeItem(storageKey); states.delete(storageKey);
    });
    if (sameVisit(draft, selected)) await load();
    await renderQueue();
  }
  const summaryMessages = {
    regularVisit: ['Visita {id}','Visit {id}','Visite {id}','Visita {id}','Besuch {id}'],
    extraVisit: ['Visita extra {id}','Extra visit {id}','Visite supplémentaire {id}','Visita extra {id}','Zusatzbesuch {id}'],
    pending: ['{visit} — {title}: revisão por confirmar no servidor{blocked}.','{visit} — {title}: maintenance awaiting server confirmation{blocked}.','{visit} — {title}: entretien à confirmer sur le serveur{blocked}.','{visit} — {title}: revisión pendiente de confirmación en el servidor{blocked}.','{visit} — {title}: Wartung wartet auf Serverbestätigung{blocked}.'],
    blocked: ['; precisa de apoio do escritório','; office support needed','; aide du bureau nécessaire','; necesita apoyo de la oficina','; Unterstützung durch das Büro erforderlich'],
    rejected: ['{visit} — revisão não aplicada: {message}','{visit} — maintenance not applied: {message}','{visit} — entretien non appliqué : {message}','{visit} — revisión no aplicada: {message}','{visit} — Wartung nicht übernommen: {message}'],
    draft: ['{visit} — {title}: rascunho de revisão guardado, ainda não enviado.','{visit} — {title}: maintenance draft saved, not sent yet.','{visit} — {title}: brouillon d’entretien enregistré, pas encore envoyé.','{visit} — {title}: borrador de revisión guardado, aún no enviado.','{visit} — {title}: Wartungsentwurf gespeichert, noch nicht gesendet.']
  };
  const summaryText = (key, parameters, index) => summaryMessages[key][index].replace(/\{(\w+)\}/g, (_, name) => String(parameters[name]));
  function summaryItem(key, visit, parameters = {}) {
    const reviewText = Object.freeze(Object.fromEntries(['pt','en','fr','es','de'].map((language, index) => [language, summaryText(key, {
      ...parameters, visit: summaryText(visit.visitType === 'EXTRA' ? 'extraVisit' : 'regularVisit', {id:visit.visitId}, index),
      blocked: parameters.blocked ? summaryMessages.blocked[index] : ''
    }, index)])));
    // Preserve the existing Portuguese JSON; the review selects from captured
    // strings without retaining callbacks, records or mutable draft objects.
    const item = {kind:'pending', text:reviewText.pt};
    Object.defineProperty(item, 'reviewText', {value:reviewText});
    return item;
  }
  async function pendingSummary() {
    assertSession(); const rows = await store.records(scope, captured, true), result = [];
    for (const row of rows) {
      if (!row.response) result.push(summaryItem('pending', row.payload, {title:row.label, blocked:row.failure?.blocked}));
      else if (row.response.applied === false && !row.reviewedAt) result.push(summaryItem('rejected', row.payload, {message:row.response.message}));
    }
    for (const storageKey of Object.keys(localStorage).filter(name => name.startsWith(prefix))) {
      const draft = parseDraft(localStorage.getItem(storageKey), storageKey);
      if (hasDraft(draft) && !rows.some(row => matching(row, draft) && (!row.response || acknowledgedDraft(row, draft)))) result.push(summaryItem('draft', draft, {title:draft.title}));
    }
    assertSession(); return result;
  }
  async function renderQueue() {
    const rev = ++queueRevision; if (!protect()) return;
    try {
      const all = await store.records(scope, captured, true);
      const rows = all.filter(row => !row.response || (row.response.applied === false && !row.reviewedAt));
      const drafts = Object.keys(localStorage).filter(name => name.startsWith(prefix)).map(storageKey => { const raw = localStorage.getItem(storageKey); return { storageKey, raw, draft: parseDraft(raw, storageKey) }; }).filter(({draft}) => hasDraft(draft) && !all.some(row => matching(row, draft) && (!row.response || acknowledgedDraft(row, draft))));
      if (!protect() || rev !== queueRevision) return;
      queue.replaceChildren(); queue.hidden = !rows.length && !drafts.length; if (queue.hidden) return;
      node('h2', copy('queueTitle'), queue);
      for (const row of rows) {
        const article = node('div', null, queue); node('p', copy('queueLabel',{visit:label(row.payload),title:row.label}), article);
        node('p', row.response ? copy('rejected',{detail:row.response.message}) : explain(row.failure?.message || copy('pending')), article);
        const action = node('button', row.response ? copy('acknowledge') : copy('retry'), article); action.type = 'button'; action.style.minHeight = '44px'; action.disabled = syncing || busy;
        action.onclick = async () => {
          action.disabled = true;
          try { if (row.response) await store.acknowledgeRejection(row.requestId, captured); else { await send(row); if (sameVisit(row.payload, selected)) await load(true); } }
          catch (error) { if (protect()) node('p', explain(errorCopy(error)), article); }
          finally { if (protect()) { action.disabled = false; await renderQueue(); } }
        };
      }
      for (const {storageKey, raw, draft} of drafts) {
        const details = node('details', null, queue); node('summary', copy('queueDraft',{visit:label(draft),title:draft.title}), details); node('p', draft.notes, details);
        if (draft.workTime) node('p', timeText(draft.workTime), details);
        if (draft.materials) node('p', materialsText(draft.materials), details);
        const discard = node('button', draft.materials ? copy('discardMaterials') : draft.workTime ? copy('discardTime') : copy('discardNotes'), details); discard.type = 'button'; discard.style.minHeight = '44px';
        discard.onclick = async () => { discard.disabled = true; try { await discardDraft(storageKey, raw); } catch (error) { if (protect()) { node('p', errorCopy(error), details); discard.disabled = false; } } };
      }
    } catch (error) { if (protect() && rev === queueRevision) { queue.hidden = false; queue.replaceChildren(); node('p', errorCopy(error), queue); } }
  }
  function validateView(data, visit) {
    if (data?.ok !== true || data.visitId !== visit.visitId || data.visitType !== visit.visitType || data.poolId !== visit.poolId || typeof data.canComplete !== 'boolean' || !Array.isArray(data.plans)) throw ownError('viewMismatch');
    const ids = new Set();
    for (const p of data.plans) {
      if (!positive(p.id) || ids.has(p.id) || p.poolId !== visit.poolId || !positive(p.version) || !['FILTER','CHLORINATOR','PUMP','OTHER'].includes(p.component) || typeof p.title !== 'string' || typeof p.instructions !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.nextDue) || typeof p.active !== 'boolean' || typeof p.completedInVisit !== 'boolean' || typeof p.canComplete !== 'boolean') throw ownError('viewIncomplete');
      ids.add(p.id);
    }
    return data;
  }
  const cacheKey = visit => `cwEquipmentCache:v1:${captured.owner}:${key(visit)}`;
  function cached(visit) {
    const raw = localStorage.getItem(cacheKey(visit)); if (!raw) return null;
    const saved = JSON.parse(raw); if (saved.owner !== captured.owner || !Number.isFinite(Date.parse(saved.at))) throw ownError('cacheInvalid');
    validateView(saved.data, visit); return saved;
  }
  function render(data, visit, rev, rows, offline) {
    list.replaceChildren();
    const plans = data.plans.filter(p => p.active || p.completedInVisit).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
    if (!plans.length) { node('p', copy('empty'), list); return; }
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    for (const plan of plans) {
      const card = node('article', null, list); card.className = 'field-equipment-plan';
      node('h3', plan.title, card); node('p', ({ FILTER: copy('filter'), CHLORINATOR: copy('chlorinator'), PUMP: copy('pump'), OTHER: copy('other') })[plan.component], card);
      node('strong', copy('due',{state:plan.nextDue < today ? copy('overdue') : plan.nextDue === today ? copy('today') : copy('next'),date:plan.nextDue}), card);
      node('p', plan.instructions, card); node('p', copy('lastExecution',{date:plan.lastCompletedAt?dateCopy(plan.lastCompletedAt):copy('neverExecuted')}), card);
      const related = rows.filter(row => row.resourceId === plan.id && sameVisit(row.payload, visit)), pending = related.find(row => !row.response);
      if (pending) { node('p', copy('pendingOriginal'), card); continue; }
      if (related.some(row => row.response.applied === false && !row.reviewedAt)) node('p', copy('rejectionNotice'), card);
      let state; try { state = draftState(visit, plan); } catch (error) { node('p', errorCopy(error), card); continue; }
      if (plan.completedInVisit) {
        node('p', copy('completed'), card);
        const saved = plan.completion?.workTime;
        node('p',saved?.state==='WITHDRAWN'?copy('timeWithdrawn'):saved?.state==='REVIEW'?copy('timeReview'):timeText(saved?.record),card);
        if(saved?.revision){node('p',copy('timeRevision'),card);if(saved.original)node('p',validTime(storedTimeInput(saved.original))?copy('originalRecord',{record:timeText(saved.original)}):copy('originalReview'),card);}
        if (saved?.state === 'REVIEW' && validTime(storedTimeInput(saved.record))) node('p', copy('originalRecord',{record:timeText(saved.record)}), card);
        materialsView(plan.completion?.materials, card);
      }
      if (offline || !data.canComplete || !plan.canComplete || plan.completedInVisit) {
        if (!plan.completedInVisit) node('p', offline ? copy('offlineReadOnly') : copy('readOnly'), card);
        if (state.draft?.notes) node('p', copy('savedNotes',{notes:state.draft.notes}), card);
        if (state.draft?.workTime) node('p', copy('savedTime',{time:timeText(state.draft.workTime)}), card);
        if (state.draft?.materials) node('p', copy('draftMaterials',{materials:materialsText(state.draft.materials)}), card);
        continue;
      }
      if (state.draft && state.draft.expectedVersion !== plan.version) node('p', copy('planUpdated'), card);
      const notesLabel = node('label', copy('notesLabel'), card), notes = node('textarea', null, notesLabel); notes.rows = 2; notes.maxLength = 3000; notes.value = state.draft?.notes || '';
      let workTime = state.draft?.workTime || null;
      let materials = state.draft?.materials || null;
      const timeBox = node('fieldset', null, card); timeBox.className = 'field-equipment-time';
      node('legend', copy('timeLegend'), timeBox);
      node('p', copy('timeHelp'), timeBox);
      const timeStatus = node('p', null, timeBox); timeStatus.setAttribute('role', 'status');timeStatus.style.whiteSpace='pre-line';timeStatus.style.overflowWrap='anywhere';
      const start=node('button',copy('start'),timeBox),end=node('button',copy('end'),timeBox),resume=node('button',copy('resume'),timeBox),removeTime=node('button',copy('removeTime'),timeBox),clear=node('button',copy('clearTime'),timeBox);
      for (const button of [start, end, resume, removeTime, clear]) button.type = 'button';
      const materialBox = node('fieldset', null, card); materialBox.className = 'field-equipment-materials'; materialBox.style.minWidth = '0';
      node('legend', copy('materialsLegend'), materialBox);
      node('p', copy('materialsHelp'), materialBox);
      const modeLabel = node('label', copy('materialsMode'), materialBox), materialMode = node('select', null, modeLabel);
      materialMode.style.cssText = 'display:block;width:100%;min-width:0';
      for (const [value, text] of [['', copy('modeUnset')], ['NONE', copy('modeNone')], ['DECLARED', copy('modeDeclared')]]) { const option = node('option', text, materialMode); option.value = value; }
      materialMode.value = materials?.mode || '';
      const materialRows = node('div', null, materialBox), addMaterial = node('button', copy('addMaterial'), materialBox), materialStatus = node('p', null, materialBox); addMaterial.type = 'button'; materialStatus.setAttribute('role', 'status');
      const checkLabel = node('label', null, card); checkLabel.className = 'field-equipment-check';
      const check = node('input', null, checkLabel); check.type = 'checkbox'; node('span', copy('confirmedWork'), checkLabel);
      const action = node('button', copy('submit'), card); action.type = 'button'; action.disabled = true;
      const ready = () => {
        let materialValid = true; try { if (materials) store.equipmentMaterials(materials); setCopy(materialStatus,''); } catch (error) { materialValid = false; setCopy(materialStatus,errorCopy(error)); }
        action.disabled = !check.checked || notes.value.trim().length < 3 || busy || state.failed || !!workTime && !lastTime(workTime)?.endAt || !materialValid;
        start.disabled = busy || state.failed || !!workTime; end.disabled = busy || state.failed || !workTime || !!lastTime(workTime)?.endAt; clear.disabled = busy || state.failed || !workTime;
        resume.disabled=busy||state.failed||!lastTime(workTime)?.endAt||times(workTime).length>=20;resume.hidden=!workTime;removeTime.hidden=times(workTime).length<2;removeTime.disabled=busy||state.failed;
        materialMode.disabled = busy || state.failed; addMaterial.disabled = busy || state.failed || (materials?.items.length || 0) >= 20; addMaterial.hidden = materials?.mode !== 'DECLARED';
        materialRows.querySelectorAll('input,button').forEach(input => { input.disabled = busy || state.failed; });
        setCopy(timeStatus,timeText(workTime));
      };
      const saveMaterials = () => {
        check.checked = false; ready();
        saveDraft(state, notes.value, workTime, materials).then(() => { if (valid(visit, rev)) { setCopy(status,copy('materialsSaved')); renderQueue(); } }).catch(error => { if (valid(visit, rev)) { setCopy(status,errorCopy(error)); ready(); } });
      };
      function renderMaterials() {
        materialRows.replaceChildren();
        for (const [index, item] of (materials?.mode === 'DECLARED' ? materials.items : []).entries()) {
          const line = node('div', null, materialRows); line.className = 'field-equipment-material-line'; line.style.cssText = 'display:grid;gap:8px;min-width:0;margin:12px 0';
          for (const [field, text, limit] of [['productName', copy('product'), 160], ['quantity', copy('quantity'), 30], ['unit', copy('unit'), 24]]) {
            const label = node('label', copy('indexedLabel',{label:text,index:index+1}), line), input = node('input', null, label); input.type = 'text'; input.maxLength = limit; input.value = item[field]; input.dataset.materialField = field; input.style.cssText = 'display:block;width:100%;min-width:0;box-sizing:border-box'; if (field === 'quantity') input.inputMode = 'decimal';
            input.oninput = () => { if (busy || !valid(visit, rev)) return; materials = { ...materials, items: materials.items.map((row, i) => i === index ? { ...row, [field]: field === 'quantity' ? input.value.replace(',', '.') : input.value } : row) }; saveMaterials(); };
          }
          const remove = node('button', copy('removeMaterial',{index:index+1}), line); remove.type = 'button'; remove.onclick = () => { if (busy || !valid(visit, rev)) return; materials = { ...materials, items: materials.items.filter((_, i) => i !== index) }; renderMaterials(); saveMaterials(); };
        }
        ready();
      }
      materialMode.onchange = () => {
        if (busy || !valid(visit, rev)) return;
        if (materials?.items.some(item => Object.values(item).some(value => value.trim())) && materialMode.value !== 'DECLARED') { materialMode.value = materials.mode; setCopy(status,copy('modeProtected')); return; }
        materials = materialMode.value ? { mode: materialMode.value, items: materialMode.value === 'DECLARED' ? [{ productName: '', unit: '', quantity: '' }] : [] } : null;
        renderMaterials(); saveMaterials();
      };
      addMaterial.onclick = () => { if (busy || !valid(visit, rev) || materials?.mode !== 'DECLARED' || materials.items.length >= 20) return; materials = { ...materials, items: [...materials.items, { productName: '', unit: '', quantity: '' }] }; renderMaterials(); saveMaterials(); };
      renderMaterials();
      const saveTime = async next => {
        if (busy || !valid(visit, rev)) return;
        if(next&&!validTime(next)){setCopy(status,copy('timeInvalid'));return;}
        workTime = next; check.checked = false; ready();
        try { await saveDraft(state, notes.value, workTime, materials); if (valid(visit, rev)) { setCopy(status,copy('timeSaved')); await renderQueue(); } }
        catch (error) { if (valid(visit, rev)) { setCopy(status,errorCopy(error)); ready(); } }
      };
      start.onclick = () => saveTime({ startAt: new Date().toISOString(), endAt: null });
      end.onclick=()=>{const endAt=new Date().toISOString(),last=lastTime(workTime);if(!last||Date.parse(endAt)<=Date.parse(last.startAt)){setCopy(status,copy('clockEnd'));return;}return saveTime(workTime.intervals?{intervals:times(workTime).map((w,i,a)=>i===a.length-1?{...w,endAt}:w)}:{...workTime,endAt});};
      resume.onclick=()=>{const startAt=new Date().toISOString(),last=lastTime(workTime);if(!last?.endAt||times(workTime).length>=20)return;if(Date.parse(startAt)<Date.parse(last.endAt)){setCopy(status,copy('clockResume'));return;}return saveTime({intervals:[...times(workTime),{startAt,endAt:null}]});};
      removeTime.onclick=()=>{const remaining=times(workTime).slice(0,-1);return saveTime(remaining.length>1?{intervals:remaining}:remaining[0]||null);};
      clear.onclick = () => saveTime(null);
      ready();
      notes.oninput = () => {
        ready(); saveDraft(state, notes.value, workTime, materials).then(() => { if (valid(visit, rev)) setCopy(status,copy('notesSaved')); }).catch(error => { if (valid(visit, rev)) { setCopy(status,errorCopy(error)); ready(); } });
      };
      check.onchange = ready;
      action.onclick = async () => {
        if (busy || !check.checked || !valid(visit, rev)) return;
        const confirmedNotes = notes.value.trim(); let prepared = false;
        busy = true; ready(); refresh.disabled = true; notes.disabled = check.disabled = true;
        try {
          await saveDraft(state, confirmedNotes, workTime, materials); if (!valid(visit, rev)) return;
          const row = await store.prepare(scope, plan.id, { visitType: visit.visitType, visitId: visit.visitId, poolId: visit.poolId, expectedVersion: plan.version, notes: confirmedNotes, confirmed: true, ...(workTime ? { workTime } : {}), ...(materials ? { materials: store.equipmentMaterials(materials) } : {}) }, { label: plan.title }, captured);
          prepared = true;
          await send(row);
        } catch (error) { if (valid(visit, rev)) setCopy(status,copy('uncertain',{detail:explain(errorCopy(error))})); }
        finally { busy = false; if (valid(visit, rev)) { ready(); refresh.disabled = false; notes.disabled = check.disabled = false; } await renderQueue(); if (prepared && protect() && sameVisit(visit, selected)) await load(true); }
      };
    }
  }
  async function send(row, automatic = false) {
    const result = await store.send(row.requestId, captured, { automatic });
    const saved = await store.get(row.requestId, captured); await cleanConfirmed(saved);
    if (protect() && sameVisit(row.payload, selected)) setCopy(status,result.applied ? copy('confirmed') : copy('rejected',{detail:result.message}));
    return result;
  }
  async function load(preserve = false) {
    const visit = selected, rev = ++revision; if (!protect()) return;
    refresh.disabled = true; list.replaceChildren();
    if (!visit) { setCopy(status,copy('chooseVisit')); refresh.disabled = false; return; }
    if (!preserve) setCopy(status,copy('loading',{visit:label(visit,true)}));
    try {
      const response = await fetch(`/api/equipment-maintenance/visits/${visit.visitId}?visitType=${visit.visitType}`, { cache: 'no-store', headers: { Authorization: 'Bearer ' + captured.token }, signal: AbortSignal.timeout(12000) });
      const data = await response.json(); if (!valid(visit, rev)) return;
      if (response.status !== 200) throw Object.assign((data.error ? Error(data.error) : ownError('viewUnavailable')), { status: response.status });
      validateView(data, visit);
      const rows = await store.records(scope, captured, true); if (!valid(visit, rev)) return;
      for (const row of rows) await cleanConfirmed(row); if (!valid(visit, rev)) return;
      let cacheWarning = '';
      try { localStorage.setItem(cacheKey(visit), JSON.stringify({ owner: captured.owner, at: new Date().toISOString(), data })); } catch (_) { cacheWarning = copy('cacheWarning'); }
      render(data, visit, rev, rows, !navigator.onLine);
      if (!preserve) setCopy(status,copy('updated',{visit:label(visit,true),warning:cacheWarning}));
    } catch (error) {
      if (!valid(visit, rev)) return;
      let saved; if (![401,403,404].includes(error.status)) try { saved = cached(visit); } catch (_) { /* A malformed cache never replaces an authoritative response. */ }
      if (saved) {
        setCopy(status,copy('cached',{visit:label(visit,true),date:dateCopy(saved.at),detail:errorCopy(error)}));
        try { const rows = await store.records(scope, captured, true); if (valid(visit, rev)) render(saved.data, visit, rev, rows, true); } catch (failure) { if (valid(visit, rev)) setCopy(status,errorCopy(failure)); }
      } else setCopy(status,copy('loadFailed',{visit:label(visit,true),detail:errorCopy(error)}));
    } finally { if (valid(visit, rev)) refresh.disabled = false; }
  }
  async function flush() {
    if (syncing || busy || !protect() || !navigator.onLine) return;
    syncing = true; let changed = false;
    try {
      for (const row of await store.records(scope, captured)) {
        if (row.failure?.blocked || row.failure?.retryAt > Date.now()) continue;
        try { await send(row, true); changed ||= sameVisit(row.payload, selected); } catch (_) { break; }
      }
    } finally { syncing = false; await renderQueue(); if (changed && protect() && !busy) await load(true); }
  }
  setCopy(root.querySelector(':scope > h2'),copy('heading'));setCopy(root.querySelector(':scope > p'),copy('intro'));setCopy(refresh,copy('refresh'));setCopy(status,copy('chooseVisit'));
  window.addEventListener('cw-language-change',repaintCopy);let observedLanguage=document.documentElement.lang;
  new MutationObserver(()=>{if(observedLanguage===document.documentElement.lang)return;observedLanguage=document.documentElement.lang;repaintCopy();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.CWFieldEquipment = { pendingSummary, flush, render: renderQueue };
  window.addEventListener('cw:field-visit-selected', event => {
    const detail = event.detail || {}, next = positive(detail.visitId) && ['REGULAR','EXTRA'].includes(detail.visitType) ? { visitId: detail.visitId, visitType: detail.visitType, poolId: detail.poolId || null, state: detail.state || '' } : null;
    if (sameVisit(next, selected) && next.state === selected.state) return;
    selected = next; ++revision; list.replaceChildren(); load();
  });
  refresh.onclick = () => { if (!busy) load(); };
  window.addEventListener('storage', () => { if (protect()) renderQueue(); });
  window.addEventListener('focus', protect);
  window.addEventListener('cw:field-write-change', renderQueue);
  window.addEventListener('online', flush);
  let timer;
  function resume() { clearInterval(timer); timer = setInterval(() => { if (protect()) flush().catch(() => {}); }, 15000); renderQueue(); flush().catch(() => {}); }
  window.addEventListener('pageshow', resume); window.addEventListener('pagehide', () => clearInterval(timer));
  setInterval(protect, 500); resume();
})();
