class VisitCompletionError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "VisitCompletionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function toNumber(value, field) {
  if (!hasValue(value)) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new VisitCompletionError(400, "INVALID_NUMBER", `${field} tem de ser numerico.`);
  }
  return number;
}

function assertRange(value, field, min, max, unit = "") {
  const number = toNumber(value, field);
  if (number === undefined) return undefined;
  if (number < min || number > max) {
    const suffix = unit ? ` ${unit}` : "";
    throw new VisitCompletionError(
      400,
      "INVALID_READING",
      `${field} invalido. Deve estar entre ${min} e ${max}${suffix}.`
    );
  }
  return number;
}

function normalizeProducts(products) {
  if (!hasValue(products)) return {};

  let parsed = products;
  if (typeof products === "string") {
    const raw = products.trim();
    if (!raw) return {};
    if (!raw.startsWith("[") && !raw.startsWith("{")) {
      return { productsText: raw };
    }
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      throw new VisitCompletionError(400, "INVALID_PRODUCTS", "Produtos devem estar em JSON valido.");
    }
  }

  if (!Array.isArray(parsed)) {
    throw new VisitCompletionError(400, "INVALID_PRODUCTS", "Produtos devem ser uma lista.");
  }

  const normalized = parsed.map((product, index) => {
    const name = String(product?.name || product?.productName || "").trim();
    if (!name) {
      throw new VisitCompletionError(400, "INVALID_PRODUCT_NAME", `Produto #${index + 1} sem nome.`);
    }

    const quantity = toNumber(product?.quantity, `Quantidade do produto ${name}`);
    if (quantity === undefined || quantity <= 0) {
      throw new VisitCompletionError(
        400,
        "INVALID_PRODUCT_QUANTITY",
        `Quantidade do produto ${name} deve ser maior que zero.`
      );
    }

    return {
      ...product,
      name,
      quantity,
      unit: product?.unit || null,
    };
  });

  return {
    productsText: JSON.stringify(normalized),
    chemicalsJson: normalized,
  };
}

function validateVisitCompletionPayload(body = {}) {
  const ph = assertRange(body.ph, "Valor de pH", 0, 10);
  const chlorine = assertRange(body.chlorine, "Valor de cloro", 0, 10);
  const alkalinity = assertRange(body.alkalinity, "Alcalinidade", 0, 300, "ppm");
  const salt = assertRange(body.salt, "Sal", 0, 10000, "ppm");
  const temperature = assertRange(body.temperature, "Temperatura", 0, 45, "C");
  const orpMv = assertRange(body.orpMv ?? body.orp, "ORP", 0, 1000, "mV");
  const { productsText, chemicalsJson } = normalizeProducts(body.products);

  return {
    ph,
    chlorine,
    alkalinity,
    salt,
    temperature,
    orpMv,
    productsText,
    chemicalsJson,
  };
}

