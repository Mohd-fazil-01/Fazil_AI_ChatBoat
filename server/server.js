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

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', chatRoutes);

// History Endpoint
const historyFilePath = path.join(__dirname, 'chatHistory.json');

app.get('/api/history', (req, res) => {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf8');
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
