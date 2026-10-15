import {isLegacyOwner} from '@/lib/legacy-owner';
import {chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
import {OwnerDashboard} from '@/components/owner-dashboard';
export default async function Page(){if(!await isLegacyOwner())return <main className="subscription-shell"><h1>Website owner sign-in</h1><p>Use the ChatGPT account registered as this website's owner.</p><a className="upi-link" href={chatGPTSignInPath('/owner')}>Sign in with ChatGPT</a><p><a href={chatGPTSignOutPath('/owner')}>Switch ChatGPT account</a></p><a href="/">Back to website</a></main>;return <OwnerDashboard/>;}
