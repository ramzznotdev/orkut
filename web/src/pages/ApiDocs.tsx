import { useState } from 'react';
import { Copy, CheckCircle } from 'lucide-react';

const codeExamples = {
  createTransaction: `curl -X POST https://api.paygateway.com/v1/transactions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant_ref": "ORDER-123",
    "amount": 100000,
    "method": "bca_va",
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "callback_url": "https://yoursite.com/webhook"
  }'`,

  getTransaction: `curl -X GET https://api.paygateway.com/v1/transactions/{transaction_id} \\
  -H "Authorization: Bearer YOUR_API_KEY"`,

  webhook: `{
  "event": "payment.success",
  "transaction_id": "TRX001",
  "merchant_ref": "ORDER-123",
  "amount": 100000,
  "status": "success",
  "paid_at": "2024-01-20T14:35:00Z",
  "signature": "abc123..."
}`,
};

interface CodeBlockProps {
  code: string;
  title: string;
}

const CodeBlock = ({ code, title }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm text-gray-300">{title}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
        >
          {copied ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-gray-300">{code}</code>
      </pre>
    </div>
  );
};

export const ApiDocs = () => {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', name: 'Getting Started' },
    { id: 'authentication', name: 'Authentication' },
    { id: 'create-transaction', name: 'Create Transaction' },
    { id: 'get-transaction', name: 'Get Transaction' },
    { id: 'webhooks', name: 'Webhooks' },
    { id: 'errors', name: 'Error Handling' },
    { id: 'onboarding', name: 'Onboarding Merchant' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">API Documentation</h1>
          <p className="text-gray-600 mt-1">Complete guide to integrate PayGateway API</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-24">
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {section.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
              {activeSection === 'getting-started' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Getting Started</h2>
                  <div className="prose max-w-none">
                    <p className="text-gray-600 mb-4">
                      Welcome to PayGateway API documentation. Our REST API allows you to accept payments
                      from various payment methods in Indonesia.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Base URL</h3>
                      <code className="text-sm text-blue-700">https://api.paygateway.com/v1</code>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Start</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-600">
                      <li>Get your API key from the Settings page</li>
                      <li>Make a test transaction using the sandbox environment</li>
                      <li>Implement webhook handler for payment notifications</li>
                      <li>Go live with production API keys</li>
                    </ol>
                  </div>
                </div>
              )}

              {activeSection === 'authentication' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
                  <p className="text-gray-600 mb-4">
                    All API requests require authentication using Bearer token. Include your API key in the
                    Authorization header.
                  </p>
                  <CodeBlock
                    title="Authorization Header"
                    code='Authorization: Bearer YOUR_API_KEY'
                  />
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Keep your API keys secure. Never expose them in client-side code or public repositories.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'create-transaction' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Transaction</h2>
                  <p className="text-gray-600 mb-4">
                    Create a new payment transaction. The API will return payment instructions for your customer.
                  </p>
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded">
                      POST
                    </span>
                    <code className="ml-2 text-gray-700">/v1/transactions</code>
                  </div>
                  <CodeBlock title="Request Example" code={codeExamples.createTransaction} />
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Parameters</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Parameter</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-900">merchant_ref</td>
                            <td className="px-4 py-2 text-sm text-gray-600">string</td>
                            <td className="px-4 py-2 text-sm text-gray-600">Your order reference ID</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-900">amount</td>
                            <td className="px-4 py-2 text-sm text-gray-600">integer</td>
                            <td className="px-4 py-2 text-sm text-gray-600">Transaction amount in IDR</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-900">method</td>
                            <td className="px-4 py-2 text-sm text-gray-600">string</td>
                            <td className="px-4 py-2 text-sm text-gray-600">Payment method code</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-900">customer_name</td>
                            <td className="px-4 py-2 text-sm text-gray-600">string</td>
                            <td className="px-4 py-2 text-sm text-gray-600">Customer full name</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-900">customer_email</td>
                            <td className="px-4 py-2 text-sm text-gray-600">string</td>
                            <td className="px-4 py-2 text-sm text-gray-600">Customer email address</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'get-transaction' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Get Transaction</h2>
                  <p className="text-gray-600 mb-4">
                    Retrieve transaction details and payment status.
                  </p>
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded">
                      GET
                    </span>
                    <code className="ml-2 text-gray-700">/v1/transactions/:id</code>
                  </div>
                  <CodeBlock title="Request Example" code={codeExamples.getTransaction} />
                </div>
              )}

              {activeSection === 'webhooks' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Webhooks</h2>
                  <p className="text-gray-600 mb-4">
                    PayGateway sends webhook notifications when payment status changes. Configure your webhook URL
                    in the Settings page.
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Webhook Events</h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                    <li>payment.pending - Payment created and waiting for customer</li>
                    <li>payment.success - Payment successfully completed</li>
                    <li>payment.failed - Payment failed or cancelled</li>
                    <li>payment.expired - Payment expired without completion</li>
                  </ul>
                  <CodeBlock title="Webhook Payload Example" code={codeExamples.webhook} />
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Always verify the webhook signature to ensure the request is from PayGateway.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'errors' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
                  <p className="text-gray-600 mb-4">
                    PayGateway API uses standard HTTP response codes to indicate success or failure.
                  </p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Code</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="px-4 py-2 text-sm font-medium text-green-600">200</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Request successful</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm font-medium text-red-600">400</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Bad request - Invalid parameters</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm font-medium text-red-600">401</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Unauthorized - Invalid API key</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm font-medium text-red-600">404</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Not found - Resource doesn't exist</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm font-medium text-red-600">500</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Server error - Something went wrong</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'onboarding' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Onboarding Merchant</h2>
                  <p className="text-gray-600 mb-4">
                    Ikuti langkah berikut untuk mendaftar dan mengaktifkan akun merchant.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-4">
                    <li>Merchant melakukan pendaftaran di halaman Register.</li>
                    <li>Isi data: nama, email, nama bisnis, password.</li>
                    <li>Status merchant akan <b>pending</b> sampai di-approve operator/admin.</li>
                    <li>Setelah di-approve, merchant bisa login, akses dashboard, API key, webhook, dsb.</li>
                  </ol>
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Untuk testing, gunakan sandbox API key dan endpoint. Untuk live, gunakan production key.
                    </p>
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    <b>Catatan:</b> Fitur admin/monitoring hanya untuk operator, tidak tersedia untuk user/merchant.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
