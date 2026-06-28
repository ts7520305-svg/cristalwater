const prisma = require("../prismaClient");
const BaseRepository = require("./BaseRepository");

module.exports = new BaseRepository(prisma.serviceVisit);
