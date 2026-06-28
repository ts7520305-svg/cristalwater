const { buildDecision } = require("../decision/decisionEngine");
const { buildClientContextFromQuery } = require("../../services/ai/context/clientContextService");

async function openPoolCase(question) {

    const decision = buildDecision(question);

    const clientContext =
        await buildClientContextFromQuery(question);

    return {

        decision,

        clientContext,

        nextStep:
            "POOL_CONTEXT"

    };

}

module.exports = {

    openPoolCase

};
