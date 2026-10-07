# cns_trainees
testing for cns trainee website

## Refresh faculty profile links

The directory loads the cached faculty roster from `sources/faculty-directory.json`.
To refresh names and profile URLs from the public NYU CNS and NYU Langone faculty
directories, install the Node dependencies and run:

```sh
npm install
npm run update:faculty
```

The refresh script writes the local JSON roster; site visitors do not scrape the
faculty websites directly.

After scraping, the script compares the result with the existing roster and asks
for confirmation:

- **New faculty** are listed and added unless you answer `n` (default `Y`).
- **Faculty no longer listed** are kept unless you answer `y` (default `N`).

Pressing Enter takes the default. In a non-interactive run (such as CI), new
faculty are added and missing faculty are kept.
