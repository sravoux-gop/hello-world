import express from 'express';
import { WebSocketServer } from 'ws';
import {
  ADMIN_PASSWORD,
  ANSWER_VALIDATION_MODEL,
  ANSWER_VALIDATION_TIMEOUT_MS,
  DEFAULT_PORT,
  OPENAI_API_KEY,
  PUBLIC_DIR,
  VIEWS_DIR
} from './config.js';
import { createAdminAuthRoutes } from './routes/admin-auth-routes.js';
import { createAdminPlaylistRoutes } from './routes/admin-playlist-routes.js';
import { createAdminSessionRoutes } from './routes/admin-session-routes.js';
import { createPageRoutes } from './routes/page-routes.js';
import { createPlayerRoutes } from './routes/player-routes.js';
import { createPublicSessionRoutes } from './routes/public-session-routes.js';
import { createAdminAuthService } from './services/admin-auth.js';
import { createGameService } from './services/game.js';
import { createLlmAnswerValidatorService } from './services/llm-answer-validator.js';
import { createPersistenceService } from './services/persistence.js';
import { createWebsocketService } from './services/websocket.js';
import {
  buildSessionSnapshot,
  connectedPlayersPayload,
  displayName,
  serializeRanking
} from './utils/session-state.js';

const app = express();
const state = {
  sessions: new Map(),
  sessionSockets: new Map(),
  adminTokens: new Set(),
  playlistLibrary: []
};

const authService = createAdminAuthService({ state });
const persistenceService = createPersistenceService({ state });
const websocketService = createWebsocketService({
  state,
  buildSessionSnapshot,
  connectedPlayersPayload
});
const llmAnswerValidatorService = createLlmAnswerValidatorService({
  apiKey: OPENAI_API_KEY,
  model: ANSWER_VALIDATION_MODEL,
  timeoutMs: ANSWER_VALIDATION_TIMEOUT_MS
});

const gameService = createGameService({
  state,
  persistSessionsToDisk: persistenceService.persistSessionsToDisk,
  broadcast: websocketService.broadcast,
  buildSessionSnapshot,
  serializeRanking,
  displayName
});

persistenceService.loadPersistedSessions();
persistenceService.loadPlaylistLibraryFromDisk();

app.use(express.json({ limit: '500kb' }));
app.use(express.static(PUBLIC_DIR, { index: false }));

app.use(createPageRoutes({ publicDir: PUBLIC_DIR, viewsDir: VIEWS_DIR, authService }));
app.use(createAdminAuthRoutes({ authService, adminPassword: ADMIN_PASSWORD }));
app.use(createAdminPlaylistRoutes({ authService, persistenceService, state }));
app.use(createAdminSessionRoutes({
  authService,
  gameService,
  llmAnswerValidatorService,
  persistenceService,
  state
}));
app.use(createPublicSessionRoutes({ state }));
app.use(createPlayerRoutes({
  broadcast: websocketService.broadcast,
  gameService,
  persistenceService,
  state
}));

const server = app.listen(DEFAULT_PORT, () => {
  console.log(`Blind test server listening on :${DEFAULT_PORT}`);
});

const wss = new WebSocketServer({ server });
wss.on('connection', websocketService.handleConnection);
