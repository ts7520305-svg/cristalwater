const { buildClientContextFromQuery } = require("./clientContextService");

async function resolveContext(question) {

  const clientContext = await buildClientContextFromQuery(question);

  return {
    client: clientContext
  };

}

module.exports = {
  resolveContext
};
