import { Link, useLocation } from 'react-router-dom';
import ActivityFeed from './ActivityFeed';
import SystemHealth from './SystemHealth';

export default function Layout({ children }) {
  const location = useLocation();

  const isInbox = location.pathname === '/' || location.pathname.startsWith('/payments');
  const isExperiments = location.pathname.startsWith('/experiments');

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <header className="border-b border-border bg-bg/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-base font-bold text-text tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
              <span>RecoverAI</span>
            </Link>

            <nav className="flex items-center gap-6 text-xs font-medium">
              <Link
                to="/"
                className={`transition ${isInbox ? 'text-text font-semibold' : 'text-muted hover:text-text'}`}
              >
                Inbox
              </Link>
              <Link
                to="/experiments"
                className={`transition ${isExperiments ? 'text-text font-semibold' : 'text-muted hover:text-text'}`}
              >
                Experiments
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <SystemHealth />
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-6 flex-1">
        <ActivityFeed />
        {children}
      </main>
    </div>
  );
}