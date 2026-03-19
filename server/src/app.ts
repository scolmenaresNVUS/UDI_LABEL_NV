import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { initializeStores } from './stores';
import authRoutes from './routes/auth.routes';
import barcodeRoutes from './routes/barcode.routes';
import productsRoutes from './routes/products.routes';
import templatesRoutes from './routes/templates.routes';
import zplRoutes from './routes/zpl.routes';
import printersRoutes from './routes/printers.routes';
import printJobsRoutes from './routes/printJobs.routes';
import auditLogRoutes from './routes/auditLog.routes';
import zebraRoutes from './routes/zebra.routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/zpl', zplRoutes);
app.use('/api/printers', printersRoutes);
app.use('/api/print-jobs', printJobsRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/zebra', zebraRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production: serve React static files
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function start() {
  try {
    await initializeStores();
    console.log('All stores initialized.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      // Show LAN IP
      const os = require('os');
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`LAN access: http://${net.address}:${PORT}`);
          }
        }
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
