import { CreditCard, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export const Navbar = ({ onNavigate, currentPage }: NavbarProps) => {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center space-x-2"
            >
              <div className="bg-blue-600 p-2 rounded-lg">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PayGateway</span>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="hidden md:flex items-center space-x-1">
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => onNavigate('transactions')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === 'transactions' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Transactions
                  </button>
                  <button
                    onClick={() => onNavigate('channels')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === 'channels' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Channels
                  </button>
                  <button
                    onClick={() => onNavigate('docs')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === 'docs' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    API Docs
                  </button>
                  
{isAdmin && (
  <button
    onClick={() => onNavigate('admin_overview')}
    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isAdminPage ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    Admin
  </button>
)}

        <button
                    onClick={() => onNavigate('settings')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Settings
                  </button>
                </div>
                <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.businessName}</p>
                  </div>
                  <button className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                    <User className="h-5 w-5" />
                  </button>
                  <button
                    onClick={logout}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('login')}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Login
                </button>
                <button
                  onClick={() => onNavigate('register')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
