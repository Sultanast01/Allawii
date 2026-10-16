import { createApp, clientBuildExists, clientDist } from './app.js';
import { startTelegramBot } from './bot/index.js';

/**
 * The persistent host: one process answers /api and serves the built SPA, so the
 * client's relative fetch('/api/...') resolves with no dev proxy and no second origin.
 * Vercel never reaches this file — server/index.mjs builds the same app without a
 * listener, because no poll loop or timer can survive between function invocations.
 * It is deliberately not called index.ts: a serverless deploy must not auto-detect an
 * entry that binds a port.
 */
const PORT = Number(process.env.PORT) || 3001;
const app = createApp({ serveClient: true });

app.listen(PORT, () => {
  console.log(`Allawii API running on http://localhost:${PORT}`);
  console.log(`Built app: ${clientBuildExists() ? clientDist : 'not built (run npm run build:client)'}`);
  console.log(`B Moni sandbox: ${process.env.BMONI_BASE_URL || 'https://embedded-dev.bmoni.com'}`);
  console.log(`Supabase: ${process.env.SUPABASE_URL ? process.env.SUPABASE_URL : 'NOT CONFIGURED — set SUPABASE_URL + keys'}`);
  console.log(`Bot HTTP API: ${process.env.BOT_API_KEY ? 'key required' : 'disabled (no BOT_API_KEY)'}`);
  void startTelegramBot();
});
