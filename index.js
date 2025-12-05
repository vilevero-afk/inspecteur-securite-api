import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import basicAuth from "express-basic-auth";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// -------- HEALTH --------
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
GENÈRE UNE RÉPONSE STRICTEMENT AU FORMAT JSON.

Exemple de format JSON attendu :
{
  "questions": [
    { "id": "q1", "label": "Question ?", "type": "bool" }
  ]
}

Génère exactement ${count} questions adaptées au contexte suivant :
"${context}"
Mode : ${mode}

Répond UNIQUEMENT en JSON valide.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const jsonText = completion.choices[0].message.content;
    console.log("Réponse OpenAI :", jsonText);

    const parsed = JSON.parse(jsonText);

    res.json(parsed);

  } catch (err) {
    console.error("Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur serveur lors de la génération" });
  }
});


// -------- ANALYSE IA --------
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers, autoAnalysis } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert en sécurité au travail." },
        {
          role: "user",
          content: `
Contexte : ${context}
Réponses : ${JSON.stringify(answers)}

Analyse les réponses de façon structurée.
${autoAnalysis}
`
        }
      ]
    });

    res.json({ report: completion.choices[0].message.content });

  } catch (e) {
    console.error("Erreur /analyse-ai :", e);
    res.status(500).json({ error: "Erreur IA" });
  }
});


// -------- START --------
app.listen(PORT, () =>
  console.log(`🚀 Serveur Inspecteur Sécurité API actif sur port ${PORT}`)
);
