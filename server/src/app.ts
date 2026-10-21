import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { pingDatabase } from './data';
import { loadSession } from './middleware/auth';
import { apiNotFound, errorHandler } from './middleware/errors';
import { corsMiddleware, csrfGuard, globalRateLimit, helmetMiddleware } from './middleware/security';
import { authRouter } from './routes/auth.routes';
import { profileRouter } from './routes/profile.routes';
import { usersRouter } from './routes/users.routes';
import { auditRouter, rolesRouter } from './routes/admin.routes';
import { productsRouter } from './routes/products.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { clientsRouter } from './routes/clients.routes';
import { invoicesRouter } from './routes/invoices.routes';
import { portfolioRouter } from './routes/portfolio.routes';
import { trainingRouter } from './routes/training.routes';

const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

const serveClient = (app: express.Express) => {
  if (!fs.existsSync(CLIENT_DIST)) return;
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      setHeaders: (res, filePath) => {
        const rel = path.relative(CLIENT_DIST, filePath).replace(/\\/g, '/');
        if (rel.startsWith('assets/')) {
          res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
        } else {
          // sw.js, manifest, index.html y offline.html deben revalidarse siempre
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  // Fallback SPA: cualquier GET que no sea API devuelve el app shell
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
};

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(helmetMiddleware);

  // Healthcheck para Railway (sin rate limit ni sesión)
  app.get('/api/health', async (_req, res) => {
    try {
      await pingDatabase();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });

  const api = express.Router();
  api.use(corsMiddleware);
  api.use(globalRateLimit);
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use(csrfGuard);
  api.use(loadSession);

  api.use('/auth', authRouter);
  api.use('/profile', profileRouter);
  api.use('/users', usersRouter);
  api.use('/roles', rolesRouter);
  api.use('/audit', auditRouter);
  api.use('/products', productsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/clients', clientsRouter);
  api.use('/invoices', invoicesRouter);
  api.use('/portfolio', portfolioRouter);
  api.use('/training', trainingRouter);
  api.use(apiNotFound);

  app.use('/api', api);
  serveClient(app);
  app.use(errorHandler);
  return app;
};
