import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SERVER_DIR = path.dirname(__filename);

export const ROOT_DIR = path.join(SERVER_DIR, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const VIEWS_DIR = path.join(SERVER_DIR, 'views');
export const DATA_DIR = path.join(SERVER_DIR, 'data');
export const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
export const PLAYLISTS_DIR = path.join(DATA_DIR, 'playlists');
export const PLAYLIST_LIBRARY_FILE = path.join(DATA_DIR, 'playlists.json');

export const DEFAULT_PORT = Number(process.env.PORT) || 3000;
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const AVATAR_MAX_BASE64 = 300 * 1024;
export const PLAYLIST_UPLOAD_MAX_TEXT = 500 * 1024;

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const ANSWER_VALIDATION_MODEL = process.env.ANSWER_VALIDATION_MODEL || 'gpt-4.1-mini';
export const ANSWER_VALIDATION_TIMEOUT_MS = Number(process.env.ANSWER_VALIDATION_TIMEOUT_MS) || 8000;