function definedOnly(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function toPositiveIntValue(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function appendInternalNote(existing, line) {
  return [existing, line].filter(Boolean).join("\n").slice(-6000);
}

function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function productUnit(product) {
  return String(product?.unit || "KG").trim().toUpperCase() || "KG";
}

function movementNotes(body, visit, product) {
  return JSON.stringify({
    cwGuideMovement: true,
    userNotes: body.notes || "Consumo automatico ao concluir visita.",
    poolId: visit.poolId || null,
    clientId: visit.clientId || null,
    readings: {
      ph: hasValue(body.ph) ? Number(body.ph) : null,
      chlorine: hasValue(body.chlorine) ? Number(body.chlorine) : null,
      alkalinity: hasValue(body.alkalinity) ? Number(body.alkalinity) : null,
      orp: hasValue(body.orpMv ?? body.orp) ? Number(body.orpMv ?? body.orp) : null,
      salt: hasValue(body.salt) ? Number(body.salt) : null,
      temperature: hasValue(body.temperature) ? Number(body.temperature) : null,
    },
    productName: product.name,
    quantity: product.quantity,
    unit: productUnit(product),
  });
}

async function resolveWorkGuide(tx, visit, body) {
  const explicitWorkGuideId = Number(body.workGuideId || body.guideWorkId || 0);
  if (Number.isInteger(explicitWorkGuideId) && explicitWorkGuideId > 0) {
    return tx.workGuide.findUnique({ where: { id: explicitWorkGuideId } });
  }

  let vehicleId = Number(body.vehicleId || 0);
  if ((!vehicleId || !Number.isFinite(vehicleId)) && visit.technicianId) {
    const technician = await tx.technician.findUnique({
      where: { id: visit.technicianId },
      select: { vehicleId: true },
    }).catch(() => null);
    vehicleId = Number(technician?.vehicleId || 0);
  }

  if (!vehicleId || !Number.isFinite(vehicleId)) return null;

  return tx.workGuide.findFirst({
    where: { vehicleId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
}

async function registerAutomaticProductConsumption(tx, visit, body, products) {
  const items = Array.isArray(products) ? products.filter((item) => item && item.quantity > 0) : [];
  if (!items.length) return;

  const workGuide = await resolveWorkGuide(tx, visit, body);
  if (!workGuide) {
    throw new VisitCompletionError(
      409,
      "WORK_GUIDE_REQUIRED",
      "Nao e possivel consumir produtos sem guia de obra/viatura ativa."
    );
  }

  const guideItems = await tx.workGuideItem.findMany({
    where: { workGuideId: workGuide.id },
  });

  for (const product of items) {
    const target = guideItems.find((item) => normalize(item.name) === normalize(product.name));
    if (!target) {
      throw new VisitCompletionError(
        409,
        "WORK_GUIDE_ITEM_NOT_FOUND",
        `Produto ${product.name} nao existe na guia de obra ativa.`
      );
    }

    if (Number(target.quantity || 0) < Number(product.quantity || 0)) {
      throw new VisitCompletionError(
        409,
        "WORK_GUIDE_STOCK_INSUFFICIENT",
        `Stock insuficiente na viatura para ${product.name}. Disponivel: ${target.quantity} ${target.unit || "UN"}.`
      );
    }

    await tx.workGuideItem.update({
      where: { id: target.id },
      data: {
        quantity: Number(target.quantity || 0) - Number(product.quantity || 0),
        usedQty: Number(target.usedQty || 0) + Number(product.quantity || 0),
      },
    });

    await tx.vehicleStockMovement.create({
      data: {
        vehicleId: workGuide.vehicleId,
        transportGuideId: workGuide.guideId,
        workGuideId: workGuide.id,
        visitId: visit.id,
        technicianId: visit.technicianId || workGuide.technicianId || null,
        itemName: target.name,
        itemType: target.type,
        unit: target.unit || productUnit(product),
        quantity: Number(product.quantity || 0),
        movementType: "CONSUMPTION",
        source: "VISIT_COMPLETE_AUTO",
        notes: movementNotes(body, visit, product),
      },
    });

    await tx.stockMovement.create({
      data: {
        movementType: "CONSUMPTION",
        scopeFrom: "VEHICLE",
        vehicleId: workGuide.vehicleId || null,
        productName: target.name,
        category: target.type || "CHEMICAL",
        unit: target.unit || productUnit(product),
        quantity: Number(product.quantity || 0),
        transportGuideId: workGuide.guideId || null,
        workGuideId: workGuide.id,
        visitId: visit.id,
        clientId: visit.clientId || null,
        poolId: visit.poolId || null,
        technicianId: visit.technicianId || workGuide.technicianId || null,
        notes: movementNotes(body, visit, product),
        createdBy: "TECHNICIAN_FIELD_MODE",
      },
    }).catch(() => null);
  }
}

async function completeServiceVisit(prisma, visitId, body = {}) {
  const id = Number(visitId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new VisitCompletionError(400, "INVALID_VISIT_ID", "ID de visita invalido.");
  }

  const validated = validateVisitCompletionPayload(body);

  return prisma.$transaction(async (tx) => {
    const currentVisit = await tx.serviceVisit.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        endAt: true,
        poolId: true,
        clientId: true,
        technicianId: true,
        technicianName: true,
        internalNotes: true,
      },
    });

    if (!currentVisit) {
      throw new VisitCompletionError(404, "VISIT_NOT_FOUND", "Visita nao encontrada.");
    }

    if (currentVisit.status === "DONE" || currentVisit.endAt) {
      throw new VisitCompletionError(
        409,
        "VISIT_ALREADY_COMPLETED",
        "Esta visita ja foi concluida e submetida por outro tecnico."
      );
    }

    const actingTechnicianId = toPositiveIntValue(
      body.performedByTechnicianId || body.actualTechnicianId || body.technicianId
    );
    const actingTechnician = actingTechnicianId
      ? await tx.technician.findUnique({
          where: { id: actingTechnicianId },
          select: { id: true, name: true },
        }).catch(() => null)
      : null;
    const actingTechnicianName =
      actingTechnician?.name || String(body.performedByTechnicianName || body.technicianName || "").trim();
    const technicianChanged = Boolean(
      actingTechnicianId &&
      actingTechnicianId !== currentVisit.technicianId
    );
    const helperNote = technicianChanged
      ? `Apoio de ronda: visita originalmente atribuida a ${currentVisit.technicianName || currentVisit.technicianId || "tecnico por definir"} e executada por ${actingTechnicianName || `tecnico ${actingTechnicianId}`}.`
      : "";
    const internalNotes = [body.internalNotes, helperNote].filter(Boolean).join("\n");

    const data = definedOnly({
      status: "DONE",
      technicianId: technicianChanged ? actingTechnicianId : undefined,
      technicianName: technicianChanged && actingTechnicianName ? actingTechnicianName : undefined,
      cleaned: body.cleaned === undefined ? true : toBoolean(body.cleaned),
      brushed: toBoolean(body.brushed),
      vacuumed: toBoolean(body.vacuumed),
      basketCleaned: body.basketCleaned === undefined ? true : toBoolean(body.basketCleaned),
      waterlineClean: toBoolean(body.waterlineClean),
      backwashDone: toBoolean(body.backwashDone),
      ph: validated.ph,
      chlorine: validated.chlorine,
      alkalinity: validated.alkalinity,
      salt: validated.salt,
      temperature: validated.temperature,
      orpMv: validated.orpMv,
      products: validated.productsText,
      chemicalsJson: validated.chemicalsJson,
      notes: body.notes || null,
      internalNotes: internalNotes ? appendInternalNote(currentVisit.internalNotes, internalNotes) : undefined,
      endAt: new Date(),
    });

    const updatedCount = await tx.serviceVisit.updateMany({
      where: {
        id,
        status: { not: "DONE" },
        endAt: null,
      },
      data,
    });

    if (updatedCount.count !== 1) {
      throw new VisitCompletionError(
        409,
        "VISIT_ALREADY_COMPLETED",
        "Esta visita ja foi concluida e submetida por outro tecnico."
      );
    }

    let repair = null;
    const problem = body.problem || body.repair?.problem;
    if (problem && currentVisit.poolId) {
      repair = await tx.repair.create({
        data: {
          poolId: currentVisit.poolId,
          problem: String(problem),
          notes: body.problemNotes || body.repair?.resolution || null,
          status: "PENDING",
          priority: body.priority || body.repair?.priority || "NORMAL",
        },
      }).catch(() => null);
    }

    if (Array.isArray(validated.chemicalsJson) && validated.chemicalsJson.length) {
      await tx.chemicalUsage.deleteMany({ where: { visitId: id } }).catch(() => null);
      await tx.chemicalUsage.createMany({
        data: validated.chemicalsJson.map((product) => ({
          visitId: id,
          name: product.name,
          quantity: product.quantity,
          unit: product.unit || null,
        })),
      }).catch(() => null);

      await registerAutomaticProductConsumption(
        tx,
        {
          ...currentVisit,
          technicianId: technicianChanged ? actingTechnicianId : currentVisit.technicianId,
        },
        body,
        validated.chemicalsJson
      );
    }

    const visit = await tx.serviceVisit.findUnique({
      where: { id },
      include: {
        pool: { include: { client: true } },
        client: true,
        technician: true,
        chemicals: true,
        photos: true,
      },
    });

    return { visit, repair };
  });
}

module.exports = {
  VisitCompletionError,
  completeServiceVisit,
  validateVisitCompletionPayload,
};
