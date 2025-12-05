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

// ===== Route de santé pour Render =====
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ============================================================
   🔵 1) ROUTE : GENERATE QUESTIONS
   ============================================================ */
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Tu es un Conseiller en Prévention Niveau 1 (Belgique), expert en sécurité du travail, RGPT, Code du Bien-être, normes EU, ISO 45001.

Génère un questionnaire professionnel d’analyse de risques basé sur :
- Méthode Kinney (P × F × G)
- Arbre des causes
- Hiérarchie des mesures de prévention
- Obligations légales belges et européennes
- Pratiques HSE réelles

Contexte : "${context}"
Type d’analyse : ${mode}

Génère EXACTEMENT ${count} questions.

FORMAT STRICT EN JSON UNIQUEMENT :
[
  {
    "id": "q1",
    "label": "Question…",
    "type": "bool | rate | text",
    "category": "danger | organisation | EPI | prévention | environnement | technique",
    "kinney": true
  }
]
Aucun texte hors JSON.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response: { format: "json" } // NOUVEAU FORMAT OPENAI
    });

    const content = completion.choices[0].message.content;

    // Parser le JSON généré
    const questions = JSON.parse(content);

    res.json({ questions });

  } catch (err) {
    console.error("❌ Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur génération questionnaire : " + err.message });
  }
});

/* ============================================================
   🟩 2) ROUTE : ANALYSE IA
   ============================================================ */
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers, autoAnalysis } = req.body;

    if (!context || !answers) {
      return res.status(400).json({ error: "Champs requis : context, answers" });
    }

    const prompt = `
Tu es un Conseiller en Prévention Niveau 1 belge.
Analyse professionnelle complète basée sur :

- Identification des dangers
- Méthode Kinney (P, F, G, Score)
- Arbre des causes
- Conformité légale (Code du Bien-être, RGPT, normes EU)
- Mesures existantes et conformité
- Mesures correctives classées selon la hiérarchie des mesures
- Plan d’action : Action | Responsable | Délai | Obligation légale
- Conclusion professionnelle

Contexte : "${context}"
Réponses du questionnaire : ${JSON.stringify(answers)}

Produit un rapport clair destiné à un document officiel HSE.
PAS DE JSON, uniquement du texte structuré.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert belge en prévention et sécurité du travail." },
        { role: "user", content: prompt }
      ]
    });

    const report = completion.choices[0].message.content;

    res.json({ report });

  } catch (error) {
    console.error("❌ Erreur /analyse-ai :", error);
    res.status(500).json({ error: "Erreur IA : " + error.message });
  }
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Serveur Inspecteur Sécurité API actif sur port ${PORT}`);
});
