import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { adminGetOrderkuotaSettings, adminQrisTest, adminUpdateOrderkuotaSettings } from '../lib/api';
import { Save, TestTube2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminOrderKuota({ onNavigate }: { onNavigate: (page: any) => void }) {
  const [form, setForm] = useState<any>({
    username: '',
    password: '',
    pin: '',
    idOrkut: '',
    qris_static: '',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [testAmount, setTestAmount] = useState(1000);
  const [testRes, setTestRes] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  async function load() {
    setMsg(null);
    const r = await adminGetOrderkuotaSettings();
    if (r?.success) setForm((r as any).data || form);
    else toast.error('Gagal memuat data OrderKuota');
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await adminUpdateOrderkuotaSettings(form);
    setSaving(false);
    if (r?.success) {
      setMsg('Tersimpan.');
      toast.success('Kredensial OrderKuota tersimpan');
    } else {
      setMsg((r as any)?.error?.message || 'Gagal menyimpan.');
      toast.error('Gagal menyimpan kredensial');
    }
  }

  async function runTest() {
    setTesting(true);
    setTestRes(null);
    const r = await adminQrisTest({ qris_static: form.qris_static, amount: Number(testAmount) || 0 });
    setTesting(false);
    setTestRes(r);
    if (r?.success) {
      toast.success('Tes QRIS berhasil');
    } else {
      toast.error('Tes QRIS gagal');
    }
  }

  return (
    <AdminLayout
      title="OrderKuota Settings"
      subtitle="Kredensial & QRIS static sumber (disimpan sebagai secret di DB)."
      current="admin_orderkuota"
      onNavigate={onNavigate}
    >
      {msg ? (
        <div className="mb-4 p-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800">{msg}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">Kredensial</h2>
          <p className="text-sm text-gray-600 mt-1">Dipakai server untuk akses OrderKuota (akun pusat).</p>

          <div className="mt-4 space-y-3">
            <Field label="Username" value={form.username} onChange={v => setForm({ ...form, username: v })} />
            <Field label="Password" value={form.password} onChange={v => setForm({ ...form, password: v })} secret />
            <Field label="PIN" value={form.pin} onChange={v => setForm({ ...form, pin: v })} secret />
            <Field label="ID Orkut" value={form.idOrkut} onChange={v => setForm({ ...form, idOrkut: v })} />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">QRIS static</h2>
          <p className="text-sm text-gray-600 mt-1">Masukkan *string QRIS* (bukan gambar). Dipakai converter jadi QRIS dinamis.</p>

          <div className="mt-4">
            <label className="text-xs text-gray-500">QRIS string</label>
            <textarea
              value={form.qris_static}
              onChange={e => setForm({ ...form, qris_static: e.target.value })}
              rows={6}
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000201010211..."
            />
          </div>

          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Test amount</label>
              <input
                type="number"
                value={testAmount}
                onChange={e => setTestAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={runTest}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-60"
            >
              <TestTube2 className="h-4 w-4" />
              {testing ? 'Testing…' : 'Test'}
            </button>
          </div>

          {testRes ? (
            <div className="mt-4 rounded-xl border border-gray-200 p-4 bg-gray-50">
              <div className="text-xs text-gray-600">Result</div>
              <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(testRes, null, 2)}</pre>
              {testRes?.success && testRes?.data?.qr_string ? (
                <div className="mt-3 text-sm">
                  <div className="text-gray-700 font-medium">QR string (dinamis)</div>
                  <div className="mt-1 break-all text-xs text-gray-800">{testRes.data.qr_string}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type={secret ? 'password' : 'text'}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
