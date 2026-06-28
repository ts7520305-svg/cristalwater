function buildClientPaymentReference(clientId) {
  const id = Number(clientId);
  if (!Number.isFinite(id) || id <= 0) return "CW-000000";
  return `CW-${String(Math.trunc(id)).padStart(6, "0")}`;
}

function buildPaymentNoticeText({ client, amount, method, note, channel }) {
  const reference = buildClientPaymentReference(client?.id);
  const parts = [
    "PAGAMENTO COMUNICADO",
    `Referencia cliente: ${reference}`,
    `Cliente: ${client?.name || `Cliente ${client?.id || ""}`}`.trim(),
  ];

  if (Number(amount) > 0) parts.push(`Valor comunicado: ${Number(amount).toFixed(2)} EUR`);
  if (method) parts.push(`Metodo indicado: ${method}`);
  if (channel) parts.push(`Canal: ${channel}`);
  if (note) parts.push(`Nota/comprovativo: ${note}`);

  parts.push("Confirmar no financeiro antes de marcar como pago.");
  return parts.join("\n");
}

module.exports = {
  buildClientPaymentReference,
  buildPaymentNoticeText,
};
