import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { isLegacyOwner, legacyOwnerPhone } from "@/lib/legacy-owner";
import { billingDb } from "@/db/billing";
import { LEGACY_BOOK_ID, tokenHash } from "@/lib/account-auth";
import { OwnerReset } from "@/components/owner-reset";
export const dynamic = "force-dynamic";
export default async function OwnerResetPage() {
  const user = await getChatGPTUser();
  if (!user) return <main className="owner-reset-shell"><h1>Reset the original owner’s book</h1><p>Verify ownership using the same ChatGPT account that created Namma Mallige.</p><a className="reset-link" href={chatGPTSignInPath("/owner-reset")} target="_top">Verify with ChatGPT</a><a href="/">Back to login</a></main>;
  if (!await isLegacyOwner()) return <main className="owner-reset-shell"><h1>Different ChatGPT account</h1><p>This signed-in account is not the original app owner. No records have been changed.</p><a className="reset-link" href={chatGPTSignOutPath("/owner-reset")} target="_top">Sign out and use the original account</a><a href="/">Back to login</a></main>;
  const row = await billingDb().prepare("SELECT recovery_hash AS recoveryHash FROM owners WHERE id = ? AND phone = ?").bind(LEGACY_BOOK_ID,legacyOwnerPhone()).first() as {recoveryHash:string} | null;
  return <OwnerReset phone={legacyOwnerPhone()} challenge={row ? tokenHash("delete-book:" + row.recoveryHash) : null} />;
}
