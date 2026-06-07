import { TrendingUp, TrendingDown, DollarSign, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';

const mockTransactions: Transaction[] = [
  {
    id: 'TRX001',
    amount: 250000,
    status: 'success',
    method: 'BCA Virtual Account',
    reference: 'VA123456789',
    merchantRef: 'ORDER-001',
    customerName: 'Ahmad Rizki',
    customerEmail: 'ahmad@example.com',
    createdAt: '2024-01-20 14:30:00',
    paidAt: '2024-01-20 14:35:00',
  },
  {
    id: 'TRX002',
    amount: 500000,
    status: 'success',
    method: 'GoPay',
    reference: 'GP987654321',
    merchantRef: 'ORDER-002',
    customerName: 'Siti Nurhaliza',
    customerEmail: 'siti@example.com',
    createdAt: '2024-01-20 15:00:00',
    paidAt: '2024-01-20 15:02:00',
  },
  {
    id: 'TRX003',
    amount: 150000,
    status: 'pending',
    method: 'BNI Virtual Account',
    reference: 'VA456789123',
    merchantRef: 'ORDER-003',
    customerName: 'Budi Santoso',
    customerEmail: 'budi@example.com',
    createdAt: '2024-01-20 16:00:00',
  },
  {
    id: 'TRX004',
    amount: 750000,
    status: 'success',
    method: 'QRIS',
    reference: 'QR789456123',
    merchantRef: 'ORDER-004',
    customerName: 'Rina Wati',
    customerEmail: 'rina@example.com',
    createdAt: '2024-01-20 16:30:00',
    paidAt: '2024-01-20 16:31:00',
  },
  {
    id: 'TRX005',
    amount: 300000,
    status: 'failed',
    method: 'OVO',
    reference: 'OV321654987',
    merchantRef: 'ORDER-005',
    customerName: 'Joko Widodo',
    customerEmail: 'joko@example.com',
    createdAt: '2024-01-20 17:00:00',
  },
];

export const Dashboard = () => {
  const { user } = useAuth();

  const stats = {
    totalRevenue: 15750000,
    totalTransactions: 847,
    successRate: 94.2,
    pendingTransactions: 23,
  };

  const revenueGrowth = 12.5;
  const transactionGrowth = 8.3;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <span className="flex items-center text-sm font-medium text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                {revenueGrowth}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              Rp {stats.totalRevenue.toLocaleString('id-ID')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Total Revenue</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
              <span className="flex items-center text-sm font-medium text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                {transactionGrowth}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</h3>
            <p className="text-sm text-gray-600 mt-1">Total Transactions</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
              <span className="flex items-center text-sm font-medium text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                2.1%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.successRate}%</h3>
            <p className="text-sm text-gray-600 mt-1">Success Rate</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <span className="flex items-center text-sm font-medium text-red-600">
                <TrendingDown className="h-4 w-4 mr-1" />
                3.2%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.pendingTransactions}</h3>
            <p className="text-sm text-gray-600 mt-1">Pending Transactions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">This Month</span>
                  <span className="font-semibold text-gray-900">Rp 8,500,000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Last Month</span>
                  <span className="font-semibold text-gray-900">Rp 7,250,000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gray-400 h-2 rounded-full" style={{ width: '73%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Virtual Account</span>
                <span className="text-sm font-semibold text-gray-900">45%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">E-Wallet</span>
                <span className="text-sm font-semibold text-gray-900">35%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '35%' }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">QRIS</span>
                <span className="text-sm font-semibold text-gray-900">20%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-600 h-2 rounded-full" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{transaction.id}</div>
                      <div className="text-xs text-gray-500">{transaction.merchantRef}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transaction.customerName}</div>
                      <div className="text-xs text-gray-500">{transaction.customerEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.method}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Rp {transaction.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          transaction.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : transaction.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
