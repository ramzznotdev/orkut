import { useState } from 'react';
import { Search, Filter, Download, Eye } from 'lucide-react';
import { Transaction } from '../types';

const mockTransactions: Transaction[] = Array.from({ length: 20 }, (_, i) => ({
  id: `TRX${String(i + 1).padStart(3, '0')}`,
  amount: Math.floor(Math.random() * 1000000) + 50000,
  status: ['success', 'pending', 'failed', 'expired'][Math.floor(Math.random() * 4)] as Transaction['status'],
  method: ['BCA Virtual Account', 'BNI Virtual Account', 'GoPay', 'OVO', 'DANA', 'QRIS', 'ShopeePay'][
    Math.floor(Math.random() * 7)
  ],
  reference: `REF${Math.random().toString(36).substring(7).toUpperCase()}`,
  merchantRef: `ORDER-${String(i + 1).padStart(3, '0')}`,
  customerName: ['Ahmad Rizki', 'Siti Nurhaliza', 'Budi Santoso', 'Rina Wati', 'Joko Widodo'][
    Math.floor(Math.random() * 5)
  ],
  customerEmail: `customer${i + 1}@example.com`,
  createdAt: `2024-01-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')} ${String(
    Math.floor(Math.random() * 24)
  ).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
  paidAt:
    Math.random() > 0.3
      ? `2024-01-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')} ${String(
          Math.floor(Math.random() * 24)
        ).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`
      : undefined,
}));

export const Transactions = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const filteredTransactions = mockTransactions.filter((transaction) => {
    const matchesSearch =
      transaction.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.merchantRef.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">Manage and monitor all your transactions</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ID, customer name, or order reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="expired">Expired</option>
                </select>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>More Filters</span>
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
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
                            : transaction.status === 'expired'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.createdAt}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedTransaction(transaction)}
                        className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Transaction ID</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Merchant Reference</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.merchantRef}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Customer Name</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Customer Email</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.customerEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Method</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.method}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reference Number</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="font-medium text-gray-900">
                      Rp {selectedTransaction.amount.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        selectedTransaction.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : selectedTransaction.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {selectedTransaction.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created At</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.createdAt}</p>
                  </div>
                  {selectedTransaction.paidAt && (
                    <div>
                      <p className="text-sm text-gray-500">Paid At</p>
                      <p className="font-medium text-gray-900">{selectedTransaction.paidAt}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
