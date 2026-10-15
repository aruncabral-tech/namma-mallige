import { isLegacyOwner } from "@/lib/legacy-owner";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { PaymentAdmin } from "@/components/payment-admin";
export default async function Page(){if(!await isLegacyOwner())return <main className="subscription-shell"><h1>Owner payment approvals</h1><p>Sign in with the site owner's ChatGPT account to review subscription payments.</p><a className="upi-link" href={chatGPTSignInPath("/subscription-admin")}>Sign in with ChatGPT</a><p><a href="/">Back to Namma Mallige</a></p></main>;return <PaymentAdmin/>;}
