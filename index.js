require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

// ✅ IMPORT EXPLICITE
const { getPrompt } = require("./prompts/index.js");
console.log("✅ typeof getPrompt =", typeof getPrompt);

const app = express();

// ==========================================================
// MIDDLEWARES
// ==========================================================
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ==========================================================
// OPENAI CLIENT
// ==========================================================
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================================================
// HEALTHCHECK
// ==========================================================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "running",
    time: new Date().toISOString(),
    node: process.version,
  });
});

// ==========================================================
// ANALYSE IA
// ==========================================================
app.post("/analyse-ai", async (req, res) => {
  try {
    const {
      analysisType = "questionnaire",
      context = "",
      request = "",
      answers = {},
    } = req.body;

    const prompt = getPrompt({
      analysisType,
      context: String(context).trim(),
      request: String(request).trim(),
      answers,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content;

    if (analysisType === "kinney") {
      const parsed = JSON.parse(raw);
      return res.json({ report: parsed });
    }

    return res.json({ report: raw });

  } catch (error) {
    console.error("❌ Erreur analyse-ai :", error);
    return res.status(500).json({
      error: "Erreur analyse IA",
      details: error.message,
    });
  }
});

// ==========================================================
// SERVER START
// ==========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Inspecteur Sécurité API active sur port ${PORT}`);
});
