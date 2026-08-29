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

  if (error) return null; // fail quietly — stats are supplementary, not blocking
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
      <StatCard label="Total Payments" value={stats.total} />
      <StatCard label="Recovered" value={stats.recovered} accent="text-green-600" />
      <StatCard label="Escalated" value={stats.escalated} accent="text-purple-600" />
      <StatCard label="Failed" value={stats.failed} accent="text-red-600" />
      <StatCard
        label="Recovery Rate"
        value={`${Math.round(stats.recoveryRate * 100)}%`}
        accent="text-indigo-600"
      />
    </div>
  );
}