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

// ===== Route de santé obligatoire pour Render =====
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
   🔵 1) ROUTE : GENERATE QUESTIONS (NOUVEAU PROMPT PRO)
   ============================================================ */
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Tu es un Conseiller en Prévention – Niveau 1, expert en sécurité, législation belge (Code du Bien-être, RGPT), normes européennes et méthodologies HSE.

Ta tâche :
Générer un questionnaire professionnel d’analyse de risques relatif au contexte suivant :
« ${context} »

Exigences professionnelles :
- Méthode Kinney (Probabilité × Fréquence × Gravité)
- Arbre des causes
- Hiérarchie européenne des mesures de prévention
- Code du Bien-être au travail (Belgique)
- RGPT (travaux en hauteur si applicable)
- Bonnes pratiques ISO 45001

Format strict en JSON :
[
  {
    "id": 1,
    "label": "Question professionnelle obligatoire",
    "type": "bool | rate | text",
    "category": "danger | organisation | EPI | prévention | environnement | technique",
    "kinney": true | false
  }
]

Contraintes :
- EXACTEMENT ${count} questions.
- Le JSON doit être 100% valide.
- Pas de texte en dehors du JSON.
`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      response_format: { type: "json_object" }
    });

    const result = completion.output[0].content[0].json;

    res.json({ questions: result });

  } catch (err) {
    console.error("Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur génération questionnaire" });
  }
});



/* ============================================================
   🟩 2) ROUTE : ANALYSE IA (PRO + STRUCTURÉE)
   ============================================================ */
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers, autoAnalysis } = req.body;

    if (!context || !answers) {
      return res.status(400).json({ error: "Champs requis : context, answers" });
    }

    const prompt = `
Tu es un Conseiller en Prévention – Niveau 1 (Belgique), expert en analyse de risques, RGPT, Code du Bien-être au travail, ISO 45001 et méthodologie Kinney.

Analyse les réponses suivantes :
Contexte : "${context}"
Réponses : ${JSON.stringify(answers)}

Produit un rapport professionnel structuré :

1. Dangers identifiés
2. Évaluation Kinney (P, F, G, Score)
3. Arbre des causes
4. Analyse légale (Code BE, RGPT, normes EU)
5. Mesures existantes et conformité
6. Mesures correctives classées selon la hiérarchie
7. Plan d’action : Action | Responsable | Délais | Obligation légale
8. Conclusion professionnelle (risque résiduel)

Le rapport doit être un texte clair et destiné à un rapport officiel en HSE.

Texte uniquement, pas de JSON.
`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt
    });

    const report = completion.output_text;

    res.json({ report });

  } catch (error) {
    console.error("Erreur /analyse-ai :", error);
    res.status(500).json({ error: "Erreur IA" });
  }
});


// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Serveur Inspecteur Sécurité API actif sur port ${PORT}`);
});
