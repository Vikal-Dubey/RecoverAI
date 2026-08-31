import { useEffect, useState } from 'react';
import { getHealth } from '../api/payments';

function Dot({ ok }) {
  return <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-400'}`} />;
}

export default function SystemHealth() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function check() {
      try {
        const data = await getHealth();
        if (!ignore) setHealth(data);
      } catch {
        if (!ignore) setHealth({ backend: false, db: false, gemini: false });
      }
    }
    check();
    const interval = setInterval(check, 15000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  if (!health) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
      <span className="flex items-center gap-1"><Dot ok={health.backend} /> Backend</span>
      <span className="flex items-center gap-1"><Dot ok={health.db} /> Database</span>
      <span className="flex items-center gap-1"><Dot ok={health.gemini} /> AI Agent</span>
    </div>
  );
}