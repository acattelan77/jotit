const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  slugify,
  buildFilename,
  normalizeUrl,
  markdownToHtml,
  toLocalDateTimeValue,
} = require("../lib/note-utils.js");

test("slugify creates clean slugs and falls back to note", () => {
  assert.equal(slugify("Project Sync!"), "project-sync");
  assert.equal(slugify("  "), "note");
  assert.equal(slugify("A".repeat(120)).length <= 48, true);
});

test("buildFilename uses date and slug", () => {
  const filename = buildFilename({
    meetingName: "My Note",
    meetingDate: "2026-01-30T23:16",
  });
  assert.equal(filename, "2026-01-30_2316-my-note.md");
});

test("normalizeUrl accepts http(s) and mailto, rejects unsafe schemes", () => {
  assert.equal(normalizeUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(normalizeUrl("http://example.com"), "http://example.com/");
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("mailto:test@example.com"), "mailto:test@example.com");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
});

test("markdownToHtml escapes HTML and renders basic formatting", () => {
  const html = markdownToHtml("**Bold** <script>alert(1)</script>");
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("markdownToHtml renders lists, code, and links safely", () => {
  const md = [
    "- One",
    "- Two",
    "",
    "1. First",
    "2. Second",
    "",
    "`code`",
    "",
    "[Link](example.com)",
  ].join("\n");
  const html = markdownToHtml(md);
  assert.match(html, /<ul>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<a href="https:\/\/example\.com\/" target="_blank" rel="noopener noreferrer">Link<\/a>/);
});

test("markdownToHtml renders headings and horizontal rules", () => {
  const html = markdownToHtml("# Title\n\n---\n\n## Subtitle");
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<h2>Subtitle<\/h2>/);
});

test("toLocalDateTimeValue returns input date in local datetime format", () => {
  const date = new Date("2026-01-30T23:16:00");
  const value = toLocalDateTimeValue(date);
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});
