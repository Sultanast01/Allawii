import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Resolve from this file so the server boots the same way from any working directory.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_PATH || join(here, '..', '.env') });
dotenv.config();

import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import bmoniRoutes from './routes/bmoni.js';
import roundUpRoutes from './routes/roundup.js';

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

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Allawii API running on http://localhost:${PORT}`);
  console.log(`B Moni sandbox: ${process.env.BMONI_BASE_URL || 'https://embedded-dev.bmoni.com'}`);
});
