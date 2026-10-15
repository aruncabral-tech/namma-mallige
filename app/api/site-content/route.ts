import {sponsorSchema,sponsorDefaults,sponsorForDisplay} from '@/lib/sponsorship';
import {siteSettings} from '@/lib/site-settings';
import {accountJson,accountError} from '@/lib/account-auth';
export async function GET(){try{const s=await siteSettings();return accountJson({headline:s.headline,announcement:s.announcement,sponsor:sponsorForDisplay(sponsorSchema.safeParse(s.sponsor).success?sponsorSchema.parse(s.sponsor):sponsorDefaults),serverNow:Date.now()});}catch(e){return accountError(e);}}
