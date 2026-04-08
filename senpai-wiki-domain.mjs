const WIKI_URL = "https://senpai-stream.wiki/";
const WIKI_HOST = new URL(WIKI_URL).host;

function uniq(list) {
  return Array.from(new Set(list));
}

function extractCandidateUrlsFromHtml(html) {
  // Capture URLs from href/src attributes and plain text.
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const matches = html.match(urlRegex) ?? [];
  return uniq(matches);
}

function scoreCandidate(urlString) {
  // Higher is better.
  // Bias towards the simplest origin-only URLs and senpai-stream.* domains.
  let score = 0;
  if (urlString.startsWith("https://")) score += 10;
  if (urlString.includes("senpai-stream.")) score += 50;
  if (/^https:\/\/senpai-stream\.[^/]+\/?$/.test(urlString)) score += 100;
  // The wiki page itself is not the streaming origin.
  try {
    const host = new URL(urlString).host;
    if (host === WIKI_HOST) score -= 1000;
  } catch {
    // ignore
  }
  // Prefer shorter URLs when other signals are equal.
  score += Math.max(0, 50 - Math.min(50, urlString.length / 2));
  return score;
}

export function extractSenpaiOriginFromHtml(html) {
  const candidates = extractCandidateUrlsFromHtml(html)
    .filter((u) => u.includes("senpai-stream."))
    .map((u) => {
      try {
        // Normalize to origin to avoid paths/query.
        const parsed = new URL(u);
        return parsed.origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const uniqCandidates = uniq(candidates).filter((origin) => {
    try {
      return new URL(origin).host !== WIKI_HOST;
    } catch {
      return false;
    }
  });
  if (uniqCandidates.length === 0) return null;

  uniqCandidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return uniqCandidates[0];
}

export async function fetchCurrentSenpaiOrigin({ timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(WIKI_URL, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Keep it simple and browser-like.
        "User-Agent": "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.166 Safari/537.36",
        Accept: "text/html,*/*",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} while fetching ${WIKI_URL}`);
    }

    const html = await res.text();
    const origin = extractSenpaiOriginFromHtml(html);
    if (!origin) {
      throw new Error(`Could not extract origin from ${WIKI_URL}`);
    }

    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") {
      throw new Error(`Expected https origin, got: ${origin}`);
    }

    return parsed.origin;
  } finally {
    clearTimeout(timeout);
  }
}

