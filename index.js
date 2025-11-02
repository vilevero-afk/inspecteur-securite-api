// ======================
// 🔧 IMPORTS & CONFIG
// ======================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import multer from "multer";
import pdfLib from "pdf-lib";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ======================
// 🧩 ROUTE 1 : Génération du questionnaire
// ======================
app.post("/generate-questions", async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "Le champ 'reason' est manquant." });
    }

    const prompt = `
      Tu es un expert en sécurité au travail. 
      Génère une liste de 10 à 15 questions précises pour analyser les risques liés à : "${reason}".
      Évite tout texte ou balisage JSON. 
      Fournis uniquement la liste des questions, une par ligne.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = completion.choices[0].message.content
      .replace(/[*•]/g, "")
      .trim();

    const questions = responseText
      .split("\n")
      .filter((q) => q.trim() !== "")
      .map((q) => q.replace(/^\d+[\.\)]\s*/, "").trim());

    res.json({ questions });
  } catch (err) {
    console.error("Erreur génération questionnaire :", err);
    res.status(500).json({ error: "Erreur lors de la génération des questions." });
  }
});

// ======================
// 🧠 ROUTE 2 : Analyse IA des réponses
// ======================
app.post("/analyse-reponses", async (req, res) => {
  try {
    const { reason, answers } = req.body;

    if (!answers || !Array.isArray(answers) && typeof answers !== "object") {
      return res.status(400).json({ error: "Format des réponses invalide." });
    }

    const formattedAnswers = Array.isArray(answers)
      ? answers.map((a) => `${a.question}: ${a.answer}`).join("\n")
      : Object.entries(answers)
          .map(([q, a]) => `${q}: ${a}`)
          .join("\n");

    const prompt = `
      Tu es un conseiller en prévention. 
      Analyse les réponses suivantes pour une évaluation des risques liée à "${reason}".
      Rédige un rapport structuré avec des titres clairs en gras, un ton professionnel,
      et des propositions d'amélioration selon le Code du bien-être au travail belge.
      Voici les réponses :
      ${formattedAnswers}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const report = completion.choices[0].message.content;
    res.json({ report });
  } catch (err) {
    console.error("Erreur analyse IA :", err);
    res.status(500).json({ error: "Erreur lors de l’analyse IA." });
  }
});

// ======================
// 📄 ROUTE 3 : Génération du PDF du rapport
// ======================
app.post("/generate-report-pdf", async (req, res) => {
  try {
    const { report, reason } = req.body;

    if (!report) {
      return res.status(400).json({ error: "Aucun rapport à insérer dans le PDF." });
    }

    const templatePath = path.join(__dirname, "template.pdf");
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await pdfLib.PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);

    // 🔹 Mise en page propre
    const margin = 50;
    const fontSize = 11;
    const lines = report.split("\n").filter((l) => l.trim() !== "");
    let y = height - 100;

    for (const line of lines) {
      if (line.trim() === "") continue;

      const isTitle = /^[0-9]+\./.test(line) || line.includes(":");
      const text = line.replace(/[*•]/g, "").trim();

      firstPage.drawText(text, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: pdfLib.rgb(0, 0, 0),
        ...(isTitle ? { font: font, size: 12 } : {}),
      });

      y -= isTitle ? 20 : 15;
      if (y < margin) {
        y = height - 100;
        pdfDoc.addPage();
      }
    }

    const output = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(output));
  } catch (err) {
    console.error("Erreur PDF rapport :", err);
    res.status(500).json({ error: "Erreur lors de la génération du rapport PDF." });
  }
});

// ======================
// 🧾 ROUTE 4 : Génération du PDF du questionnaire interactif
// ======================
app.post("/generate-questionnaire-pdf", async (req, res) => {
  try {
    const { questions, reason } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Liste de questions manquante ou invalide." });
    }

    const templatePath = path.join(__dirname, "template_questionnaire.pdf");
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await pdfLib.PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
    const { height } = page.getSize();

    let y = height - 100;
    const margin = 50;
    const fontSize = 11;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      page.drawText(`${i + 1}. ${q}`, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: pdfLib.rgb(0, 0, 0),
      });

      y -= 20;

      // 🟦 Zone de réponse
      page.drawRectangle({
        x: margin,
        y: y - 35,
        width: 500,
        height: 35,
        borderColor: pdfLib.rgb(0.6, 0.6, 0.6),
        borderWidth: 1,
      });

      y -= 60;

      if (y < 100) {
        y = height - 100;
        pdfDoc.addPage();
      }
    }

    const output = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(output));
  } catch (err) {
    console.error("Erreur PDF questionnaire :", err);
    res.status(500).json({ error: "Erreur lors de la génération du questionnaire PDF." });
  }
});

// ======================
// 🚀 Lancement du serveur
// ======================
app.listen(PORT, () => {
  console.log(`✅ Serveur inspecteur-sécurité actif sur le port ${PORT}`);
});
