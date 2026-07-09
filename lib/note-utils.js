(() => {
  const toLocalDateTimeValue = (date = new Date()) => {
    const pad = (num) => String(num).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDateTime = (date) =>
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);

  const sanitizeMeetingName = (name) => name.trim() || "Untitled note";

  const slugify = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 48) || "note";

  const FILENAME_DATETIME_REGEX = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

  const toSafeFilenameText = (value, fallback = "Untitled note") => {
    const base = typeof value === "string" ? value.trim() : "";
    const withFallback = base || fallback;
    return (
      withFallback
        .replace(/[\\/:*?"<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim() || fallback
    );
  };

  const buildFilename = ({ meetingName, meetingDate }) => {
    const dateValue = meetingDate || toLocalDateTimeValue();
    const matched = FILENAME_DATETIME_REGEX.exec(dateValue);
    const fallback = toLocalDateTimeValue();
    const fallbackMatched = FILENAME_DATETIME_REGEX.exec(fallback);
    const datePart = matched?.[1] || fallbackMatched?.[1] || "0000-00-00";
    const hourPart = matched?.[2] || fallbackMatched?.[2] || "00";
    const minutePart = matched?.[3] || fallbackMatched?.[3] || "00";
    const safeTitle = toSafeFilenameText(sanitizeMeetingName(meetingName || ""));
    return `${datePart} - h${hourPart}:${minutePart} - ${safeTitle}.md`;
  };

  const getActiveTab = () =>
    new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome?.tabs) {
        resolve(null);
        return;
      }
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        if (tabs && tabs.length) {
          resolve(tabs[0]);
          return;
        }
        chrome.tabs.query({ active: true }, (fallbackTabs) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(fallbackTabs && fallbackTabs.length ? fallbackTabs[0] : null);
        });
      });
    });

  const normalizeUrl = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^(chrome|chrome-extension|edge|about|file|view-source):/i.test(trimmed)) {
      return null;
    }
    if (/^mailto:/i.test(trimmed)) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (["http:", "https:"].includes(parsed.protocol)) {
        return parsed.toString();
      }
      return null;
    } catch (error) {
      // fall through
    }

    try {
      if (trimmed.includes("://")) return null;
      const parsed = new URL(`https://${trimmed}`);
      return parsed.toString();
    } catch (error) {
      return null;
    }
  };

  const SUPPORTED_IMAGE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
  ]);

  const SUPPORTED_IMAGE_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "avif",
  ]);

  const escapeAttribute = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const escapeMarkdownLabel = (value) =>
    String(value || "Image").replace(/[\[\]\n\r]/g, " ").trim() || "Image";

  const getImageExtensionFromUrl = (value) => {
    try {
      const parsed = new URL(value);
      const extension = parsed.pathname.split(".").pop()?.toLowerCase() || "";
      return SUPPORTED_IMAGE_EXTENSIONS.has(extension) ? extension : "";
    } catch (error) {
      return "";
    }
  };

  const normalizeImageSrc = (value) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const dataMatch = /^data:(image\/[a-z0-9.+-]+);base64,[a-z0-9+/=\s]+$/i.exec(trimmed);
    if (dataMatch) {
      const mimeType = dataMatch[1].toLowerCase();
      return SUPPORTED_IMAGE_TYPES.has(mimeType) ? trimmed.replace(/\s/g, "") : null;
    }
    const normalized = normalizeUrl(trimmed);
    if (!normalized) return null;
    return normalized;
  };

  const createImageHtml = (alt, src) => {
    const safeSrc = normalizeImageSrc(src);
    if (!safeSrc) return escapeMarkdownLabel(alt);
    const safeAlt = escapeAttribute(escapeMarkdownLabel(alt));
    if (/^data:/i.test(safeSrc)) {
      return `<img src="${escapeAttribute(safeSrc)}" alt="${safeAlt}">`;
    }
    return `<figure class="image-attachment" contenteditable="false" data-jot-image-src="${escapeAttribute(
      safeSrc
    )}" data-jot-image-alt="${safeAlt}"><span class="image-attachment__badge">Image</span><figcaption>${safeAlt}</figcaption></figure>`;
  };

  const htmlToMarkdown = (html) => {
    if (!html || !html.trim()) return "";
    if (typeof document === "undefined") {
      throw new Error("htmlToMarkdown requires a DOM.");
    }

    const temp = document.createElement("div");
    temp.innerHTML = html;

    const convert = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(convert).join("");

      switch (tag) {
        case "figure":
          if (node.dataset?.jotImageSrc) {
            const src = normalizeImageSrc(node.dataset.jotImageSrc);
            if (!src) return "";
            return `![${escapeMarkdownLabel(node.dataset.jotImageAlt || "Image")}](${src})\n`;
          }
          return `${children}\n`;
        case "img":
          const src = normalizeImageSrc(node.getAttribute("src") || node.dataset?.jotImageSrc || "");
          if (!src) return "";
          return `![${escapeMarkdownLabel(node.getAttribute("alt") || "Image")}](${src})`;
        case "strong":
        case "b":
          return `**${children}**`;
        case "em":
        case "i":
          return `*${children}*`;
        case "code":
          if (node.parentElement?.tagName.toLowerCase() === "pre") {
            return children;
          }
          return `\`${children}\``;
        case "pre":
          return `\n\`\`\`\n${children}\n\`\`\`\n`;
        case "h1":
          return `# ${children}\n`;
        case "h2":
          return `## ${children}\n`;
        case "h3":
          return `### ${children}\n`;
        case "ul":
          return `\n${children}`;
        case "ol":
          return `\n${children}`;
        case "li":
          const parent = node.parentElement;
          if (parent?.tagName.toLowerCase() === "ol") {
            const index = Array.from(parent.children).indexOf(node) + 1;
            return `${index}. ${children}\n`;
          }
          return `- ${children}\n`;
        case "blockquote":
          return children
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
        case "a":
          const href = node.getAttribute("href") || "";
          return `[${children}](${href})`;
        case "br":
          return "\n";
        case "hr":
          return "\n---\n";
        case "p":
        case "div":
          return `${children}\n`;
        default:
          return children;
      }
    };

    return convert(temp).trim().replace(/\n{3,}/g, "\n\n");
  };

  const markdownToHtml = (markdown) => {
    if (!markdown || !markdown.trim()) return "";

    let html = markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, src) => {
      const safeSrc = normalizeImageSrc(src);
      if (!safeSrc) return escapeMarkdownLabel(alt);
      return createImageHtml(alt, safeSrc);
    });
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/^\d+\. (.+)$/gm, '<li data-list="ol">$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li data-list="ul">$1</li>');
    html = html.replace(/(<li data-list="(?:ol|ul)">.*<\/li>\n?)+/g, (match) => {
      const isOrdered = match.includes('data-list="ol"');
      return `${isOrdered ? "<ol>" : "<ul>"}${match}${isOrdered ? "</ol>" : "</ul>"}`;
    });
    html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
      const safeHref = normalizeUrl(href);
      if (!safeHref) return text;
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });
    html = html.replace(/^---$/gm, "<hr>");
    html = html.replace(/\n/g, "<br>");
    html = html.replace(/<li data-list="(?:ol|ul)">/g, "<li>");

    return html;
  };

  const api = {
    toLocalDateTimeValue,
    formatDateTime,
    sanitizeMeetingName,
    slugify,
    buildFilename,
    normalizeUrl,
    normalizeImageSrc,
    htmlToMarkdown,
    markdownToHtml,
    getActiveTab,
  };

  if (typeof window !== "undefined") {
    window.NoteUtils = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
