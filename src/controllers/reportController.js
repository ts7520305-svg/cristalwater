const { prisma } = require("../prismaClient");
const { period } = require("../services/operationalValueReportService");

function htmlText(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function getMonthlyPrintableReport(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const query = req.query || {};
  if (Object.keys(query).some(key => !["monthRef", "onlyRequiresInvoice"].includes(key)) ||
      typeof query.monthRef !== "string" ||
      (query.onlyRequiresInvoice !== undefined && !["true", "false"].includes(query.onlyRequiresInvoice))) {
    return res.status(400).json({ ok: false, error: "Indique um mês AAAA-MM e um filtro de faturação válido." });
  }
  let monthRef;
  try { ({ monthRef } = period({ monthRef: query.monthRef })); }
  catch (_) { return res.status(400).json({ ok: false, error: "Mês inválido; use AAAA-MM entre 2000 e 2199." }); }
  const onlyRequiresInvoice = query.onlyRequiresInvoice === "true";
  try {
    let invoices = await prisma.invoice.findMany({
      where: {
        monthRef,
      },
      include: {
        client: {
          include: {
            pools: true,
          },
        },
        payments: true,
      },
      orderBy: [{ id: "asc" }],
    });

    if (onlyRequiresInvoice) {
      invoices = invoices.filter((inv) => inv.requiresInvoice === true);
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
    const totalOpen = invoices.reduce((sum, inv) => sum + Number(inv.amountOpen || 0), 0);

    const html = `
      <!doctype html>
      <html lang="pt">
      <head>
        <meta charset="utf-8">
        <title>Relatório Mensal ${monthRef}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #1f2937; }
          h1, h2 { margin-bottom: 8px; }
          .muted { color: #6b7280; }
          .summary { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
          .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; min-width: 180px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; }
          .badge { display:inline-block; padding:4px 8px; border-radius:999px; color:#fff; font-size:11px; font-weight:bold; }
          .pending { background:#ef6c00; }
          .partial { background:#8e24aa; }
          .paid { background:#2e7d32; }
          @media print {
            button { display:none; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir / Guardar PDF</button>
        <h1>Relatório Mensal - ${monthRef}</h1>
        <div class="muted">${onlyRequiresInvoice ? "Apenas clientes que requerem fatura" : "Todos os clientes"}</div>

        <div class="summary">
          <div class="box"><strong>Clientes</strong><br>${invoices.length}</div>
          <div class="box"><strong>Total</strong><br>€ ${totalAmount.toFixed(2)}</div>
          <div class="box"><strong>Pago</strong><br>€ ${totalPaid.toFixed(2)}</div>
          <div class="box"><strong>Aberto</strong><br>€ ${totalOpen.toFixed(2)}</div>
        </div>

        ${invoices.map((inv) => `
          <div class="card">
            <h2>${htmlText(inv.client?.name || "-")}</h2>
            <div class="muted">
              Telefone: ${htmlText(inv.client?.phone || "-")} |
              Email: ${htmlText(inv.client?.email || "-")} |
              Morada: ${htmlText(inv.client?.address || "-")}
            </div>
            <div style="margin-top:8px;">
              Estado:
              ${
                inv.status === "PAID"
                  ? '<span class="badge paid">PAID</span>'
                  : inv.status === "PARTIAL"
                  ? '<span class="badge partial">PARTIAL</span>'
                  : '<span class="badge pending">PENDING</span>'
              }
            </div>
            <div style="margin-top:8px;">
              Total: € ${Number(inv.total || 0).toFixed(2)} |
              Pago: € ${Number(inv.amountPaid || 0).toFixed(2)} |
              Aberto: € ${Number(inv.amountOpen || 0).toFixed(2)}
            </div>

            <h3>Instalações</h3>
            <table>
              <thead>
                <tr>
                  <th>Instalação</th>
                  <th>Zona</th>
                  <th>Mensalidade</th>
                </tr>
              </thead>
              <tbody>
                ${(inv.client?.pools || []).map((pool) => `
                  <tr>
                    <td>${htmlText(pool.name || "-")}</td>
                    <td>${htmlText(pool.zone || "-")}</td>
                    <td>€ ${Number(pool.monthlyAmount || 0).toFixed(2)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <h3>Pagamentos</h3>
            <table>
              <thead>
                <tr>
                  <th>Valor</th>
                  <th>Método</th>
                  <th>Data</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                ${(inv.payments || []).length > 0 ? inv.payments.map((pay) => `
                  <tr>
                    <td>€ ${Number(pay.amount || 0).toFixed(2)}</td>
                    <td>${htmlText(pay.method || "-")}</td>
                    <td>${pay.paidAt ? new Date(pay.paidAt).toLocaleString("pt-PT") : "-"}</td>
                    <td>${htmlText(pay.notes || "-")}</td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="4">Sem pagamentos registados</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        `).join("")}
      </body>
      </html>
    `;

    res.set({ "X-CW-Report-Type": "monthly-print", "X-CW-Month-Ref": monthRef, "X-CW-Invoice-Filter": String(onlyRequiresInvoice), "X-Content-Type-Options": "nosniff" });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    console.error("getMonthlyPrintableReport error:", err);
    return res.status(500).send("Erro ao gerar relatório");
  }
}

module.exports = {
  getMonthlyPrintableReport,
};
