// =========================================
// Inspecteur Sécurité — Backend Complet
// Compatible Render + Node 22
// =========================================

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import basicAuth from "express-basic-auth";
import PDFDocument from "pdfkit";
import fs from "fs";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Vérification ENV
if (!process.env.AUTH_USER || !process.env.AUTH_PASS || !process.env.OPENAI_API_KEY) {
  console.error("❌ ENV manquantes : AUTH_USER, AUTH_PASS, OPENAI_API_KEY");
  process.exit(1);
}

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Auth Basic
app.use(
  basicAuth({
    users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
    challenge: true,
  })
);

// --------------------------------------------------
// 🔵 ROUTE : Vérification du serveur
// --------------------------------------------------
app.get("/healthz", (req, res) => {
  res.json({ status: "ok", message: "API Inspecteur Sécurité active" });
});

// --------------------------------------------------
// 🔵 ROUTE : Génération de questions
// --------------------------------------------------
app.post("/generate-questions", async (req, res) => {
  try {
    const { mode, context } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: "Champs requis : mode, context" });
    }

    const questionCount = mode === "iso" ? 30 : 20;

    const prompt = `
Génère ${questionCount} questions de sécurité pour une analyse ${mode}.
Contexte : ${context}

Renvoie uniquement un tableau JSON :

[
  { "id": 1, "label": "Question ?", "type": "bool" },
  { "id": 2, "label": "Question ?", "type": "rate" },
  { "id": 3, "label": "Question ?", "type": "text" }
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
    console.error("❌ Erreur /generate-questions :", err);
    res.status(500).json({ error: "Erreur génération questionnaire" });
  }
});

// --------------------------------------------------
// 🔵 ROUTE : Analyse IA
// --------------------------------------------------
app.post("/analyse-text", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text)
      return res.status(400).json({ error: "Le champ 'text' est obligatoire" });

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
    console.error("❌ Erreur /analyse-text :", error);
    res.status(500).json({ error: "Erreur analyse IA" });
  }
});

// --------------------------------------------------
// 🔵 ROUTE : Génération PDF
// --------------------------------------------------
app.post("/generate-pdf", (req, res) => {
  try {
    const { content, title } = req.body;

    const fileName = `rapport_${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(22).text(title || "Rapport sécurité", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(content);
    doc.end();

    stream.on("finish", () => {
      res.download(filePath, fileName, () => fs.unlinkSync(filePath));
    });
  } catch (err) {
    console.error("❌ Erreur PDF :", err);
    res.status(500).json({ error: "Erreur génération PDF" });
  }
});

// --------------------------------------------------
// 🚀 Lancement du serveur
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Inspecteur Sécurité API opérationnel sur port ${PORT}`);
});
