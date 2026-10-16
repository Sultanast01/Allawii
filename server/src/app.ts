import './env.js';
import 'express-async-errors';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import bmoniRoutes from './routes/bmoni.js';
import roundUpRoutes from './routes/roundup.js';
import botRoutes, { botUserRouter } from './routes/bot.js';
import telegramRoutes from './routes/telegram.js';
import syncRoutes from './routes/sync.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Where `npm run build:client` puts the SPA, so one process can serve both. */
export const clientDist = join(here, '..', '..', 'client', 'dist');

export const clientBuildExists = () => existsSync(join(clientDist, 'index.html'));

export interface AppOptions {
  /**
   * Answer page requests with the built SPA. Only a persistent Node host can do this:
   * a serverless host serves those files from its own CDN instead, and its function
   * bundle has no copy of them at a readable path.
   */
  serveClient?: boolean;
}

/** The whole API, without a port listener — both hosts build the app from here. */
export function createApp({ serveClient = false }: AppOptions = {}) {
  const app = express();

  /**
   * Same-origin deploys need no cross-origin allowance at all; set ALLOWED_ORIGINS
   * only when a separate front-end host must reach this API. Left unset it stays as
   * permissive as development, which is the one thing a deployed service-role key
   * server should not be silently configured with.
   */
  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
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
  app.use('/api/telegram', telegramRoutes);
  app.use('/api/sync', syncRoutes);

  const hasClientBuild = serveClient && clientBuildExists();
  if (hasClientBuild) {
    app.use(express.static(clientDist, { index: false }));
  }

  /**
   * An unmatched /api path must answer with JSON. Returning index.html instead is what
   * made a deployed client read `{}` and report "Login failed" over a working password.
   */
  app.use((req, res) => {
    if (!hasClientBuild || req.path.startsWith('/api/') || req.method !== 'GET') {
      res.status(404).json({ error: `No ${req.method} ${req.path} endpoint` });
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(clientDist, 'index.html'));
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
