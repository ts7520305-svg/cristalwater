const { addMemory, searchMemory } = require("./memoryEngine");

function remember(data) {
  return addMemory(data);
}

function recall(filters = {}) {
  return searchMemory(filters);
}

module.exports = {
  remember,
  recall,
};
