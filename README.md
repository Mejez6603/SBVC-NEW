# SBVC – Show Bible Verse Controller

> Your Bible presentation assistant for church services and Bible studies — plain HTML, CSS and JavaScript. No build step, no Node.

## Overview

SBVC lets an operator control what the congregation sees on a projector or second screen. The operator works in the **Controller** window; the audience sees only the clean **Presentation** window (`present.html`).

The two windows talk to each other through the browser's `localStorage` and `storage` events, so nothing is uploaded anywhere and no server-side code is needed. A tiny PowerShell web server (`tools/serve.ps1`) is included only so the pages can be opened from `http://localhost`.

SBVC is the static (plain web files) version of an earlier Next.js project.

## Features

- **Bible controller** – book / chapter / verse lists, search, three translations (KJV, ADB, TCB); picking a verse scrolls the same verse into view in the other translation.
- **Hymnals** – search 308 English and 79 Tagalog hymns, build a queue of up to 15 and project them with their own styling.
- **Preaching** – a PowerPoint-style editor: draggable slide thumbnails, text / verse / shape / picture boxes, rich text, 30 design templates and color schemes, undo/redo, copy/paste, multi-select.
- **PowerPoint tab** – a separate deck with the same editor, for introductions, announcements and other presentations.
- **Presenter View** – every slide in a grid (two per row); click a slide to present it.
- **Preview screen** – see what is on the projector at the top of the right-hand panel in the Bible, Hymnals, Preaching and PowerPoint pages.
- **Customization** – theme, fonts, sizes, colors, text alignment and positions, backgrounds (colors or your own pictures) shared across pages.
- **Import / Export** – save a deck as an `.sbvc.json` file, or export / import a real **PowerPoint (`.pptx`)** file (best effort: text, shapes, pictures and backgrounds come across; animations, charts, SmartArt, videos and gradient-filled shapes do not).
- **Live mode** – share a deck with a key so a helper can join remotely and edit or control it (peer-to-peer over WebRTC). Includes host approval, view / control / edit roles, host controls, a restore point, an activity log and a **live chat** (text, pictures and small files).
- **Remembers your work** – slides, notes and settings survive a refresh or closing the tab.
- **The screen stays put** – switching between the Bible, Hymnals, Preaching and PowerPoint pages does not change the projector; it changes only when you click a new verse, hymn line, video or slide (or press Clear).
- **Safe projector screen** – text on the presentation window cannot be selected, dragged or right-clicked.

## Technologies Used

