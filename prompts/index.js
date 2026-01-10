// prompts/index.js

const { buildKinneyPrompt } = require("./kinney.prompt.js");
const { buildQuestionnairePrompt } = require("./questionnaire.prompt.js");
const { buildHseDocumentPrompt } = require("./hse_document.prompt.js");

function getPrompt({ analysisType, context, request, answers }) {
  if (analysisType === "kinney") {
    return buildKinneyPrompt(context, request);
  }

  if (analysisType === "questionnaire") {
    return buildQuestionnairePrompt(context, answers);
  }

  if (analysisType === "hse_full") {
    return buildHseDocumentPrompt(context, request);
  }

  // fallback
  return `
Contexte :
${context}

Requête :
${request}

Réponses :
${JSON.stringify(answers, null, 2)}
`;
}

module.exports = { getPrompt };
