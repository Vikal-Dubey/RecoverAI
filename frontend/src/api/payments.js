import client from './client';

export async function getPayments({ status, notified } = {}) {
  const params = {};
  if (status) params.status = status;
  if (notified) params.notified = 'true';
  const res = await client.get('/payments', { params });
  return res.data;
}

export async function getPaymentDetail(id) {
  const res = await client.get(`/payments/${id}`);
  return res.data;
}

export async function getLatestExperiment() {
  const res = await client.get('/experiments/latest');
  return res.data;
}

export async function simulateFailure(failureReason) {
  const res = await client.post('/payments/simulate-failure', failureReason ? { failureReason } : {});
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

export async function simulateMany(count, failureReason, onProgress) {
  const results = [];
  for (let i = 0; i < count; i++) {
    try {
      const result = await simulateFailure(failureReason);
      results.push(result);
    } catch (err) {
      results.push({ success: false, error: err.response?.data?.error || err.message });
    }
    if (onProgress) onProgress(i + 1, count);
    await new Promise((r) => setTimeout(r, 400)); // small gap so the live feed reads naturally
  }
  return results;
}

export async function getHealth() {
  const res = await client.get('/health');
  return res.data;
}