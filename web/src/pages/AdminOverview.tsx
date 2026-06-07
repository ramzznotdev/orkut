import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { adminGetStats, adminListAlerts, adminResolveAlert, ApiResponse } from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminOverview({ onNavigate }: { onNavigate: (page: any) => void }) {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    const s = await adminGetStats();
    const a = await adminListAlerts();
    setLoading(false);
    if (s?.success) setStats((s as any).data);
    if (a?.success) setAlerts((a as any).data || []);
    if (!s?.success || !a?.success) {
      setMsg('Gagal memuat data admin. Pastikan email kamu ada di ADMIN_EMAILS.');
      toast.error('Gagal memuat data admin');
    }
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: string) {
    const r = await adminResolveAlert(id);
    if ((r as ApiResponse<any>)?.success) {
      setAlerts(prev => prev.filter(x => x.id !== id));
      toast.success('Alert resolved!');
    } else {
      toast.error('Gagal resolve alert');
    }
  }

  return (
    <AdminLayout
      title="Admin Console"
      subtitle="Monitoring & kontrol operator (hanya admin)."
      current="admin_overview"
      onNavigate={onNavigate}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Ringkasan global gateway.</div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {msg ? (
        <div className="mt-4 p-4 rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-900 text-sm">
          {msg}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Merchants" value={stats?.merchants_total ?? '—'} />
        <StatCard title="Invoices (7d)" value={stats?.invoices_7d ?? '—'} />
        <StatCard title="Paid (7d)" value={stats?.paid_7d ?? '—'} />
        <StatCard title="Success rate" value={stats?.success_rate_7d ? `${Math.round(stats.success_rate_7d * 100)}%` : '—'} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>
          <p className="text-sm text-gray-600 mt-1">Menu yang paling sering dipakai.</p>
          <div className="mt-4 flex flex-col gap-2">
            <QuickButton onClick={() => onNavigate('admin_verifications')}>Review verifikasi</QuickButton>
            <QuickButton onClick={() => onNavigate('admin_orderkuota')}>Atur kredensial OrderKuota</QuickButton>
            <QuickButton onClick={() => onNavigate('admin_exports')}>Export CSV</QuickButton>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" /> Alerts
          </h2>
          <p className="text-sm text-gray-600 mt-1">Alert operasional yang perlu dicek.</p>

          <div className="mt-4 space-y-3">
            {alerts?.length ? alerts.map(a => (
              <div key={a.id} className="p-3 rounded-lg border border-gray-200 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{a.title || a.type}</div>
                  <div className="text-xs text-gray-600 mt-1">{a.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{a.created_at}</div>
                </div>
                <button
                  onClick={() => resolve(a.id)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Resolve
                </button>
              </div>
            )) : (
              <div className="text-sm text-gray-600">Tidak ada alert.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function QuickButton({ children, onClick }: { children: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <div className="text-sm font-medium text-gray-900">{children}</div>
    </button>
  );
}
