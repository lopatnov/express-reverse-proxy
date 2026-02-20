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
