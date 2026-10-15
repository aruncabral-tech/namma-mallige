import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("installed app update notice protects unsaved work", async () => {
  const { UpdateNotice } = await vite.ssrLoadModule("/components/live-app-update.tsx");
  const blocked = renderToStaticMarkup(React.createElement(UpdateNotice, {blocked:true,onUpdate(){}}));
  assert.match(blocked,/ disabled=""/);
  assert.match(blocked,/Save your entries/);
  const ready = renderToStaticMarkup(React.createElement(UpdateNotice, {blocked:false,onUpdate(){}}));
  assert.doesNotMatch(ready,/ disabled=""/);
  assert.match(ready,/No reinstall needed/);
});

test("release checks are never cached", async () => {
  const { GET } = await vite.ssrLoadModule("/app/api/app-version/route.ts");
  const response = GET();
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(typeof (await response.json()).version,'string');
});

test("sponsor placement supports enquiries, booked ads and hiding", async () => {
 const {SponsorCard}=await vite.ssrLoadModule('/components/sponsor-space.tsx');
 const {sponsorDefaults,sponsorSchema}=await vite.ssrLoadModule('/lib/sponsorship.ts');
 const vacant=renderToStaticMarkup(React.createElement(SponsorCard,{sponsor:sponsorDefaults}));
 assert.match(vacant,/Advertisement · Space available/);
 assert.match(vacant,/wa.me\/918971891245/);
 assert.doesNotMatch(vacant,/<script|<iframe/);
 const booked=sponsorSchema.parse({...sponsorDefaults,title:'Local business',description:'A local offer',url:'https://example.com/offer'});
 const html=renderToStaticMarkup(React.createElement(SponsorCard,{sponsor:booked}));
 assert.match(html,/Sponsored/);assert.match(html,/rel="sponsored noopener noreferrer"/);
 assert.match(html,/https:\/\/example.com\/offer/);
 assert.equal(renderToStaticMarkup(React.createElement(SponsorCard,{sponsor:{...booked,enabled:false}})),'');
 for(const url of ['javascript:alert(1)','data:text/html,test','https://name:password@example.com']){
  assert.equal(sponsorSchema.safeParse({...booked,url}).success,false);
 }
 assert.equal(sponsorSchema.safeParse({...booked,title:''}).success,false);
});

test('sponsor dates use inclusive India days and preserve the enquiry slot',async()=>{
 const {sponsorDefaults,sponsorSchema,sponsorStatus,sponsorForDisplay}=await vite.ssrLoadModule('/lib/sponsorship.ts');
 const campaign=sponsorSchema.parse({...sponsorDefaults,title:'Test sponsor',startDate:'2026-10-15',endDate:'2026-10-16'});
 for(const [time,status] of [['2026-10-14T18:29:59.999Z','scheduled'],['2026-10-14T18:30:00Z','active'],['2026-10-16T18:29:59.999Z','active'],['2026-10-16T18:30:00Z','expired']]){
  assert.equal(sponsorStatus(campaign,Date.parse(time)),status);
  const displayed=sponsorForDisplay(campaign,Date.parse(time));
  assert.equal(displayed.title,status==='active'?'Test sponsor':'');assert.equal(displayed.enabled,true);
 }
 assert.equal(sponsorSchema.safeParse({...campaign,startDate:'2026-02-30'}).success,false);
 assert.equal(sponsorSchema.safeParse({...campaign,endDate:'2026-10-14'}).success,false);
 assert.equal(sponsorStatus({...campaign,enabled:false}),'hidden');
 assert.equal(sponsorStatus({...campaign,startDate:'',endDate:''}),'active');
 const legacy=sponsorSchema.parse({enabled:true,title:'Old ad',url:'',description:''});
 assert.equal(legacy.image,'');assert.equal(legacy.startDate,'');assert.equal(legacy.endDate,'');
});
test('sponsor images cannot embed HTML or SVG and disappear after expiry',async()=>{
 const {sponsorDefaults,sponsorSchema}=await vite.ssrLoadModule('/lib/sponsorship.ts');
 const {SponsorCard}=await vite.ssrLoadModule('/components/sponsor-space.tsx');
 const campaign={...sponsorDefaults,title:'Business logo',image:'data:image/jpeg;base64,/9j/AA==',endDate:'2026-10-15'};
 assert.equal(sponsorSchema.safeParse(campaign).success,true);
 for(const image of ['data:image/svg+xml;base64,PHN2Zz4=','data:text/html;base64,PHNjcmlwdD4=','javascript:alert(1)','https://example.com/track.png','data:image/jpeg;base64,/9j/'+ 'A'.repeat(180000)]){
  assert.equal(sponsorSchema.safeParse({...campaign,image}).success,false);
 }
 const active=renderToStaticMarkup(React.createElement(SponsorCard,{sponsor:campaign,now:Date.parse('2026-10-15T10:00:00Z')}));
 assert.match(active,/alt="Business logo advertisement"/);
 const expired=renderToStaticMarkup(React.createElement(SponsorCard,{sponsor:campaign,now:Date.parse('2026-10-15T18:30:00Z')}));
 assert.doesNotMatch(expired,/<img/);assert.match(expired,/Advertise here/);
});
