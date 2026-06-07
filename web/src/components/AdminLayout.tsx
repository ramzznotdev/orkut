import { ReactNode } from 'react';
import { Shield, Settings, ClipboardList, BarChart3, Download } from 'lucide-react';

type AdminPage = 'admin_overview' | 'admin_verifications' | 'admin_orderkuota' | 'admin_exports';

export function AdminLayout({
  title,
  subtitle,
  current,
  onNavigate,
  children,
}: {
  title: string;
  subtitle?: string;
  current: AdminPage;
  onNavigate: (page: AdminPage) => void;
  children: ReactNode;
}) {
  const tabs: Array<{ key: AdminPage; label: string; icon: any }> = [
    { key: 'admin_overview', label: 'Overview', icon: BarChart3 },
    { key: 'admin_verifications', label: 'Verifikasi', icon: ClipboardList },
    { key: 'admin_orderkuota', label: 'OrderKuota', icon: Settings },
    { key: 'admin_exports', label: 'Exports', icon: Download },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
          </div>
          {subtitle ? <p className="text-gray-600 mt-2">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-2 flex flex-wrap gap-2">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = current === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onNavigate(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
