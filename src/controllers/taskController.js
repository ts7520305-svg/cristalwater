// src/controllers/taskController.js
const { prisma } = require("../db/connection");
const { roleMatches } = require("../utils/roles");

// LISTAR TAREFAS (respeitando o role do utilizador)
async function listTasks(req, res) {
  try {
    const role = req.user?.role || "ADMIN";
    const techId = req.user?.technicianId ?? null;

    let where = {};

    if (roleMatches(role, "TECHNICIAN")) {
      // técnico só vê tarefas atribuídas a ele
      if (!techId) {
        return res.json([]);
      }
      where.technicianId = techId;
    }
    // ADMIN vê tudo (where vazio)

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        client: true,
        pool: true,
        service: true,
        technician: true,
      },
    });

    res.json(tasks);
  } catch (err) {
    console.error("Erro ao listar tarefas:", err);
    res.status(500).json({ error: "Erro ao listar tarefas." });
  }
}

// OBTER UMA TAREFA
async function getTask(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: true,
        pool: true,
        service: true,
        technician: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }

    res.json(task);
  } catch (err) {
    console.error("Erro ao obter tarefa:", err);
    res.status(500).json({ error: "Erro ao obter tarefa." });
  }
}

// CRIAR TAREFA (ADMIN)
async function createTask(req, res) {
  try {
    const {
      title,
      description,
      priority,
      status,
      technicianId,
      clientId,
      poolId,
      serviceId,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Campo "title" é obrigatório.' });
    }

    if (!priority) {
      return res.status(400).json({ error: 'Campo "priority" é obrigatório.' });
    }

    const data = {
      title: title.trim(),
      description: description?.trim() || null,
      priority,
      status: status || "PENDENTE",
      technicianId: technicianId ? Number(technicianId) : null,
      clientId: clientId ? Number(clientId) : null,
      poolId: poolId ? Number(poolId) : null,
      serviceId: serviceId ? Number(serviceId) : null,
    };

    const created = await prisma.task.create({ data });

    res.json(created);
  } catch (err) {
    console.error("Erro ao criar tarefa:", err);
    res.status(500).json({ error: "Erro ao criar tarefa." });
  }
}

// ATUALIZAR TAREFA (ADMIN)
async function updateTask(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const {
      title,
      description,
      priority,
      status,
      technicianId,
      clientId,
      poolId,
      serviceId,
    } = req.body;

    const data = {};

    if (title !== undefined) data.title = title.trim();
    if (description !== undefined)
      data.description = description?.trim() || null;
    if (priority !== undefined) data.priority = priority;
    if (status !== undefined) data.status = status;
    if (technicianId !== undefined)
      data.technicianId = technicianId ? Number(technicianId) : null;
    if (clientId !== undefined)
      data.clientId = clientId ? Number(clientId) : null;
    if (poolId !== undefined) data.poolId = poolId ? Number(poolId) : null;
    if (serviceId !== undefined)
      data.serviceId = serviceId ? Number(serviceId) : null;

    const updated = await prisma.task.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar tarefa:", err);
    res.status(500).json({ error: "Erro ao atualizar tarefa." });
  }
}

// APAGAR TAREFA (ADMIN)
async function deleteTask(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    await prisma.task.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao apagar tarefa:", err);
    res.status(500).json({ error: "Erro ao apagar tarefa." });
  }
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
};
