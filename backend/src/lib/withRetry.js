export async function withRetry(fn, retries = 3, delayMs = 3000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.log(`[DB] Query failed (${err.message}), retrying in ${delayMs}ms... (attempt ${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}