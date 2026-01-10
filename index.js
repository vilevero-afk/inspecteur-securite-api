require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

// ==========================================================
// IMPORT PROMPTS (EXPLICITE & SÛR)
// ==========================================================
const promptsModule = require("./prompts/index.js");

console.log("🧪 promptsModule =", promptsModule);
console.log("🧪 Object.keys(promptsModule) =", Object.keys(promptsModule || {}));

const { getPrompt } = promptsModule;
console.log("✅ typeof getPrompt =", typeof getPrompt);

if (typeof getPrompt !== "function") {
  throw new Error(
    "❌ getPrompt n'est pas une fonction. Vérifie prompts/index.js et les exports."
  );
}

// ==========================================================
// APP EXPRESS
// ==========================================================
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ==========================================================
// OPENAI CLIENT (clé fournie par Render)
// ==========================================================
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY absente. L’API ne pourra pas appeler OpenAI."
  );
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================================================
// HEALTHCHECK
// ==========================================================
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "inspecteur-securite-api",
    status: "running",
    time: new Date().toISOString(),
    node: process.version,
  });
});

// ==========================================================
// ROUTE UNIQUE — ANALYSE IA
// ==========================================================
app.post("/analyse-ai", async (req, res) => {
  try {
    const {
      analysisType = "questionnaire",
      context = "",
      request = "",
      answers = {},
    } = req.body;

    const cleanContext = String(context || "").trim();
    const cleanRequest = String(request || "").trim();

    console.log("📥 /analyse-ai");
    console.log("   analysisType:", analysisType);
    console.log("   context length:", cleanContext.length);
    console.log("   request length:", cleanRequest.length);
    console.log("   answers keys:", Object.keys(answers || {}));

    // ------------------------------------------------------
    // CONSTRUCTION DU PROMPT
    // ------------------------------------------------------
    const prompt = getPrompt({
      analysisType,
      context: cleanContext,
      request: cleanRequest,
      answers,
    });

    if (!prompt || typeof prompt !== "string") {
      throw new Error("Prompt invalide ou vide");
    }

    // ------------------------------------------------------
    // APPEL OPENAI
    // ------------------------------------------------------
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const rawContent = completion?.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("Réponse OpenAI vide");
    }

    // ------------------------------------------------------
    // MODE KINNEY — JSON STRICT
    // ------------------------------------------------------
    if (analysisType === "kinney") {
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
      } catch (err) {
        console.error("❌ Réponse Kinney NON JSON :", rawContent);
        return res.status(500).json({
          error: "Réponse Kinney non conforme (JSON attendu)",
          raw: rawContent,
        });
      }

      if (parsed.method !== "KINNEY" || !Array.isArray(parsed.risks)) {
        return res.status(500).json({
          error: "Structure JSON Kinney invalide",
          parsed,
        });
      }

      return res.json({ report: parsed });
    }

    // ------------------------------------------------------
    // AUTRES MODES (QUESTIONNAIRE / HSE)
    // ------------------------------------------------------
    return res.json({ report: rawContent });
  } catch (error) {
    console.error("❌ Erreur analyse-ai :", error);
    return res.status(500).json({
      error: "Erreur analyse IA",
      details: error?.message || String(error),
    });
  }
});

// ==========================================================
// SERVER START (RENDER COMPATIBLE)
// ==========================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Inspecteur Sécurité API active sur port ${PORT}`);
});