| Area | Technology |
| --- | --- |
| Pages and styling | HTML5, CSS3 |
| Logic | Vanilla JavaScript (IIFE modules on `window.SBVC`) |
| Window-to-window sync | `localStorage` + `storage` events |
| Remote (Live) mode | [PeerJS](https://peerjs.com/) 1.5.4 (WebRTC) |
| `.pptx` export | [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) 3.12.0 |
| `.pptx` import | [JSZip](https://stuk.github.io/jszip/) 3.10.1 |
| Local server | PowerShell `HttpListener` (`tools/serve.ps1`) |

All third-party libraries are stored in `js/vendor/` (with sizes and SHA-256 checksums in `js/vendor/README.txt`) — nothing is loaded from a CDN.

## Getting Started

### Prerequisites

- Windows with PowerShell (included with Windows 10 and later), **or** any other static web server
- A modern browser (Chrome, Edge or Firefox)

### Run it

1. Download or clone the repository:
   ```powershell
   git clone https://github.com/Mejez6603/SBVC-NEW.git
   cd SBVC-NEW
   ```
2. Double-click **`START.bat`** (it starts the small server on port 8765).
3. Open <http://localhost:8765> in your browser and click **Open Control Panel**.

Not on Windows? Serve the folder with any static server instead, for example:

```bash
python -m http.server 8765
```

## Usage

1. **Controller** (`controller.html`) – choose a book, chapter and verse. Click **Show** to put it on the screen.
2. **Presentation** (`present.html`) – open it in a second window and drag it to the projector or second monitor, then press fullscreen.
3. **Hymnals** – search a hymn, add it to the queue, project a verse or the whole hymn.
4. **Preaching / PowerPoint** – build slides, then click **Present** (or click a slide in **Presenter View**).
5. **Export / Import** – use the toolbar buttons; Export asks for an SBVC file or a PowerPoint file, Import asks *Add after my slides* or *Replace all my slides* (Ctrl+Z undoes a replace).
6. **Live mode** – click the **Local / Live** button at the top right. The host shares a key; the helper enters it to join. The host approves each person and chooses their role.

## Project Structure

```
SBVC-NEW/
├── index.html          Home page
├── controller.html     Bible controller
├── hymnals.html        Hymnals page
├── preaching.html      Preaching slide editor
├── powerpoint.html     PowerPoint slide editor (separate deck)
├── present.html        Presentation window for the projector
├── about.html          About / how it works
├── START.bat           Starts the local server on port 8765
├── UPDATE_LOG.txt      Every change, newest at the bottom
├── css/
│   └── style.css
├── js/
│   ├── state.js        Shared state and the localStorage channel
│   ├── nav.js          Top menu and Live button
│   ├── controller.js   Bible controller logic
│   ├── hymnals.js      Hymnals logic
│   ├── preaching.js    Slide editor (used by Preaching and PowerPoint)
│   ├── slide.js, designs.js, designpanel.js, background.js, custompanel.js, preview.js
│   ├── present.js      Presentation window
│   ├── live.js         Live mode, chat and security
│   ├── pptx.js         .pptx export and import
│   └── vendor/         PeerJS, PptxGenJS, JSZip (+ README with checksums)
├── data/
│   ├── bible/          kjv, adb, tcb (one file per book)
│   ├── hymns/          English and Tagalog hymns
│   └── books.js
└── tools/
    └── serve.ps1       Small local web server
```

## Packaging for Distribution

SBVC has no build step, so "packaging" is just copying the folder:

1. Make sure the folder contains everything above (especially `data/` and `js/vendor/`).
2. Zip the **SBVC-NEW** folder (leave out the `.git` folder).
3. On the target computer, unzip it anywhere and double-click `START.bat`.

To host it online instead, upload the folder to any static host (for example GitHub Pages). Note that browsers keep `localStorage` per address, so open the Controller and Presentation pages from the **same** address.

## Future Enhancements

- Better `.pptx` import (gradient fills, tables as real tables, rotation values).
- Keep video and media lists after a reload.
- More Bible translations and hymn collections.
- A server-independent launcher for macOS and Linux.
- More slide designs and transitions.

## Changelog

The full, dated history of every change is in [`UPDATE_LOG.txt`](UPDATE_LOG.txt) (newest at the bottom). Recent highlights:

- **2026-11-25** – `.pptx` export and import; Import / Export of `.sbvc.json`; preview screen in Preaching / PowerPoint; Live chat and security hardening; Live mode; PowerPoint tab; Presenter View.
- **2026-11-24** – First static version: Bible controller, Presentation window, Hymnals, Preaching editor with designs, shapes and pictures.

## System Requirements

- Windows 10 or later (for `START.bat`), or any OS with a static web server
- Chrome, Edge or Firefox (recent versions)
- Two displays (or a projector) recommended for the Presentation window
- Internet access is needed **only** for Live mode (to reach the free PeerJS broker that introduces two computers; slides and chat go directly between them)

## Troubleshooting

| Problem | What to try |
| --- | --- |
| `START.bat` closes or the page does not open | Check that port 8765 is free, or run `tools\serve.ps1 -Port 9000` and open that port. |
| Presentation window does not update | Open the Controller and Presentation from the **same address** (both `localhost`, not one `127.0.0.1`). |
| Videos disappear after refresh | Video files cannot be stored by the browser; add them again. |
| Live mode cannot connect | Check both computers are online, the key is typed exactly, and the host has the Live panel open. Some strict networks block WebRTC. |
| A `.pptx` looks different after import | Import is best effort; fonts, animations, charts and gradient shapes may change. |
| Everything looks reset | Browser data was cleared; slides and settings are stored in `localStorage`. Use Export to keep a backup. |

## Acknowledgment

- [PeerJS](https://peerjs.com/), [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) and [JSZip](https://stuk.github.io/jszip/) — the open-source libraries SBVC builds on.
- The original Next.js SBVC project this static version was converted from.
- The churches and volunteers who use and test SBVC.

## Contributing and Policies

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## License

Released under the [MIT License](LICENSE).
