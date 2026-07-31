import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRoutes from './routes/chat.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5173', 'https://fazil-ai-chatboat.onrender.com']
}));
app.use(express.json());

// API Routes
app.use('/api', chatRoutes);

// ── Per-session history ──────────────────────────────────────────────────────
const historyDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir);

function sessionFilePath(sessionId) {
  // Sanitise the session ID so it can safely be used as a filename
  const safe = (sessionId || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(historyDir, `${safe}.json`);
}

// GET /api/history?sessionId=xxx
app.get('/api/history', (req, res) => {
  try {
    const filePath = sessionFilePath(req.query.sessionId);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error reading history:', error);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { sessionFilePath };
