const { searchClients } = require("../../services/ai/data/clientData");

function cleanQuestion(question = "") {
  return String(question)
    .trim()
    .replace(/[?!.]/g, " ");
}

async function resolveEntities(question = "") {
  const clean = cleanQuestion(question);

  const clientMatches = await searchClients(clean, 5);

  let client = null;

  if (clientMatches.length) {
    client = {
      id: clientMatches[0].id,
      name: clientMatches[0].name,
      email: clientMatches[0].email,
      phone: clientMatches[0].phone,
      zone: clientMatches[0].zone,
    };
  }

  return {
    question,
    entities: {
      client,
    },
    matches: {
      clients: clientMatches.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        zone: c.zone,
      })),
    },
  };
}

module.exports = {
  resolveEntities,
};
