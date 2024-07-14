import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { pino } from 'pino';
import cron from 'node-cron';
import { healthCheckRouter } from '@/api/healthCheck/healthCheckRouter';
import { uniswapRouter } from '@/api/swap/uniswap/uniswapRouter';
import { openAPIRouter } from '@/api-docs/openAPIRouter';
import errorHandler from '@/common/middleware/errorHandler';
import rateLimiter from '@/common/middleware/rateLimiter';
import requestLogger from '@/common/middleware/requestLogger';
import { env } from '@/common/utils/envConfig';
import { getPools } from './cron/raydium';

const logger = pino({ name: 'server start' });
const app: Express = express();

// Set the application to trust the reverse proxy
app.use(rateLimiter);
app.set('trust proxy', true);

// Middlewares
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());

// Request logging
app.use(requestLogger);
app.use(express.json());

// Routes
app.use('/health-check', healthCheckRouter);
app.use('/uniswap', uniswapRouter);

// Swagger UI
app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

const cronSchedule = '*/10 * * * *';
cron.schedule(cronSchedule, getPools);

export { app, logger };
