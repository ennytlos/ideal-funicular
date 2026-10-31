// src/constants/payment.ts
// Shared financial validation constants across Web and Mobile payment routes

export const TIP_LIMITS = {
  NGN: { min: 1000, max: 500000 },
  USD: { min: 5, max: 5000 },
} as const;

export type SupportedTipCurrency = keyof typeof TIP_LIMITS;

export function getTipLimits(currency: string = 'NGN'): { min: number; max: number } {
  const curr = currency.toUpperCase() as SupportedTipCurrency;
  return TIP_LIMITS[curr] || TIP_LIMITS.NGN;
}
