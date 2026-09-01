import { useEffect, useState, useRef } from 'react';
import { getHealth } from '../api/payments';

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const popoverRef = useRef(null);

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

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowDetails(false);
      }
    }
    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetails]);

  if (!health) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-2" />
        <span>Checking systems...</span>
      </div>
    );
  }

  const allOperational = health.backend && health.db && health.gemini;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition py-1 px-2 rounded-md hover:bg-surface-2"
      >
        <span className={`w-2 h-2 rounded-full ${allOperational ? 'bg-accent' : 'bg-warn'}`} />
        <span>{allOperational ? 'All systems operational' : 'System issue detected'}</span>
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface-2 border border-border rounded-xl p-3 shadow-xl z-50 text-xs space-y-2">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
            System Status
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text">Backend</span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${health.backend ? 'bg-accent' : 'bg-danger'}`} />
              <span className={health.backend ? 'text-accent' : 'text-danger'}>{health.backend ? 'Operational' : 'Down'}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text">Database</span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${health.db ? 'bg-accent' : 'bg-danger'}`} />
              <span className={health.db ? 'text-accent' : 'text-danger'}>{health.db ? 'Connected' : 'Error'}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text">AI Agent</span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${health.gemini ? 'bg-accent' : 'bg-danger'}`} />
              <span className={health.gemini ? 'text-accent' : 'text-danger'}>{health.gemini ? 'Ready' : 'Offline'}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}