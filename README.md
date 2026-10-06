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
