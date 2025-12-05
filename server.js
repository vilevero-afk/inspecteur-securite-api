// =========================================
// Inspecteur Sécurité — Backend Render
// Version complète avec /generate-questions
// =========================================

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

// --- Vérification des variables d’environnement ---
if (!process.env.AUTH_USER || !process.env.AUTH_PASS || !process.env.OPENAI_API_KEY) {
  console.error("❌ Variables ENV manquantes (AUTH_USER / AUTH_PASS / OPENAI_API_KEY)");
  process.exit(1);
}

// --- Route publique ---
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", message: "Serveur opérationnel" });
});

// --- Auth obligatoire ---
app.use(
  basicAuth({
    users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
    challenge: true,
  })
);

app.use(cors());
app.use(bodyParser.json());

// =========================================
// 🟦 ROUTE : GENERATE QUESTIONS
// =========================================
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "Champs requis : mode, context" });
    }

    const count = mode === "iso" ? 30 : 20;

    const prompt = `
Génère exactement ${count} questions de sécurité pour une analyse ${mode}.
Contexte : ${context}

Renvoie STRICTEMENT un JSON comme ceci :

[
  {"id": 1, "label": "La zone est-elle protégée ?", "type": "bool"},
  {"id": 2, "label": "Évaluez le risque de chute", "type": "rate"},
  {"id": 3, "label": "Décrivez les mesures existantes", "type": "text"}
]
    `;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const output = completion.choices[0].message.content.trim();

    const json = JSON.parse(output);

    res.json({ questions: json });
  } catch (err) {
    console.error("Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur génération questionnaire" });
  }
});

// =========================================
// 🟦 ROUTE : ANALYSE IA
// =========================================
app.post("/analyse-text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Champ 'text' obligatoire" });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert en sécurité au travail." },
        { role: "user", content: text },
      ],
    });

    res.json({ analysis: completion.choices[0].message.content });
  } catch (error) {
    console.error("Erreur /analyse-text :", error);
    res.status(500).json({ error: "Erreur analyse IA" });
  }
});

// =========================================
// 🟦 ROUTE : GENERATE PDF
// =========================================
app.post("/generate-pdf", (req, res) => {
  try {
    const { content, title } = req.body;

    const fileName = `rapport_${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);
    doc.fontSize(20).text(title || "Rapport Sécurité", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(content);
    doc.end();

    stream.on("finish", () => {
      res.download(filePath, fileName, () => fs.unlinkSync(filePath));
    });
  } catch (err) {
    console.error("Erreur PDF :", err);
    res.status(500).json({ error: "Erreur génération PDF" });
  }
});

// =========================================
// 🚀 Démarrage serveur
// =========================================
app.listen(PORT, () => {
  console.log(`Serveur Inspecteur Sécurité actif sur port ${PORT}`);
});
