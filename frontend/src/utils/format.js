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