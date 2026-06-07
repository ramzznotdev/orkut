export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PendingTransaction {
  id: string;
  username: string;
  base_amount: number;
  unique_suffix: number;
  final_amount: number;
  qris_string: string;
  created_at: number;
  expires_at: number;
}

export interface PaidTransaction {
  id: string;
  username: string;
  final_amount: number;
  paid_at: number;
  expires_at: number;
}

export interface GenerateQrisRequest {
  username: string;
  token: string;
  amount: number;
}

export interface CheckPaymentRequest {
  username: string;
  token: string;
  transaction_id: string;
}

export interface AuthOtpRequest {
  username: string;
  password: string;
}

export interface AuthTokenRequest {
  username: string;
  otp: string;
}

export interface BalanceRequest {
  username: string;
  token: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'not_found';
