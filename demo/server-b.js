import express from 'express';

const app = express();

const products = [
  { id: 1, name: 'Widget', price: 9.99, stock: 42 },
  { id: 2, name: 'Gadget', price: 24.99, stock: 17 },
  { id: 3, name: 'Doohickey', price: 4.99, stock: 100 },
];

app.get('/products', (_req, res) => {
  res.json(products);
});

app.get('/products/:id', (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

const server = app.listen(4002, () => {
  console.log('[server-b] Products API → http://localhost:4002');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[server-b] Port 4002 is already in use');
    process.exit(1);
  }
  throw err;
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
