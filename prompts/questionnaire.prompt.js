function buildQuestionnairePrompt(context, answers) {
  return `
Tu es un conseiller en prévention.

Contexte :
${context}

Réponses :
${JSON.stringify(answers, null, 2)}

Donne une synthèse et des recommandations.
`;
}

module.exports = { buildQuestionnairePrompt };
