import path from 'path';
import { config as loadEnv } from 'dotenv';

const envFile = process.env.INTEGRATION_ENV_FILE || '.env.test';
loadEnv({ path: path.resolve(process.cwd(), envFile) });
