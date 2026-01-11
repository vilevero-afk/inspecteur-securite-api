// prompts/index.js

const { buildKinneyPrompt } = require("./kinney.prompt.js");
const { buildQuestionnairePrompt } = require("./questionnaire.prompt.js");
const { buildHseDocumentPrompt } = require("./hse_document.prompt.js");

// ==========================================================
// ROUTEUR DE PROMPTS IA
// ==========================================================
function getPrompt({ analysisType, context, request, answers }) {
  // 🔍 LOG DEBUG (utile sur Render)
  console.log("🧠 getPrompt appelé avec :", {
    analysisType,
    hasContext: !!context,
    hasRequest: !!request,
    answersKeys: answers ? Object.keys(answers) : [],
  });

  // =======================
  // KINNEY
  // =======================
  if (analysisType === "kinney") {
    if (typeof buildKinneyPrompt !== "function") {
      throw new Error("buildKinneyPrompt n'est pas une fonction");
    }

    return buildKinneyPrompt(
      String(context ?? "").trim(),
      String(request ?? "").trim()
    );
  }

  // =======================
  // QUESTIONNAIRE
  // =======================
  if (analysisType === "questionnaire") {
    if (typeof buildQuestionnairePrompt !== "function") {
      throw new Error("buildQuestionnairePrompt n'est pas une fonction");
    }

    return buildQuestionnairePrompt(
      String(context ?? "").trim(),
      answers ?? {}
    );
  }

  // =======================
  // HSE DOCUMENT COMPLET
  // =======================
  if (analysisType === "hse_full") {
    if (typeof buildHseDocumentPrompt !== "function") {
      throw new Error("buildHseDocumentPrompt n'est pas une fonction");
    }

    return buildHseDocumentPrompt(
      String(context ?? "").trim(),
      String(request ?? "").trim()
    );
  }

  // =======================
  // FALLBACK SÉCURISÉ
  // =======================
  console.warn("⚠️ analysisType inconnu, fallback utilisé :", analysisType);

  return `
CONTEXTE :
${String(context ?? "").trim()}

REQUÊTE :
${String(request ?? "").trim()}

RÉPONSES :
${JSON.stringify(answers ?? {}, null, 2)}
`;
}

// ==========================================================
// EXPORT
// ==========================================================
module.exports = {
  getPrompt,
};
