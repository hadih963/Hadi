// Reads settings from .env (if present) and the environment, with safe defaults.
// process.loadEnvFile is built into Node >= 20.12, so no "dotenv" package is needed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // No .env file: fine, use defaults below.
}

const env = process.env;
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const hhmm = (v) => (/^\d{1,2}:\d{2}$/.test(v || '') ? v : null);

export const config = {
  port: num(env.PORT, 3000),
  weather: {
    lat: num(env.WEATHER_LAT, 52.3676),
    lon: num(env.WEATHER_LON, 4.9041),
    city: env.WEATHER_CITY || 'Amsterdam',
    timezone: env.WEATHER_TIMEZONE || 'Europe/Amsterdam',
    fixture: env.WEATHER_FIXTURE || null,
  },
  painting: {
    autoStart: hhmm(env.PAINTING_AUTO_START),
    autoEnd: hhmm(env.PAINTING_AUTO_END),
    nightDimStart: hhmm(env.NIGHT_DIM_START),
    nightDimEnd: hhmm(env.NIGHT_DIM_END),
    rotateMinutes: num(env.PAINTING_ROTATE_MINUTES, 30),
  },
  publicDir: path.join(ROOT, 'public'),
  dataFile: env.STATE_FILE || path.join(ROOT, 'data', 'state.json'),
};
