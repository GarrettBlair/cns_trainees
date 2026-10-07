// Shared by trainees.html (browser) and scripts/generate-static-directory.mjs (Node); keep it DOM-free.

export const PUBLISHED_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRI-bsWtUw-xHXXn8wznvhXg3htUK4281nrDdDYrPe5OMFqlmdfYaA8GPQ-gic2QFSq7jyiNGi9bnl3/pub?gid=1236118581&single=true&output=csv";
export const ARCHIVE_AGE_MONTHS = 12;

const FACULTY_ALIAS_OVERRIDES = [
  { alias: "Tony Movshon", name: "J. Anthony Movshon" },
];

const SITE_LABELS = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)github\.(com|io)$/, "GitHub"],
  [/(^|\.)scholar\.google\.com$/, "Google Scholar"],
  [/(^|\.)(linktr\.ee|linktree\.com)$/, "Linktree"],
];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);

  const headers = rows.shift().map((header) => header.trim().replace(/^\uFEFF/, ""));
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
}

export function parseTimestamp(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [, month, day, year, hour = "0", minute = "0", second = "0"] = match;
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (timestamp.getFullYear() !== Number(year) || timestamp.getMonth() !== Number(month) - 1 || timestamp.getDate() !== Number(day)) return null;
  return timestamp;
}

export function archiveCutoff(months = ARCHIVE_AGE_MONTHS, now = new Date()) {
  const cutoff = new Date(now);
  const day = cutoff.getDate();
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - months);
  const lastDay = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
  cutoff.setDate(Math.min(day, lastDay));
  return cutoff;
}

// Profiles with no parseable timestamp are never archived.
export function isArchived(person, cutoff) {
  return Boolean(person.timestamp && person.timestamp < cutoff);
}

export function latestPeople(rows) {
  const people = new Map();
  for (const row of rows) {
    const first = row["First Name"] || "";
    const last = row["Last Name"] || "";
    const name = `${first} ${last}`.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const timestamp = parseTimestamp(row.Timestamp || "");
    const existing = people.get(key);
    if (existing?.timestamp && (!timestamp || timestamp < existing.timestamp)) continue;
    people.set(key, {
      name,
      timestamp,
      email: row["Your Email Address"] || "",
      lab: row["Your Lab/PI"] || "",
      role: row["Current Role"] || "",
      website: row["Personal/Professional Website URL"] || "",
    });
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupByRole(people) {
  const groups = new Map();
  for (const person of people) {
    const roleName = person.role || "Role not listed";
    if (!groups.has(roleName)) groups.set(roleName, []);
    groups.get(roleName).push(person);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}

// Splits a semicolon-separated website field into links with brand labels where known.
export function siteLinks(website) {
  return website.split(/\s*;\s*/).filter(Boolean).map((site) => {
    const href = /^https?:\/\//i.test(site) ? site : `https://${site}`;
    let text = "personal website";
    try {
      const hostname = new URL(href).hostname.toLowerCase();
      const brand = SITE_LABELS.find(([pattern]) => pattern.test(hostname));
      if (brand) text = brand[1];
    } catch {}
    return { text, href };
  });
}

function stripAccents(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeFacultyName(name) {
  return stripAccents(name).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Normalizes text for matching while recording where each kept character came from.
function normalizeWithOffsets(value) {
  const characters = [];
  const sourceStarts = [];
  const sourceEnds = [];
  for (let offset = 0; offset < value.length;) {
    const sourceCharacter = String.fromCodePoint(value.codePointAt(offset));
    const nextOffset = offset + sourceCharacter.length;
    const normalizedCharacters = stripAccents(sourceCharacter).toLocaleLowerCase();
    for (const character of normalizedCharacters) {
      const normalizedCharacter = /[\p{L}\p{N}]/u.test(character) ? character : " ";
      if (normalizedCharacter === " " && (!characters.length || characters.at(-1) === " ")) {
        if (characters.length) sourceEnds[sourceEnds.length - 1] = nextOffset;
        continue;
      }
      characters.push(normalizedCharacter);
      sourceStarts.push(offset);
      sourceEnds.push(nextOffset);
    }
    offset = nextOffset;
  }
  while (characters.at(-1) === " ") {
    characters.pop();
    sourceStarts.pop();
    sourceEnds.pop();
  }
  return { text: characters.join(""), sourceStarts, sourceEnds };
}

// Returns linkLab(lab) -> [{ text, url? }]; segments with a url are faculty names.
export function createFacultyLinker(facultyDirectory) {
  const facultyByName = new Map();
  for (const person of facultyDirectory) {
    const key = normalizeFacultyName(person.name);
    if (key && !facultyByName.has(key)) facultyByName.set(key, person);
  }

  const surnameCounts = new Map();
  for (const person of facultyByName.values()) {
    const surname = normalizeFacultyName(person.name).split(" ").at(-1);
    surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);
  }

  const aliases = new Map();
  const ambiguousAliases = new Set();
  const addAlias = (alias, person) => {
    const key = normalizeFacultyName(alias);
    if (!key || ambiguousAliases.has(key)) return;
    const existing = aliases.get(key);
    if (!existing) aliases.set(key, person);
    else if (existing.url !== person.url) {
      aliases.delete(key);
      ambiguousAliases.add(key);
    }
  };

  for (const person of facultyByName.values()) {
    const nameParts = person.name.split(/\s+/);
    const first = nameParts[0];
    const surname = nameParts.at(-1);
    const variants = new Set([
      person.name,
      `${first} ${surname}`,
      stripAccents(person.name),
      `${stripAccents(first)} ${stripAccents(surname)}`,
    ]);
    for (const alias of variants) addAlias(alias, person);
    if (surnameCounts.get(normalizeFacultyName(surname)) === 1) addAlias(surname, person);
  }

  for (const override of FACULTY_ALIAS_OVERRIDES) {
    const person = facultyByName.get(normalizeFacultyName(override.name));
    if (person) addAlias(override.alias, person);
  }

  const patterns = [...aliases.keys()]
    .sort((a, b) => b.length - a.length)
    .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = patterns.length ? new RegExp(`(^| )(${patterns.join("|")})(?=$| )`, "giu") : null;

  return function linkLab(lab) {
    if (!pattern) return [{ text: lab }];
    const normalizedLab = normalizeWithOffsets(lab);
    const segments = [];
    let cursor = 0;
    for (const match of normalizedLab.text.matchAll(pattern)) {
      const normalizedStart = match.index + match[1].length;
      const normalizedEnd = normalizedStart + match[2].length;
      const start = normalizedLab.sourceStarts[normalizedStart];
      const end = normalizedLab.sourceEnds[normalizedEnd - 1];
      const faculty = aliases.get(match[2]);
      if (!faculty || start < cursor || end <= start) continue;
      if (start > cursor) segments.push({ text: lab.slice(cursor, start) });
      segments.push({ text: lab.slice(start, end), url: faculty.url });
      cursor = end;
    }
    if (cursor < lab.length) segments.push({ text: lab.slice(cursor) });
    return segments;
  };
}
