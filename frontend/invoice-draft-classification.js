(() => {
  const DRAFT_STATUSES = new Set(["DRAFT", "RASCUNHO"]);

  function isDraftStatusValue(status) {
    return DRAFT_STATUSES.has(String(status || "").trim().toUpperCase());
  }

  const originalInvoiceOpenAmount = invoiceOpenAmount;
  invoiceOpenAmount = function invoiceOpenAmountWithDraftGuard(invoice) {
    if (isDraftStatusValue(invoice?.status)) return 0;
    return originalInvoiceOpenAmount(invoice);
  };

  const originalMatchesInvoiceStatusFilter = matchesInvoiceStatusFilter;
  matchesInvoiceStatusFilter = function matchesInvoiceStatusFilterWithDraft(invoice) {
    const isDraft = isDraftStatusValue(invoice?.status);
    if (invoiceStatusFilter === "draft") return isDraft;
    if (isDraft && invoiceStatusFilter !== "all") return false;
    return originalMatchesInvoiceStatusFilter(invoice);
  };

  const originalStatusLabelText = statusLabelText;
  statusLabelText = function statusLabelTextWithDraft(status) {
    if (isDraftStatusValue(status)) return "RASCUNHO";
    return originalStatusLabelText(status);
  };

  const originalStatusClassName = statusClassName;
  statusClassName = function statusClassNameWithDraft(status) {
    if (isDraftStatusValue(status)) return "draft";
    return originalStatusClassName(status);
  };

  function ensureDraftFilterOption() {
    const select = document.getElementById("statusFilter");
    if (!select || select.querySelector('option[value="draft"]')) return;
    const option = document.createElement("option");
    option.value = "draft";
    option.textContent = "Rascunhos";
    const pending = select.querySelector('option[value="pending"]');
    select.insertBefore(option, pending || null);
  }

  function ensureDraftSummaryCard() {
    if (document.getElementById("sumDrafts")) return;
    const summary = document.querySelector(".summary");
    if (!summary) return;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-title">Rascunhos</div>
      <div class="card-value" id="sumDrafts">0</div>
    `;

    const pendingValue = document.getElementById("sumPending");
    const pendingCard = pendingValue?.closest(".card");
    if (pendingCard?.nextSibling) summary.insertBefore(card, pendingCard.nextSibling);
    else summary.appendChild(card);
  }

  function installDraftStyles() {
    if (document.getElementById("invoiceDraftClassificationStyles")) return;
    const style = document.createElement("style");
    style.id = "invoiceDraftClassificationStyles";
    style.textContent = `
      .invoice-card.draft {
        border-left-color: #64748b;
        background: #f8fafc;
      }
      .invoice-badge.draft {
        background: #475569 !important;
        color: #ffffff !important;
        border-color: #94a3b8 !important;
      }
      .draft-notice {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #334155;
      }
      .invoice-card.draft button:disabled {
        cursor: not-allowed;
        opacity: .82;
      }
    `;
    document.head.appendChild(style);
  }

  const originalUpdateSummary = updateSummary;
  updateSummary = function updateSummaryWithDrafts(invoices) {
    originalUpdateSummary(invoices);
    ensureDraftSummaryCard();
    const drafts = (Array.isArray(invoices) ? invoices : []).filter((invoice) => isDraftStatusValue(invoice?.status)).length;
    const box = document.getElementById("sumDrafts");
    if (box) box.textContent = String(drafts);
  };

  const originalRenderInvoices = renderInvoices;
  renderInvoices = function renderInvoicesWithDraftClassification(invoices) {
    originalRenderInvoices(invoices);

    const cards = Array.from(document.querySelectorAll("#invoiceList .invoice-card"));
    (Array.isArray(invoices) ? invoices : []).forEach((invoice, index) => {
      if (!isDraftStatusValue(invoice?.status)) return;
      const card = cards[index];
      if (!card) return;

      card.classList.add("draft");
      card.classList.remove("overdue");

      const actions = card.querySelector(".actions");
      const buttons = actions ? Array.from(actions.querySelectorAll("button")) : [];
      const paymentButton = buttons.find((button) => button.textContent.includes("Registar pagamento"));
      if (paymentButton) {
        paymentButton.disabled = true;
        paymentButton.className = "btn-gray";
        paymentButton.removeAttribute("onclick");
        paymentButton.textContent = "Pagamento indisponível — rascunho";
      }

      const pdfButton = buttons.find((button) => button.textContent.includes("Abrir PDF"));
      if (pdfButton) pdfButton.textContent = "Pré-visualizar PDF";

      const copyButton = buttons.find((button) => button.textContent.includes("Copiar link PDF"));
      if (copyButton) {
        copyButton.disabled = true;
        copyButton.removeAttribute("onclick");
        copyButton.textContent = "Partilha disponível após emissão";
      }

      if (!card.querySelector(".draft-notice")) {
        const notice = document.createElement("div");
        notice.className = "meta draft-notice";
        notice.innerHTML = "<strong>Rascunho:</strong> ainda não emitido. Não conta como dívida nem aceita pagamentos.";
        if (actions) card.insertBefore(notice, actions);
        else card.appendChild(notice);
      }
    });
  };

  const originalSetInvoiceStatusFilter = setInvoiceStatusFilter;
  setInvoiceStatusFilter = function setInvoiceStatusFilterWithDraft(filter) {
    if (filter !== "draft") return originalSetInvoiceStatusFilter(filter);

    invoiceStatusFilter = "draft";
    const params = new URLSearchParams(location.search);
    params.set("status", "draft");
    const nextQuery = params.toString();
    history.replaceState(null, "", `${location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    loadInvoices();
  };

  const requestedFilter = String(new URLSearchParams(location.search).get("status") || new URLSearchParams(location.search).get("filter") || "").toLowerCase();
  if (requestedFilter === "draft") invoiceStatusFilter = "draft";

  ensureDraftFilterOption();
  ensureDraftSummaryCard();
  installDraftStyles();
})();
