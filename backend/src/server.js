import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handlePaymentFailedEvent } from './webhooks/paymentWebhook.js';
import { prisma } from './lib/prismaClient.js';
import { executeRetryAttempt } from './recovery/recoveryService.js';
import { runExperiment } from './recovery/experimentService.js';
import { withRetry } from './lib/withRetry.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Make io accessible in route handlers if needed later
app.set('io', io);

// --- Webhook route (the "real" gateway entry point) ---
app.post('/webhooks/payment-failed', async (req, res) => {
  try {
    const result = await handlePaymentFailedEvent(req.body);
    io.emit('recovery:completed', result);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Dev/demo trigger: builds a gateway-shaped event internally ---
app.post('/payments/simulate-failure', async (req, res) => {
  try {
    const { failureReason } = req.body || {};

    const payment = await withRetry(() =>
      prisma.payment.findFirst({
        where: {
          status: 'FAILED',
          ...(failureReason ? { failureReason } : {}),
        },
      })
    );

    if (!payment) {
      return res.status(404).json({
        error: failureReason
          ? `No FAILED payments with reason "${failureReason}" available.`
          : 'No failed payments available. Run seed first.',
      });
    }

    const webhookPayload = {
      event: 'payment.failed',
      created_at: Date.now(),
      payload: { payment: { id: payment.id } },
    };

    io.emit('payment:failed', { paymentId: payment.id });
    const result = await handlePaymentFailedEvent(webhookPayload);
    io.emit('recovery:completed', result);

    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Execute a scheduled retry, and loop the agent again if it fails ---
app.post('/payments/:id/recovery/execute', async (req, res) => {
  try {
    const payment = await withRetry(() =>
      prisma.payment.findUnique({ where: { id: req.params.id } })
    );
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const latestAttempt = await withRetry(() =>
      prisma.recoveryAttempt.findFirst({
        where: { paymentId: payment.id, executedAt: null },
        orderBy: { createdAt: 'desc' },
      })
    );

    if (!latestAttempt) return res.status(404).json({ error: 'No pending recovery attempt found' });

    io.emit('recovery:executing', { paymentId: payment.id });

    const result = await executeRetryAttempt(latestAttempt.id);
    io.emit('recovery:completed', result);

    // If it failed and retries remain, loop the agent again automatically
    if (result.outcome === 'failed' && result.payment.retryCount < 3) {
      const loopResult = await handlePaymentFailedEvent({
        event: 'payment.failed',
        payload: { payment: { id: payment.id } },
      });
      io.emit('recovery:decision', loopResult);
      return res.json({ result, loopResult });
    }

    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- List failed payments (for dashboard) ---
app.get('/payments/failed', async (req, res) => {
  try {
    const payments = await withRetry(() =>
      prisma.payment.findMany({
        where: { status: 'FAILED', experimentBatchId: null },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    );
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- List payments (for dashboard table), optionally filtered by status ---
app.get('/payments', async (req, res) => {
  const { status, notified } = req.query;
  try {
    const payments = await withRetry(() =>
      prisma.payment.findMany({
        where: {
          experimentBatchId: null,
          ...(status ? { status } : {}),
          ...(notified === 'true' ? { notificationCount: { gt: 0 } } : {}),
        },
        include: {
          customer: true,
          agentDecisions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    );
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Payment detail + timeline (for dashboard detail view) ---
app.get('/payments/:id', async (req, res) => {
  try {
    const payment = await withRetry(() =>
      prisma.payment.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          agentDecisions: { include: { policyChecks: true }, orderBy: { createdAt: 'desc' } },
          recoveryAttempts: true,
          agentState: true,
          auditLogs: { orderBy: { timestamp: 'asc' } },
        },
      })
    );
    if (!payment) return res.status(404).json({ error: 'Not found' });
    res.json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/experiments/run', async (req, res) => {
  try {
    const sampleSize = req.body?.sampleSize || 40;
    const result = await runExperiment(sampleSize);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Dashboard stats ---
app.get('/dashboard/stats', async (req, res) => {
  try {
    const [total, recovered, escalated, failed] = await withRetry(() =>
      Promise.all([
        prisma.payment.count(),
        prisma.payment.count({ where: { status: 'RECOVERED' } }),
        prisma.payment.count({ where: { status: 'ESCALATED' } }),
        prisma.payment.count({ where: { status: 'FAILED' } }),
      ])
    );

    res.json({
      total,
      recovered,
      escalated,
      failed,
      recoveryRate: total > 0 ? recovered / total : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);
  socket.on('disconnect', () => console.log('Dashboard disconnected:', socket.id));
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`RecoverAI backend running on port ${PORT}`);
});

// Warm up the DB connection immediately so the first real request isn't penalized
withRetry(() => prisma.customer.count())
  .then(() => console.log('[DB] Warmed up and ready'))
  .catch((err) => console.warn('[DB] Warm-up failed, will retry on first request:', err.message));