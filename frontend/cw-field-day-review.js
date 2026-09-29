(function () {
  'use strict';
  const messages = {
    "chemicalTitle": ["Química a preparar","Chemicals to prepare","Produits chimiques à préparer","Productos químicos a preparar","Chemikalien vorbereiten"],
    "chemicalIntro": ["Confira as faltas reportadas antes de sair. Confirme apenas produtos que recebeu fisicamente. A receção não conclui a visita nem calcula dosagens.","Check reported shortages before leaving. Only confirm products you have physically received. Receipt does not complete the visit or calculate doses.","Vérifiez les manques signalés avant de partir. Confirmez uniquement les produits reçus physiquement. La réception ne termine pas la visite et ne calcule pas les dosages.","Compruebe las faltas reportadas antes de salir. Confirme solo productos que haya recibido físicamente. La recepción no finaliza la visita ni calcula dosis.","Prüfen Sie gemeldete Fehlmengen vor der Abfahrt. Bestätigen Sie nur tatsächlich erhaltene Produkte. Der Empfang schließt keinen Besuch ab und berechnet keine Dosierungen."],
    "chemicalRefresh": ["Atualizar necessidades","Refresh requirements","Actualiser les besoins","Actualizar necesidades","Bedarf aktualisieren"],
    "chemicalOfflineQuery": ["Sem rede. Confirme as necessidades com o escritório; a lista pode estar desatualizada.","Offline. Check requirements with the office; the list may be outdated.","Hors ligne. Vérifiez les besoins auprès du bureau ; la liste peut être obsolète.","Sin conexión. Confirme las necesidades con la oficina; la lista puede estar desactualizada.","Offline. Klären Sie den Bedarf mit dem Büro; die Liste könnte veraltet sein."],
    "chemicalLoading": ["A consultar necessidades de reposição…","Checking replenishment requirements…","Consultation des besoins de réapprovisionnement…","Consultando necesidades de reposición…","Nachschubbedarf wird abgerufen…"],
    "chemicalQueryFailed": ["Falha ao consultar necessidades","Could not retrieve requirements","Impossible de consulter les besoins","No se pudieron consultar las necesidades","Bedarf konnte nicht abgerufen werden"],
    "chemicalProduct": ["{name} · {quantity}","{name} · {quantity}","{name} · {quantity}","{name} · {quantity}","{name} · {quantity}"],
    "chemicalQuantityUnknown": ["Quantidade por confirmar","Quantity to be confirmed","Quantité à confirmer","Cantidad por confirmar","Menge noch zu bestätigen"],
    "chemicalVisit": ["{visit} · {date}","{visit} · {date}","{visit} · {date}","{visit} · {date}","{visit} · {date}"],
    "chemicalReceived": ["Recebido na sua viatura: {quantity} {unit}{remaining}","Received in your vehicle: {quantity} {unit}{remaining}","Reçu dans votre véhicule : {quantity} {unit}{remaining}","Recibido en su vehículo: {quantity} {unit}{remaining}","In Ihrem Fahrzeug erhalten: {quantity} {unit}{remaining}"],
    "chemicalTotalUnknown": [" · Total necessário por confirmar"," · Total required to be confirmed"," · Total nécessaire à confirmer"," · Total necesario por confirmar"," · Gesamtbedarf noch zu bestätigen"],
    "chemicalRemaining": [" · Falta receber: {quantity} {unit}"," · Still to receive: {quantity} {unit}"," · Reste à recevoir : {quantity} {unit}"," · Falta recibir: {quantity} {unit}"," · Noch zu erhalten: {quantity} {unit}"],
    "chemicalReturned": ["Devolvido ao armazém: {quantity} {unit}. Os valores acima descontam as devoluções.","Returned to the warehouse: {quantity} {unit}. The amounts above account for returns.","Retourné à l’entrepôt : {quantity} {unit}. Les valeurs ci-dessus déduisent les retours.","Devuelto al almacén: {quantity} {unit}. Los valores anteriores descuentan las devoluciones.","Ins Lager zurückgegeben: {quantity} {unit}. Die obigen Mengen berücksichtigen Rückgaben."],
    "chemicalReceive": ["Confirmar receção de química","Confirm chemical receipt","Confirmer la réception des produits","Confirmar recepción de productos","Chemikalienempfang bestätigen"],
    "chemicalComplete": ["Quantidade reportada recebida. A visita continua por resolver.","Reported quantity received. The visit remains unresolved.","Quantité signalée reçue. La visite reste à traiter.","Cantidad reportada recibida. La visita sigue por resolver.","Gemeldete Menge erhalten. Der Besuch bleibt offen."],
    "chemicalCount": ["{count} necessidade(s) reportada(s) para as suas visitas.","{count} requirement(s) reported for your visits.","{count} besoin(s) signalé(s) pour vos visites.","{count} necesidad(es) reportada(s) para sus visitas.","{count} gemeldete(r) Bedarf(e) für Ihre Besuche."],
    "chemicalEmpty": ["Sem faltas de química reportadas por resolver. Verifique também o stock da viatura.","No reported chemical shortages remain unresolved. Also check the vehicle stock.","Aucun manque de produits chimiques signalé ne reste à traiter. Vérifiez aussi le stock du véhicule.","No hay faltas de productos químicos reportadas por resolver. Compruebe también el stock del vehículo.","Keine gemeldeten Chemikalienfehlmengen sind noch offen. Prüfen Sie auch den Fahrzeugbestand."],
    "chemicalRefreshFailed": ["Não foi possível atualizar: {detail}. Confirme com o escritório.","Could not refresh: {detail}. Check with the office.","Impossible d’actualiser : {detail}. Vérifiez auprès du bureau.","No se pudo actualizar: {detail}. Confirme con la oficina.","Aktualisierung fehlgeschlagen: {detail}. Fragen Sie beim Büro nach."],
    "chemicalOpenReceipt": ["Termine ou cancele a receção em aberto antes de iniciar outra.","Finish or cancel the open receipt before starting another.","Terminez ou annulez la réception en cours avant d’en commencer une autre.","Termine o cancele la recepción abierta antes de iniciar otra.","Schließen Sie die offene Empfangsbestätigung ab oder brechen Sie sie ab, bevor Sie eine weitere beginnen."],
    "chemicalConnect": ["Ligue-se à rede para confirmar a receção.","Connect to confirm receipt.","Connectez-vous pour confirmer la réception.","Conéctese para confirmar la recepción.","Stellen Sie eine Verbindung her, um den Empfang zu bestätigen."],
    "chemicalDeliveriesFailed": ["Falha ao consultar entregas","Could not retrieve deliveries","Impossible de consulter les livraisons","No se pudieron consultar las entregas","Lieferungen konnten nicht abgerufen werden"],
    "chemicalNoTransfer": ["Sem transferência correspondente registada após esta falta. Confirme com a gestão.","No matching transfer has been recorded after this shortage. Check with management.","Aucun transfert correspondant n’a été enregistré après ce manque. Vérifiez auprès de la gestion.","No se ha registrado una transferencia correspondiente después de esta falta. Confirme con la administración.","Keine passende Umlagerung wurde erfasst, nachdem diese Fehlmenge gemeldet wurde. Fragen Sie bei der Verwaltung nach."],
    "chemicalTransfer": ["Transferência para a viatura","Transfer to the vehicle","Transfert vers le véhicule","Transferencia al vehículo","Umlagerung ins Fahrzeug"],
    "chemicalMovement": ["{quantity} {unit} · {date} · #{id}","{quantity} {unit} · {date} · #{id}","{quantity} {unit} · {date} · #{id}","{quantity} {unit} · {date} · #{id}","{quantity} {unit} · {date} · #{id}"],
    "chemicalQuantity": ["Quantidade recebida","Quantity received","Quantité reçue","Cantidad recibida","Erhaltene Menge"],
    "chemicalSubmit": ["Recebi esta quantidade","I received this quantity","J’ai reçu cette quantité","He recibido esta cantidad","Diese Menge habe ich erhalten"],
    "chemicalCancel": ["Cancelar","Cancel","Annuler","Cancelar","Abbrechen"],
    "chemicalAvailable": ["Disponível para confirmar: {quantity} {unit}","Available to confirm: {quantity} {unit}","Disponible à confirmer : {quantity} {unit}","Disponible para confirmar: {quantity} {unit}","Zur Bestätigung verfügbar: {quantity} {unit}"],
    "chemicalOfflineAction": ["Sem rede. A receção ainda não foi confirmada.","Offline. Receipt has not yet been confirmed.","Hors ligne. La réception n’a pas encore été confirmée.","Sin conexión. La recepción aún no se ha confirmado.","Offline. Der Empfang wurde noch nicht bestätigt."],
    "chemicalStorageFailed": ["Não foi possível guardar o pedido neste dispositivo. Confirme com o escritório.","Could not save the request on this device. Check with the office.","Impossible d’enregistrer la demande sur cet appareil. Vérifiez auprès du bureau.","No se pudo guardar la solicitud en este dispositivo. Confirme con la oficina.","Die Anfrage konnte nicht gespeichert werden. Fragen Sie beim Büro nach."],
    "chemicalConfirmFailed": ["Falha ao confirmar","Confirmation failed","Échec de la confirmation","Fallo al confirmar","Bestätigung fehlgeschlagen"],
    "chemicalConfirmed": ["Receção confirmada.","Receipt confirmed.","Réception confirmée.","Recepción confirmada.","Empfang bestätigt."],
    "chemicalRetry": ["{detail} Pode repetir com os mesmos dados.","{detail} You can retry with the same details.","{detail} Vous pouvez réessayer avec les mêmes données.","{detail} Puede repetir con los mismos datos.","{detail} Sie können es mit denselben Angaben erneut versuchen."],
    "chemicalOffline": ["Sem rede. A lista anterior pode estar desatualizada.","Offline. The previous list may be outdated.","Hors ligne. La liste précédente peut être obsolète.","Sin conexión. La lista anterior puede estar desactualizada.","Offline. Die vorherige Liste könnte veraltet sein."],
    "handoverTitle": ["Passar responsabilidade","Hand over responsibility","Transmettre la responsabilité","Transferir la responsabilidad","Verantwortung übergeben"],
    "handoverIntro": ["Água aberta e bomba manual: continua responsável até o colega aceitar. Combine a passagem com ele; o pedido não confirma que foi visto.","Water left on and pump in manual mode: you remain responsible until your colleague accepts. Arrange the handover with them; the request does not confirm that it was seen.","Eau ouverte et pompe en mode manuel : vous restez responsable jusqu’à l’acceptation de votre collègue. Convenez de la transmission avec lui ; la demande ne confirme pas qu’elle a été vue.","Agua abierta y bomba en manual: sigue siendo responsable hasta que el compañero acepte. Acuerde el traspaso con él; la solicitud no confirma que se haya visto.","Laufendes Wasser und Pumpe im manuellen Modus: Sie bleiben verantwortlich, bis Ihr Kollege annimmt. Sprechen Sie die Übergabe ab; die Anfrage bestätigt nicht, dass sie gesehen wurde."],
    "handoverRefresh": ["Atualizar passagens","Refresh handovers","Actualiser les transmissions","Actualizar traspasos","Übergaben aktualisieren"],
    "handoverLoading": ["A consultar passagens…","Checking handovers…","Consultation des transmissions…","Consultando traspasos…","Übergaben werden abgerufen…"],
    "handoverIncoming": ["Pedido para si: {reason}. Só aceite se consegue assumir esta responsabilidade.","Request for you: {reason}. Only accept if you can take this responsibility.","Demande pour vous : {reason}. Acceptez uniquement si vous pouvez assumer cette responsabilité.","Solicitud para usted: {reason}. Acepte solo si puede asumir esta responsabilidad.","Anfrage an Sie: {reason}. Nehmen Sie nur an, wenn Sie diese Verantwortung übernehmen können."],
    "handoverWaiting": ["À espera de {name}. Continua responsável.","Waiting for {name}. You remain responsible.","En attente de {name}. Vous restez responsable.","Esperando a {name}. Sigue siendo responsable.","Warten auf {name}. Sie bleiben verantwortlich."],
    "handoverChoose": ["Escolha quem pode assumir este lembrete.","Choose who can take responsibility for this reminder.","Choisissez qui peut assumer ce rappel.","Elija quién puede asumir este recordatorio.","Wählen Sie, wer diese Erinnerung übernehmen kann."],
    "handoverTarget": ["Técnico destinatário","Receiving technician","Technicien destinataire","Técnico destinatario","Übernehmender Techniker"],
    "handoverSelect": ["Escolher técnico","Choose technician","Choisir un technicien","Elegir técnico","Techniker wählen"],
    "handoverReason": ["Motivo da passagem","Reason for handover","Motif de la transmission","Motivo del traspaso","Grund der Übergabe"],
    "handoverRequest": ["Pedir passagem","Request handover","Demander la transmission","Solicitar traspaso","Übergabe anfragen"],
    "handoverAccept": ["Aceitar responsabilidade","Accept responsibility","Accepter la responsabilité","Aceptar la responsabilidad","Verantwortung übernehmen"],
    "handoverCancel": ["Cancelar pedido","Cancel request","Annuler la demande","Cancelar solicitud","Anfrage zurückziehen"],
    "handoverConfirm": ["Confirma que consegue assumir este lembrete a partir de agora?","Can you confirm that you can take responsibility for this reminder from now on?","Confirmez-vous pouvoir assumer ce rappel à partir de maintenant ?","¿Confirma que puede asumir este recordatorio a partir de ahora?","Bestätigen Sie, dass Sie ab jetzt die Verantwortung für diese Erinnerung übernehmen können?"],
    "handoverActionFailed": ["{detail}. Atualize a lista antes de repetir; a resposta pode ter-se perdido.","{detail}. Refresh the list before retrying; the response may have been lost.","{detail}. Actualisez la liste avant de réessayer ; la réponse a pu se perdre.","{detail}. Actualice la lista antes de repetir; la respuesta puede haberse perdido.","{detail}. Aktualisieren Sie die Liste vor einem erneuten Versuch; die Antwort könnte verloren gegangen sein."],
    "handoverCount": ["{count} pedido(s) para aceitar.","{count} request(s) to accept.","{count} demande(s) à accepter.","{count} solicitud(es) por aceptar.","{count} Anfrage(n) zum Annehmen."],
    "handoverUpdated": ["Passagens atualizadas.","Handovers updated.","Transmissions actualisées.","Traspasos actualizados.","Übergaben aktualisiert."],
    "handoverEmpty": ["Sem lembretes ativos ou pedidos de passagem.","No active reminders or handover requests.","Aucun rappel actif ni demande de transmission.","Sin recordatorios activos ni solicitudes de traspaso.","Keine aktiven Erinnerungen oder Übergabeanfragen."],
    "handoverUnavailable": ["Sem confirmação do servidor. Não considere nenhuma responsabilidade transferida; atualize com rede.","No server confirmation. Do not consider any responsibility transferred; refresh when connected.","Aucune confirmation du serveur. Ne considérez aucune responsabilité comme transmise ; actualisez avec une connexion.","Sin confirmación del servidor. No considere transferida ninguna responsabilidad; actualice con conexión.","Keine Serverbestätigung. Betrachten Sie keine Verantwortung als übergeben; aktualisieren Sie bei bestehender Verbindung."],
    "panelResponseUnavailable": ["Resposta indisponível","Response unavailable","Réponse indisponible","Respuesta no disponible","Antwort nicht verfügbar"],
    "receiptTitle": ["Novas visitas atribuídas","Newly assigned visits","Nouvelles visites attribuées","Nuevas visitas asignadas","Neu zugewiesene Besuche"],
    "receiptIntro": ["Confirme que recebeu o trabalho. Esta confirmação não inicia a visita e não transfere água aberta ou bombas em manual.","Confirm that you received the work. This confirmation does not start the visit or transfer responsibility for water left on or pumps in manual mode.","Confirmez la réception du travail. Cette confirmation ne démarre pas la visite et ne transfère pas la responsabilité de l’eau ouverte ou des pompes en mode manuel.","Confirme que recibió el trabajo. Esta confirmación no inicia la visita ni transfiere la responsabilidad del agua abierta o de las bombas en manual.","Bestätigen Sie den Empfang des Auftrags. Diese Bestätigung startet keinen Besuch und überträgt keine Verantwortung für laufendes Wasser oder Pumpen im manuellen Modus."],
    "receiptRefresh": ["Atualizar atribuições","Refresh assignments","Actualiser les attributions","Actualizar asignaciones","Zuweisungen aktualisieren"],
    "receiptLoading": ["A verificar atribuições…","Checking assignments…","Vérification des attributions…","Comprobando asignaciones…","Zuweisungen werden geprüft…"],
    "receiptOfflineQuery": ["Sem ligação. Ligue à rede para consultar e confirmar as novas atribuições.","Offline. Connect to view and confirm new assignments.","Hors ligne. Connectez-vous pour consulter et confirmer les nouvelles attributions.","Sin conexión. Conéctese para consultar y confirmar las nuevas asignaciones.","Offline. Stellen Sie eine Verbindung her, um neue Zuweisungen anzusehen und zu bestätigen."],
    "receiptQueryFailed": ["Falha ao consultar atribuições","Could not retrieve assignments","Impossible de consulter les attributions","No se pudieron consultar las asignaciones","Zuweisungen konnten nicht abgerufen werden"],
    "receiptRegular": ["{name} · visita #{id}","{name} · visit #{id}","{name} · visite n°{id}","{name} · visita #{id}","{name} · Besuch #{id}"],
    "receiptExtra": ["{name} · visita extra #{id}","{name} · extra visit #{id}","{name} · visite supplémentaire n°{id}","{name} · visita extra #{id}","{name} · Zusatzbesuch #{id}"],
    "receiptDateUnknown": ["Data por confirmar","Date to be confirmed","Date à confirmer","Fecha por confirmar","Datum noch zu bestätigen"],
    "receiptConfirm": ["Confirmar receção desta visita","Confirm receipt of this visit","Confirmer la réception de cette visite","Confirmar recepción de esta visita","Empfang dieses Besuchs bestätigen"],
    "receiptFuture": ["{count} visita(s) de dias futuros","{count} visit(s) on future days","{count} visite(s) à venir","{count} visita(s) de días futuros","{count} Besuch(e) an künftigen Tagen"],
    "receiptCount": ["{count} visita(s) por confirmar.","{count} visit(s) awaiting confirmation.","{count} visite(s) à confirmer.","{count} visita(s) por confirmar.","{count} Besuch(e) noch zu bestätigen."],
    "receiptEmpty": ["Sem novas atribuições por confirmar no servidor.","No new assignments awaiting confirmation on the server.","Aucune nouvelle attribution à confirmer sur le serveur.","No hay nuevas asignaciones por confirmar en el servidor.","Keine neuen Zuweisungen auf dem Server zu bestätigen."],
    "receiptRefreshFailed": ["Não foi possível atualizar: {detail}. Confirme as atribuições com o escritório.","Could not refresh: {detail}. Check the assignments with the office.","Impossible d’actualiser : {detail}. Vérifiez les attributions auprès du bureau.","No se pudo actualizar: {detail}. Confirme las asignaciones con la oficina.","Aktualisierung fehlgeschlagen: {detail}. Prüfen Sie die Zuweisungen mit dem Büro."],
    "receiptOfflineAction": ["Sem ligação. A receção ainda não foi confirmada no escritório.","Offline. Receipt has not yet been confirmed with the office.","Hors ligne. La réception n’a pas encore été confirmée auprès du bureau.","Sin conexión. La recepción aún no se ha confirmado con la oficina.","Offline. Der Empfang wurde beim Büro noch nicht bestätigt."],
    "receiptConfirmFailed": ["Falha na confirmação","Confirmation failed","Échec de la confirmation","Fallo en la confirmación","Bestätigung fehlgeschlagen"],
    "receiptConfirmed": ["Receção confirmada no escritório. Atualize a rota para consultar o trabalho.","Receipt confirmed with the office. Refresh the route to view the work.","Réception confirmée auprès du bureau. Actualisez la tournée pour consulter le travail.","Recepción confirmada con la oficina. Actualice la ruta para consultar el trabajo.","Empfang beim Büro bestätigt. Aktualisieren Sie die Route, um den Auftrag anzusehen."],
    "receiptActionFailed": ["Receção não confirmada: {detail}. Pode atualizar e tentar novamente.","Receipt not confirmed: {detail}. You can refresh and try again.","Réception non confirmée : {detail}. Vous pouvez actualiser et réessayer.","Recepción no confirmada: {detail}. Puede actualizar e intentarlo de nuevo.","Empfang nicht bestätigt: {detail}. Sie können aktualisieren und es erneut versuchen."],
    "receiptOffline": ["Sem ligação. As confirmações exigem ligação ao escritório.","Offline. Confirmations require a connection to the office.","Hors ligne. Les confirmations nécessitent une connexion au bureau.","Sin conexión. Las confirmaciones requieren conexión con la oficina.","Offline. Bestätigungen erfordern eine Verbindung zum Büro."],
    "title": ["Antes de sair","Before leaving","Avant de partir","Antes de salir","Vor dem Verlassen"],
    "intro": ["Reveja trabalhos, envios e lembretes. Esta revisão não encerra a jornada nem transfere responsabilidades.","Review work, submissions and reminders. This review does not end the workday or transfer responsibilities.","Vérifiez les travaux, les envois et les rappels. Cette vérification ne termine pas la journée et ne transfère aucune responsabilité.","Revise trabajos, envíos y recordatorios. Esta revisión no cierra la jornada ni transfiere responsabilidades.","Prüfen Sie Arbeiten, Übermittlungen und Erinnerungen. Diese Prüfung beendet weder den Arbeitstag noch überträgt sie Verantwortlichkeiten."],
    "review": ["Rever pendências do dia","Review outstanding items today","Vérifier les éléments en attente du jour","Revisar pendientes del día","Offene Punkte des Tages prüfen"],
    "visit": ["Visita {id}","Visit {id}","Visite {id}","Visita {id}","Besuch {id}"],
    "routeUnknown": ["Ronda sem confirmação atual. Ligue à rede e atualize a agenda; podem existir alterações do escritório.","Route not currently confirmed. Connect and refresh the schedule; the office may have made changes.","Tournée sans confirmation à jour. Connectez-vous et actualisez le planning ; le bureau peut avoir effectué des modifications.","Ruta sin confirmación actual. Conéctese y actualice la agenda; la oficina puede haber realizado cambios.","Route derzeit nicht bestätigt. Stellen Sie eine Verbindung her und aktualisieren Sie den Terminplan; das Büro könnte Änderungen vorgenommen haben."],
    "verification": ["{section}: não foi possível confirmar os dados no servidor. A revisão está incompleta.","{section}: could not confirm the server data. The review is incomplete.","{section} : impossible de confirmer les données du serveur. La vérification est incomplète.","{section}: no se pudieron confirmar los datos del servidor. La revisión está incompleta.","{section}: Die Serverdaten konnten nicht bestätigt werden. Die Prüfung ist unvollständig."],
    "waterOpen": ["{name} — água aberta. Confirme o fecho físico ou contacte o responsável.","{name} — water left on. Confirm it has physically been turned off or contact the person responsible.","{name} — eau ouverte. Confirmez la fermeture physique ou contactez la personne responsable.","{name} — agua abierta. Confirme el cierre físico o contacte con la persona responsable.","{name} — Wasser läuft. Bestätigen Sie, dass es vor Ort abgestellt wurde, oder kontaktieren Sie die verantwortliche Person."],
    "waterPending": ["{name} — estado da água por confirmar no servidor.","{name} — water status awaiting server confirmation.","{name} — état de l’eau à confirmer sur le serveur.","{name} — estado del agua por confirmar en el servidor.","{name} — Wasserstatus wartet auf Serverbestätigung."],
    "pumpManual": ["{name} — bomba em manual. Confirme o regresso físico a automático ou contacte o responsável.","{name} — pump in manual mode. Confirm it has physically returned to automatic or contact the person responsible.","{name} — pompe en mode manuel. Confirmez le retour physique en mode automatique ou contactez la personne responsable.","{name} — bomba en modo manual. Confirme el retorno físico al modo automático o contacte con la persona responsable.","{name} — Pumpe im manuellen Modus. Bestätigen Sie, dass sie vor Ort auf Automatik zurückgestellt wurde, oder kontaktieren Sie die verantwortliche Person."],
    "pumpPending": ["{name} — estado da bomba por confirmar no servidor.","{name} — pump status awaiting server confirmation.","{name} — état de la pompe à confirmer sur le serveur.","{name} — estado de la bomba por confirmar en el servidor.","{name} — Pumpenstatus wartet auf Serverbestätigung."],
    "unfinished": ["{name} — {work}. Combine o próximo passo com o escritório.","{name} — {work}. Agree on the next step with the office.","{name} — {work}. Convenez de la prochaine étape avec le bureau.","{name} — {work}. Acuerde el siguiente paso con la oficina.","{name} — {work}. Vereinbaren Sie den nächsten Schritt mit dem Büro."],
    "regularWork": ["trabalho por concluir","unfinished work","travail à terminer","trabajo sin terminar","unerledigte Arbeit"],
    "extraWork": ["visita extra por concluir","unfinished extra visit","visite supplémentaire à terminer","visita extra sin terminar","unerledigter Zusatzbesuch"],
    "rejected": ["{name} — correção não aplicada: {detail}","{name} — correction not applied: {detail}","{name} — correction non appliquée : {detail}","{name} — corrección no aplicada: {detail}","{name} — Korrektur nicht angewendet: {detail}"],
    "queued": ["{name} — {operation} por confirmar no servidor{blocked}.","{name} — {operation} awaiting server confirmation{blocked}.","{name} — {operation} à confirmer sur le serveur{blocked}.","{name} — {operation} por confirmar en el servidor{blocked}.","{name} — {operation} wartet auf Serverbestätigung{blocked}."],
    "start": ["início","start","début","inicio","Beginn"],
    "correction": ["correção","correction","correction","corrección","Korrektur"],
    "completion": ["conclusão","completion","fin","finalización","Abschluss"],
    "blocked": ["; precisa de apoio do escritório","; office support needed"," ; aide du bureau nécessaire","; necesita apoyo de la oficina","; Unterstützung durch das Büro erforderlich"],
    "photos": ["{name} — {count} fotografia(s) por enviar.","{name} — {count} photo(s) awaiting upload.","{name} — {count} photo(s) à envoyer.","{name} — {count} foto(s) por enviar.","{name} — {count} Foto(s) zum Senden."],
    "problemDraft": ["{name} — ocorrência guardada no telemóvel, por enviar.","{name} — issue saved on the phone, awaiting sending.","{name} — incident enregistré sur le téléphone, à envoyer.","{name} — incidencia guardada en el teléfono, por enviar.","{name} — Vorfall auf dem Telefon gespeichert, noch zu senden."],
    "route": ["Ronda","Route","Tournée","Ruta","Route"],
    "water": ["Água aberta","Water left on","Eau ouverte","Agua abierta","Laufendes Wasser"],
    "pumps": ["Bombas em manual","Pumps in manual mode","Pompes en mode manuel","Bombas en modo manual","Pumpen im manuellen Modus"],
    "criticalReminders": ["Lembretes críticos","Critical reminders","Rappels critiques","Recordatorios críticos","Kritische Erinnerungen"],
    "legacyReminders": ["Lembretes antigos por reconciliar com o escritório","Old reminders to reconcile with the office","Anciens rappels à rapprocher avec le bureau","Recordatorios antiguos por conciliar con la oficina","Alte Erinnerungen mit dem Büro abgleichen"],
    "legacyDrafts": ["Rascunhos antigos sem conta/tipo de visita confirmados","Old drafts without a confirmed account/visit type","Anciens brouillons sans compte/type de visite confirmé","Borradores antiguos sin cuenta/tipo de visita confirmados","Alte Entwürfe ohne bestätigtes Konto/bestätigten Besuchstyp"],
    "changed": ["O estado pode ter mudado. Volte a rever as pendências antes de sair.","The state may have changed. Review outstanding items again before leaving.","L’état peut avoir changé. Vérifiez à nouveau les éléments en attente avant de partir.","El estado puede haber cambiado. Revise de nuevo los pendientes antes de salir.","Der Zustand könnte sich geändert haben. Prüfen Sie die offenen Punkte vor dem Verlassen erneut."],
    "checking": ["A verificar pendências neste telemóvel…","Checking outstanding items on this phone…","Vérification des éléments en attente sur ce téléphone…","Comprobando pendientes en este teléfono…","Offene Punkte auf diesem Telefon werden geprüft…"],
    "sessionChanged": ["Sessão alterada. Repita a revisão com a conta atual.","Session changed. Repeat the review with the current account.","Session modifiée. Recommencez la vérification avec le compte actuel.","Sesión cambiada. Repita la revisión con la cuenta actual.","Sitzung geändert. Wiederholen Sie die Prüfung mit dem aktuellen Konto."],
    "intakePending": ["{name} — cadastro por confirmar. Abra Novo cliente em campo.","{name} — registration awaiting confirmation. Open New client in the field.","{name} — inscription à confirmer. Ouvrez Nouveau client sur le terrain.","{name} — alta por confirmar. Abra Nuevo cliente en campo.","{name} — Registrierung wartet auf Bestätigung. Öffnen Sie Neuer Kunde vor Ort."],
    "intakeDraft": ["Rascunho de cadastro por enviar. Abra Novo cliente em campo.","Registration draft awaiting sending. Open New client in the field.","Brouillon d’inscription à envoyer. Ouvrez Nouveau client sur le terrain.","Borrador de alta por enviar. Abra Nuevo cliente en campo.","Registrierungsentwurf noch zu senden. Öffnen Sie Neuer Kunde vor Ort."],
    "correctionDraft": ["{name} — rascunho de correção guardado, ainda não confirmado.","{name} — correction draft saved, not yet confirmed.","{name} — brouillon de correction enregistré, pas encore confirmé.","{name} — borrador de corrección guardado, aún sin confirmar.","{name} — Korrekturentwurf gespeichert, noch nicht bestätigt."],
    "outstanding": ["Existem pendências antes de sair:","There are outstanding items before leaving:","Des éléments sont en attente avant de partir :","Hay pendientes antes de salir:","Vor dem Verlassen sind noch Punkte offen:"],
    "empty": ["Não foram encontradas pendências nos dados verificados. Confirme as condições físicas antes de sair.","No outstanding items were found in the checked data. Confirm the physical conditions before leaving.","Aucun élément en attente dans les données vérifiées. Confirmez les conditions sur place avant de partir.","No se encontraron pendientes en los datos verificados. Confirme las condiciones físicas antes de salir.","In den geprüften Daten wurden keine offenen Punkte gefunden. Prüfen Sie vor dem Verlassen die Bedingungen vor Ort."],
    "critical": ["Atenção imediata","Immediate attention","Attention immédiate","Atención inmediata","Sofortige Aufmerksamkeit"],
    "pending": ["Por concluir ou enviar","To finish or send","À terminer ou envoyer","Por terminar o enviar","Abzuschließen oder zu senden"],
    "unknown": ["Por confirmar","Awaiting confirmation","À confirmer","Por confirmar","Noch zu bestätigen"],
    "group": ["{label} ({count})","{label} ({count})","{label} ({count})","{label} ({count})","{label} ({count})"],
    "unconfirmed": ["não confirmada","not confirmed","non confirmée","sin confirmar","nicht bestätigt"],
    "stamp": ["Revisão: {reviewed}. Última ronda confirmada: {confirmed}. Não limpe os dados da aplicação enquanto existirem envios pendentes.","Reviewed: {reviewed}. Last confirmed route: {confirmed}. Do not clear the application data while submissions are pending.","Vérification : {reviewed}. Dernière tournée confirmée : {confirmed}. N’effacez pas les données de l’application tant que des envois sont en attente.","Revisión: {reviewed}. Última ruta confirmada: {confirmed}. No borre los datos de la aplicación mientras haya envíos pendientes.","Geprüft: {reviewed}. Letzte bestätigte Route: {confirmed}. Löschen Sie keine Anwendungsdaten, solange Übermittlungen ausstehen."],
    "failed": ["Não foi possível verificar todas as pendências. Não considere o dia conferido. Preserve os dados e peça apoio ao escritório.","Could not check all outstanding items. Do not consider the day checked. Preserve the data and ask the office for support.","Impossible de vérifier tous les éléments en attente. Ne considérez pas la journée comme vérifiée. Conservez les données et demandez de l’aide au bureau.","No se pudieron comprobar todos los pendientes. No considere el día revisado. Conserve los datos y pida apoyo a la oficina.","Nicht alle offenen Punkte konnten geprüft werden. Betrachten Sie den Tag nicht als geprüft. Bewahren Sie die Daten auf und bitten Sie das Büro um Unterstützung."]
  };
  // Only descriptors created here are translated; names, notes and server errors stay literal.
  const descriptors = new WeakSet(), itemCopies = new WeakMap();
  const copy = (key, params = {}) => { const value = {key, params}; descriptors.add(value); return value; };
  const dateCopy = (value, timeOnly = false, dateOnly = false) => { const entry = {date:value, timeOnly, dateOnly}; descriptors.add(entry); return entry; };
  const languages = ['pt','en','fr','es','de'], locales = ['pt-PT','en-GB','fr-FR','es-ES','de-DE'];
  function text(value, language = 'pt') {
    if (!value || typeof value !== 'object' || !descriptors.has(value)) return String(value ?? '');
    const index = Math.max(0,languages.indexOf(String(language).toLowerCase().split('-')[0]));
    if (value.translations) return value.translations[languages[index]];
    if ('date' in value) return new Date(value.date)[value.dateOnly ? 'toLocaleDateString' : value.timeOnly ? 'toLocaleTimeString' : 'toLocaleString'](locales[index]);
    return messages[value.key][index].replace(/\{(\w+)\}/g,(_,key)=>text(value.params[key],language));
  }
  function reviewItem(kind, value, language) {
    const item = {kind, text:text(value,language)}; itemCopies.set(item,value); return item;
  }
  function externalReviewItem(item) {
    const values = item && Object.hasOwn(item,'reviewText') ? item.reviewText : null;
    if (values && languages.every(language=>typeof values[language] === 'string')) {
      // Copy strings once; neither producer callbacks nor mutable records survive in the binding.
      const value = {translations:Object.freeze(Object.fromEntries(languages.map(language=>[language,values[language]])))};
      descriptors.add(value);itemCopies.set(item,value);
    }
    return item;
  }
  function mergeReminders(local, remote, pump = false) {
    const transferred = remote.filter(row=>row.transferredAway);
    const merged = local.filter(item=>!transferred.some(row=>String(item.serverId)===String(row.id)||item.localId===row.metadata?.localId)).map(item => ({ ...item }));
    for (const row of remote) {
      if (row.isCompleted || row.transferredAway) continue;
      const meta = row.metadata || {};
      if (merged.some(item => (item.serverId && String(item.serverId) === String(row.id)) || (meta.localId && item.localId === meta.localId))) continue;
      merged.push({ ...meta, serverId: row.id, status: 'OPEN', ...(pump ? {closed:false} : {}) });
    }
    return merged;
  }
  function buildReview({ snapshot, water, pumps, outbox, drafts, photos, online, verificationErrors = [] }, language = 'pt') {
    const items = [];
    const add = (kind, value) => items.push(reviewItem(kind,value,language));
    const name = (id,type='REGULAR') => snapshot.visits.find(v => (v.visitType || 'REGULAR') === type && String(v.id) === String(id))?.name || copy('visit',{id});
    if (!online || !snapshot.confirmedAt) add('unknown', copy('routeUnknown'));
    for (const section of verificationErrors) add('unknown', copy('verification',{section}));
    for (const reminder of water) {
      const pool = reminder.poolName || name(reminder.visitId,reminder.visitType || 'REGULAR');
      if (reminder.status !== 'CLOSED') add('critical', copy('waterOpen',{name:pool}));
      if (!reminder.serverId || reminder.syncError || (reminder.status === 'CLOSED' && !reminder.closeSyncedAt)) add('pending', copy('waterPending',{name:pool}));
    }
    for (const reminder of Object.values(pumps)) {
      const pool = reminder.poolName || name(reminder.visitId,reminder.visitType || 'REGULAR');
      if (!reminder.closed) add('critical', copy('pumpManual',{name:pool}));
      if (!reminder.serverId || reminder.closed) add('pending', copy('pumpPending',{name:pool}));
    }
    for (const visit of snapshot.visits) {
      if (!visit.done && !visit.future && !Object.values(outbox).some(item=>String(item.visitId)===String(visit.id)&&(item.visitType || 'REGULAR')===(visit.visitType || 'REGULAR')&&item.scope!=='EXTRA_VISIT_START')) add('pending', copy('unfinished',{name:visit.name,work:copy(visit.visitType === 'EXTRA' ? 'extraWork' : 'regularWork')}));
    }
    for (const item of Object.values(outbox)) add('pending', item.rejected ? copy('rejected',{name:name(item.visitId,'EXTRA'),detail:item.rejected}) : copy('queued',{name:name(item.visitId,item.visitType || 'REGULAR'),operation:copy(item.scope === 'EXTRA_VISIT_START' ? 'start' : item.scope === 'EXTRA_VISIT_CORRECTION' ? 'correction' : 'completion'),blocked:item.blocked ? copy('blocked') : ''}));
    const photoCounts = new Map();
    for (const photo of photos) { const key=(photo.visitType || 'REGULAR')+':'+photo.visitId; photoCounts.set(key,(photoCounts.get(key)||0)+1); }
    for (const [key, count] of photoCounts) add('pending', copy('photos',{name:name(key.split(':')[1],key.split(':')[0]),count}));
    for (const [id, draft] of Object.entries(drafts)) {
      if (draft.pendingProblems?.some(problem => !problem.synced)) add('pending', copy('problemDraft',{name:name(id.replace(/^visit-(?:REGULAR-)?/, ''))}));
    }
    return items;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { buildReview, mergeReminders };
  if (typeof document === 'undefined') return;
  const button = document.getElementById('dayReviewBtn'), result = document.getElementById('dayReviewResult');
  if (!button || !result) return;
  const bindings = new WeakMap(), attributeBindings = new WeakMap(), panelErrors = new WeakMap();
  function panelError(key) {
    const value = copy(key), error = new Error(text(value));
    panelErrors.set(error,value);return error;
  }
  const panelErrorCopy = error => panelErrors.get(error) || error.message;
  const language = () => document.documentElement.lang || 'pt';
  const textCopy = key => text(copy(key),language());
  function setCopy(node,value) {
    if (!node) return;
    bindings.set(node,value);node.setAttribute('data-cw-day-review-copy','');node.setAttribute('data-cw-no-i18n','');
    node.textContent = text(value,language());
  }
  function setCopyAttribute(node,attribute,value) {
    if (!attributeBindings.has(node)) attributeBindings.set(node,new Map());
    attributeBindings.get(node).set(attribute,value);
    node.setAttribute('data-cw-day-review-attributes','');node.setAttribute('data-cw-no-i18n','');
    node.setAttribute(attribute,text(value,language()));
  }
  function repaintCopy() {
    for (const node of document.querySelectorAll('[data-cw-day-review-copy]')) {
      const value = text(bindings.get(node),language());
      if (node.textContent !== value) node.textContent = value;
    }
    for (const node of document.querySelectorAll('[data-cw-day-review-attributes]')) {
      for (const [attribute,value] of attributeBindings.get(node) || []) node.setAttribute(attribute,text(value,language()));
    }
  }
  result.setAttribute('data-cw-no-i18n','');
  const card = document.getElementById('dayReviewCard');
  setCopy(card?.querySelector('h2'),copy('title'));setCopy(card?.querySelector('p'),copy('intro'));setCopy(button,copy('review'));
  window.addEventListener('cw-language-change',repaintCopy);
  let observedLanguage = document.documentElement.lang;
  new MutationObserver(()=>{
    if (observedLanguage === document.documentElement.lang) return;
    observedLanguage = document.documentElement.lang;repaintCopy();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  const owner = () => { const user = window.CristalAuth?.parseUser?.() || {}; return String(user.technicianId || user.id || 'none'); };
  function read(key, array = false) {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : (array ? [] : {});
    if (!value || typeof value !== 'object' || Array.isArray(value) !== array || Object.values(value).some(item => !item || typeof item !== 'object')) throw new Error('Dados locais ilegíveis');
    return value;
  }
  let revision = 0;
  async function serverData(token) {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const endpoints = [ ['Ronda', `/api/technician/today?date=${date}`, 'visits'], ['Água aberta', '/api/technician/water-reminders', 'reminders'], ['Bombas em manual', '/api/technician/pump-reminders', 'reminders'] ];
    return Promise.all(endpoints.map(async ([label, url, field]) => {
      try {
        const response = await fetch(url, {headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
        const data = await response.json();
        if (!response.ok || data.ok === false || !Array.isArray(data[field])) throw new Error('Resposta incompleta');
        if (label === 'Ronda' && (data.complete !== true || data.total !== data.visits.length)) throw new Error('Ronda incompleta');
        return {label, rows:data[field]};
      } catch (_) { return {label, error:true}; }
    }));
  }
  function invalidate() {
    ++revision;
    if (result.textContent) setCopy(result,copy('changed'));
    button.disabled = false;
    result.setAttribute('aria-busy', 'false');
  }
  async function review() {
    const requestedOwner = owner(), requestedRevision = ++revision, token = window.CristalAuth?.getToken?.();
    button.disabled = true; setCopy(result,copy('checking'));
    result.setAttribute('aria-busy', 'true');
    try {
      if (requestedOwner === 'none') throw new Error('Sem técnico identificado');
      const [photos, remote, completions] = await Promise.all([
        window.CWFieldPhotos.pendingSummary(),
        navigator.onLine && token ? serverData(token) : Promise.resolve(null),
        window.CWFieldOffline.entries().then(async rows=>[...rows,...await window.CWFieldOffline.rejections()]),
      ]);
      if (revision !== requestedRevision) return;
      if (owner() !== requestedOwner || token !== window.CristalAuth?.getToken?.()) { setCopy(result,copy('sessionChanged')); return; }
      let snapshot = window.CWFieldDaySnapshot();
      let water = window.CWFieldReminders.list('WATER_OPEN');
      let pumps = window.CWFieldReminders.list('PUMP_MANUAL').filter(row=>row.status!=='CLOSED'||!row.closeSyncedAt);
      const verificationErrors = remote ? remote.filter(section=>section.error).map(section=>copy({'Ronda':'route','Água aberta':'water','Bombas em manual':'pumps'}[section.label])) : [copy('criticalReminders')];
      if (remote?.[0].rows) snapshot = {confirmedAt:new Date().toISOString(),visits:remote[0].rows.map(visit=>({id:visit.id,visitType:visit.visitType || 'REGULAR',name:visit.pool?.name || copy('visit',{id:visit.id}),done:Boolean(visit.endAt) || ['DONE','COMPLETED','CONCLUIDA'].includes(String(visit.status).toUpperCase())}))};
      else snapshot = {...snapshot,confirmedAt:null};
      if (remote?.[1].rows) water = mergeReminders(water, remote[1].rows);
      if (remote?.[2].rows) pumps = mergeReminders(pumps, remote[2].rows, true);
      if (window.CWFieldReminders.legacyWarning()) verificationErrors.push(copy('legacyReminders'));
      const outbox = Object.fromEntries(completions.map(row => [row.scope+':'+row.resourceId, { visitId: row.resourceId, visitType:row.scope.startsWith('EXTRA_') ? 'EXTRA' : 'REGULAR', scope:row.scope, blocked: row.failure?.blocked, rejected:row.response?.applied===false ? row.response.message : null }]));
      if (Object.keys(read(`cwFieldVisitDrafts:${requestedOwner}`)).length) verificationErrors.push(copy('legacyDrafts'));
      const items = buildReview({ snapshot, water, pumps, outbox, drafts: window.CWFieldDraftSnapshot ? window.CWFieldDraftSnapshot() : {}, photos, online: navigator.onLine, verificationErrors },language());
      for(const item of await window.CWFieldIncomplete?.pendingSummary?.()||[])items.push(externalReviewItem(item));
      for(const item of await window.CWFieldEquipment?.pendingSummary?.()||[])items.push(externalReviewItem(item));
      for(const item of await window.CWFieldStockRequest?.pendingSummary?.()||[])items.push(externalReviewItem(item));
      for(const item of await window.CWFieldProblemReport?.pendingSummary?.()||[])items.push(externalReviewItem(item));
      const intakeSession=window.CWFieldWriteStore.session(),intakes=await window.CWFieldWriteStore.records('FIELD_CLIENT_INTAKE',intakeSession,true);
      for(const row of intakes.filter(row=>!row.response))items.push(reviewItem('pending',copy('intakePending',{name:row.payload.clientName}),language()));
      const intakeRaw=localStorage.getItem('cwFieldIntakeDraft:'+intakeSession.owner);
      if(intakeRaw){let draft;try{draft=JSON.parse(intakeRaw);}catch(_){throw Error('Rascunho de cadastro ilegível. Preserve os dados.');}const keys=['clientName','phone','email','address','zone','poolName','poolType','volumeM3','latitude','longitude','notes'];if(!draft||Object.keys(draft).length!==14||Object.keys(draft).some(k=>!['v','owner','requestId',...keys].includes(k))||draft.v!==1||draft.owner!==intakeSession.owner||keys.some(k=>typeof draft[k]!=='string')||draft.requestId!==null&&!/^[0-9a-f-]{36}$/i.test(draft.requestId)||draft.requestId&&!intakes.some(row=>row.requestId===draft.requestId))throw Error('Rascunho de cadastro inválido. Preserve os dados.');if(keys.some(k=>draft[k]!=='')&&!intakes.some(row=>row.requestId===draft.requestId))items.push(reviewItem('pending',copy('intakeDraft'),language()));}
      for(const draft of await window.CWExtraVisitCorrection?.pendingDrafts?.()||[])items.push(reviewItem('pending',copy('correctionDraft',{name:draft.name}),language()));
      for(const item of await window.CWFieldDraftSummary?.()||[])items.push(externalReviewItem(item));
      if(revision!==requestedRevision||owner()!==requestedOwner||token!==window.CristalAuth?.getToken?.())return;
      bindings.delete(result);result.removeAttribute('data-cw-day-review-copy');result.replaceChildren();
      const title = document.createElement('p');
      setCopy(title,copy(items.length ? 'outstanding' : 'empty'));
      result.append(title);
      for (const kind of ['critical','pending','unknown']) {
        const rows = items.filter(item=>item.kind===kind);
        if (!rows.length) continue;
        const group = document.createElement('section'); group.className = `day-review-group day-review-${kind}`;
        const heading = document.createElement('h3'); setCopy(heading,copy('group',{label:copy(kind),count:rows.length})); group.append(heading);
        const list = document.createElement('ul');
        for (const item of rows) { const row = document.createElement('li'); if(itemCopies.has(item))setCopy(row,itemCopies.get(item));else row.textContent=item.text; list.append(row); }
        group.append(list); result.append(group);
      }
      const stamp = document.createElement('small');
      setCopy(stamp,copy('stamp',{reviewed:dateCopy(new Date().toISOString(),true),confirmed:snapshot.confirmedAt ? dateCopy(snapshot.confirmedAt) : copy('unconfirmed')}));
      result.append(stamp);
    } catch (error) {
      if (owner() === requestedOwner && revision === requestedRevision) setCopy(result,copy('failed'));
    } finally { if (revision === requestedRevision) { button.disabled = false; result.setAttribute('aria-busy','false'); } }
  }
  button.addEventListener('click', review);
  ['online', 'offline', 'storage', 'cw:visit-synced', 'cw:water-state-updated', 'cw:field-write-change'].forEach(event => window.addEventListener(event, invalidate));
  document.addEventListener('visibilitychange', invalidate);
  document.addEventListener('input', event=>{ if(event.target !== document.getElementById('cwLanguageSelect'))invalidate(); });
  window.setInterval(invalidate, 60000);

  const handoverPanel=document.createElement('section');
  handoverPanel.id='handoverPanel';
  handoverPanel.className='card field-panel field-panel-hoje';
  handoverPanel.setAttribute('data-cw-state-managed','manual');
  handoverPanel.setAttribute('data-cw-no-i18n','');
  handoverPanel.innerHTML='<h2></h2><p></p><button type="button" class="big" id="handoverRefresh"></button><div id="handoverStatus" role="status" aria-live="polite"></div><div id="handoverList"></div>';
  setCopy(handoverPanel.querySelector('h2'),copy('handoverTitle'));setCopy(handoverPanel.querySelector('p'),copy('handoverIntro'));setCopy(handoverPanel.querySelector('button'),copy('handoverRefresh'));
  document.getElementById('dayReviewCard').after(handoverPanel);
  const handoverStatus=document.getElementById('handoverStatus'),handoverList=document.getElementById('handoverList');
  let handoverRevision=0;
  async function handoverApi(path,body) {
    const response=await fetch(`/api/technician/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${window.CristalAuth?.getToken?.()}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    const data=await response.json();if(!response.ok||data.ok===false)throw data.error?new Error(data.error):panelError('panelResponseUnavailable');return data;
  }
  async function loadHandovers() {
    const principal=owner(),token=window.CristalAuth?.getToken?.(),version=++handoverRevision;
    handoverList.replaceChildren();setCopy(handoverStatus,copy('handoverLoading'));
    try {
      const [water,pump,incoming,targets]=await Promise.all(['water-reminders','pump-reminders','reminder-handovers/incoming','reminder-handovers/targets'].map(path=>handoverApi(path)));
      if(version!==handoverRevision||owner()!==principal||token!==window.CristalAuth?.getToken?.())return;
      await window.CWFieldReminders?.sync?.();
      if(version!==handoverRevision||owner()!==principal||token!==window.CristalAuth?.getToken?.())return;
      const outgoing=[...water.reminders,...pump.reminders].filter(row=>!row.isCompleted&&!row.transferredAway);
      for(const [row,isIncoming] of [...incoming.reminders.map(row=>[row,true]),...outgoing.map(row=>[row,false])]) {
        const card=document.createElement('section');card.className='day-review-group';card.dataset.handoverReminder=row.id;
        const title=document.createElement('h3');title.textContent=row.title;card.append(title);
        const text=document.createElement('p'),proposal=row.metadata?.handover;
        setCopy(text,isIncoming ? copy('handoverIncoming',{reason:proposal.reason}) : proposal?.status==='PENDING' ? copy('handoverWaiting',{name:proposal.toName}) : copy('handoverChoose'));card.append(text);
        const action=document.createElement('button');action.type='button';action.className='big';
        let select,reason;
        const operation=isIncoming?'accept':proposal?.status==='PENDING'?'cancel':'request';
        if(operation==='request') {
          select=document.createElement('select');setCopyAttribute(select,'aria-label',copy('handoverTarget'));
          const empty=document.createElement('option');empty.value='';setCopy(empty,copy('handoverSelect'));select.append(empty);
          for(const tech of targets.technicians.filter(tech=>tech.id!==row.assignedToTechnicianId)){const option=document.createElement('option');option.value=tech.id;option.textContent=tech.name;select.append(option);}
          reason=document.createElement('textarea');setCopyAttribute(reason,'placeholder',copy('handoverReason'));setCopyAttribute(reason,'aria-label',copy('handoverReason'));reason.maxLength=1000;card.append(select,reason);
        }
        setCopy(action,copy({request:'handoverRequest',accept:'handoverAccept',cancel:'handoverCancel'}[operation]));
        action.onclick=async()=>{
          if(owner()!==principal||token!==window.CristalAuth?.getToken?.())return loadHandovers();
          if(operation==='accept'&&!confirm(textCopy('handoverConfirm')))return;
          action.disabled=true;
          try {
            await handoverApi(`reminder-handovers/${row.id}/${operation}`,operation==='request'?{technicianId:Number(select.value),reason:reason.value}:{handoverId:proposal.id});
            if(owner()!==principal||token!==window.CristalAuth?.getToken?.())return;
            invalidate();await window.CWPumpReminders?.sync?.();await loadHandovers();
          } catch(error){if(owner()===principal&&token===window.CristalAuth?.getToken?.()){setCopy(handoverStatus,copy('handoverActionFailed',{detail:panelErrorCopy(error)}));action.disabled=false;}}
        };card.append(action);handoverList.append(card);
      }
      setCopy(handoverStatus,incoming.reminders.length?copy('handoverCount',{count:incoming.reminders.length}):copy(outgoing.length?'handoverUpdated':'handoverEmpty'));
    }catch(error){if(version===handoverRevision&&owner()===principal)setCopy(handoverStatus,copy('handoverUnavailable'));}
  }
  document.getElementById('handoverRefresh').onclick=loadHandovers;
  window.addEventListener('online',loadHandovers);
  loadHandovers();

  const receiptPanel=document.createElement('section');receiptPanel.id='visitReceiptPanel';receiptPanel.className='card field-panel field-panel-hoje';receiptPanel.setAttribute('data-cw-state-managed','manual');
  receiptPanel.setAttribute('data-cw-no-i18n','');
  receiptPanel.innerHTML='<h2></h2><p></p><button class="big" id="receiptRefresh" type="button"></button><p id="receiptStatus" role="status" aria-live="polite"></p><div id="receiptList"></div>';
  setCopy(receiptPanel.querySelector('h2'),copy('receiptTitle'));setCopy(receiptPanel.querySelector('p'),copy('receiptIntro'));setCopy(receiptPanel.querySelector('button'),copy('receiptRefresh'));
  document.getElementById('dayReviewCard').before(receiptPanel);
  let receiptRevision=0;
  const receiptEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function loadReceipts(){
    const revision=++receiptRevision,token=window.CristalAuth?.getToken?.(),principal=owner(),status=document.getElementById('receiptStatus');
    setCopy(status,copy(navigator.onLine?'receiptLoading':'receiptOfflineQuery'));
    if(!navigator.onLine)return;
    try{
      const response=await fetch('/api/technician/visit-receipts',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(!response.ok)throw data.error?new Error(data.error):panelError('receiptQueryFailed');
      if(revision!==receiptRevision||principal!==owner()||token!==window.CristalAuth?.getToken?.())return;
      const tomorrow=new Date();tomorrow.setHours(0,0,0,0);tomorrow.setDate(tomorrow.getDate()+1);
      const current=data.receipts.filter(row=>!row.plannedDate||new Date(row.plannedDate)<tomorrow),future=data.receipts.filter(row=>row.plannedDate&&new Date(row.plannedDate)>=tomorrow);
      const renderReceipt=row=>{
        const item=document.createElement('div');item.style.cssText='padding:12px 0;overflow-wrap:anywhere';
        const title=document.createElement('strong'),date=document.createElement('p'),action=document.createElement('button');
        setCopy(title,copy(row.visitType==='EXTRA'?'receiptExtra':'receiptRegular',{name:row.poolName,id:row.visitId}));
        setCopy(date,row.plannedDate?dateCopy(row.plannedDate,false,true):copy('receiptDateUnknown'));
        action.className='big';action.type='button';action.dataset.receipt=row.id;action.style.cssText='min-height:48px;white-space:normal';setCopy(action,copy('receiptConfirm'));
        item.append(title,date,action);return item;
      };
      const list=document.getElementById('receiptList');list.replaceChildren(...current.map(renderReceipt));
      if(future.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.style.cssText='min-height:48px;padding:12px 0';setCopy(summary,copy('receiptFuture',{count:future.length}));details.append(summary,...future.map(renderReceipt));list.append(details);}
      setCopy(status,data.receipts.length?copy('receiptCount',{count:data.receipts.length}):copy('receiptEmpty'));
    }catch(error){if(revision===receiptRevision&&principal===owner()&&token===window.CristalAuth?.getToken?.())setCopy(status,copy('receiptRefreshFailed',{detail:panelErrorCopy(error)}));}
  }
  document.getElementById('receiptRefresh').onclick=loadReceipts;
  document.getElementById('receiptList').onclick=async event=>{
    const button=event.target.closest('[data-receipt]');if(!button||button.disabled)return;
    const token=window.CristalAuth?.getToken?.(),principal=owner(),status=document.getElementById('receiptStatus');
    if(!navigator.onLine){setCopy(status,copy('receiptOfflineAction'));return;}
    button.disabled=true;
    try{
      const response=await fetch(`/api/technician/visit-receipts/${button.dataset.receipt}/acknowledge`,{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(!response.ok)throw data.error?new Error(data.error):panelError('receiptConfirmFailed');
      if(principal!==owner()||token!==window.CristalAuth?.getToken?.())return;
      await loadReceipts();if(principal!==owner()||token!==window.CristalAuth?.getToken?.())return;setCopy(status,copy('receiptConfirmed'));
    }catch(error){if(principal===owner()&&token===window.CristalAuth?.getToken?.())setCopy(status,copy('receiptActionFailed',{detail:panelErrorCopy(error)}));}
    finally{button.disabled=false;}
  };
  window.addEventListener('online',loadReceipts);window.addEventListener('offline',()=>{receiptRevision++;setCopy(document.getElementById('receiptStatus'),copy('receiptOffline'));});
  setInterval(loadReceipts,60000);loadReceipts();

  const shortagePanel=document.createElement('section');shortagePanel.id='fieldShortagePreparation';shortagePanel.className='card field-panel field-panel-hoje';shortagePanel.setAttribute('data-cw-state-managed','manual');
  shortagePanel.setAttribute('data-cw-no-i18n','');
  shortagePanel.innerHTML='<h2></h2><p></p><button type="button" class="big" id="shortageRefresh" style="background:#075c4c!important;color:#fff!important;min-height:48px"></button><p id="shortageStatus" role="status" aria-live="polite"></p><div id="shortageList"></div>';
  setCopy(shortagePanel.querySelector('h2'),copy('chemicalTitle'));setCopy(shortagePanel.querySelector('p'),copy('chemicalIntro'));setCopy(shortagePanel.querySelector('button'),copy('chemicalRefresh'));
  receiptPanel.after(shortagePanel);let shortageRevision=0,shortageIdentity=null;
  function deliveryMessage(container,value){
    // Bind a leaf: replacing this message with a form must not leave a binding that later removes its inputs.
    const message=document.createElement('span');setCopy(message,value);container.replaceChildren(message);
  }
  function renderShortage(row){
    const item=document.createElement('div');item.dataset.shortage=row.shortageId;item.style.cssText='padding:12px 0;overflow-wrap:anywhere';
    const title=document.createElement('strong'),visit=document.createElement('p'),received=document.createElement('p');
    setCopy(title,copy('chemicalProduct',{name:row.productName,quantity:row.quantity===null?copy('chemicalQuantityUnknown'):row.quantity+' '+row.unit}));
    setCopy(visit,copy('chemicalVisit',{visit:copy(row.visitType==='EXTRA'?'receiptExtra':'receiptRegular',{name:row.poolName,id:row.visitId}),date:row.plannedDate?dateCopy(row.plannedDate,false,true):copy('receiptDateUnknown')}));
    setCopy(received,copy('chemicalReceived',{quantity:row.receivedQuantity||0,unit:row.unit,remaining:row.quantity===null?copy('chemicalTotalUnknown'):copy('chemicalRemaining',{quantity:Math.max(0,row.quantity-(row.receivedQuantity||0)),unit:row.unit})}));
    item.append(title,visit,received);
    if(row.returnedQuantity){const returned=document.createElement('p');setCopy(returned,copy('chemicalReturned',{quantity:row.returnedQuantity,unit:row.unit}));item.append(returned);}
    if(row.quantity===null||row.receivedQuantity<row.quantity){
      const button=document.createElement('button'),container=document.createElement('div');
      button.type='button';button.className='big';button.style.cssText='background:#075c4c!important;color:#fff!important;min-height:48px';button.dataset.deliveryOptions=row.shortageId;setCopy(button,copy('chemicalReceive'));
      container.setAttribute('data-delivery-form','');item.append(button,container);
    }else{const complete=document.createElement('p');setCopy(complete,copy('chemicalComplete'));item.append(complete);}
    return item;
  }
  async function loadShortages(){
    const token=window.CristalAuth?.getToken?.(),principal=owner(),status=document.getElementById('shortageStatus'),identity=JSON.stringify([principal,token]);
    if(identity!==shortageIdentity){shortageIdentity=identity;shortageRevision++;document.getElementById('shortageList').replaceChildren();}
    if(shortagePanel.querySelector('form')&&arguments[0]!==true)return;
    const revision=++shortageRevision;
    if(!navigator.onLine){setCopy(status,copy('chemicalOfflineQuery'));return;}
    setCopy(status,copy('chemicalLoading'));
    try{
      const response=await fetch('/api/technician/chemical-shortages',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(!response.ok)throw data.error?new Error(data.error):panelError('chemicalQueryFailed');
      if(revision!==shortageRevision||principal!==owner()||token!==window.CristalAuth?.getToken?.())return;
      document.getElementById('shortageList').replaceChildren(...data.rows.map(renderShortage));
      setCopy(status,data.rows.length?copy('chemicalCount',{count:data.rows.length}):copy('chemicalEmpty'));
    }catch(error){if(revision===shortageRevision&&principal===owner()&&token===window.CristalAuth?.getToken?.())setCopy(status,copy('chemicalRefreshFailed',{detail:panelErrorCopy(error)}));}
  }
  shortagePanel.addEventListener('click',async event=>{
    const button=event.target.closest('[data-delivery-options]');if(!button)return;
    if(shortagePanel.querySelector('form')){setCopy(document.getElementById('shortageStatus'),copy('chemicalOpenReceipt'));return;}
    const id=button.dataset.deliveryOptions,container=button.parentElement.querySelector('[data-delivery-form]'),token=window.CristalAuth?.getToken?.(),principal=owner();
    if(!navigator.onLine){deliveryMessage(container,copy('chemicalConnect'));return;}
    button.disabled=true;
    try{
      const response=await fetch(`/api/technician/chemical-shortages/${id}/deliveries`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(token!==window.CristalAuth?.getToken?.()||principal!==owner()||!container.isConnected)return;
      if(!response.ok)throw data.error?new Error(data.error):panelError('chemicalDeliveriesFailed');
      if(!data.rows.length){deliveryMessage(container,copy('chemicalNoTransfer'));return;}
      if(shortagePanel.querySelector('form'))return;
      shortageRevision++;button.hidden=true;
      container.innerHTML='<form><label><span data-transfer-label></span><select name="movement" required style="min-height:48px;width:100%"></select></label><p data-delivery-details></p><label><span data-quantity-label></span><input name="quantity" type="number" min="0.001" step="any" required inputmode="decimal" style="min-height:48px;width:100%"></label><button type="submit" class="big" style="background:#075c4c!important;color:#fff!important;min-height:48px"></button><button type="button" data-delivery-cancel style="min-height:48px"></button><p role="status"></p></form>';
      setCopy(container.querySelector('[data-transfer-label]'),copy('chemicalTransfer'));setCopy(container.querySelector('[data-quantity-label]'),copy('chemicalQuantity'));setCopy(container.querySelector('[type=submit]'),copy('chemicalSubmit'));setCopy(container.querySelector('[data-delivery-cancel]'),copy('chemicalCancel'));
      const select=container.querySelector('select');
      for(const movement of data.rows){const option=document.createElement('option');option.value=movement.id;setCopy(option,copy('chemicalMovement',{quantity:movement.available,unit:movement.unit,date:dateCopy(movement.createdAt),id:movement.id}));select.append(option);}
      select.onchange=()=>{const movement=data.rows.find(m=>m.id===Number(select.value));setCopy(container.querySelector('[data-delivery-details]'),copy('chemicalAvailable',{quantity:movement.available,unit:movement.unit}));};select.onchange();
      container.querySelector('[data-delivery-cancel]').onclick=()=>loadShortages(true);
      container.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const form=e.currentTarget,message=form.querySelector('[role=status]');
        if(token!==window.CristalAuth?.getToken?.()||principal!==owner())return;
        if(!navigator.onLine){setCopy(message,copy('chemicalOfflineAction'));return;}
        const body={movementId:Number(form.elements.movement.value),quantity:Number(form.elements.quantity.value)},key='cwChemicalDelivery:'+JSON.stringify([principal,id,body]);
        try{body.requestId=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,body.requestId);}catch{setCopy(message,copy('chemicalStorageFailed'));return;}
        for(const control of form.elements)control.disabled=true;document.getElementById('shortageRefresh').disabled=true;
        try{const reply=await fetch(`/api/technician/chemical-shortages/${id}/deliveries`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)}),result=await reply.json();
          if(token!==window.CristalAuth?.getToken?.()||principal!==owner())return;
          if(!reply.ok)throw result.error?new Error(result.error):panelError('chemicalConfirmFailed');localStorage.removeItem(key);setCopy(message,copy('chemicalConfirmed'));await loadShortages(true);
        }catch(error){if(token===window.CristalAuth?.getToken?.()&&principal===owner())setCopy(message,copy('chemicalRetry',{detail:panelErrorCopy(error)}));}finally{for(const control of form.elements)control.disabled=false;document.getElementById('shortageRefresh').disabled=false;}
      };
    }catch(error){if(token===window.CristalAuth?.getToken?.()&&principal===owner())deliveryMessage(container,panelErrorCopy(error));}finally{button.disabled=false;}
  });
  document.getElementById('shortageRefresh').onclick=()=>loadShortages(true);window.addEventListener('online',loadShortages);window.addEventListener('offline',()=>{shortageRevision++;setCopy(document.getElementById('shortageStatus'),copy('chemicalOffline'));});setInterval(loadShortages,60000);loadShortages();
})();
