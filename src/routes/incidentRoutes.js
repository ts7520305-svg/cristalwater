const express =
  require("express");

const router =
  express.Router();

const auth =
  require("../middlewares/authMiddleware");

const {

  createIncident,

  updateIncidentStatus,

  escalateIncident,

  listIncidents,

  getCriticalIncidents,

  processSlaEscalations

} = require(
  "../services/incidentService"
);

// ======================================================
// LIST ALL INCIDENTS
// ======================================================

router.get(
  "/",
  auth("ADMIN"),

  async (req,res)=>{

    try {

      const incidents =
        await listIncidents();

      res.json({
        ok:true,
        incidents
      });

    } catch(err){

      console.error(err);

      res.status(500).json({
        ok:false,
        error:"Erro ao listar incidentes"
      });
    }
  }
);

// ======================================================
// INCIDENT SUMMARY
// ======================================================

router.get(
  "/summary",
  auth("ADMIN"),

  async (req,res)=>{

    try {

      const incidents =
        await listIncidents();

      const summary = {

        total:
          incidents.length,

        active:
          incidents.filter(i =>
            i.status !== "RESOLVED"
          ).length,

        resolved:
          incidents.filter(i =>
            i.status === "RESOLVED"
          ).length,

        critical:
          incidents.filter(i =>
            i.severity === "CRITICAL"
          ).length,

        high:
          incidents.filter(i =>
            i.severity === "HIGH"
          ).length,

        escalated:
          incidents.filter(i =>
            i.escalated
          ).length,

        autoEscalated:
          incidents.filter(i =>
            i.autoEscalated
          ).length
      };

      res.json({
        ok:true,
        summary
      });

    } catch(err){

      console.error(err);

      res.status(500).json({
        ok:false,
        error:"Erro ao gerar resumo"
      });
    }
  }
);

// ======================================================
// CRITICAL INCIDENTS
// ======================================================

router.get(
  "/critical",
  auth("ADMIN"),

  async (req,res)=>{

    try {

      const incidents =
        await getCriticalIncidents();

      res.json({
        ok:true,
        incidents
      });

    } catch(err){

      console.error(err);

      res.status(500).json({
        ok:false,
        error:"Erro ao listar críticos"
      });
    }
  }
);

// ======================================================
// CREATE INCIDENT
// ======================================================

router.post(
  "/",
  auth("ADMIN"),

  async (req,res)=>{

    try {

      const incident =
        await createIncident(
          req.body
        );

      res.json({
        ok:true,
        incident
      });

    } catch(err){

      console.error(err);

      res.status(500).json({
        ok:false,
        error:"Erro ao criar incidente"
      });
    }
  }
);

// ======================================================
// UPDATE STATUS
// ======================================================

router.post(
  "/status/:id",
  auth("ADMIN"),

  async (req,res)=>{

    try {

      const incident =
        await updateIncidentStatus(
          req.params.id,
          req.body.status
        );

      res.json({
        ok:true,
        incident
      });

    } catch(err){

      console.error(err);

      res.status(500).json({
        ok:false,
        error:"Erro ao atualizar incidente"
      });
    }
  }
);

// ======================================================
// ESCALATE INCIDENT
// ======================================================

router.post(
  "/escalate/:id",
  auth("ADMIN"),

  async (req,res)=>{

    try {

      const incident =
        await escalateIncident(
          req.params.id,
          false
        );

      res.json({
        ok:true,
        incident
      });

    } catch(err){

      console.error(err);

      res.status(500).json({
        ok:false,
        error:"Erro ao escalar incidente"
      });
    }
  }
);

// ======================================================
// RUN SLA ENGINE MANUALLY
// ======================================================

router.post(
  "/sla/run",
  auth("ADMIN"),

  async (req,res)=>{

    try {

      await processSlaEscalations();

      res.json({
        ok:true,
        message:"SLA engine executado"
      });

    } catch(err){

      console.error(err);

      res.status(500).json({
        ok:false,
        error:"Erro ao executar SLA engine"
      });
    }
  }
);

module.exports =
  router;