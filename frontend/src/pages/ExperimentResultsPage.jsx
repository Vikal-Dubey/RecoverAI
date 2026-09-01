import { useEffect, useState } from 'react';
import { getLatestExperiment, runExperiment } from '../api/payments';
import Card from '../components/Card';
import ComparisonBar from '../components/ComparisonBar';
import { formatINR, formatFailureReason } from '../utils/format';

function downloadSummary(result) {
  const lines = [
    `RecoverAI Experiment Results — Batch ${result.batchId}`,
    `Sample size: ${result.sampleSize} payments per arm`,
    '',
    '--- RecoverAI ---',
    `Revenue Recovered: ₹${(result.recoverAI.revenueRecovered / 100).toLocaleString('en-IN')}`,
    `Net Value (cost-adjusted): ₹${(result.recoverAI.netValueRecovered / 100).toLocaleString('en-IN')}`,
    `Recovery Rate: ${Math.round(result.recoverAI.recoveryRate * 100)}%`,
    `Avg Attempts/Payment: ${result.recoverAI.avgAttempts.toFixed(2)}`,
    `Operational Cost: ₹${(result.recoverAI.operationalCost / 100).toLocaleString('en-IN')}`,
    '',
    '--- Baseline (naive retry) ---',
    `Revenue Recovered: ₹${(result.baseline.revenueRecovered / 100).toLocaleString('en-IN')}`,
    `Net Value (cost-adjusted): ₹${(result.baseline.netValueRecovered / 100).toLocaleString('en-IN')}`,
    `Recovery Rate: ${Math.round(result.baseline.recoveryRate * 100)}%`,
    `Avg Attempts/Payment: ${result.baseline.avgAttempts.toFixed(2)}`,
    `Operational Cost: ₹${(result.baseline.operationalCost / 100).toLocaleString('en-IN')}`,
    '',
    `Incremental Revenue: ₹${(result.incrementalRevenue / 100).toLocaleString('en-IN')}`,
    `Incremental Net Value: ₹${(result.incrementalNetValue / 100).toLocaleString('en-IN')}`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recoverai-experiment-${result.batchId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExperimentResultsPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const data = await getLatestExperiment();
        if (!ignore) setResult(data);
      } catch (err) {
        if (!ignore) {
          // 404 is normal before first run
          if (err.response?.status !== 404) {
            setError(err.message);
          }
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleRun() {
    setRunning(true);
    setError(null);

    try {
      const data = await runExperiment(40);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-12 text-center text-xs text-muted">
        Loading experiment results...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">
            RecoverAI vs Baseline
          </h1>
          <p className="text-xs text-muted mt-1">
            Compare AI-powered recovery with the baseline strategy.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {result && (
            <button
              type="button"
              onClick={() => downloadSummary(result)}
              className="px-3.5 py-2 rounded-lg bg-surface-2 hover:bg-surface-2/80 text-text border border-border text-xs font-medium transition"
            >
              Download Report
            </button>
          )}

          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-bg text-xs font-semibold shadow transition disabled:opacity-50"
          >
            {running ? 'Running Experiment...' : 'Run Experiment'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger-dim text-danger text-xs">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!result && !running && (
        <div className="bg-surface border border-border rounded-xl p-16 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-10 h-10 rounded-full bg-surface-2 text-accent mx-auto flex items-center justify-center font-bold text-sm">
            ✦
          </div>
          <div>
            <h2 className="text-base font-bold text-text">RecoverAI vs Baseline</h2>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              No experiment has been run yet.<br />
              Run a benchmark to compare recovery performance.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRun}
            className="px-5 py-2 rounded-lg bg-accent hover:bg-accent/90 text-bg text-xs font-semibold shadow transition"
          >
            Run Experiment
          </button>
        </div>
      )}

      {/* Running feedback indicator */}
      {running && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-xs text-muted space-y-2">
          <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
          <p className="text-text font-medium">Running benchmark simulation across 40 payment scenarios...</p>
        </div>
      )}

      {/* Active Results */}
      {result && !running && (
        <div className="space-y-6">
          <Card title={`Benchmark Comparison (Sample: ${result.sampleSize} payments)`}>
            <div className="space-y-3">
              <ComparisonBar
                label="Recovery Rate"
                aValue={result.recoverAI.recoveryRate}
                bValue={result.baseline.recoveryRate}
                format={(v) => `${Math.round(v * 100)}%`}
              />

              <ComparisonBar
                label="Revenue Recovered"
                aValue={result.recoverAI.revenueRecovered}
                bValue={result.baseline.revenueRecovered}
                format={formatINR}
              />

              <ComparisonBar
                label="Net Value Recovered (Cost-Adjusted)"
                aValue={result.recoverAI.netValueRecovered}
                bValue={result.baseline.netValueRecovered}
                format={formatINR}
              />

              <ComparisonBar
                label="Avg Attempts per Payment"
                aValue={result.recoverAI.avgAttempts}
                bValue={result.baseline.avgAttempts}
                format={(v) => Number(v).toFixed(2)}
                higherIsBetter={false}
              />
            </div>
          </Card>

          {/* Compact Failure Type Breakdown */}
          {result.recoverAI.failureTypeBreakdown && Object.keys(result.recoverAI.failureTypeBreakdown).length > 0 && (
            <Card title="Failure-Type Performance Breakdown">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-muted font-medium">
                    <tr>
                      <th className="text-left px-4 py-2.5">Failure Type</th>
                      <th className="text-right px-4 py-2.5">Count</th>
                      <th className="text-right px-4 py-2.5">Avg Attempts</th>
                      <th className="text-right px-4 py-2.5">Notified</th>
                      <th className="text-right px-4 py-2.5">Recovery Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {Object.entries(result.recoverAI.failureTypeBreakdown).map(([reason, b]) => {
                      const ratePct = Math.round(b.recoveryRate * 100);
                      return (
                        <tr key={reason} className="hover:bg-surface-2/40 transition">
                          <td className="px-4 py-2.5 font-medium text-text">
                            {formatFailureReason(reason)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-text">{b.count}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-text">{b.avgAttempts}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-text">{b.notified}</td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                ratePct >= 70
                                  ? 'bg-accent-dim text-accent'
                                  : ratePct >= 40
                                  ? 'bg-warn-dim text-warn'
                                  : 'bg-danger-dim text-danger'
                              }`}
                            >
                              {ratePct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}