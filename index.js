require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

const { getPrompt } = require("./prompts/index.js");
console.log("✅ typeof getPrompt =", typeof getPrompt);

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
// ROUTE HEALTHCHECK
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
// ROUTE ANALYSE IA
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

    const rawContent = completion.choices[0].message.content;

    if (analysisType === "kinney") {
      return res.json({ report: JSON.parse(rawContent) });
    }

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Inspecteur Sécurité API active sur port ${PORT}`);
});
