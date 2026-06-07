import { ArrowRight, Shield, Zap, Code, BarChart3, Lock, Globe } from 'lucide-react';

interface LandingProps {
  onNavigate: (page: string) => void;
}

export const Landing = ({ onNavigate }: LandingProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Accept Payments
            <span className="block text-blue-600">Seamlessly & Securely</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Complete payment gateway solution for your business. Support for Virtual Account, E-Wallet, QRIS, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onNavigate('register')}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>Start Now - Free</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => onNavigate('docs')}
              className="px-8 py-4 bg-white text-gray-900 border-2 border-gray-200 rounded-lg font-semibold hover:border-gray-300 transition-colors"
            >
              View Documentation
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="bg-blue-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <Zap className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Fast Integration</h3>
            <p className="text-gray-600">
              Get started in minutes with our simple REST API. Complete documentation and code examples available.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="bg-green-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <Shield className="h-7 w-7 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Secure & Reliable</h3>
            <p className="text-gray-600">
              Bank-grade security with PCI DSS compliance. Your transactions are always protected.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="bg-orange-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="h-7 w-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Real-time Analytics</h3>
            <p className="text-gray-600">
              Monitor your transactions with real-time dashboard and comprehensive reporting tools.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-white mb-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">Payment Channels</h2>
              <p className="text-blue-100 mb-6">
                Support all popular payment methods in Indonesia
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                  <p className="font-semibold">Virtual Account</p>
                  <p className="text-sm text-blue-100">BCA, BNI, BRI, Mandiri</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                  <p className="font-semibold">E-Wallet</p>
                  <p className="text-sm text-blue-100">GoPay, OVO, DANA, ShopeePay</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                  <p className="font-semibold">QRIS</p>
                  <p className="text-sm text-blue-100">Scan & Pay</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                  <p className="font-semibold">Retail</p>
                  <p className="text-sm text-blue-100">Alfamart, Indomaret</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl">
              <Code className="h-12 w-12 mb-4" />
              <h3 className="text-2xl font-bold mb-3">Developer Friendly</h3>
              <p className="text-blue-100 mb-4">
                Simple REST API with comprehensive documentation. Test in sandbox mode before going live.
              </p>
              <ul className="space-y-2 text-blue-100">
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                  <span>RESTful API Design</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                  <span>Webhook Notifications</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                  <span>Sandbox Environment</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="text-center">
            <Lock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">PCI DSS Certified</h3>
            <p className="text-gray-600">Industry standard security compliance</p>
          </div>
          <div className="text-center">
            <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">99.9% Uptime</h3>
            <p className="text-gray-600">Reliable infrastructure you can trust</p>
          </div>
          <div className="text-center">
            <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">24/7 Support</h3>
            <p className="text-gray-600">Always here to help your business grow</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses using PayGateway to accept payments online
          </p>
          <button
            onClick={() => onNavigate('register')}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
          >
            <span>Create Free Account</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
