#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchCurrentSenpaiOrigin } from "./senpai-wiki-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "domain-config.js");
const manifestPath = path.join(__dirname, "manifest.json");

function usageAndExit(code = 1) {
  console.error(
    [
      "Usage:",
      "  node update.mjs",
      "  node update.mjs https://example.com",
      "  node update.mjs example.com",
      "",
      "When no argument is provided, the script fetches the current official domain from https://senpai-stream.wiki/.",
    ].join("\n"),
  );
  process.exit(code);
}

function normalizeOrigin(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const parsed = new URL(withProtocol);
  if (parsed.protocol !== "https:") {
    throw new Error(`Expected https URL, got: ${parsed.toString()}`);
  }
  return parsed.origin;
}

function updateDomainConfig(origin) {
  const src = fs.readFileSync(configPath, "utf8");
  const re = /const\s+SENPAI_ORIGIN\s*=\s*["']([^"']+)["']\s*;/;
  if (!re.test(src)) {
    throw new Error("Could not find `const SENPAI_ORIGIN = ...;` in domain-config.js");
  }
  const updated = src.replace(re, `const SENPAI_ORIGIN = "${origin}";`);
  fs.writeFileSync(configPath, updated);
}

function updateManifestMatches(origin) {
  const host = new URL(origin).host;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entry = manifest.content_scripts?.[0];
  if (!entry) {
    throw new Error("manifest.json: missing content_scripts[0]");
  }

  entry.matches = [
    `https://${host}/movie/*`,
    `https://${host}/episode/*`,
    `https://${host}/episode/*/*`,
  ];

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return host;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1) usageAndExit(1);

  let origin;
  if (args.length === 1) {
    origin = normalizeOrigin(args[0]);
  } else {
    origin = await fetchCurrentSenpaiOrigin();
  }

  if (!origin) {
    throw new Error("Could not resolve origin");
  }

  updateDomainConfig(origin);
  const host = updateManifestMatches(origin);

  console.log(`Updated SENPAI_ORIGIN: ${origin}`);
  console.log(`Updated manifest host: ${host}`);
  console.log(`Updated files: ${path.basename(configPath)}, ${path.basename(manifestPath)}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

