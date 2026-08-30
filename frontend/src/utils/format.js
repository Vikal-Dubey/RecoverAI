export function formatINR(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatFailureReason(reason) {
  return reason
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatINRRupees(rupees) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function computeRiskTier(customer) {
  const total = customer.successCount + customer.failCount;
  const rate = total > 0 ? customer.successCount / total : 0;
  if (rate >= 0.7) return { label: 'Low Risk', short: 'Low', color: 'bg-green-100 text-green-700', rate };
  if (rate >= 0.4) return { label: 'Medium Risk', short: 'Medium', color: 'bg-amber-100 text-amber-700', rate };
  return { label: 'High Risk', short: 'High', color: 'bg-red-100 text-red-700', rate };
}