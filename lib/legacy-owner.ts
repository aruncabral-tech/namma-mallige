import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export function legacyOwnerPhone(): string {
  const config = env as unknown as Record<string, string | undefined>;
  if (!config.LEGACY_OWNER_PHONE) throw new Error("Existing owner setup is not configured.");
  return config.LEGACY_OWNER_PHONE;
}
export async function isLegacyOwner() {
  const config = env as unknown as Record<string, string | undefined>;
  const user = await getChatGPTUser();
  return !!config.LEGACY_OWNER_EMAIL && !!user?.id && user.email.toLowerCase() === config.LEGACY_OWNER_EMAIL.toLowerCase();
}
