import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../config.js';

const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const APP_VERSION = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')).version;

function injectAppVersion(html) {
  const versionMarkup = `<div class="app-version-badge" aria-label="Version de l'application">v${APP_VERSION}</div>`;

  if (html.includes('app-version-badge')) {
    return html;
  }

  if (html.includes('</body>')) {
    return html.replace('</body>', `  ${versionMarkup}\n</body>`);
  }

  return `${html}\n${versionMarkup}`;
}

export function sendHtmlView(res, filePath) {
  fs.readFile(filePath, 'utf8', (error, html) => {
    if (error) {
      res.sendStatus(404);
      return;
    }

    res.type('html').send(injectAppVersion(html));
  });
}

export function getSession(req, res, sessions) {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'session_not_found' });
    return null;
  }

  return session;
}

export function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  return `${proto}://${host}`;
}

export function getJoinUrl(req, session) {
  return `${getBaseUrl(req)}/?session=${session.code}`;
}

export function sendPublicView(res, publicDir, fileName) {
  sendHtmlView(res, path.join(publicDir, fileName));
}