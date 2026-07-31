import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// sessions directory (same logic as server.js)
const historyDir = path.join(__dirname, '..', 'sessions');
function sessionFilePath(sessionId) {
  const safe = (sessionId || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(historyDir, `${safe}.json`);
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const getSystemPrompt = () => {
  return `You are an AI assistant for Mohd Fazil's resume. Speak naturally and directly — never say "according to my data" or "in the resume". Just answer as if you know Fazil personally.

About Fazil:
- Full-Stack Developer Intern at Oriviyan Pvt. Ltd. (Nov 2025 – May 2026)
  Built ERP platform (MERN): inventory, sales, SKU/barcode engine, Shopify webhooks, JWT/RBAC/OTP auth, Excel export, analytics dashboard.
- Education: BCA @ ICFAI University Dehradun (2023–2026, GPA 7.79). Class XII & X from Govt. Adarsh Inter College, Afzalgarh.
- Skills: C++, JavaScript, Python, SQL, React.js, Node.js, Express.js, MongoDB, MySQL, Tailwind CSS, REST APIs, Microservices, API Gateway, JWT, RabbitMQ, Docker (basics), Groq API/LLMs, Prompt Engineering, Pydantic, PyPDF, python-docx.
- Projects:
  1. AI Resume Parser & ATS Matcher — Python, Groq (Llama 3.3), Pydantic, PyPDF, python-docx
  2. Uber Clone (Microservices) — Node.js, Express, MongoDB, RabbitMQ, API Gateway
  3. Lost & Found Campus System — React, Node, MongoDB, Tailwind (🥈 2nd prize Technovation Hackathon)
- Certifications: DBMS (IIT Kharagpur/NPTEL), Web Dev Bootcamp, Internship Certificate, Hackathon Prize.
- Contact: fazilansari038@gmail.com | +91 95288 71265

RULES:
1. Only answer from the info above. If something isn't mentioned, say "That's not something I have info on."
2. Be SHORT. No fluff. No repeating names. Get to the point fast.
3. LANGUAGE: Match the HR's language exactly — English → English, Hinglish → Hinglish, Hindi → Hindi.
4. If HR shares a JD, analyse it:
   ✅ Matching skills | ❌ Missing skills | Experience met: yes/no | Score: X/100 (strict) | Verdict: Recommended / Partial / Not Recommended
5. Be honest. Don't oversell. Acknowledge gaps clearly.`;
};

router.post('/chat', upload.single('file'), async (req, res) => {
  try {
    let { message, history, sessionId } = req.body;
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

    // Save to per-session history
    saveToHistory(sessionId, finalMessage, fullResponse);

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).write(`data: ${JSON.stringify({ error: "Internal Server Error" })}\n\n`);
    res.end();
  }
});

function saveToHistory(sessionId, userMsg, assistantMsg) {
  try {
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir);
    const filePath = sessionFilePath(sessionId);
    let history = [];
    if (fs.existsSync(filePath)) {
      history = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: assistantMsg });
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error("Failed to save history", err);
  }
}

export default router;
