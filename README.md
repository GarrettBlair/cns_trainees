# cns_trainees
Testing site for a CNS trainee directory. 
## Features:
- Load trainee data directly from the published Google Sheets CSV.
- Add timestamp-based archiving with an internal 12-month cutoff; “See archived profiles” switches to archived profiles only.
- Use no_image.png for profile portraits and omit the image when it fails to load.
- Display multiple site links together, separated by semicolons, with branded labels for LinkedIn, GitHub, Google Scholar, and Linktree.
- Replace manually maintained faculty links with a generated roster scraped from the public CNS and NYU Langone faculty directories.
- Add ```npm run update:faculty``` to refresh the local roster and document the workflow.
- Show the requested CNS IT message when trainee data fails to load.
### To-do
- add trainee submitted photos instead of the placeholder image (need access to drive folder images)

## Demo the trainee directory
Prerequisites: a browser, plus either Python 3 or Node.js. No build step is needed.

1. __Get the repo.__ Clone it or download the ZIP from GitHub, then open a terminal in the project folder.

2. __Serve it over HTTP.__ Opening trainees.html directly won't work, because the page uses fetch to load the faculty roster. Run one of these:
  ```python -m http.server 8000```
or
  ```npx serve .```

3. __Open the page__ at http://localhost:8000/trainees.html. The page needs internet access to load the published Google Sheet. If the sheet is unavailable, the page shows "Trainee directory data failed to load. Please contact CNS IT".

4. __Directory features__:

  - Grouped profiles: people are grouped by role (PhD Student, Postdoc, and so on), each with a name, role, lab, email and site.
  - Search and filter: search by name, lab or email, and use the role dropdown.
  - Lab links: lab names such as "Fenton" or "Michael Long / György Buzsáki" link to the CNS or NYU Langone faculty profiles.
  - Site links: these are shortened to LinkedIn, GitHub, Google Scholar or Linktree, and multiple links share one line.
  - Archiving: profiles whose latest submission is over 12 months old are hidden. "See archived profiles" switches to the archived-only view, and the cutoff is archiveAgeMonths in trainees.html.
  - Photos: profiles use the placeholder no_image.png, and a profile with no loadable image simply omits it.
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
This re-scrapes both faculty directories and rewrites faculty-directory.json. Manual entries can also be added following the same format in the 'sources/faculty-directory.json'. Reload the page to see the result. The refresh script writes the local JSON roster; site visitors do not scrape the faculty websites directly.
