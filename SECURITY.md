# Security Policy

## Supported Versions

SBVC has no numbered releases. Only the latest version on the `main` branch is supported with security fixes.

| Version | Supported |
| --- | --- |
| Latest `main` | Yes |
| Older copies | No — please update |

## Reporting a Vulnerability

Please **do not** open a public issue for a security problem.

1. Go to the repository's **Security** tab and choose **Report a vulnerability** (GitHub private reporting), or contact the maintainer [@Mejez6603](https://github.com/Mejez6603) privately through GitHub.
2. Include what you found, the steps to reproduce it, the browser and Windows version, and the possible impact. Screenshots or a short video help.
3. We will acknowledge your report as soon as we can, keep you updated while we investigate, and credit you in the fix if you wish.

Please give us reasonable time to fix the problem before telling anyone else.

## What SBVC Already Does

- **No server, no accounts.** Slides, notes and settings stay in your browser's `localStorage` on your own computer.
- **Security headers on the online site.** `vercel.json` sends a Content-Security-Policy (only the site's own script files may run; the only outside connection allowed by it is the Live mode broker), plus X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy (camera, microphone, location, payment and USB are off). The local `START.bat` server does not send them.
- **Local libraries only.** PeerJS, PptxGenJS and JSZip are stored in `js/vendor/` with SHA-256 checksums; nothing is loaded from a CDN, so a compromised CDN cannot run code in the site.
- **Live mode safeguards.** Peer-to-peer (WebRTC) connections, host approval for every guest, view / control / edit roles, host controls (kick, block, change role), a restore point, an activity log, strict checking of every message received (allowed keys only, size limits, no scripts or outside web addresses, pictures limited to safe types) and rate limits.
- **Safe imports.** Imported `.sbvc.json` and `.pptx` files are checked first: SBVC slides only, limits on slide / element counts and file size, no scripts or outside web links, and only png / jpg / webp / gif pictures. A zip-bomb guard protects `.pptx` import.
- **Checked restores.** A backup file is checked before it is restored: only SBVC's own settings, no scripts or outside web links, only safe pictures and video / audio files. Live mode keys are never put in a backup. A backup is not encrypted, so keep it as private as your notes.
- **Safe chat files.** Only a short list of document types up to 1 MB, and pictures shrunk before sending.

## Known Limits

- Live mode uses the free PeerJS broker (`0.peerjs.com`) to introduce two computers. It never sees slides or chat, but it does see that a connection was requested.
- Anyone who has the Live key can **ask** to join; the host decides. Keep keys private and end the session when finished.
- The local server (`tools/serve.ps1`) is meant for use on your own computer. Do not expose it to the internet.
- `.pptx` import is best effort and not a full PowerPoint parser.

## Safe Use Tips

- Use a new Live key for every session and never post it publicly.
- Give guests the lowest role they need (view or control, not edit).
- Download SBVC only from the official repository.
- Keep your browser up to date.
