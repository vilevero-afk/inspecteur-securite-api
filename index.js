import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import basicAuth from "express-basic-auth";
import PDFDocument from "pdfkit";
import fs from "fs";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Client OpenAI (SDK v4) =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== Route de santé =====
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ===== Auth =====
if (!process.env.AUTH_USER || !process.env.AUTH_PASS || !process.env.OPENAI_API_KEY) {
  console.error("❌ Variables ENV manquantes (AUTH_USER / AUTH_PASS / OPENAI_API_KEY)");
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
   🔵 1) ROUTE : GENERATE QUESTIONS (PROMPT PRO HSE)
   ============================================================ */
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Tu es un Conseiller en Prévention – Niveau 1 (Belgique), expert en :
- Code du bien-être au travail
- RGPT
- ISO 45001
- Méthode Kinney
- Arbre des causes
- Hiérarchie des mesures de prévention

Contexte :
"${context}"

Génère EXACTEMENT ${count} questions professionnelles.

FORMAT STRICT EN JSON :
{
  "questions": [
    {
      "id": 1,
      "label": "Question",
      "type": "bool | rate | text",
      "category": "danger | organisation | EPI | prévention | environnement | technique",
      "kinney": true,
      "comment": "but de la question"
    }
  ]
}

AUCUN TEXTE HORS JSON.
`;

    // ======= NOUVELLE SYNTAXE : Responses API =======
    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      output_format: { type: "json_object" }
    });

    const json = completion.output[0].content[0].json;

    const questions = json.questions;

    if (!Array.isArray(questions)) {
      console.error("❌ Questions invalides :", json);
      return res.status(500).json({ error: "Format questions invalide" });
    }

    res.json({ questions });

  } catch (err) {
    console.error("❌ Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur génération questionnaire" });
  }
});

/* ============================================================
   🟩 2) ROUTE : ANALYSE IA (PRO + STRUCTURÉE)
   ============================================================ */
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers } = req.body;

    if (!context || !answers) {
      return res.status(400).json({ error: "Champs requis : context, answers" });
    }

    const prompt = `
Tu es un Conseiller en Prévention – Niveau 1 (Belgique).

Contexte :
"${context}"

Réponses :
${JSON.stringify(answers, null, 2)}

Produit un rapport HSE structuré :

1. Contexte
2. Dangers identifiés
3. Évaluation Kinney (P/F/G + Score)
4. Matrice de risque belge
5. Arbre des causes
6. Analyse de conformité légale (Code BE, RGPT, ISO 45001)
7. Mesures existantes
8. Plan d’action (action | type | responsable | délai | priorité | base légale)
9. Conclusion (risque résiduel)

Réponse : texte uniquement, format rapport professionnel.
`;

    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt
    });

    const report = completion.output_text;

    res.json({ report });

  } catch (error) {
    console.error("❌ Erreur /analyse-ai :", error);
    res.status(500).json({ error: "Erreur IA" });
  }
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Serveur Inspecteur Sécurité API actif sur port ${PORT}`);
});
