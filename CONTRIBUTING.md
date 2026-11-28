# Contributing to SBVC

Thank you for helping! You can report a bug, share an idea, fix Bible or hymn text, or work on the code. SBVC is still in development and testing, so testing it and telling us what went wrong is a big help.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Report a bug or share an idea

No coding needed. Use either one:

- the **Report / Message** form on the [About page](https://sbvc-new.vercel.app/about), or
- a [GitHub issue](https://github.com/Mejez6603/SBVC-NEW/issues).

For a bug, tell us:

1. What you did, step by step.
2. What you expected, and what happened instead.
3. Your browser, and whether you used the online site or `START.bat`.
4. A screenshot or short video, if you can.

GitHub issues can be seen by other people, so don't include passwords, Live keys or private information.

> **Security problem?** Don't open a public issue. Follow the [Security Policy](SECURITY.md).

## Set up the project

You need Git and a recent version of Chrome, Edge or Firefox. There is nothing to install or build.

```powershell
git clone https://github.com/Mejez6603/SBVC-NEW.git
cd SBVC-NEW
```

Double-click `START.bat`, then open <http://localhost:8765>. See the [project structure](README.md#project-structure) to find your way around.

## Make a change

> **Be careful with `main`:** the online site is published from it, so what is pushed there goes live. Do your work on a separate branch.

1. If you can't push to the repository, **fork** it on GitHub first and clone your fork.
2. Get the latest version, then make a branch:
   ```powershell
   git switch main
   ```
   ```powershell
   git pull
   ```
   ```powershell
   git switch -c fix-short-description
   ```
3. Make your change. Keep each branch to one topic.
4. [Test it](#test-your-change).
5. [Add a line to the update log](#update-log).
6. Commit with a message that says what changed, for example `Fix spelling in TCB Genesis 3`. Avoid messages like `update`.
7. Push your branch and open a **pull request** to `main`. Say what you changed, why, and how you tested it. Add a screenshot if the look changed.

If someone else may be editing the same files, such as the same Bible books, agree on who takes which first.

## Code rules

- **Plain HTML, CSS and JavaScript.** No framework, build step or Node.
- **Match the code around you.** The scripts use `'use strict'` functions that share things through `window.SBVC`, with `var` and `function`.
- **No JavaScript inside `.html` files:** no `<script>` blocks with code and no `onclick=` attributes. Put it in a file in `js/`. The online site's security policy blocks inline scripts, **even though they work with `START.bat`**.
- **Nothing loaded from other websites.** Keep libraries in `js/vendor/` and fonts in `fonts/`. If a feature must connect to an outside service, discuss it in an issue first; its address also has to be added to the policy in `vercel.json`, and explained in `SECURITY.md`.
- **Keep the `.html` ending in links between pages,** so they work with `START.bat`. The online site removes it.
- **Don't trust outside data.** Anything from an imported file or from Live mode must be checked before it is used. Show text as text (`textContent`), not as HTML.
- **No secrets or private information** in the code: no passwords, private keys or personal email addresses.
- **Don't edit the files in `js/vendor/` by hand.** To update a library, replace the file and update its notes in `js/vendor/README.txt`.
- **New fonts:** add the font file and its rules in `fonts/`, add the name to the font list in `js/state.js`, note it in `fonts/README.txt`, and check that its license allows sharing.

## Bible and hymn text

| What | Where |
| --- | --- |
| Bible | `data/bible/kjv/`, `data/bible/adb/`, `data/bible/tcb/` – one file per book |
| Hymns | `data/hymns/hymns-english.js`, `data/hymns/hymns-tagalog.js` |
| Book names | `data/books.js` |

- **Check the text against a trusted copy of that same version,** and say in your pull request which copy you used. Don't "fix" old wording or spelling that the version really has.
- **Change only the text.** Keep the first line of each file, the chapter and verse numbers, the quotes and the commas as they are. One missing quote or comma can stop a whole file from loading.
- **A straight quote `"` inside a verse** must be written as `\"`. Curly quotes `“ ”` don't need this.
- **Save as UTF-8,** so letters such as `ñ` and curly quotes stay correct.
- **Open the book you changed** in SBVC and check the chapters you edited.
- **Only add text you have the right to share.** For a new translation or hymn collection, open an issue first and tell us its source and permission or license.

## Test your change

There are no automatic tests, so test by hand with `START.bat`:

- [ ] The page you changed works, with no errors in the browser console (<kbd>F12</kbd>).
- [ ] The **Presentation** window still shows the right content.
- [ ] If you changed shared files (such as `state.js`, `nav.js` or `style.css`), check Bible, Hymnals, Preaching, PowerPoint and About.
- [ ] Slides and settings you saved before the change still open.
- [ ] If you changed Live mode, try it with a host and a helper.
- [ ] If you changed `vercel.json` or loaded something new, check it on a Vercel preview or the online site too, with the console open. `START.bat` does not send the security headers.

Use **Backup** first if your browser has slides you want to keep.

## Update log

Every change gets a line in [`UPDATE_LOG.txt`](UPDATE_LOG.txt). Add it **above** the heading `HOW TO ADD A NEW ENTRY`, with a blank line between entries:

```
2026-11-28  14:30  FIX  Corrected spelling in Genesis chapter 3 (data/bible/tcb/genesis.js) (Your name)
```

That is the date, time, type (`NEW`, `ADD`, `CHANGE`, `FIX`, `REMOVE` or `SECURITY`), what changed in plain words, the files, and your name.

If your change adds or changes a feature, update the [README](README.md) too.

## License

SBVC uses the [MIT License](LICENSE). By contributing, you agree that your contribution can be shared under it. Libraries, fonts, Bible translations and hymns made by others keep their own licenses and rights.
