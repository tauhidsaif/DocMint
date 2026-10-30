import {
  wireDrop,
  nextFrame,
  toMB,
  showAlert,
  ensurePdfJs,
  ensureJsZip
} from "./main.js";

console.log("Loaded: PDF → JPG Tool");

const dzPdf = document.getElementById("dz-pdf");
const inpPdf = document.getElementById("inp-pdf");
const ctrlPdf = document.getElementById("ctrl-pdf");
const pdfStatus = document.getElementById("pdf-status");
const pdfOut = document.getElementById("pdf-output");
const btnPdfConvert = document.getElementById("btn-pdf-convert");
const btnPdfZip = document.getElementById("btn-pdf-zip");
const btnPdfReset = document.getElementById("btn-pdf-reset");
const pdfLabel = document.getElementById("dz-pdf-label");

let pdfFile = null;
let pdfGenerated = [];
const objectUrls = new Set();
const MAX_EXPORT_WIDTH = 2200;
const MAX_EXPORT_HEIGHT = 3100;
const PREVIEW_WIDTH = 520;
const PREVIEW_HEIGHT = 720;

if (!dzPdf || !inpPdf) {
  console.warn("PDF → JPG elements missing in HTML.");
} else {
  wireDrop(dzPdf, inpPdf);

  inpPdf.addEventListener("change", () => {
    const file = inpPdf.files?.[0];
    if (!file) {
      pdfLabel.textContent = "Drop a PDF here or click to choose";
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showAlert("Select a valid PDF file.", "error");
      inpPdf.value = "";
      pdfLabel.textContent = "Drop a PDF here or click to choose";
      return;
    }

    clearGenerated();
    pdfFile = file;
    ctrlPdf.classList.remove("hidden");
    pdfStatus.textContent = file.name + " · " + toMB(file.size);
    pdfLabel.textContent = file.name;
    pdfOut.innerHTML = "";
    btnPdfZip.disabled = true;
  });

  btnPdfReset?.addEventListener("click", () => {
    if (btnPdfConvert.disabled) return;
    pdfFile = null;
    clearGenerated();
    pdfOut.innerHTML = "";
    ctrlPdf.classList.add("hidden");
    pdfStatus.textContent = "";
    btnPdfZip.disabled = true;
    inpPdf.value = "";
    pdfLabel.textContent = "Drop a PDF here or click to choose";
  });

  btnPdfConvert?.addEventListener("click", async () => {
    if (!pdfFile) {
      showAlert("Choose a PDF file first.", "warning");
      return;
    }

    const sourceFile = pdfFile;
    btnPdfConvert.disabled = true;
    btnPdfZip.disabled = true;
    btnPdfReset.disabled = true;
    inpPdf.disabled = true;
    clearGenerated();
    pdfOut.innerHTML = "";

    let documentProxy = null;
    try {
      pdfStatus.textContent = "Loading PDF tools…";
      const pdfjsLib = await ensurePdfJs();
      pdfStatus.textContent = "Reading " + sourceFile.name + "…";

      const data = new Uint8Array(await sourceFile.arrayBuffer());
      documentProxy = await pdfjsLib.getDocument({ data }).promise;
      const total = documentProxy.numPages;

      if (!total) throw new Error("This PDF does not contain any pages.");

      // Render one page at a time. This avoids holding multiple large canvases at once.
      for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
        pdfStatus.textContent = "Converting page " + pageNumber + " of " + total + "…";
        const result = await renderPage(pageNumber, documentProxy, sourceFile);
        pdfGenerated.push({ name: result.name, blob: result.blob });

        pdfStatus.textContent =
          "Converted " + pageNumber + " of " + total + " pages · " +
          pdfGenerated.length + " JPGs ready";
        await nextFrame();
      }

      btnPdfZip.disabled = pdfGenerated.length === 0;
      pdfStatus.textContent =
        "Done · " + pdfGenerated.length + " page(s) converted from " + sourceFile.name;
      showAlert("PDF converted into " + pdfGenerated.length + " JPG images.", "success");
    } catch (error) {
      console.error("PDF to JPG conversion failed:", error);
      btnPdfZip.disabled = pdfGenerated.length === 0;
      pdfStatus.textContent = "Conversion failed: " + (error?.message || "Unknown error");
      showAlert("Could not convert this PDF. Try a smaller PDF or another file.", "error");
    } finally {
      try {
        await documentProxy?.destroy?.();
      } catch (error) {
        console.warn("PDF cleanup warning:", error);
      }
      btnPdfConvert.disabled = false;
      btnPdfReset.disabled = false;
      inpPdf.disabled = false;
    }
  });

  btnPdfZip?.addEventListener("click", async () => {
    if (!pdfGenerated.length) return;

    btnPdfZip.disabled = true;
    btnPdfConvert.disabled = true;
    btnPdfReset.disabled = true;
    inpPdf.disabled = true;
    try {
      pdfStatus.textContent = "Loading ZIP tools…";
      const JSZip = await ensureJsZip();
      const zip = new JSZip();
      for (const file of pdfGenerated) zip.file(file.name, file.blob);

      pdfStatus.textContent = "Creating ZIP…";
      const blob = await zip.generateAsync(
        { type: "blob" },
        metadata => {
          pdfStatus.textContent = "Creating ZIP… " + Math.round(metadata.percent) + "%";
        }
      );
      const url = createObjectUrl(blob);
      triggerDownload(url, safeBaseName(pdfFile?.name || "converted") + "_jpg.zip");
      pdfStatus.textContent = "ZIP downloaded · " + toMB(blob.size);
      showAlert("ZIP file is ready.", "success");
    } catch (error) {
      console.error("PDF to JPG ZIP failed:", error);
      pdfStatus.textContent = "Could not create ZIP: " + (error?.message || "Unknown error");
      showAlert("Could not create the ZIP file.", "error");
    } finally {
      btnPdfZip.disabled = pdfGenerated.length === 0;
      btnPdfConvert.disabled = false;
      btnPdfReset.disabled = false;
      inpPdf.disabled = false;
    }
  });
}

