function buildHseDocumentPrompt(context, request) {
  return `
Tu es un expert HSE.

Contexte :
${context}

Demande :
${request}

Analyse les risques et propose un plan d'action structuré.
`;
}

module.exports = { buildHseDocumentPrompt };
