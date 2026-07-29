import express from 'express';

const app = express();

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'editor' },
  { id: 3, name: 'Carol', email: 'carol@example.com', role: 'viewer' },
];

app.get('/users', (_req, res) => {
  res.json(users);
});

app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Exercises the reverse proxy's forwarded-header sanitization: reports
// exactly what this backend received, so tests can confirm client-supplied
// X-Forwarded-* claims never survive the trip through the proxy.
app.get('/echo-headers', (req, res) => {
  res.json({
    host: req.headers.host,
    xForwardedHost: req.headers['x-forwarded-host'],
    xForwardedProto: req.headers['x-forwarded-proto'],
    xForwardedFor: req.headers['x-forwarded-for'],
  });
});

const server = app.listen(4001, () => {
  console.log('[server-a] Users API → http://localhost:4001');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[server-a] Port 4001 is already in use');
    process.exit(1);
  }
  throw err;
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
