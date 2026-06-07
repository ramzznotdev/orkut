import { AdminLayout } from '../components/AdminLayout';
import { adminExportInvoicesCsvUrl, adminExportWebhooksCsvUrl } from '../lib/api';
import { Download } from 'lucide-react';

export default function AdminExports({ onNavigate }: { onNavigate: (page: any) => void }) {
  return (
    <AdminLayout
      title="Exports"
      subtitle="Download CSV untuk rekapan (admin)."
      current="admin_exports"
      onNavigate={onNavigate}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title="Invoices CSV"
          desc="Rekap invoice (id, merchant, amount, status, timestamps)."
          href={adminExportInvoicesCsvUrl()}
        />
        <Card
          title="Webhook deliveries CSV"
          desc="Rekap pengiriman webhook (endpoint, status code, retry, dll)."
          href={adminExportWebhooksCsvUrl()}
        />
      </div>

      <div className="mt-6 text-sm text-gray-600">
        Catatan: link export menggunakan sesi admin. Pastikan sudah login sebagai admin.
      </div>
    </AdminLayout>
  );
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} className="block bg-white border border-gray-200 rounded-xl p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-900">{title}</div>
        <Download className="h-5 w-5 text-gray-500" />
      </div>
      <p className="text-sm text-gray-600 mt-2">{desc}</p>
      <div className="mt-4 text-sm text-blue-700 font-medium">Download</div>
    </a>
  );
}