async function renderPage(pageNumber, documentProxy, sourceFile) {
  const page = await documentProxy.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });

  const previewScale = Math.min(
    PREVIEW_WIDTH / baseViewport.width,
    PREVIEW_HEIGHT / baseViewport.height
  );
  const previewViewport = page.getViewport({ scale: previewScale });
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = Math.max(1, Math.ceil(previewViewport.width));
  previewCanvas.height = Math.max(1, Math.ceil(previewViewport.height));

  const previewContext = previewCanvas.getContext("2d", { alpha: false });
  if (!previewContext) throw new Error("Could not create an image preview.");
  await page.render({ canvasContext: previewContext, viewport: previewViewport }).promise;

  const previewBlob = await canvasToBlob(previewCanvas, "image/jpeg", 0.68);
  const previewUrl = createObjectUrl(previewBlob);

  const exportScale = Math.min(
    MAX_EXPORT_WIDTH / baseViewport.width,
    MAX_EXPORT_HEIGHT / baseViewport.height
  );
  const exportViewport = page.getViewport({ scale: exportScale });
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, Math.ceil(exportViewport.width));
  exportCanvas.height = Math.max(1, Math.ceil(exportViewport.height));

  const exportContext = exportCanvas.getContext("2d", { alpha: false });
  if (!exportContext) throw new Error("Could not create the JPG output.");
  await page.render({ canvasContext: exportContext, viewport: exportViewport }).promise;

  // 0.92 keeps text and document edges crisp without the huge files produced at quality 1.
  const blob = await canvasToBlob(exportCanvas, "image/jpeg", 0.92);
  const name = safeBaseName(sourceFile.name) + "_" +
    String(pageNumber).padStart(3, "0") + ".jpg";

  const card = document.createElement("article");
  card.className =
    "bg-white border border-emerald-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow";
  const preview = document.createElement("img");
  preview.src = previewUrl;
  preview.alt = "Preview of page " + pageNumber;
  preview.loading = "lazy";
  preview.className = "w-full aspect-[3/4] object-contain rounded-xl bg-gray-50";

  const info = document.createElement("div");
  info.className = "mt-3 flex items-center justify-between gap-2 text-xs";
  const title = document.createElement("span");
  title.className = "font-semibold text-gray-700";
  title.textContent = "Page " + pageNumber;
  const size = document.createElement("span");
  size.className = "text-gray-500";
  size.textContent = toMB(blob.size);

  const link = document.createElement("a");
  link.href = createObjectUrl(blob);
  link.download = name;
  link.className =
    "mt-3 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors";
  link.textContent = "Download JPG";

  info.append(title, size);
  card.append(preview, info, link);
  pdfOut.appendChild(card);

  previewCanvas.width = previewCanvas.height = 0;
  exportCanvas.width = exportCanvas.height = 0;
  page.cleanup?.();

  return { index: pageNumber, name, blob };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode this page."));
    }, type, quality);
  });
}

function safeBaseName(name) {
  return String(name)
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .slice(0, 90) || "converted";
}

function createObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}

function triggerDownload(url, name) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function clearGenerated() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  pdfGenerated = [];
}
