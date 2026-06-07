export interface Transaction {
  id: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'expired';
  method: string;
  reference: string;
  merchantRef: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentChannel {
  code: string;
  name: string;
  type: 'virtual_account' | 'ewallet' | 'retail' | 'qris' | 'credit_card';
  icon: string;
  fee: number;
  active: boolean;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTransactions: number;
  successRate: number;
  pendingTransactions: number;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  type: 'public' | 'private';
  createdAt: string;
  lastUsed?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  businessName: string;
  balance: number;
}
