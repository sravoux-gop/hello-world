import path from 'node:path';

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
  res.sendFile(path.join(publicDir, fileName));
}