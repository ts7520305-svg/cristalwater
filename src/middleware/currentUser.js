const jwt = require("jsonwebtoken");
const prisma = require("../prismaClient");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async function currentUser(req, res, next) {
  const authHeader = req.headers.authorization;

  // Não há token → segue sem user
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.id }
    });

    req.user = user || null;
    return next();
  } catch (err) {
    // Token inválido/expirado → segue sem user
    req.user = null;
    return next();
  }
};