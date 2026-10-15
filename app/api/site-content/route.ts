import {siteSettings} from '@/lib/site-settings';
import {accountJson,accountError} from '@/lib/account-auth';
export async function GET(){try{const s=await siteSettings();return accountJson({headline:s.headline,announcement:s.announcement,sponsor:s.sponsor});}catch(e){return accountError(e);}}
