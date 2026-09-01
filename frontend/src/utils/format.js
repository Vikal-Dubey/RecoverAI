export function formatINR(paise) {
  if (paise == null || isNaN(paise)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatFailureReason(reason) {
  if (!reason) return '—';
  return String(reason)
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function formatINRRupees(rupees) {
  if (rupees == null || isNaN(rupees)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function computeRiskTier(customer) {
  if (!customer) {
    return { label: 'Unknown', short: 'Unknown', color: 'bg-surface-2 text-muted', rate: 0 };
  }
  const success = customer.successCount || 0;
  const fail = customer.failCount || 0;
  const total = success + fail;
  const rate = total > 0 ? success / total : 0;

  if (rate >= 0.7) {
    return {
      label: 'Low Risk',
      short: 'LOW',
      color: 'bg-accent-dim text-accent',
      rate,
    };
  }
  if (rate >= 0.4) {
    return {
      label: 'Medium Risk',
      short: 'MEDIUM',
      color: 'bg-warn-dim text-warn',
      rate,
    };
  }
  return {
    label: 'High Risk',
    short: 'HIGH',
    color: 'bg-danger-dim text-danger',
    rate,
  };
}

export function formatTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(dateStr);
  }
}