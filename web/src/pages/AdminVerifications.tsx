import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import {
  adminApproveVerification,
  adminListVerificationQueue,
  adminNeedMoreInfoVerification,
  adminRejectVerification,
  adminVerificationScreenshotUrl,
  VerificationQueueItem,
} from '../lib/api';
import { Check, X, MessageSquareWarning, ExternalLink, Image as ImageIcon, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminVerifications({ onNavigate }: { onNavigate: (page: any) => void }) {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<VerificationQueueItem | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    setLoading(true);
    const r = await adminListVerificationQueue();
    setLoading(false);
    if (r?.success) setItems((r as any).data || []);
    else toast.error('Gagal memuat queue verifikasi');
  }

  useEffect(() => { load(); }, []);

  const pending = useMemo(() => items.filter(x => x.status === 'submitted' || x.status === 'need_more_info'), [items]);

  async function approve(id: string) {
    const r = await adminApproveVerification(id);
    if (r?.success) {
      setItems(prev => prev.filter(x => x.id !== id));
      setSelected(null);
      toast.success('Verifikasi merchant di-approve');
    } else {
      toast.error('Gagal approve verifikasi');
    }
  }
  async function reject(id: string) {
    const r = await adminRejectVerification(id, reason || 'Tidak memenuhi syarat');
    if (r?.success) {
      setItems(prev => prev.filter(x => x.id !== id));
      setSelected(null);
      setReason('');
      toast.success('Verifikasi merchant di-reject');
    } else {
      toast.error('Gagal reject verifikasi');
    }
  }
  async function needMore(id: string) {
    const r = await adminNeedMoreInfoVerification(id, note || 'Mohon lengkapi informasi');
    if (r?.success) {
      setItems(prev => prev.map(x => x.id === id ? ({ ...x, status: 'need_more_info' } as any) : x));
      setSelected(null);
      setNote('');
      toast.success('Request info tambahan dikirim ke merchant');
    } else {
      toast.error('Gagal request info tambahan');
    }
  }

  return (
    <AdminLayout
      title="Review Verifikasi"
      subtitle="Approve / reject pengajuan verifikasi merchant (1 kali submit)."
      current="admin_verifications"
      onNavigate={onNavigate}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          Antrian: <span className="font-semibold text-gray-900">{pending.length}</span>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="font-semibold text-gray-900">Queue</div>
            <div className="text-xs text-gray-500">Klik item untuk detail</div>
          </div>

          <div className="divide-y divide-gray-100">
            {pending.length ? pending.map(it => (
              <button
                key={it.id}
                onClick={() => setSelected(it)}
                className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors ${
                  selected?.id === it.id ? 'bg-blue-50' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{it.store_name || '(tanpa nama toko)'}</div>
                    <div className="text-xs text-gray-600 mt-1">{it.store_link}</div>
                    <div className="text-xs text-gray-500 mt-1">WA: {it.whatsapp || '-'}</div>
                  </div>
                  <div className="text-xs rounded-full px-2 py-1 border border-gray-200 text-gray-700">
                    {it.status}
                  </div>
                </div>
              </button>
            )) : (
              <div className="p-6 text-sm text-gray-600">Tidak ada pengajuan.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="font-semibold text-gray-900">Detail</div>
          {selected ? (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-gray-500">Store</div>
                <div className="text-sm font-medium text-gray-900">{selected.store_name || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Link</div>
                <a
                  className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"
                  href={selected.store_link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka link <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div>
                <div className="text-xs text-gray-500">WhatsApp</div>
                <div className="text-sm text-gray-900">{selected.whatsapp || '-'}</div>
              </div>

              <div className="pt-2">
                <div className="text-xs text-gray-500">Screenshot</div>
                {selected.screenshot_path ? (
                  <a
                    className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                    href={adminVerificationScreenshotUrl(selected.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ImageIcon className="h-4 w-4" /> Lihat
                  </a>
                ) : (
                  <div className="text-sm text-gray-600 mt-1">Tidak ada.</div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => approve(selected.id)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white hover:bg-green-700"
                >
                  <Check className="h-4 w-4" /> Approve
                </button>

                <div className="mt-3">
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Alasan reject (opsional)"
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <button
                    onClick={() => reject(selected.id)}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>

                <div className="mt-3">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Need more info (catatan ke merchant)"
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <button
                    onClick={() => needMore(selected.id)}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <MessageSquareWarning className="h-4 w-4" /> Need more info
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-600">Pilih item di queue.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
