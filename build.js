#!/usr/bin/env node
/* killedbypenguins — pre-render graveyard.json into index.html
 * so the page works in JS-less / TUI browsers (w3m, lynx, links, etc.).
 *
 * Usage:  node build.js
 * Reads:  graveyard.json
 * Writes: index.html  (in place — between <!--BEGIN--> and <!--END--> markers)
 *
 * The live page script (script.js) replaces the static <li>s on first render
 * so JS-enabled clients still get search/filter, while the static content is
 * there as a no-JS fallback.
 */

const fs = require("fs");
const path = require("path");

const CATEGORIES = [
  { key: "all",          label: "all" },
  { key: "distribution", label: "distro" },
  { key: "app",          label: "app" },
  { key: "service",      label: "service" },
  { key: "hardware",     label: "hardware" },
];

const TOMBSTONE = [
  "   .--.  ",
  "  |RIP|  ",
  "  |   |  ",
  "  |___|  ",
  "  /   \\  ",
  " /_____\\ ",
  " |     | ",
].join("\n");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function yearsLine(entry) {
  const born = entry.openDate  ? new Date(entry.openDate).getUTCFullYear() : null;
  const died = entry.deathDate ? new Date(entry.deathDate).getUTCFullYear() : null;
  if (born && died) return `${born}—${died}`;
  if (died) return `d. ${died}`;
  if (born) return `b. ${born}`;
  return "";
}

function entryHtml(entry) {
  const years = yearsLine(entry);
  const categoryLabel = CATEGORIES.find(c => c.key === entry.category)?.label || entry.category;
  const nameHtml = entry.link
    ? `<a href="${escapeHtml(entry.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.name)}</a>`
    : escapeHtml(entry.name);

  return `      <li class="entry" data-category="${escapeHtml(entry.category || "")}" data-name="${escapeHtml(entry.name.toLowerCase())}" data-desc="${escapeHtml((entry.description || "").toLowerCase())}">
        <div class="entry-stone">
          <pre class="tombstone" aria-hidden="true">${TOMBSTONE}</pre>
${years ? `          <div class="tombstone-years">${escapeHtml(years)}</div>\n` : ""}${entry.category ? `          <div class="tombstone-category">${escapeHtml(categoryLabel)}</div>\n` : ""}        </div>
        <div class="entry-inscription">
          <h2 class="entry-name">${nameHtml}</h2>
          <p class="entry-desc">${escapeHtml(entry.description || "")}</p>
        </div>
      </li>
`;
}

function sortedEntries(entries) {
  return [...entries].sort((a, b) => {
    const ta = a.deathDate ? new Date(a.deathDate).getTime() : Infinity;
    const tb = b.deathDate ? new Date(b.deathDate).getTime() : Infinity;
    return tb - ta;
  });
}

const root = __dirname;
const htmlPath = path.join(root, "index.html");
const jsonPath = path.join(root, "graveyard.json");

const entries = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const sorted = sortedEntries(entries);

// ---- build filter buttons (with counts) ----
const counts = entries.reduce((acc, e) => {
  acc[e.category] = (acc[e.category] || 0) + 1;
  return acc;
}, {});
counts.all = entries.length;

const filterButtons = CATEGORIES.map(({ key, label }) => {
  const pressed = key === "all" ? "true" : "false";
  return `      <button type="button" data-category="${key}" aria-pressed="${pressed}">[${label}: ${counts[key] || 0}]</button>`;
}).join("\n");

// ---- build entry list ----
const entryList = sorted.map(entryHtml).join("");

// ---- assemble counter text ----
const n = entries.length;
const counterText = `# ${n} ${n === 1 ? "soul" : "souls"} interred`;

// ---- patch index.html ----
let html = fs.readFileSync(htmlPath, "utf8");

// counter
html = html.replace(
  /<p class="counter" id="counter" aria-live="polite">.*?<\/p>/s,
  `<p class="counter" id="counter" aria-live="polite">${counterText}</p>`
);

// filter buttons
html = html.replace(
  /<span class="filters" id="filters" role="group" aria-label="filter by category">[\s\S]*?<\/span>/,
  `<span class="filters" id="filters" role="group" aria-label="filter by category">\n${filterButtons}\n    </span>`
);

// entry list
html = html.replace(
  /<ul id="graveyard" class="graveyard">[\s\S]*?<\/ul>/,
  `<ul id="graveyard" class="graveyard">\n${entryList}    </ul>`
);

fs.writeFileSync(htmlPath, html);
console.log(`✓ Pre-rendered ${entries.length} entries into index.html`);
