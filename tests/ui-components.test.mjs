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
