import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import basicAuth from "express-basic-auth";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// HEALTH CHECK
// ======================================================
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ======================================================
// AUTH
// ======================================================
if (
  !process.env.AUTH_USER ||
  !process.env.AUTH_PASS ||
  !process.env.OPENAI_API_KEY
) {
  console.error("❌ Variables ENV manquantes");
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

// ======================================================
// PROMPT PROFESSIONNEL — GÉNÉRATION QUESTIONNAIRE
// ======================================================
function buildQuestionPrompt(context, count) {
  return `
Tu es Conseiller en Prévention Niveau 1 en Belgique.
Tu appliques strictement :
- RGPT
- Code du Bien-être au travail
- Norme ISO 45001
- Analyse dynamique des risques (CP Niveau 1)
- Méthodes : Kinney – Arbre des causes – AMDEC – 5M – Bow-Tie – SOBANE/Déparis

🎯 OBJECTIF :
Générer EXACTEMENT ${count} questions *spécifiques au contexte suivant* :
"${context}"

🎯 EXIGENCE MAJEURE :
Tu dois choisir automatiquement **la meilleure méthodologie d'analyse de risque** selon le contexte :
- Risques mécaniques → Méthode Kinney
- Risques procéduraux / défaillances → AMDEC
- Risques humains / organisationnels → 5M
- Accident ou incident décrit → Arbre des causes + Bow-Tie
- Travail en hauteur → Hiérarchie des mesures de prévention + RGPT
- Environnement / ergonomie → SOBANE / Déparis

⚠️ CONTRAINTES IMPORTANTES :
- Aucune réponse pré-remplie
- Aucune valeur par défaut
- Pas de texte hors JSON
- Questions obligatoirement professionnelles et techniques
- Le questionnaire doit ressembler à celui produit par un CP Niveau 1 en Belgique

FORMAT STRICT JSON :
{
  "questions": [
    {
      "id": 1,
      "label": "Question HSE précise",
      "type": "bool | rate | text",
      "category": "danger | technique | organisation | EPI | environnement | prévention",
      "method": "Kinney | 5M | AMDEC | Arbre des causes | Bow-Tie | Déparis | autre",
      "kinney": true,
      "comment": "Objectif professionnel de la question"
    }
  ]
}

Aucun texte hors JSON.
`;
}

// ======================================================
// ROUTE : GÉNÉRATION DES QUESTIONS
// ======================================================
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;
    if (!mode || !context) {
      return res
        .status(400)
        .json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;
    const prompt = buildQuestionPrompt(context, count);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu génères des questionnaires HSE avancés, niveau Conseiller en Prévention Niveau 1 en Belgique.",
        },
        { role: "user", content: prompt },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error("❌ Format JSON inattendu :", parsed);
      return res.status(500).json({ error: "Format JSON incorrect" });
    }

    return res.json({ questions: parsed.questions });
  } catch (err) {
    console.error("❌ Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur backend /generate-questions" });
  }
});

// ======================================================
// PROMPT PROFESSIONNEL — ANALYSE IA
// ======================================================
function buildAnalysisPrompt(context, answers) {
  return `
Tu es Conseiller en Prévention Niveau 1 en Belgique.
Analyse les réponses selon :

- RGPT
- Code du Bien-être au travail
- ISO 45001
- Méthode Kinney (P × F × G)
- AMDEC (Gravité / Occurrence / Détection)
- Méthode des 5M
- Bow-Tie
- Hiérarchie des mesures de prévention
- Analyse comportementale & organisationnelle

CONTEXTE :
${context}

RÉPONSES :
${JSON.stringify(answers, null, 2)}

🎯 PRODUIS UN RAPPORT STRUCTURÉ :
1. Analyse du contexte
2. Identification des dangers (catégorisés)
3. Sélection automatique de la meilleure méthode d’analyse
4. Analyse technique (Kinney, 5M, Bow-Tie, AMDEC…)
5. Conformité légale + références belges (Code du Bien-être, RGPT, directives EU, ISO 45001)
6. Priorisation du risque (critique / majeur / modéré / faible)
7. Plan d’actions correctives hiérarchisé
8. Mesures immédiates, correctives et préventives
9. Conclusion professionnelle

Le rapport doit être clair, structuré, lisible par un HSE manager.
`;
}

// ======================================================
// ROUTE : ANALYSE IA
// ======================================================
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers } = req.body;

    if (!context || !answers) {
      return res.status(400).json({ error: "Champs requis" });
    }

    const prompt = buildAnalysisPrompt(context, answers);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "Tu rédiges des rapports HSE professionnels (niveau CP1 Belgique).",
        },
        { role: "user", content: prompt },
      ],
    });

    res.json({ report: completion.choices[0].message.content });
  } catch (error) {
    console.error("❌ Erreur /analyse-ai :", error);
    res.status(500).json({ error: "Erreur IA backend" });
  }
});

// ======================================================
// START SERVER
// ======================================================
app.listen(PORT, () => {
  console.log(`🚀 API Inspecteur Sécurité active sur port ${PORT}`);
});
