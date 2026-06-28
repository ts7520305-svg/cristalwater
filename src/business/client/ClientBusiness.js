const prisma = require("../../prismaClient");

function boolFrom(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
}

function numberOrUndefined(value) {
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function cleanString(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const v = String(value).trim();
    return v || null;
}

function definedOnly(data) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function clientUpdateData(body = {}, currentClient = null) {
    const finalContractActive = body.contractActive === undefined
        ? Boolean(currentClient?.contractActive)
        : boolFrom(body.contractActive);

    const wantsBillingActive = body.billingActive === undefined
        ? undefined
        : boolFrom(body.billingActive);

    if (wantsBillingActive === true && !finalContractActive) {
        const error = new Error("Não é possível ativar faturação sem ativar primeiro o contrato.");
        error.statusCode = 400;
        throw error;
    }

    return definedOnly({
        name: cleanString(body.name),
        internalName: cleanString(body.internalName),
        email: cleanString(body.email),
        phone: cleanString(body.phone),
        address: cleanString(body.address),
        zone: cleanString(body.zone),
        notes: cleanString(body.notes),
        monthlyFee: numberOrUndefined(body.monthlyFee),
        monthlyAmount: numberOrUndefined(body.monthlyFee ?? body.monthlyAmount),
        requiresInvoice: body.requiresInvoice === undefined ? undefined : boolFrom(body.requiresInvoice),
        fiscalName: cleanString(body.fiscalName),
        fiscalNif: cleanString(body.fiscalNif ?? body.nif),
        fiscalAddress: cleanString(body.fiscalAddress),
        fiscalEmail: cleanString(body.fiscalEmail),
        externalBillingNotes: cleanString(body.externalBillingNotes),
        contractActive: body.contractActive === undefined ? undefined : finalContractActive,
        billingActive: wantsBillingActive,
    });
}

class ClientBusiness {

    async list(query = {}) {
        const includeInactive =
            ["true", "1", "yes", "sim"].includes(
                String(query.includeInactive || "").toLowerCase()
            );

        const where = includeInactive ? {} : {
            active: true,
            deletedAt: null,
            archiveStatus: "ATIVO",
            status: {
                not: "ARCHIVED"
            }
        };

        return prisma.client.findMany({
            where,
            include: {
                pools: {
                    where: includeInactive
                        ? {}
                        : {
                            active: true,
                            deletedAt: null,
                            archiveStatus: "ATIVO"
                        }
                }
            },
            orderBy: {
                name: "asc"
            }
        });
    }

    async getById(clientId) {
        return prisma.client.findUnique({
            where: {
                id: Number(clientId)
            },
            include: {
                pools: true,
                invoices: true
            }
        });
    }

    async create(data) {
        return prisma.client.create({
            data
        });
    }

    async update(clientId, body = {}) {
        const id = Number(clientId);

        const currentClient = await prisma.client.findUnique({
            where: { id }
        });

        if (!currentClient) {
            const error = new Error("Cliente não encontrado");
            error.statusCode = 404;
            throw error;
        }

        return prisma.client.update({
            where: { id },
            data: clientUpdateData(body, currentClient)
        });
    }

}

module.exports = new ClientBusiness();
