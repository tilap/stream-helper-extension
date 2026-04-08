# Stream Helper Extension (Chrome, MV3)

Chrome extension for the Senpai streaming website.

## Features

- Automatically skips / bypasses the ad-flow on supported pages.
- Adds a button near the embedded player to copy a `yt-dlp` command to your clipboard.

## Installation (macOS)

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select this folder

## Requirements

- Node.js **18+** (the updater uses the built-in `fetch` API)

## Supported pages

The content script is injected only on:

- `https://<host>/movie/*`
- `https://<host>/episode/*`
- `https://<host>/episode/*/*`

Where `<host>` is derived from `SENPAI_ORIGIN`.

## Maintenance: when the website changes domain

### Automatic update (recommended)

Fetches the currently advertised official domain from `https://senpai-stream.wiki/`, then updates both `domain-config.js` and `manifest.json`:

```bash
node update.mjs
```

### Manual update

If you already know the new domain:

```bash
node update.mjs https://new-domain.com
```

### Test the live fetch

This performs a real fetch to `https://senpai-stream.wiki/` and prints the resolved origin + host (or exits with an error):

```bash
node test-fetch-domain.mjs
```


### Why update `manifest.json`?

Chrome requires static match patterns in the manifest for content scripts. If the domain changes but `manifest.json` isn’t updated, the content script won’t be injected on the new host.

### After running the updater

After updating the domain, go to `chrome://extensions` and click **Reload** on the extension.

## How it works (MV3)

- The extension uses a **content script** (`content.js`) declared in `manifest.json`.
- It observes DOM changes to detect the "Continue" ad step and the player iframe, then performs the same clicks a user would.
- The download button copies a `yt-dlp` command to the clipboard (best-effort URL extraction; cross-origin iframes may limit what can be read directly).

## Debugging

`content.js` has a `DEBUG` flag. When enabled, it shows a small overlay and prints extra logs to the console.

## Permissions

This extension currently declares **no special permissions** and relies on static `content_scripts` matches.

## Security & privacy

- **No tracking**: the extension does not include analytics.
- **No network exfiltration**: it does not send page data to external servers.
- **Local-only behavior**: it modifies the current page DOM and may copy a generated command to your clipboard when you click the button.
- **Least privilege**: the extension is scoped to specific URL match patterns, not `<all_urls>`.