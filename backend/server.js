import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handlePaymentFailedEvent } from './webhooks/paymentWebhook.js';
import { prisma } from './src/lib/prismaClient.js';

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
    const payment = await prisma.payment.findFirst({ where: { status: 'FAILED' } });
    if (!payment) return res.status(404).json({ error: 'No failed payments available. Run seed first.' });

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

// --- List failed payments (for dashboard) ---
app.get('/payments/failed', async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { status: 'FAILED' },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(payments);
});

// --- Payment detail + timeline (for dashboard detail view) ---
app.get('/payments/:id', async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      agentDecisions: { include: { policyChecks: true }, orderBy: { createdAt: 'desc' } },
      recoveryAttempts: true,
      agentState: true,
      auditLogs: { orderBy: { timestamp: 'asc' } },
    },
  });
  if (!payment) return res.status(404).json({ error: 'Not found' });
  res.json(payment);
});

// --- Dashboard stats ---
app.get('/dashboard/stats', async (req, res) => {
  const total = await prisma.payment.count();
  const recovered = await prisma.payment.count({ where: { status: 'RECOVERED' } });
  const escalated = await prisma.payment.count({ where: { status: 'ESCALATED' } });
  const failed = await prisma.payment.count({ where: { status: 'FAILED' } });

  res.json({
    total,
    recovered,
    escalated,
    failed,
    recoveryRate: total > 0 ? (recovered / total) : 0,
  });
});

io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);
  socket.on('disconnect', () => console.log('Dashboard disconnected:', socket.id));
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`RecoverAI backend running on port ${PORT}`);
});