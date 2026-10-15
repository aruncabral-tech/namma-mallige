import type { Metadata } from "next";
import { CustomerBillPage } from "@/components/customer-bill-page";
export const metadata: Metadata = {
  title: "Your weekly bill | Namma Mallige",
  description: "View the flower bill shared with you and request a correction.",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  referrer: "no-referrer",
};
export default function Page() { return <CustomerBillPage />; }
