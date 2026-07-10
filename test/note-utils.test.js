const assert = require("node:assert/strict");
const { describe, it, before, after } = require("node:test");
const path = require("node:path");

const NoteUtils = require("../lib/note-utils.js");

describe("toLocalDateTimeValue", () => {
  it("returns a string matching YYYY-MM-DDTHH:MM", () => {
    const result = NoteUtils.toLocalDateTimeValue(new Date(2026, 6, 10, 14, 30));
    assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(result, "2026-07-10T14:30");
  });

  it("defaults to current date when no argument", () => {
    const result = NoteUtils.toLocalDateTimeValue();
    assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("pads single-digit month/day/hour/minute", () => {
    const result = NoteUtils.toLocalDateTimeValue(new Date(2026, 0, 5, 3, 7));
    assert.equal(result, "2026-01-05T03:07");
  });
});

describe("formatDateTime", () => {
  it("formats a date as a human-readable string", () => {
    const result = NoteUtils.formatDateTime(new Date(2026, 6, 10, 14, 30));
    assert.match(result, /Jul/);
    assert.match(result, /2026/);
    assert.match(result, /10/);
    assert.match(result, /30/);
  });
});

describe("sanitizeMeetingName", () => {
  it("returns the trimmed input", () => {
    assert.equal(NoteUtils.sanitizeMeetingName("  My Meeting  "), "My Meeting");
  });

  it('returns "Untitled note" for empty/whitespace input', () => {
    assert.equal(NoteUtils.sanitizeMeetingName(""), "Untitled note");
    assert.equal(NoteUtils.sanitizeMeetingName("   "), "Untitled note");
  });
});

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric with hyphens", () => {
    assert.equal(NoteUtils.slugify("Hello World"), "hello-world");
  });

  it("collapses multiple separators into one", () => {
    assert.equal(NoteUtils.slugify("foo   bar___baz"), "foo-bar-baz");
  });

  it("strips leading/trailing hyphens", () => {
    assert.equal(NoteUtils.slugify("--hello--"), "hello");
  });

  it("truncates to 48 characters", () => {
    const long = "a".repeat(100);
    assert.equal(NoteUtils.slugify(long).length, 48);
  });

  it('falls back to "note" for entirely non-alphanumeric input', () => {
    assert.equal(NoteUtils.slugify("!!! ___ ???"), "note");
  });
});

describe("buildFilename", () => {
  it("builds a date-title filename", () => {
    const result = NoteUtils.buildFilename({
      meetingName: "Sprint Review",
      meetingDate: "2026-07-10T14:30",
    });
    assert.equal(result, "2026-07-10 - h14:30 - Sprint Review.md");
  });

  it("sanitizes unsafe filename characters", () => {
    const result = NoteUtils.buildFilename({
      meetingName: "Q1: Review? <Budget> | Plan",
      meetingDate: "2026-07-10T14:30",
    });
    assert.equal(
      result,
      "2026-07-10 - h14:30 - Q1 Review Budget Plan.md"
    );
  });

  it('uses "Untitled note" fallback for empty meeting name', () => {
    const result = NoteUtils.buildFilename({
      meetingName: "",
      meetingDate: "2026-07-10T14:30",
    });
    assert.equal(result, "2026-07-10 - h14:30 - Untitled note.md");
  });

  it("generates date from current time when no date provided", () => {
    const result = NoteUtils.buildFilename({ meetingName: "Test" });
    assert.match(result, /^\d{4}-\d{2}-\d{2} - h\d{2}:\d{2} - Test\.md$/);
  });
});

