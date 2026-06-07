import { useState } from 'react';
import { Wallet, Building2, QrCode, Store, CreditCard as CreditCardIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import { PaymentChannel } from '../types';

const mockChannels: PaymentChannel[] = [
  {
    code: 'bca_va',
    name: 'BCA Virtual Account',
    type: 'virtual_account',
    icon: 'BCA',
    fee: 4000,
    active: true,
  },
  {
    code: 'bni_va',
    name: 'BNI Virtual Account',
    type: 'virtual_account',
    icon: 'BNI',
    fee: 4000,
    active: true,
  },
  {
    code: 'bri_va',
    name: 'BRI Virtual Account',
    type: 'virtual_account',
    icon: 'BRI',
    fee: 4000,
    active: true,
  },
  {
    code: 'mandiri_va',
    name: 'Mandiri Virtual Account',
    type: 'virtual_account',
    icon: 'Mandiri',
    fee: 4000,
    active: false,
  },
  {
    code: 'gopay',
    name: 'GoPay',
    type: 'ewallet',
    icon: 'GoPay',
    fee: 2.5,
    active: true,
  },
  {
    code: 'ovo',
    name: 'OVO',
    type: 'ewallet',
    icon: 'OVO',
    fee: 2.5,
    active: true,
  },
  {
    code: 'dana',
    name: 'DANA',
    type: 'ewallet',
    icon: 'DANA',
    fee: 2.5,
    active: true,
  },
  {
    code: 'shopeepay',
    name: 'ShopeePay',
    type: 'ewallet',
    icon: 'ShopeePay',
    fee: 2.5,
    active: false,
  },
  {
    code: 'qris',
    name: 'QRIS',
    type: 'qris',
    icon: 'QRIS',
    fee: 0.7,
    active: true,
  },
  {
    code: 'alfamart',
    name: 'Alfamart',
    type: 'retail',
    icon: 'Alfamart',
    fee: 2500,
    active: true,
  },
  {
    code: 'indomaret',
    name: 'Indomaret',
    type: 'retail',
    icon: 'Indomaret',
    fee: 2500,
    active: false,
  },
  {
    code: 'credit_card',
    name: 'Credit Card',
    type: 'credit_card',
    icon: 'Card',
    fee: 2.9,
    active: false,
  },
];

const getIconForType = (type: PaymentChannel['type']) => {
  switch (type) {
    case 'virtual_account':
      return <Building2 className="h-6 w-6" />;
    case 'ewallet':
      return <Wallet className="h-6 w-6" />;
    case 'qris':
      return <QrCode className="h-6 w-6" />;
    case 'retail':
      return <Store className="h-6 w-6" />;
    case 'credit_card':
      return <CreditCardIcon className="h-6 w-6" />;
  }
};

const getColorForType = (type: PaymentChannel['type']) => {
  switch (type) {
    case 'virtual_account':
      return 'bg-blue-100 text-blue-600';
    case 'ewallet':
      return 'bg-green-100 text-green-600';
    case 'qris':
      return 'bg-purple-100 text-purple-600';
    case 'retail':
      return 'bg-orange-100 text-orange-600';
    case 'credit_card':
      return 'bg-red-100 text-red-600';
  }
};

export const Channels = () => {
  const [channels, setChannels] = useState(mockChannels);
  const [filter, setFilter] = useState<'all' | PaymentChannel['type']>('all');

  const toggleChannel = (code: string) => {
    setChannels(
      channels.map((channel) =>
        channel.code === code ? { ...channel, active: !channel.active } : channel
      )
    );
  };

  const filteredChannels = channels.filter((channel) => filter === 'all' || channel.type === filter);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Channels</h1>
          <p className="text-gray-600 mt-1">Manage your available payment methods</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Channels
            </button>
            <button
              onClick={() => setFilter('virtual_account')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'virtual_account'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Virtual Account
            </button>
            <button
              onClick={() => setFilter('ewallet')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'ewallet'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              E-Wallet
            </button>
            <button
              onClick={() => setFilter('qris')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'qris'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              QRIS
            </button>
            <button
              onClick={() => setFilter('retail')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'retail'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Retail
            </button>
            <button
              onClick={() => setFilter('credit_card')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'credit_card'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Credit Card
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChannels.map((channel) => (
            <div
              key={channel.code}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                channel.active ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${getColorForType(channel.type)}`}>
                    {getIconForType(channel.type)}
                  </div>
                  <button
                    onClick={() => toggleChannel(channel.code)}
                    className={`p-2 rounded-lg transition-colors ${
                      channel.active
                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {channel.active ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{channel.name}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Fee:</span>
                  <span className="font-medium text-gray-900">
                    {typeof channel.fee === 'number' && channel.fee < 100
                      ? `${channel.fee}%`
                      : `Rp ${channel.fee.toLocaleString('id-ID')}`}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      channel.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {channel.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Need More Payment Methods?</h3>
          <p className="text-blue-700 mb-4">
            Contact our sales team to enable additional payment channels for your business.
          </p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
};
