import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PaymentsListPage from './pages/PaymentsListPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import ExperimentResultsPage from './pages/ExperimentResultsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PaymentsListPage />} />
          <Route path="/payments/:id" element={<PaymentDetailPage />} />
          <Route path="/experiments" element={<ExperimentResultsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}