const express = require("express");

const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const { roleMatches } = require("../utils/roles");

const { prisma } =
  require("../prismaClient");

// ======================================================
// REPORT VISIT
// ======================================================

router.use(auth());

router.get("/visit/:id", async (req, res) => {

  try {

    const visit =
      await prisma.serviceVisit.findUnique({

        where: {

          id:
            Number(req.params.id)
        },

        include: {

          pool: {

            include: {

              client: true
            }
          },

          photos: true
        }
      });

    if (!visit){

      return res.send(
        "Visita não encontrada"
      );
    }

    const user = req.user || {};
    const isAdmin = roleMatches(user.role, "ADMIN");
    const isTechnician = roleMatches(user.role, "TECHNICIAN") && !isAdmin;
    const isClient = roleMatches(user.role, "CLIENT");

    if (isTechnician && Number(visit.technicianId || 0) !== Number(user.technicianId || user.id || 0)) {
      return res.status(403).send("Acesso negado");
    }

    if (isClient) {
      const authClientId = Number(user.clientId || user.id || 0);
      const visitClientId = Number(visit.clientId || visit.pool?.clientId || 0);
      if (!authClientId || authClientId !== visitClientId) {
        return res.status(403).send("Acesso negado");
      }
    }

    const beforePhotos =
      (visit.photos || [])

      .filter(
        p => p.type === "BEFORE"
      );

    const afterPhotos =
      (visit.photos || [])

      .filter(
        p => p.type === "AFTER"
      );

    const html = `

      <!doctype html>

      <html lang="pt">

      <head>

        <meta charset="utf-8">

        <title>
          Relatório Técnico
        </title>

        <style>

          body{
            font-family:Arial;
            margin:30px;
            color:#1f2937;
          }

          h1,h2{
            margin-bottom:8px;
          }

          .card{
            border:1px solid #ddd;
            border-radius:10px;
            padding:15px;
            margin-bottom:20px;
          }

          .photos{
            display:flex;
            flex-wrap:wrap;
            gap:10px;
          }

          .photos img{
            width:180px;
            height:180px;
            object-fit:cover;
            border-radius:8px;
          }

          .muted{
            color:#6b7280;
          }

          @media print{
            button{
              display:none;
            }
          }

        </style>

      </head>

      <body>

      <button onclick="window.print()">
        Imprimir / Guardar PDF
      </button>

      <h1>
        Relatório Técnico Piscina
      </h1>

      <div class="muted">
        Cristal Water
      </div>

      <div class="card">

        <h2>
          ${visit.pool?.name || "-"}
        </h2>

        <div>
          👤 Cliente:
          ${visit.pool?.client?.name || "-"}
        </div>

        <div>
          👨‍🔧 Técnico:
          ${visit.technicianName || "-"}
        </div>

        <div>
          🕒 Início:
          ${
            visit.startAt
              ? new Date(visit.startAt)
                  .toLocaleString("pt-PT")
              : "-"
          }
        </div>

        <div>
          🕒 Fim:
          ${
            visit.endAt
              ? new Date(visit.endAt)
                  .toLocaleString("pt-PT")
              : "-"
          }
        </div>

      </div>

      <div class="card">

        <h2>
          Parâmetros Água
        </h2>

        <div>
          🧪 pH:
          ${visit.ph ?? "-"}
        </div>

        <div>
          🧪 Cloro:
          ${visit.chlorine ?? "-"}
        </div>

        <div>
          🧪 Alcalinidade:
          ${visit.alkalinity ?? "-"}
        </div>

        <div>
          🧂 Sal:
          ${visit.salt ?? "-"}
        </div>

      </div>

      <div class="card">

        <h2>
          Produtos Adicionados
        </h2>

        <div>
          ${visit.products || "-"}
        </div>

      </div>

      <div class="card">

        <h2>
          Observações Técnicas
        </h2>

        <div>
          ${visit.notes || "-"}
        </div>

      </div>

      <div class="card">

        <h2>
          BEFORE
        </h2>

        <div class="photos">

          ${
            beforePhotos.map(p => `
              <img src="${p.url}">
            `).join("")
          }

        </div>

      </div>

      <div class="card">

        <h2>
          AFTER
        </h2>

        <div class="photos">

          ${
            afterPhotos.map(p => `
              <img src="${p.url}">
            `).join("")
          }

        </div>

      </div>

      </body>

      </html>

    `;

    res.setHeader(
      "Content-Type",
      "text/html; charset=utf-8"
    );

    return res.send(html);

  } catch(err){

    console.error(err);

    return res.send(
      "Erro relatório"
    );
  }
});

// ======================================================

module.exports = router;