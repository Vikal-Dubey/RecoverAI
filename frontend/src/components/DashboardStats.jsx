import { useEffect, useState, useCallback } from 'react';
import { getDashboardStats } from '../api/payments';
import StatCard from './StatCard';
import { useSocketEvent } from '../hooks/useSocketEvent';

export default function DashboardStats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const data = await getDashboardStats();
        if (!ignore) setStats(data);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useSocketEvent('recovery:completed', loadStats);
  useSocketEvent('recovery:decision', loadStats);
  useSocketEvent('payment:failed', loadStats);

  if (error) return null; // fail quietly — stats are supplementary, not blocking

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  const recoveryPct = Math.round((stats.recoveryRate || 0) * 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard label="Total Payments" value={stats.total} />
      <StatCard label="Recovered" value={stats.recovered} accent="text-accent" />
      <StatCard label="Recovery Rate" value={`${recoveryPct}%`} accent="text-accent" />
      <StatCard label="Escalated" value={stats.escalated} accent="text-warn" />
    </div>
  );
}