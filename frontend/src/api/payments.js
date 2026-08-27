import client from './client';

export async function getPayments(status) {
  const res = await client.get('/payments', { params: status ? { status } : {} });
  return res.data;
}

export async function getPaymentDetail(id) {
  const res = await client.get(`/payments/${id}`);
  return res.data;
}

export async function simulateFailure() {
  const res = await client.post('/payments/simulate-failure');
  return res.data;
}

export async function executeRecovery(paymentId) {
  const res = await client.post(`/payments/${paymentId}/recovery/execute`);
  return res.data;
}

export async function getDashboardStats() {
  const res = await client.get('/dashboard/stats');
  return res.data;
}

export async function runExperiment(sampleSize = 40) {
  const res = await client.post('/experiments/run', { sampleSize });
  return res.data;
}