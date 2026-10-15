import './env.js';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import bmoniRoutes from './routes/bmoni.js';
import roundUpRoutes from './routes/roundup.js';
import whatsappRoutes from './routes/whatsapp.js';
import syncRoutes from './routes/sync.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// WhatsApp verifies the X-Hub-Signature-256 HMAC over the exact bytes Meta sent.
app.use('/api/whatsapp/webhook', express.raw({ type: () => true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Allawii API', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/bmoni', bmoniRoutes);
app.use('/api/round-up', roundUpRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/sync', syncRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Allawii API running on http://localhost:${PORT}`);
  console.log(`B Moni sandbox: ${process.env.BMONI_BASE_URL || 'https://embedded-dev.bmoni.com'}`);
  console.log(`WhatsApp webhook: ${process.env.WHATSAPP_APP_SECRET ? 'signature checks on' : 'needs WHATSAPP_APP_SECRET'} · outbound: ${process.env.WHATSAPP_TOKEN ? 'Meta Cloud API' : 'console only (no WHATSAPP_TOKEN)'}`);
});
