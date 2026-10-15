import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ES module imports are hoisted, so every `process.env.X || fallback` in the route modules
// would read the environment before this file's config ran. Nothing else may import it later.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_PATH || join(here, '..', '.env') });
dotenv.config();