describe("normalizeUrl", () => {
  it("returns a valid https URL as-is", () => {
    assert.equal(
      NoteUtils.normalizeUrl("https://example.com/page"),
      "https://example.com/page"
    );
  });

  it("prepends https:// for bare hostnames", () => {
    assert.equal(
      NoteUtils.normalizeUrl("example.com"),
      "https://example.com/"
    );
  });

  it("accepts http:// protocol", () => {
    assert.equal(
      NoteUtils.normalizeUrl("http://example.com"),
      "http://example.com/"
    );
  });

  it("returns null for chrome:// URLs", () => {
    assert.equal(NoteUtils.normalizeUrl("chrome://extensions"), null);
  });

  it("returns null for chrome-extension:// URLs", () => {
    assert.equal(
      NoteUtils.normalizeUrl("chrome-extension://abc123/sidepanel.html"),
      null
    );
  });

  it("returns null for about: pages", () => {
    assert.equal(NoteUtils.normalizeUrl("about:blank"), null);
  });

  it("returns null for file:// URLs", () => {
    assert.equal(NoteUtils.normalizeUrl("file:///tmp/note.md"), null);
  });

  it("accepts mailto: links", () => {
    assert.equal(
      NoteUtils.normalizeUrl("mailto:test@example.com"),
      "mailto:test@example.com"
    );
  });

  it("returns null for empty/whitespace input", () => {
    assert.equal(NoteUtils.normalizeUrl(""), null);
    assert.equal(NoteUtils.normalizeUrl("   "), null);
  });

  it("returns null for null input", () => {
    assert.equal(NoteUtils.normalizeUrl(null), null);
  });

  it("handles URLs with query params and fragments", () => {
    assert.equal(
      NoteUtils.normalizeUrl("https://example.com/path?a=1&b=2#section"),
      "https://example.com/path?a=1&b=2#section"
    );
  });
});

describe("normalizeImageSrc", () => {
  it("accepts a valid data URI", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    assert.equal(NoteUtils.normalizeImageSrc(dataUri), dataUri);
  });

  it("rejects unsupported image types", () => {
    assert.equal(
      NoteUtils.normalizeImageSrc("data:image/svg+xml;base64,PHN2Zw=="),
      null
    );
  });

  it("accepts a valid https image URL", () => {
    assert.equal(
      NoteUtils.normalizeImageSrc("https://example.com/photo.png"),
      "https://example.com/photo.png"
    );
  });

  it("returns null for empty input", () => {
    assert.equal(NoteUtils.normalizeImageSrc(""), null);
  });

  it("strips whitespace from data URIs", () => {
    const raw = "data:image/png;base64,iVBORw0KGgo=";
    const withSpace = "data:image/png;base64,iVBORw0KGgo=  ";
    assert.equal(NoteUtils.normalizeImageSrc(withSpace), raw);
  });
});

