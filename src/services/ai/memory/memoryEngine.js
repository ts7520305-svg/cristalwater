const memoryStore = [];

function addMemory(memory = {}) {
  const item = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    type: memory.type || "general",
    entityType: memory.entityType || null,
    entityId: memory.entityId || null,
    title: memory.title || "",
    content: memory.content || "",
    importance: memory.importance || "normal",
    source: memory.source || "manual",
  };

  memoryStore.push(item);
  return item;
}

function searchMemory({ entityType, entityId, type, query } = {}) {
  return memoryStore.filter((item) => {
    if (entityType && item.entityType !== entityType) return false;
    if (entityId && item.entityId !== entityId) return false;
    if (type && item.type !== type) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

module.exports = {
  addMemory,
  searchMemory,
};
