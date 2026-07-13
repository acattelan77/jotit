import { toLocalDateTimeParts } from "./date-time.mjs";

/** Builds deterministic note packages and performs low-level local writes. */
export const createExportService = ({
  noteUtils,
  normalizePageHistory,
  chromeApi = chrome,
  fetchImpl = fetch,
  urlApi = URL,
  BlobCtor = Blob,
  decodeBase64 = atob,
  maxImageBytes = 20 * 1024 * 1024,
}) => {
  const {
    slugify,
    buildFilename,
    normalizeImageSrc,
    getImageExtension,
    sanitizeMeetingName,
    SUPPORTED_IMAGE_TYPES,
  } = noteUtils;

  const toAttachmentSafeName = (value, fallback = "image") =>
    slugify(value || fallback).replace(/^-+|-+$/g, "") || fallback;

  const dataUrlToBlob = (dataUrl) => {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(
      dataUrl || ""
    );
    if (!match) throw new Error("Unsupported image data.");
    const mimeType = match[1].toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      throw new Error("Unsupported image type.");
    }
    const binary = decodeBase64(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new BlobCtor([bytes], { type: mimeType });
  };

  const fetchRemoteAttachmentBlob = async (url) => {
    const safeUrl = normalizeImageSrc(url);
    if (!safeUrl || /^data:/i.test(safeUrl)) {
      throw new Error("Unsupported image URL.");
    }
    const response = await fetchImpl(safeUrl, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) {
      throw new Error(`Image download failed (${response.status}).`);
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxImageBytes) {
      throw new Error("Image is too large to export.");
    }
    const contentType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
      throw new Error("Downloaded file is not a supported image.");
    }

    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let receivedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > maxImageBytes) {
          await reader.cancel();
          throw new Error("Image is too large to export.");
        }
        chunks.push(value);
      }
      return new BlobCtor(chunks, { type: contentType });
    }

    const blob = await response.blob();
    if (blob.size <= maxImageBytes) return blob;
    throw new Error("Image is too large to export.");
  };

  const buildObsidianImageExport = async (markdown, noteFilename) => {
    const noteBase = toAttachmentSafeName(
      noteFilename.replace(/\.md$/i, ""),
      "note"
    );
    const attachments = [];
    const remoteBlobCache = new Map();
    const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
    let output = "";
    let lastIndex = 0;
    let match;

    while ((match = imageRegex.exec(markdown))) {
      const [fullMatch, rawAlt, rawSrc] = match;
      const src = normalizeImageSrc(rawSrc);
      if (!src) continue;
      output += markdown.slice(lastIndex, match.index);
      lastIndex = match.index + fullMatch.length;

      let blob;
      if (/^data:/i.test(src)) {
        blob = dataUrlToBlob(src);
        if (blob.size > maxImageBytes) {
          throw new Error("Image is too large to export.");
        }
      } else {
        blob = remoteBlobCache.get(src);
        if (!blob) {
          blob = await fetchRemoteAttachmentBlob(src);
          remoteBlobCache.set(src, blob);
        }
      }

      const extension = getImageExtension(src, blob.type);
      const filename = `${noteBase}-image-${attachments.length + 1}.${extension}`;
      const relativePath = `attachments/${filename}`;
      const alt = rawAlt?.trim() || "Image";
      output += `![${alt.replace(/[\[\]\n\r]/g, " ")}](${relativePath})`;
      attachments.push({ path: relativePath, blob });
    }
    output += markdown.slice(lastIndex);
    return { markdown: output, attachments };
  };

  const toYamlString = (value) => JSON.stringify(String(value || ""));
  const toYamlLinkListItem = (title, url) => {
    const safeTitle =
      String(title || url || "")
        .replace(/[\[\]\r\n]/g, " ")
        .trim() || url;
    return toYamlString(`[${safeTitle}](${url})`);
  };

  const buildYamlFrontmatter = ({ title, meetingDate, pageHistory }) => {
    const { date, time, datetime } = toLocalDateTimeParts(meetingDate);
    const pages = normalizePageHistory(pageHistory).map((entry) => ({
      title: entry.title,
      url: entry.url,
    }));
    const lines = [
      "---",
      `title: ${toYamlString(title)}`,
      `date: ${date}`,
      `time: ${toYamlString(time)}`,
      `datetime: ${toYamlString(datetime)}`,
    ];
    if (pages.length) {
      lines.push("pages_visited:");
      pages.forEach((page) => {
        lines.push(`  - ${toYamlLinkListItem(page.title, page.url)}`);
      });
    } else {
      lines.push("pages_visited: []");
    }
    lines.push("---");
    return lines.join("\n");
  };

  const buildMarkdown = ({ meetingName, meetingDate, notes, pageHistory }) => {
    const title = sanitizeMeetingName(meetingName);
    const body = notes.trim() ? `${notes.trim()}\n` : "";
    return `${buildYamlFrontmatter({
      title,
      meetingDate,
      pageHistory,
    })}\n\n# ${title}\n\n${body}`;
  };

  const toDownloadFilename = (value) => {
    const fallbackName = "note.md";
    const sanitized = (typeof value === "string" ? value : fallbackName)
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    if (!sanitized) return fallbackName;
    return /\.md$/i.test(sanitized) ? sanitized : `${sanitized}.md`;
  };

  const prepareNoteExport = async (data, { forceFolder = false } = {}) => {
    const downloadFilename = toDownloadFilename(buildFilename(data));
    const exportData = await buildObsidianImageExport(
      buildMarkdown(data),
      downloadFilename
    );
    const hasAttachments = exportData.attachments.length > 0;
    const exportRoot =
      hasAttachments || forceFolder
        ? toAttachmentSafeName(
            downloadFilename.replace(/\.md$/i, ""),
            "jot-it-note"
          )
        : "";
    return {
      downloadFilename,
      exportData,
      hasAttachments,
      exportRoot,
      noteDownloadFilename: exportRoot
        ? `${exportRoot}/${downloadFilename}`
        : downloadFilename,
    };
  };

  const downloadBlob = (
    blob,
    filename,
    { saveAs = false, conflictAction = "uniquify" } = {}
  ) =>
    new Promise((resolve, reject) => {
      const url = urlApi.createObjectURL(blob);
      chromeApi.downloads.download(
        { url, filename, saveAs, conflictAction },
        (downloadId) => {
          urlApi.revokeObjectURL(url);
          const error = chromeApi.runtime.lastError;
          if (error || !downloadId) {
            reject(error || new Error("Download did not start."));
            return;
          }
          resolve(downloadId);
        }
      );
    });

  const downloadMarkdown = (
    markdown,
    filename,
    { saveAs, conflictAction, mimeType = "text/markdown" }
  ) =>
    downloadBlob(new BlobCtor([markdown], { type: mimeType }), filename, {
      saveAs,
      conflictAction,
    });

  const downloadImageAttachments = async (attachments, exportRoot = "") => {
    for (const attachment of attachments) {
      await downloadBlob(
        attachment.blob,
        exportRoot ? `${exportRoot}/${attachment.path}` : attachment.path,
        { saveAs: false, conflictAction: "overwrite" }
      );
    }
  };

  const writeBlobFile = async (directoryHandle, filename, blob) => {
    const fileHandle = await directoryHandle.getFileHandle(filename, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
  };

  const writeTextFile = (directoryHandle, filename, text, mimeType) =>
    writeBlobFile(
      directoryHandle,
      filename,
      new BlobCtor([text], { type: mimeType })
    );

  const writeAttachmentsToDirectory = async (directoryHandle, attachments) => {
    if (!attachments.length) return;
    const attachmentsDirectory = await directoryHandle.getDirectoryHandle(
      "attachments",
      { create: true }
    );
    for (const attachment of attachments) {
      const filename = attachment.path.split("/").pop();
      if (filename) {
        await writeBlobFile(attachmentsDirectory, filename, attachment.blob);
      }
    }
  };

  return {
    buildMarkdown,
    buildObsidianImageExport,
    buildYamlFrontmatter,
    downloadImageAttachments,
    downloadMarkdown,
    prepareNoteExport,
    writeAttachmentsToDirectory,
    writeTextFile,
  };
};