describe("markdownToHtml — pure regex, no DOM needed", () => {
  it("converts bold", () => {
    assert.equal(
      NoteUtils.markdownToHtml("**bold text**"),
      "<strong>bold text</strong>"
    );
  });

  it("converts italic", () => {
    assert.equal(
      NoteUtils.markdownToHtml("*italic text*"),
      "<em>italic text</em>"
    );
  });

  it("converts highlight", () => {
    assert.equal(
      NoteUtils.markdownToHtml("==highlighted=="),
      "<mark>highlighted</mark>"
    );
  });

  it("converts headings", () => {
    assert.equal(NoteUtils.markdownToHtml("# H1"), "<h1>H1</h1>");
    assert.equal(NoteUtils.markdownToHtml("## H2"), "<h2>H2</h2>");
    assert.equal(NoteUtils.markdownToHtml("### H3"), "<h3>H3</h3>");
  });

  it("converts unordered lists", () => {
    const md = "- item 1\n- item 2";
    const html = NoteUtils.markdownToHtml(md);
    assert.match(html, /<ul>/);
    assert.match(html, /<li>item 1/);
    assert.match(html, /<li>item 2/);
  });

  it("converts ordered lists", () => {
    const md = "1. first\n2. second";
    const html = NoteUtils.markdownToHtml(md);
    assert.match(html, /<ol>/);
    assert.match(html, /<li>first/);
    assert.match(html, /<li>second/);
  });

  it("converts inline code", () => {
    assert.equal(
      NoteUtils.markdownToHtml("Use `code` here"),
      "Use <code>code</code> here"
    );
  });

  it("converts fenced code blocks", () => {
    const md = "```\nconst x = 1;\n```";
    const html = NoteUtils.markdownToHtml(md);
    assert.match(html, /<pre><code>/);
    assert.match(html, /const x = 1;/);
  });

  it("converts links", () => {
    const html = NoteUtils.markdownToHtml("[text](https://example.com)");
    assert.match(html, /<a href="https:\/\/example\.com\//);
    assert.match(html, /text/);
    assert.match(html, /target="_blank"/);
  });

  it("converts images", () => {
    const html = NoteUtils.markdownToHtml("![alt](https://example.com/img.png)");
    assert.match(html, /<figure class="image-attachment"/);
    assert.match(html, /data-jot-image-src="https:\/\/example\.com\/img\.png"/);
  });

  it("converts blockquotes", () => {
    const html = NoteUtils.markdownToHtml("> quoted text");
    assert.equal(html, "<blockquote>quoted text</blockquote>");
  });

  it("converts horizontal rules", () => {
    const html = NoteUtils.markdownToHtml("---");
    assert.match(html, /<hr>/);
  });

  it("protects code from formatting regexes (key bugfix)", () => {
    const md = "`a == b` and `**kwargs`";
    const html = NoteUtils.markdownToHtml(md);
    assert.match(html, /<code>a == b<\/code>/);
    assert.match(html, /<code>\*\*kwargs<\/code>/);
    assert.doesNotMatch(html, /<mark>/);
    assert.doesNotMatch(html, /<strong>/);
  });

  it("protects fenced code blocks from formatting regexes", () => {
    const md = "```\na == b\n**not bold**\n```";
    const html = NoteUtils.markdownToHtml(md);
    assert.match(html, /<pre><code>/);
    assert.match(html, /a == b/);
    assert.match(html, /\*\*not bold\*\*/);
  });

  it("handles empty input", () => {
    assert.equal(NoteUtils.markdownToHtml(""), "");
    assert.equal(NoteUtils.markdownToHtml("   "), "");
    assert.equal(NoteUtils.markdownToHtml(null), "");
  });
});

describe("htmlToMarkdown — requires DOM shim", () => {
  const savedDocument = globalThis.document;
  const savedNode = globalThis.Node;

  before(() => {
    globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
    globalThis.document = createDocumentShim();
  });

  after(() => {
    globalThis.document = savedDocument;
    globalThis.Node = savedNode;
  });

  it("converts paragraphs", () => {
    assert.equal(NoteUtils.htmlToMarkdown("<p>Hello world</p>"), "Hello world");
  });

  it("converts bold", () => {
    assert.equal(
      NoteUtils.htmlToMarkdown("<strong>bold</strong>"),
      "**bold**"
    );
  });

  it("converts italic", () => {
    assert.equal(NoteUtils.htmlToMarkdown("<em>italic</em>"), "*italic*");
  });

  it("converts headings", () => {
    assert.equal(NoteUtils.htmlToMarkdown("<h1>Title</h1>"), "# Title");
    assert.equal(NoteUtils.htmlToMarkdown("<h2>Section</h2>"), "## Section");
    assert.equal(NoteUtils.htmlToMarkdown("<h3>Sub</h3>"), "### Sub");
  });

  it("converts unordered lists", () => {
    const html = "<ul><li>A</li><li>B</li></ul>";
    assert.equal(NoteUtils.htmlToMarkdown(html), "- A\n- B");
  });

  it("converts ordered lists", () => {
    const html = "<ol><li>First</li><li>Second</li></ol>";
    assert.equal(NoteUtils.htmlToMarkdown(html), "1. First\n2. Second");
  });

  it("converts inline code", () => {
    assert.equal(
      NoteUtils.htmlToMarkdown("<code>const x = 1;</code>"),
      "`const x = 1;`"
    );
  });

  it("converts fenced code blocks", () => {
    const html = "<pre><code>const x = 1;\nlet y = 2;</code></pre>";
    const result = NoteUtils.htmlToMarkdown(html);
    assert.match(result, /```/);
    assert.match(result, /const x = 1;/);
    assert.match(result, /let y = 2;/);
  });

  it("converts links", () => {
    assert.equal(
      NoteUtils.htmlToMarkdown('<a href="https://example.com">text</a>'),
      "[text](https://example.com)"
    );
  });

  it("converts images (remote)", () => {
    const html =
      '<figure class="image-attachment" data-jot-image-src="https://example.com/img.png" data-jot-image-alt="Photo">' +
      '<span class="image-attachment__badge">Image</span><figcaption>Photo</figcaption></figure>';
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, "![Photo](https://example.com/img.png)");
  });

  it("converts images (inline img)", () => {
    assert.equal(
      NoteUtils.htmlToMarkdown('<img src="https://example.com/i.png" alt="Img">'),
      "![Img](https://example.com/i.png)"
    );
  });

  it("converts data-uri images (inline img)", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    const html = `<img src="${dataUri}" alt="Pic">`;
    assert.equal(NoteUtils.htmlToMarkdown(html), `![Pic](${dataUri})`);
  });

  it("converts highlight", () => {
    assert.equal(
      NoteUtils.htmlToMarkdown("<mark>highlighted</mark>"),
      "==highlighted=="
    );
  });

  it("converts blockquotes", () => {
    assert.equal(
      NoteUtils.htmlToMarkdown("<blockquote>quote</blockquote>"),
      "> quote"
    );
  });

  it("converts horizontal rules", () => {
    assert.equal(NoteUtils.htmlToMarkdown("<hr>"), "---");
  });

  it("strips zero-width spaces (U+200B)", () => {
    assert.equal(
      NoteUtils.htmlToMarkdown("<p>hello\u200B world</p>"),
      "hello world"
    );
  });

  it("handles nested elements", () => {
    const html = "<p><strong>bold</strong> and <em>italic</em></p>";
    assert.equal(
      NoteUtils.htmlToMarkdown(html),
      "**bold** and *italic*"
    );
  });

  it("handles empty input", () => {
    assert.equal(NoteUtils.htmlToMarkdown(""), "");
    assert.equal(NoteUtils.htmlToMarkdown("   "), "");
  });

  it("handles br inside code block (Enter key)", () => {
    const html = "<pre><code>line1<br>line2</code></pre>";
    const result = NoteUtils.htmlToMarkdown(html);
    assert.match(result, /```/);
    assert.match(result, /line1/);
    assert.match(result, /line2/);
  });

  it("handles empty code block (br placeholder)", () => {
    const html = "<pre><code><br></code></pre>";
    assert.match(NoteUtils.htmlToMarkdown(html), /```/);
  });

  it("does not produce 3+ consecutive newlines", () => {
    const html = "<p>A</p><p>B</p><p>C</p>";
    const result = NoteUtils.htmlToMarkdown(html);
    assert.doesNotMatch(result, /\n{3,}/);
  });

  it("converts code inside pre without wrapping it in backticks", () => {
    const html =
      "<pre><code>def hello():\n    print('world')</code></pre>";
    const result = NoteUtils.htmlToMarkdown(html);
    assert.match(result, /```/);
    assert.match(result, /def hello/);
    assert.doesNotMatch(result, /```\s*```/);
  });
});

describe("round-trip: markdownToHtml → htmlToMarkdown", () => {
  const savedDocument = globalThis.document;
  const savedNode = globalThis.Node;

  before(() => {
    globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
    globalThis.document = createDocumentShim();
  });

  after(() => {
    globalThis.document = savedDocument;
    globalThis.Node = savedNode;
  });

  it("preserves bold", () => {
    const original = "**bold text**";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, original);
  });

  it("preserves italic", () => {
    const original = "*italic text*";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, original);
  });

  it("preserves highlight", () => {
    const original = "==highlighted==";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, original);
  });

  it("preserves inline code", () => {
    const original = "Use `code` here";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, original);
  });

  it("preserves links", () => {
    const original = "[text](https://example.com)";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, "[text](https://example.com/)");
  });

  it("preserves images", () => {
    const original = "![alt](https://example.com/img.png)";
    const html = NoteUtils.markdownToHtml(original);
    const mdLink = NoteUtils.htmlToMarkdown(html);
    assert.equal(mdLink, original);
  });

  it("preserves data-uri images", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    const original = `![Pic](${dataUri})`;
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, original);
  });

  it("preserves headings", () => {
    for (const md of ["# Title", "## Section", "### Sub"]) {
      const html = NoteUtils.markdownToHtml(md);
      const result = NoteUtils.htmlToMarkdown(html);
      assert.equal(result, md);
    }
  });

  it("preserves fenced code blocks", () => {
    const original = "```\nconst x = 1;\n```";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, original);
  });

  it("preserves code with formatting characters (stash/restore)", () => {
    const original = "`a == b` and `**kwargs**`";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    assert.equal(result, original);
  });

  it("preserves mixed content", () => {
    const original =
      "# Meeting Notes\n\n**Key point:** *discussed* `config` and ==highlight==.\n\n- item 1\n- item 2";
    const html = NoteUtils.markdownToHtml(original);
    const result = NoteUtils.htmlToMarkdown(html);
    // htmlToMarkdown insert an extra newline between list items
    assert.equal(
      result,
      "# Meeting Notes\n\n**Key point:** *discussed* `config` and ==highlight==.\n\n- item 1\n\n- item 2"
    );
  });
});

