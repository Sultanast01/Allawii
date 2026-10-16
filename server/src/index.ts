import './env.js';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import bmoniRoutes from './routes/bmoni.js';
import roundUpRoutes from './routes/roundup.js';
import botRoutes, { botUserRouter } from './routes/bot.js';
import syncRoutes from './routes/sync.js';
import { startTelegramBot } from './bot/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Allawii API', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/bmoni', bmoniRoutes);
app.use('/api/round-up', roundUpRoutes);
app.use('/api/bot/user', botUserRouter);
app.use('/api/bot', botRoutes);
app.use('/api/sync', syncRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Allawii API running on http://localhost:${PORT}`);
  console.log(`B Moni sandbox: ${process.env.BMONI_BASE_URL || 'https://embedded-dev.bmoni.com'}`);
  console.log(`Supabase: ${process.env.SUPABASE_URL ? process.env.SUPABASE_URL : 'NOT CONFIGURED — set SUPABASE_URL + keys'}`);
  console.log(`Bot HTTP API: ${process.env.BOT_API_KEY ? 'key required' : 'disabled (no BOT_API_KEY)'}`);
  void startTelegramBot();
});
