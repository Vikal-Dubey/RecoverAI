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

  const blob = new Blob([lines.join('\n')], {
    type: 'text/plain',
  });

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

        if (!ignore) {
          setResult(data);
        }
      } catch (err) {
        if (!ignore) {
          // 404 means no experiment has been run yet — friendly message.
          // Anything else is a real error worth showing.
          setError(
            err.response?.status === 404
              ? 'No experiment run yet — click "Run Experiment" to generate results.'
              : err.message
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
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
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          RecoverAI vs. Baseline
        </h2>

        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={() => downloadSummary(result)}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Download Summary
            </button>
          )}

          <button
            onClick={handleRun}
            disabled={running}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? 'Running experiment…' : 'Run New Experiment'}
          </button>
        </div>
      </div>

      {error && !result && (
        <div className="p-3 rounded-md bg-amber-50 text-amber-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <>
          <Card title={`Batch ${result.batchId} — ${result.sampleSize} payments`}>
            <ComparisonBar
              label="Revenue Recovered"
              aValue={result.recoverAI.revenueRecovered}
              bValue={result.baseline.revenueRecovered}
              format={formatINR}
            />

            <ComparisonBar
              label="Net Value (cost-adjusted)"
              aValue={result.recoverAI.netValueRecovered}
              bValue={result.baseline.netValueRecovered}
              format={formatINR}
            />

            <ComparisonBar
              label="Recovery Rate"
              aValue={result.recoverAI.recoveryRate}
              bValue={result.baseline.recoveryRate}
              format={(v) => `${Math.round(v * 100)}%`}
            />

            <ComparisonBar
              label="Avg Attempts per Payment"
              aValue={result.recoverAI.avgAttempts}
              bValue={result.baseline.avgAttempts}
              format={(v) => v.toFixed(2)}
              higherIsBetter={false}
            />

            <ComparisonBar
              label="Operational Cost"
              aValue={result.recoverAI.operationalCost}
              bValue={result.baseline.operationalCost}
              format={formatINR}
              higherIsBetter={false}
            />
          </Card>

          <Card title="Failure-Type Breakdown (RecoverAI)">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left py-1.5">Failure Type</th>
                  <th className="text-right py-1.5">Count</th>
                  <th className="text-right py-1.5">Avg Attempts</th>
                  <th className="text-right py-1.5">Notified</th>
                  <th className="text-right py-1.5">Recovery Rate</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {Object.entries(
                  result.recoverAI.failureTypeBreakdown || {}
                ).map(([reason, b]) => (
                  <tr key={reason}>
                    <td className="py-2">
                      {formatFailureReason(reason)}
                    </td>

                    <td className="py-2 text-right">
                      {b.count}
                    </td>

                    <td className="py-2 text-right">
                      {b.avgAttempts}
                    </td>

                    <td className="py-2 text-right">
                      {b.notified}
                    </td>

                    <td className="py-2 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          b.recoveryRate >= 0.7
                            ? 'bg-green-100 text-green-700'
                            : b.recoveryRate >= 0.4
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {Math.round(b.recoveryRate * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}