function buildAutoActions({
  technicians = [],
  visits = [],
  alerts = []
}){

  const actions = [];

  alerts.forEach(alert => {

    actions.push({
      type:"ESCALATE_ALERT",
      priority:"HIGH",
      message:`Alerta ${alert.type || "crítico"} precisa de acompanhamento`,
      alertId:alert.id
    });
  });

  technicians.forEach(tech => {

    const assigned =
      visits.filter(v => v.technicianId === tech.id);

    if (assigned.length >= 12){

      actions.push({
        type:"REDUCE_LOAD",
        priority:"HIGH",
        technicianId:tech.id,
        technicianName:tech.name,
        message:`Reduzir carga de ${tech.name}`
      });
    }

    if (assigned.length <= 4){

      actions.push({
        type:"AVAILABLE_HELP",
        priority:"LOW",
        technicianId:tech.id,
        technicianName:tech.name,
        message:`${tech.name} disponível para reforço`
      });
    }
  });

  return actions;
}

module.exports = {
  buildAutoActions
};