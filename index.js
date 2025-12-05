import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import basicAuth from "express-basic-auth";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ====== HEALTH CHECK ======
app.get("/healthz", (req, res) => res.json({ status: "ok" }));

// ====== AUTH ======
if (!process.env.AUTH_USER || !process.env.AUTH_PASS || !process.env.OPENAI_API_KEY) {
  console.error("❌ Variables d’environnement manquantes");
  process.exit(1);
}

app.use(
  basicAuth({
    users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
    challenge: true,
  })
);

app.use(cors());
app.use(bodyParser.json());

/* ============================================================
   🔵 GENERATE QUESTIONS — chat.completions
   ============================================================ */
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Tu es un conseiller en prévention belge.
Génère EXACTEMENT ${count} questions d'analyse de risques.
FORMAT STRICT JSON :

{
  "questions": [
    {
      "id": 1,
      "label": "Question",
      "type": "bool | rate | text",
      "category": "danger | organisation | EPI | technique | prévention | environnement",
      "kinney": true,
      "comment": "But de la question"
    }
  ]
}

Aucun texte hors JSON.
Contexte : "${context}"
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert HSE." },
        { role: "user", content: prompt }
      ]
    });

    const content = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("❌ JSON invalide :", content);
      return res.status(500).json({ error: "JSON IA invalide" });
    }

    res.json({ questions: parsed.questions });

  } catch (err) {
    console.error("❌ Erreur /generate-questions:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ============================================================
   🟩 ANALYSE IA — chat.completions
   ============================================================ */
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers } = req.body;

    if (!context || !answers) {
      return res.status(400).json({ error: "Champs requis : context, answers" });
    }

    const prompt = `
Tu es conseiller en prévention niveau 1.
Produis un rapport HSE professionnel :

1. Contexte
2. Dangers
3. Kinney
4. Matrice risque
5. Arbre des causes
6. Conformité légale
7. Mesures existantes
8. Plan d'action
9. Conclusion

Réponses : ${JSON.stringify(answers)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Rapports HSE professionnels uniquement." },
        { role: "user", content: prompt }
      ]
    });

    res.json({ report: completion.choices[0].message.content });

  } catch (error) {
    console.error("❌ Erreur /analyse-ai:", error);
    res.status(500).json({ error: "Erreur IA" });
  }
});

/* ============================================================
   START SERVER
   ============================================================ */
app.listen(PORT, () => {
  console.log(`🚀 API Inspecteur Sécurité en ligne sur port ${PORT}`);
});
