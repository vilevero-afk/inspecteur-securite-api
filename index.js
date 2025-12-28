require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

const { getPrompt } = require("./prompts");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ==========================================================
// OPENAI CLIENT
// ==========================================================
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================================================
// ROUTE HEALTHCHECK (RENDER / DEBUG)
// ==========================================================
app.get("/health", (req, res) => {
  res.json({
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

    const cleanContext = String(context).trim();
    const cleanRequest = String(request).trim();

    // ------------------------------------------------------
    // LOGS DEBUG (À CONSERVER)
    // ------------------------------------------------------
    console.log("📥 /analyse-ai");
    console.log("   analysisType:", analysisType);
    console.log("   context length:", cleanContext.length);
    console.log("   request length:", cleanRequest.length);
    console.log("   answers keys:", Object.keys(answers || {}));

    // ------------------------------------------------------
    // VALIDATIONS MÉTIER
    // ------------------------------------------------------
    if (analysisType === "hse_full" && cleanRequest.length < 10) {
      return res.status(400).json({
        error: "Demande HSE insuffisante",
      });
    }

    if (
      analysisType === "kinney" &&
      (cleanContext.length < 20 || cleanRequest.length < 20)
    ) {
      return res.status(400).json({
        error: "Contexte ou demande Kinney insuffisante",
      });
    }

    // ------------------------------------------------------
    // CONSTRUCTION DU PROMPT
    // ------------------------------------------------------
    const prompt = getPrompt({
      analysisType,
      context: cleanContext,
      request: cleanRequest,
      answers,
    });

    // ------------------------------------------------------
    // APPEL OPENAI
    // ------------------------------------------------------
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const rawContent = completion.choices[0].message.content;

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
        });
      }

      if (
        parsed.method !== "KINNEY" ||
        !Array.isArray(parsed.risks)
      ) {
        return res.status(500).json({
          error: "Structure JSON Kinney invalide",
        });
      }

      return res.json({
        report: parsed,
      });
    }

    // ------------------------------------------------------
    // AUTRES MODES (QUESTIONNAIRE / HSE)
    // ------------------------------------------------------
    return res.json({
      report: rawContent,
    });
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
app.listen(PORT, () => {
  console.log(`🚀 Inspecteur Sécurité API active sur port ${PORT}`);
});
