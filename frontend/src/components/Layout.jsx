import { Link } from 'react-router-dom';
import ActivityFeed from './ActivityFeed';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-gray-900">
            RecoverAI
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="text-gray-600 hover:text-gray-900">Inbox</Link>
            <Link to="/experiments" className="text-gray-600 hover:text-gray-900">Experiment Results</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">
        <ActivityFeed />
        {children}
      </main>
    </div>
  );
}