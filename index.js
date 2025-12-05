import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import basicAuth from "express-basic-auth";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// -------- HEALTH CHECK --------
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// -------- AUTH --------
app.use(
  basicAuth({
    users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
    challenge: true,
  })
);

app.use(cors());
app.use(bodyParser.json());

// -------- OpenAI --------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


// -------- GENERATE QUESTIONS --------
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "mode et context obligatoires" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Génère exactement ${count} questions de sécurité.
Contexte : ${context}

Format de réponse attendu :
{
  "questions": [
    { "id": "q1", "label": "...", "type": "bool" },
    { "id": "q2", "label": "...", "type": "rate" }
  ]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }   // 🔥 OBLIGE GPT à renvoyer du JSON VALIDE
    });

    const data = completion.choices[0].message.content;

    console.log("JSON OpenAI reçu :", data);

    const parsed = JSON.parse(data);

    res.json(parsed);

  } catch (err) {
    console.error("Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur serveur lors de la génération des questions" });
  }
});


// -------- ANALYSE IA --------
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers, autoAnalysis } = req.body;

    if (!context || !answers) {
      return res.status(400).json({ error: "context et answers requis" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert en sécurité au travail." },
        {
          role: "user",
          content: `
Contexte : ${context}
Réponses : ${JSON.stringify(answers)}

Fais une analyse claire et concise :
${autoAnalysis}
`
        }
      ]
    });

    res.json({ report: completion.choices[0].message.content });

  } catch (error) {
    console.error("Erreur /analyse-ai :", error);
    res.status(500).json({ error: "Erreur IA" });
  }
});


// -------- START --------
app.listen(PORT, () =>
  console.log(`🚀 Serveur Inspecteur Sécurité API actif sur port ${PORT}`)
);
