#!/usr/bin/env node
import { fetchCurrentSenpaiOrigin } from "./senpai-wiki-domain.mjs";

async function main() {
  const origin = await fetchCurrentSenpaiOrigin();
  if (!origin) {
    throw new Error("No origin returned");
  }
  const host = new URL(origin).host;
  console.log("Host found", host);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

