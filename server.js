import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import basicAuth from "express-basic-auth";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Client OpenAI =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== Health check =====
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ===== Auth =====
if (!process.env.AUTH_USER || !process.env.AUTH_PASS || !process.env.OPENAI_API_KEY) {
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

/* ============================================================
   🔵 GENERATE QUESTIONS — **VERSION FINALE FONCTIONNELLE**
   ============================================================ */
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Tu es un Conseiller en Prévention (Belgique, niveau 1),
expert en :
- Code du Bien-être au travail
- RGPT
- ISO 45001
- Méthode Kinney (P × F × G)
- Hiérarchie des mesures de prévention
- Analyse par arbre des causes

Contexte :
"${context}"

Génère EXACTEMENT ${count} questions professionnelles d'analyse de risques.

FORMAT STRICT JSON :
{
  "questions": [
    {
      "id": 1,
      "label": "formulation professionnelle",
      "type": "bool" | "rate" | "text",
      "category": "danger | technique | organisation | EPI | environnement | prévention",
      "kinney": true,
      "comment": "explication du but"
    }
  ]
}

AUCUN TEXTE en dehors du JSON.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Tu génères des questionnaires HSE professionnels." },
        { role: "user", content: prompt }
      ]
    });

    const raw = completion.choices[0].message.content;
    const data = JSON.parse(raw);

    res.json({ questions: data.questions });

  } catch (err) {
    console.error("❌ Erreur generate-questions :", err);
    res.status(500).json({ error: "Erreur génération questionnaire" });
  }
});

/* ============================================================
   🟩 ANALYSE IA — VERSION FINALE
   ============================================================ */
app.post("/analyse-ai", async (req, res) => {
  try {
    const { context, answers } = req.body;

    if (!context || !answers) {
      return res.status(400).json({ error: "Champs requis : context, answers" });
    }

    const prompt = `
Tu es un Conseiller en Prévention niveau 1 (Belgique).

Analyse les réponses au questionnaire pour :
"${context}"

Réponses :
${JSON.stringify(answers, null, 2)}

Produit un rapport professionnel structuré :

1. Contexte
2. Dangers identifiés
3. Analyse Kinney (P/F/G, Score)
4. Matrice de risque belge
5. Arbre des causes
6. Conformité légale (Code BE, RGPT, directives EU, ISO 45001)
7. Mesures existantes
8. Plan d’action structuré :
   - Action
   - Type (Élimination / Substitution / Technique / Organisationnelle / EPI)
   - Responsable
   - Délai
   - Priorité
   - Référence légale
9. Conclusion

Réponse : texte clair, sans JSON.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu rédiges des rapports HSE professionnels." },
        { role: "user", content: prompt }
      ]
    });

    const report = completion.choices[0].message.content;

    res.json({ report });

  } catch (error) {
    console.error("❌ Erreur analyse-ai :", error.message);
    res.status(500).json({ error: "Erreur IA" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Inspecteur Sécurité active sur port ${PORT}`);
});