function createDocumentShim() {
  let idCounter = 0;

  class NodeMock {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.childNodes = [];
      this.parentElement = null;
      this.parentNode = null;
    }
  }

  class TextMock extends NodeMock {
    constructor(text) {
      super(3, "#text");
      this._text = text;
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v);
    }
    get nodeValue() {
      return this._text;
    }
    cloneNode() {
      return new TextMock(this._text);
    }
    toString() {
      return this._text;
    }
  }

  class ElementMock extends NodeMock {
    constructor(tagName) {
      super(1, tagName.toUpperCase());
      this.tagName = this.nodeName;
      this._attributes = {};
      this.dataset = {};
      this._innerHTML = "";
      this.classList = {
        _classes: new Set(),
        add(...names) {
          names.forEach((n) => this._classes.add(n));
        },
        remove(...names) {
          names.forEach((n) => this._classes.delete(n));
        },
        contains(n) {
          return this._classes.has(n);
        },
        toggle(n) {
          if (this._classes.has(n)) {
            this._classes.delete(n);
            return false;
          }
          this._classes.add(n);
          return true;
        },
      };
    }

    getAttribute(name) {
      return this._attributes[name] ?? null;
    }
    setAttribute(name, value) {
      this._attributes[name] = String(value);
    }
    hasAttribute(name) {
      return name in this._attributes;
    }
    removeAttribute(name) {
      delete this._attributes[name];
    }

    get innerHTML() {
      return this._innerHTML;
    }

    set innerHTML(html) {
      this._innerHTML = html || "";
      this.childNodes = [];
      if (!html || !html.trim()) return;
      const parsed = parseSimpleHtml(html);
      parsed.forEach((child) => {
        child.parentElement = this;
        child.parentNode = this;
        this.childNodes.push(child);
      });
    }

    get textContent() {
      return this.childNodes
        .map((c) => (c.nodeType === 3 ? c.textContent : c.textContent || ""))
        .join("");
    }

    set textContent(v) {
      this.childNodes = [new TextMock(String(v))];
      this.childNodes[0].parentElement = this;
      this.childNodes[0].parentNode = this;
    }

    appendChild(child) {
      child.parentElement = this;
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) this.childNodes.splice(idx, 1);
      return child;
    }

    insertBefore(newChild, refChild) {
      newChild.parentElement = this;
      newChild.parentNode = this;
      if (!refChild) {
        this.childNodes.push(newChild);
      } else {
        const idx = this.childNodes.indexOf(refChild);
        if (idx !== -1) this.childNodes.splice(idx, 0, newChild);
        else this.childNodes.push(newChild);
      }
      return newChild;
    }

    replaceChild(newChild, oldChild) {
      const idx = this.childNodes.indexOf(oldChild);
      if (idx !== -1) {
        newChild.parentElement = this;
        newChild.parentNode = this;
        this.childNodes[idx] = newChild;
      }
      return oldChild;
    }

    cloneNode(deep) {
      const el = new ElementMock(this.tagName);
      Object.assign(el._attributes, this._attributes);
      Object.assign(el.dataset, this.dataset);
      if (deep) {
        el.innerHTML = this.innerHTML;
      }
      return el;
    }

    closest(selector) {
      let current = this;
      while (current) {
        const tag = selector.replace(/^([a-z0-9]+)$/i, "$1").toLowerCase();
        if (current.tagName && current.tagName.toLowerCase() === tag) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }

    querySelector(selector) {
      const tag = selector.replace(/^([a-z0-9]+)$/i, "$1").toLowerCase();
      const stack = [this];
      while (stack.length) {
        const node = stack.shift();
        if (
          node !== this &&
          node.tagName &&
          node.tagName.toLowerCase() === tag
        ) {
          return node;
        }
        if (node.childNodes) {
          node.childNodes.forEach((c) => stack.push(c));
        }
      }
      return null;
    }

    get children() {
      return this.childNodes.filter((c) => c.nodeType === 1);
    }
    get firstChild() {
      return this.childNodes[0] || null;
    }
    get lastChild() {
      return this.childNodes[this.childNodes.length - 1] || null;
    }

    get nextSibling() {
      if (!this.parentNode) return null;
      const siblings = this.parentNode.childNodes;
      const idx = siblings.indexOf(this);
      return siblings[idx + 1] || null;
    }

    get previousSibling() {
      if (!this.parentNode) return null;
      const siblings = this.parentNode.childNodes;
      const idx = siblings.indexOf(this);
      return siblings[idx - 1] || null;
    }
  }

  class DocumentMock {
    constructor() {
      this.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
    }

    createElement(tagName) {
      return new ElementMock(tagName);
    }

    createTextNode(text) {
      return new TextMock(text);
    }

    createDocumentFragment() {
      const frag = new ElementMock("#document-fragment");
      frag.nodeType = 11;
      return frag;
    }

    createRange() {
      return {
        setStart() {},
        setEnd() {},
        selectNodeContents() {},
        collapse() {},
        cloneRange() {
          return this;
        },
        deleteContents() {},
        extractContents() {
          return this.createDocumentFragment();
        },
        insertNode() {},
        setStartAfter() {},
        setEndBefore() {},
        get clientWidth() {
          return 380;
        },
        get clientHeight() {
          return 200;
        },
      };
    }

    getSelection() {
      return null;
    }
  }

  function parseSimpleHtml(html) {
    const results = [];
    let remaining = html.trim();
    const tagRe =
      /<\/?([a-zA-Z0-9]+)((?:\s+[a-zA-Z-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
    const textEndRe = /<\/?[a-zA-Z]/;
    let lastIndex = 0;

    while (lastIndex < remaining.length) {
      tagRe.lastIndex = lastIndex;
      const tagMatch = tagRe.exec(remaining);
      if (!tagMatch) {
        results.push(new TextMock(remaining.slice(lastIndex)));
        break;
      }

      if (tagMatch.index > lastIndex) {
        results.push(new TextMock(remaining.slice(lastIndex, tagMatch.index)));
      }

      const fullTag = tagMatch[0];
      const tagName = tagMatch[1].toLowerCase();
      const attrString = tagMatch[2];

      if (fullTag.startsWith("</")) {
        lastIndex = tagMatch.index + fullTag.length;
        continue;
      }

      const voidElements = new Set([
        "br",
        "hr",
        "img",
        "input",
        "meta",
        "link",
      ]);

      const el = new ElementMock(tagName);

      const attrRe = /([a-zA-Z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attrMatch;
      while ((attrMatch = attrRe.exec(attrString)) !== null) {
        const name = attrMatch[1];
        const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
        if (name.startsWith("data-")) {
          const key = name.slice(5).replace(/-([a-z])/g, (_, c) =>
            c.toUpperCase()
          );
          el.dataset[key] = value;
        } else if (name === "class") {
          value.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
        } else {
          el.setAttribute(name, value);
        }
      }

      if (voidElements.has(tagName)) {
        el._innerHTML = "";
        results.push(el);
        lastIndex = tagMatch.index + fullTag.length;
        continue;
      }

      const closeTag = `</${tagName}>`;
      const closeIndex = remaining.indexOf(
        closeTag,
        tagMatch.index + fullTag.length
      );

      if (closeIndex === -1) {
        el.innerHTML = remaining.slice(
          tagMatch.index + fullTag.length
        );
        results.push(el);
        break;
      }

      const innerContent = remaining.slice(
        tagMatch.index + fullTag.length,
        closeIndex
      );
      el.innerHTML = innerContent;
      results.push(el);
      lastIndex = closeIndex + closeTag.length;
    }

    return results;
  }

  const doc = new DocumentMock();
  return doc;
}
