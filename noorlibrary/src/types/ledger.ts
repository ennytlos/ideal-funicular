// src/types/ledger.ts
// Shared Ledger and Audit types across Admin components and API handlers.

export interface AuditTransaction {
  id: string;
  type: 'donation' | 'book_purchase' | 'download_purchase' | 'series_purchase' | 'course_enrollment' | 'failed_grant';
  donorEmail: string;
  userId: string;
  amount: number; // Gross amount in primary currency units (e.g. NGN ₦)
  amountGross?: number;
  amountNet?: number;
  currency: string;
  reference: string;
  description: string;
  message?: string;
  createdAt: string;
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  channel: string;
}

export interface LedgerStats {
  totalDonationsRevenue: number;
  totalDonationsNet?: number;
  donationsCount: number;
  uniqueDonors: number;
  avgDonation: number;
  totalOverallRevenue: number;
  totalOverallNet?: number;
  totalTransactionsCount: number;
  successCount: number;
  failedCount: number;
  successRate: number;
}
