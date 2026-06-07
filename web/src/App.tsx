import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Channels } from './pages/Channels';
import { ApiDocs } from './pages/ApiDocs';
import { Settings } from './pages/Settings';
import AdminOverview from './pages/AdminOverview';
import AdminVerifications from './pages/AdminVerifications';
import AdminOrderKuota from './pages/AdminOrderKuota';
import AdminExports from './pages/AdminExports';
import { Toaster } from 'react-hot-toast';

type Page = 'landing' | 'login' | 'register' | 'dashboard' | 'transactions' | 'channels' | 'docs' | 'settings' | 'admin_overview' | 'admin_verifications' | 'admin_orderkuota' | 'admin_exports';

function AppContent() {
  const { user } = useAuth();
  const authenticated = !!user;
  const [currentPage, setCurrentPage] = useState<Page>(authenticated ? 'dashboard' : 'landing');

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onNavigate={handleNavigate} currentPage={currentPage} />
      <Toaster position="top-right" />
      {currentPage === 'landing' && <Landing onNavigate={handleNavigate} />}
      {currentPage === 'login' && <Login onNavigate={handleNavigate} />}
      {currentPage === 'register' && <Register onNavigate={handleNavigate} />}
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'transactions' && <Transactions />}
      {currentPage === 'channels' && <Channels />}
      {currentPage === 'docs' && <ApiDocs />}
      {currentPage === 'settings' && <Settings />}

      {currentPage === 'admin_overview' && <AdminOverview onNavigate={handleNavigate} />}
      {currentPage === 'admin_verifications' && <AdminVerifications onNavigate={handleNavigate} />}
      {currentPage === 'admin_orderkuota' && <AdminOrderKuota onNavigate={handleNavigate} />}
      {currentPage === 'admin_exports' && <AdminExports onNavigate={handleNavigate} />}
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
