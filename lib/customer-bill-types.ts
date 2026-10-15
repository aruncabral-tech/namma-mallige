export const CORRECTION_CATEGORIES = ["Flower quantity", "Flower price", "Payment / pending", "Other"] as const;
export type Correction = {
  id: string; billVersion: number; dayIndex: number | null;
  category: string; message: string; status: "pending" | "resolved" | "declined";
  reply: string; createdAt: string; reviewedAt: string | null;
};
export type OwnerCorrection = Correction & { billId: string; customer: string; billNo: string; weekStart: string; currentVersion: number };
export type CustomerBill = {
  version: number; customer: string; billNo: string; weekStart: string;
  business: { name: string; location: string }; updatedAt: string; expiresAt: number;
  days: { date: string; total: number; flowers: { code: "M" | "J"; buds: number; rate: number; amount: number }[] }[];
  balance: { flowerTotal: number; openingBalance: number; amountPaid: number; totalPayable: number; pending: number };
  payments: { date: string; amount: number; method: string }[];
  requests: Correction[];
};
export type AccessState = { active: boolean; expiresAt: number | null; reason: "none" | "revoked" | "expired" | "recipient_changed" | "active" };
