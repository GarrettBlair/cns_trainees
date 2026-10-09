# cns_trainees
Testing site for a CNS trainee directory. 
## Features:
- Load trainee data directly from the published Google Sheets CSV.
- Add timestamp-based archiving with an internal 12-month cutoff; “See archived profiles” switches to archived profiles only.
- Use matching portraits from `photos/` and fall back to no_image.png when a profile has no photo.
- Display multiple site links together, separated by semicolons, with branded labels for LinkedIn, GitHub, Google Scholar, and Linktree.
- Replace manually maintained faculty links with a generated roster scraped from the public CNS and NYU Langone faculty directories.
- Add ```npm run update:faculty``` to refresh the local roster and document the workflow.
- Show the requested CNS IT message when trainee data fails to load.
## Demo the trainee directory
Prerequisites: a browser, plus either Python 3 or Node.js. No build step is needed.

1. __Get the repo.__ Clone it or download the ZIP from GitHub, then open a terminal in the project folder.

2. __Serve it over HTTP.__ Opening trainees.html directly won't work, because the page uses fetch and an ES module import (`directory-core.js`). Run one of these:
  ```python -m http.server 8000```
or
  ```npx serve .```

3. __Open the page__ at http://localhost:8000/trainees.html. The page needs internet access to load the published Google Sheet. If the sheet is unavailable, the page shows "Trainee directory data failed to load. Please contact CNS IT".

4. __Directory features__:

  - Grouped profiles: people are grouped by role (PhD Student, Postdoc, and so on), each with a name, role, lab, email and site.
  - Search and filter: search by name, lab or email, and use the role dropdown.
  - Lab links: lab names such as "Fenton" or "Michael Long / György Buzsáki" link to the CNS or NYU Langone faculty profiles.
  - Site links: these are shortened to LinkedIn, GitHub, Google Scholar or Linktree, and multiple links share one line.
  - Archiving: profiles whose latest submission is over 12 months old are hidden. "See archived profiles" switches to the archived-only view, and the cutoff is `ARCHIVE_AGE_MONTHS` in `directory-core.js`.
  - Photos: profiles use matching images from `photos/`, with no_image.png as the fallback; a broken image is omitted.
  - Responsive layout: narrow the browser window to see the mobile layout.

5. *__Optional__*: refresh the faculty roster. This needs Node.js 20.18.1 or later. (see below)

faculty_example.htm is only the style reference for the page, and the page doesn't load it.


## Refresh faculty profile links

The directory loads the cached faculty roster from `sources/faculty-directory.json`.
To refresh names and profile URLs from the public [NYU CNS](https://as.nyu.edu/departments/cns/people/CoreFaculty.html) and [NYU Langone Neuroscience](https://med.nyu.edu/departments-institutes/neuroscience/faculty) faculty directories, install the Node dependencies and run:

```sh
npm install
npm run update:faculty
```
This re-scrapes both faculty directories and rewrites `faculty-directory.json`. Manual entries can also be added following the same format in `sources/faculty-directory.json`. Reload the page to see the result.

The refresh script writes the local JSON roster; site visitors do not scrape the faculty websites directly.

After scraping, the script compares the result with the existing roster and asks for confirmation:

- **New faculty** are listed and added unless you answer `n` (default `Y`).
- **Faculty no longer listed** are kept unless you answer `y` (default `N`).

Pressing Enter takes the default. In a non-interactive run (such as CI), new faculty are added and missing faculty are kept.

## Embed in Google Sites / Weebly (static HTML)

Google Sites and the Weebly-based CNS site cannot run the page's JavaScript, so generate a static, paste-ready snippet offline:

```sh
npm install
npm run build:embed
```

This reads the published sheet and `sources/faculty-directory.json`, applies the same 12-month archive rule and faculty links as the live page, and writes `dist/trainees-embed.html`. The snippet has no scripts, `<style>` blocks or classes (everything is inline-styled), and it replaces search, filter and the archive toggle with a role link bar at the top. Paste its contents into an HTML/embed block.

- **Photos must be reachable by URL.** Pasted HTML has no base path, so images use absolute URLs. The default photo directory is `https://garrettjblair.com/cns_trainees/`; override it with `npm run build:embed -- --photo-base-url=https://example.org/cns_trainees/`. Run `npm run photos:index` to regenerate 300x300 thumbnails in `photos/resized/` and refresh the name-to-file index; originals remain unchanged, and HEIC uploads are converted to JPEG.
- **It is a snapshot.** Regenerate and re-paste whenever the sheet or faculty roster changes.
- Other options: `--out=<file>` and `--csv=<url or local file>` (for example a downloaded copy if the sheet is unavailable).
- The page and the generator share their data logic in `directory-core.js`, so the two stay consistent.

## Embed the interactive directory

To retain search, role filtering, archiving, and compact view on the website, use `trainees-iframe.html` as the website's `/trainees` page. It embeds the working app at `https://garrettjblair.com/cns_trainees/trainees.html` and resizes the frame as its content changes. The iframe app and its dependencies must remain deployed at that URL; the app reports height updates only to a parent page on the same origin.

The iframe wrapper replaces the website route, not the app files. Keep `trainees.html`, `directory-core.js`, `sources/faculty-directory.json`, and `sources/no_image.png` together under `/cns_trainees/`. The static `dist/trainees-embed.html` remains available for platforms that cannot use an interactive iframe.
