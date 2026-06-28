const bcrypt = require("bcrypt");
const { prisma } = require("../prismaClient");

function safeUser(user){ if(!user) return user; const { password, ...safe } = user; return safe; }

async function listUsers(req, res) {
  try {
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
    return res.json(users.map(safeUser));
  } catch (err) {
    console.error("Erro listar users:", err);
    return res.status(500).json({ error: "Erro listar utilizadores" });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, role, username, phone, pin, active } = req.body;
    if (!name || !email || !role) return res.status(400).json({ error: "Dados obrigatórios" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email já existe" });
    const hashed = await bcrypt.hash(String(password || "123456"), 12);
    const created = await prisma.user.create({ data: { name, email, username: username || null, phone: phone || null, pin: pin || null, password: hashed, role, active: active !== false, mustChangePassword: !password } });
    return res.json(safeUser(created));
  } catch (err) {
    console.error("Erro criar user:", err);
    return res.status(500).json({ error: "Erro criar utilizador" });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    const { name, email, password, role, username, phone, pin, active, mustChangePassword } = req.body;
    const data = { name, email, role, username, phone, pin, active, mustChangePassword };
    Object.keys(data).forEach((k)=>data[k] === undefined && delete data[k]);
    if (password) { data.password = await bcrypt.hash(String(password), 12); data.passwordChangedAt = new Date(); }
    const updated = await prisma.user.update({ where: { id }, data });
    return res.json(safeUser(updated));
  } catch (err) {
    console.error("Erro atualizar user:", err);
    return res.status(500).json({ error: "Erro atualizar utilizador" });
  }
}

module.exports = { listUsers, createUser, updateUser };
