import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import basicAuth from "express-basic-auth";
import PDFDocument from "pdfkit"; // encore utilisé ailleurs si tu veux générer des PDF
import fs from "fs";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Client OpenAI (SDK v4) =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== Route de santé obligatoire pour Render =====
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ===== Auth =====
if (
  !process.env.AUTH_USER ||
  !process.env.AUTH_PASS ||
  !process.env.OPENAI_API_KEY
) {
  console.error(
    "❌ Variables ENV manquantes (AUTH_USER / AUTH_PASS / OPENAI_API_KEY)"
  );
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
      return res
        .status(400)
        .json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Tu es un Conseiller en Prévention – Niveau 1 (Belgique), expert en :
- Code du bien-être au travail
- RGPT
- Directives et normes européennes (dont ISO 45001)
- Méthodologie Kinney (Probabilité × Fréquence × Gravité)
- Analyse par arbre des causes
- Hiérarchie des mesures de prévention (élimination, substitution, mesures techniques, organisationnelles, EPI)

Contexte d'analyse des risques :
"${context}"

Objectif :
Générer un questionnaire professionnel d'analyse de risques pour différents types d'environnements (chantier, maintenance, logistique, bureaux, etc.).

EXIGENCES :
- EXACTEMENT ${count} questions.
- Questions orientées "analyse de risques" et "prévention", pas checklist gadget.
- Intégrer :
  - dangers (techniques, organisationnels, humains, environnementaux),
  - organisation de la sécurité,
  - coordination, sous-traitants, formation, procédures,
  - mesures existantes et manquantes,
  - conformité légale (Code BE, RGPT, directives UE).

FORMAT STRICT EN JSON.
Le JSON doit être un OBJET de la forme suivante :

{
  "questions": [
    {
      "id": 1,
      "label": "Formule une question professionnelle et concrète",
      "type": "bool" | "rate" | "text",
      "category": "danger | organisation | EPI | prévention | environnement | technique",
      "kinney": true | false,
      "comment": "Brève indication sur ce que la question permet d'évaluer (Kinney, conformité, etc.)"
    }
  ]
}

CONTRAINTES :
- Pas d'autre texte que ce JSON.
- Le JSON doit être 100% valide.
- "type":
    - "bool"   -> question Oui / Non
    - "rate"   -> échelle de 1 à 5 (niveau de maîtrise, gravité, fréquence…)
    - "text"   -> réponse libre (description dangers, mesures, causes, etc.)
`;

    // 👉 Utilisation de chat.completions avec response_format JSON (SDK v4)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un Conseiller en Prévention belge (niveau 1), spécialisé en analyse de risques et réglementation HSE.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const rawContent = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      console.error("❌ JSON invalide renvoyé par l'IA :", rawContent);
      return res
        .status(500)
        .json({ error: "Réponse IA non valide (JSON parse error)" });
    }

    // On accepte soit { questions: [...] } soit directement [...]
    const questions = Array.isArray(parsed) ? parsed : parsed.questions;

    if (!questions || !Array.isArray(questions)) {
      console.error("❌ Format inattendu pour 'questions' :", parsed);
      return res
        .status(500)
        .json({ error: "Format inattendu pour les questions IA" });
    }

    // ✅ On renvoie exactement comme ton frontend l'attend
    res.json({ questions });
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
      return res
        .status(400)
        .json({ error: "Champs requis : context, answers" });
    }

    const prompt = `
Tu es un Conseiller en Prévention – Niveau 1 (Belgique), expert en :
- Code du bien-être au travail
- RGPT
- ISO 45001
- Méthode Kinney
- Arbre des causes
- Hiérarchie européenne des mesures de prévention.

Contexte :
"${context}"

Réponses au questionnaire (JSON) :
${JSON.stringify(answers, null, 2)}

Tâche :
Produire un rapport professionnel complet d'analyse de risques, structuré comme pour un rapport officiel HSE.

STRUCTURE OBLIGATOIRE DU RAPPORT :

1. Contexte synthétique
2. Dangers identifiés
   - Liste des dangers par famille (technique, organisation, humain, environnement, EPI…)
3. Évaluation du risque
   - Utilise la méthode Kinney : Probabilité (P), Fréquence (F), Gravité (G), Score (P×F×G)
   - Classe le risque selon une matrice de risque (Faible, Moyen, Élevé, Très élevé)
4. Analyse par arbre des causes
   - Causes immédiates
   - Causes profondes / organisationnelles
5. Analyse de conformité légale
   - Références au Code du bien-être au travail
   - Références RGPT si pertinent
   - Références à des exigences européennes / ISO 45001
6. Mesures existantes
   - Ce qui est déjà en place et son efficacité
7. Plan d'action hiérarchisé (automatique)
   Présente un tableau (texte) avec pour chaque action :
   - Action à mettre en place
   - Type de mesure : Élimination / Substitution / Technique / Organisationnelle / EPI
   - Responsable
   - Délai
   - Priorité (Haute / Moyenne / Basse)
   - Référence légale associée (Code BE / RGPT / directive…)
8. Conclusion professionnelle
   - Risque résiduel
   - Recommandations finales du Conseiller en Prévention.

Contraintes :
- Réponse en TEXTE clair, structuré par sections numérotées.
- Pas de JSON dans la réponse finale.
- Style : professionnel, objectif, orienté document HSE.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu rédiges des rapports d'analyse de risques comme un Conseiller en Prévention belge niveau 1.",
        },
        { role: "user", content: prompt },
      ],
    });

    const report = completion.choices[0].message.content;

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
