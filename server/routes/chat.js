import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resumeData } from '../resumeData.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const historyFilePath = path.join(__dirname, '..', 'chatHistory.json');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const getSystemPrompt = () => {
  return `You are an AI representing Mohd Fazil, acting as his Resume Assistant for recruiters and HR professionals.
Your goal is to answer questions about Fazil based ONLY on the provided resume data. 

Resume Data:
${JSON.stringify(resumeData, null, 2)}

Rules:
1. Answer only from the resume data. Never invent information. If something isn't in the data, say so honestly.
2. If the user message contains or references a Job Description (JD), compare it against the resume and return:
   - Matching skills
   - Missing/important skills
   - Whether the experience requirement is met
   - An honest 0-100% match score (be strict, do not inflate)
   - A clear final verdict on fit
3. Always stay honest even if it's unfavorable to Fazil — never exaggerate.
4. EXTREMELY IMPORTANT: Keep your answers VERY short and concise. Do not add fluff. Only provide the main points.
5. Never spell out names repeatedly or print words multiple times unnecessarily.
6. Maintain conversation context across turns.`;
};

router.post('/chat', upload.single('file'), async (req, res) => {
  try {
    let { message, history } = req.body;
    const file = req.file;

    // Parse history if it comes as a string (due to FormData)
    if (typeof history === 'string') {
      try {
        history = JSON.parse(history);
      } catch (e) {
        history = [];
      }
    }

    let appendedText = "";
    if (file) {
      if (file.mimetype === 'application/pdf') {
        const data = await pdfParse(file.buffer);
        appendedText = `\n\n[Attached JD File Content]:\n${data.text}`;
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimetype === 'application/msword') {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        appendedText = `\n\n[Attached JD File Content]:\n${result.value}`;
      } else {
         appendedText = `\n\n[Attached JD File Content]:\n(Unsupported file format)`;
      }
    }

    const finalMessage = message + appendedText;

    const messages = [
      { role: "system", content: getSystemPrompt() },
      ...(history || []),
      { role: "user", content: finalMessage }
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant",
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        // Convert to string and handle newlines for SSE
        const dataStr = JSON.stringify({ content });
        res.write(`data: ${dataStr}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // Save to history
    saveToHistory(finalMessage, fullResponse);

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).write(`data: ${JSON.stringify({ error: "Internal Server Error" })}\n\n`);
    res.end();
  }
});

function saveToHistory(userMsg, assistantMsg) {
  try {
    let history = [];
    if (fs.existsSync(historyFilePath)) {
      history = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
    }
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: assistantMsg });
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error("Failed to save history", err);
  }
}

export default router;
