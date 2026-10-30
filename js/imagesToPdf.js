import { wireDrop, nextFrame, showAlert, ensurePdfLib, ensureJsZip } from "./main.js";

console.log("Loaded: Images → PDF Tool (Measured Target Size)");

const dzImgs = document.getElementById("dz-imgs");
const inpImgs = document.getElementById("inp-imgs");
const ctrlImgs = document.getElementById("ctrl-imgs");
const imgStatus = document.getElementById("img-status");
const btnImgsConvert = document.getElementById("btn-imgs-convert");
const btnImgsReset = document.getElementById("btn-imgs-reset");
const paperSizeSelect = document.getElementById("img-page");
const fitModeSelect = document.getElementById("img-fitmode");
const desiredSizeInput = document.getElementById("desired-size");
const desiredUnitSelect = document.getElementById("desired-unit");

const MIN_TARGET_QUALITY = 0.08;
const MAX_TARGET_QUALITY = 0.97;
const TARGET_SEARCH_STEPS = 7;
const MAX_IMAGE_PIXELS = 16000000;

let btnImgsDownload = null;
let activeDownloadUrl = null;
let selectedImages = [];
let isConverting = false;

if (!dzImgs || !inpImgs) {
  console.warn("Missing UI elements for Images to PDF.");
} else {
  wireDrop(dzImgs, inpImgs);

  if (btnImgsConvert) {
    btnImgsConvert.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold px-4 py-3 rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 min-h-[48px]";
    btnImgsConvert.innerHTML =
      '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg><span>Convert to PDF</span>';
  }

  if (btnImgsReset) {
    btnImgsReset.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm min-h-[48px]";
    btnImgsReset.innerHTML =
      '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg><span>Reset</span>';
  }

  inpImgs.addEventListener("change", () => {
    const files = Array.from(inpImgs.files || []);
    selectedImages = files.filter(file => file.type.startsWith("image/"));

    if (!selectedImages.length) {
      resetUI();
      showAlert("Please select valid image files.", "error");
      return;
    }

    ctrlImgs?.classList.remove("hidden");

    const outputModeSection = document.querySelector(".bg-gradient-to-r.from-amber-50");
    if (outputModeSection) {
      if (selectedImages.length === 1) {
        outputModeSection.classList.add("hidden");
        const combinedRadio = document.getElementById("pdf-mode-combined");
        if (combinedRadio) combinedRadio.checked = true;
      } else {
        outputModeSection.classList.remove("hidden");
      }
    }

    imgStatus.innerHTML =
      '<div class="text-center px-3 py-2"><span class="text-emerald-500 font-bold text-2xl">' +
      selectedImages.length +
      '</span> <span class="text-gray-700 text-base">image(s) ready</span></div>';
    removeDownloadButton();
  });

  btnImgsReset?.addEventListener("click", resetUI);

  btnImgsConvert?.addEventListener("click", async () => {
    if (!selectedImages.length) {
      showAlert("Select some images first.", "warning");
      return;
    }

    btnImgsConvert.disabled = true;
    if (btnImgsReset) btnImgsReset.disabled = true;
    inpImgs.disabled = true;
    isConverting = true;
    try {
      await ensurePdfLib();
      if (!window.PDFLib?.PDFDocument) {
        throw new Error("The PDF library did not initialize correctly.");
      }
      const pdfMode =
        document.querySelector('input[name="pdf-mode"]:checked')?.value || "combined";

      if (pdfMode === "individual") {
        await generateIndividualPDFs();
      } else {
        await generateCombinedPDF();
      }
    } catch (error) {
      console.error("Images to PDF failed:", error);
      imgStatus.textContent = "Could not create the PDF: " + (error?.message || "Unknown error");
      showAlert(error?.message || "PDF creation failed.", "error");
    } finally {
      isConverting = false;
      btnImgsConvert.disabled = false;
      if (btnImgsReset) btnImgsReset.disabled = false;
      inpImgs.disabled = false;
    }
  });
}

function readTargetBytes() {
  const mode = document.querySelector('input[name="size-mode"]:checked')?.value || "original";
  if (mode !== "desired") return null;

  const value = Number.parseFloat(desiredSizeInput?.value || "");
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Enter a valid target PDF size greater than zero.");
  }

  const unit = desiredUnitSelect?.value || "MB";
  const bytes = unit === "KB" ? value * 1024 : value * 1024 * 1024;
  if (!Number.isFinite(bytes) || bytes < 1) {
    throw new Error("The target file size is too small.");
  }
  return bytes;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getPageSettings() {
  return {
    paper: paperSizeSelect?.value || "A4",
    fitMode: fitModeSelect?.value || "fit"
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image: " + file.name));
    };
    image.src = objectUrl;
  });
}

async function imageToBlob(image, quality, scale, forceJpeg) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const safetyScale = Math.min(1, Math.sqrt(MAX_IMAGE_PIXELS / (sourceWidth * sourceHeight)));
  const effectiveScale = Math.min(scale, safetyScale);
  const width = Math.max(1, Math.round(sourceWidth * effectiveScale));
  const height = Math.max(1, Math.round(sourceHeight * effectiveScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: !forceJpeg });
  if (!context) throw new Error("Your browser could not create an image canvas.");

  const preservePng = !forceJpeg && image._docMintMime === "image/png";
  const mime = preservePng ? "image/png" : "image/jpeg";

  if (mime === "image/jpeg") {
    // PDF pages are white by default; flatten transparency against white.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise(resolve => {
    if (mime === "image/png") canvas.toBlob(resolve, mime);
    else canvas.toBlob(resolve, mime, quality);
  });

  if (!blob) throw new Error("The browser could not encode an image.");
  return blob;
}

async function prepareImages(files) {
  const prepared = [];
  for (const file of files) {
    const image = await loadImage(file);
    image._docMintMime = file.type.toLowerCase();
    prepared.push({ file, image });
  }
  return prepared;
}

async function buildPdfCandidate(images, settings) {
  const PDFDocument = window.PDFLib.PDFDocument;
  const pdfDoc = await PDFDocument.create();
  const paperSizes = {
    A4: [595.28, 841.89],
    A3: [841.89, 1190.55],
    Letter: [612, 792],
    Legal: [612, 1008]
  };

  for (let index = 0; index < images.length; index++) {
    const entry = images[index];
    const imageBlob = await imageToBlob(
      entry.image,
      settings.quality,
      settings.scale,
      settings.targetMode
    );
    const imageBytes = await imageBlob.arrayBuffer();
    const pdfImage = imageBlob.type === "image/jpeg"
      ? await pdfDoc.embedJpg(imageBytes)
      : await pdfDoc.embedPng(imageBytes);

    const sourceWidth = entry.image.naturalWidth || entry.image.width;
    const sourceHeight = entry.image.naturalHeight || entry.image.height;
    const pageSize = paperSizes[settings.paper] || [sourceWidth, sourceHeight];
    const pageWidth = pageSize[0];
    const pageHeight = pageSize[1];
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    let drawWidth = pdfImage.width;
    let drawHeight = pdfImage.height;

    if (paperSizes[settings.paper]) {
      if (settings.fitMode === "fit") {
        const scale = Math.min(pageWidth / drawWidth, pageHeight / drawHeight);
        drawWidth *= scale;
        drawHeight *= scale;
      } else if (settings.fitMode === "stretch") {
        drawWidth = pageWidth;
        drawHeight = pageHeight;
      }
    } else {
      // Keep Auto page dimensions stable even when the image is downscaled.
      drawWidth = pageWidth;
      drawHeight = pageHeight;
    }

    page.drawImage(pdfImage, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    });
    await nextFrame();
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes], { type: "application/pdf" });
}

async function optimizePdfToTarget(images, targetBytes, pageSettings) {
  let bestUnderTarget = null;
  let smallestCandidate = null;

  async function measure(quality, scale) {
    imgStatus.innerHTML =
      '<div class="text-center px-3 py-3"><span class="text-violet-600 font-semibold">Optimizing PDF size…</span><div class="text-sm text-gray-600 mt-1">Testing quality ' +
      Math.round(quality * 100) +
      '% at ' +
      Math.round(scale * 100) +
      '% resolution</div></div>';

    const blob = await buildPdfCandidate(images, {
      ...pageSettings,
      quality,
      scale,
      targetMode: true
    });
    const candidate = { blob, quality, scale };

    if (!smallestCandidate || blob.size < smallestCandidate.blob.size) {
      smallestCandidate = candidate;
    }
    if (blob.size <= targetBytes &&
        (!bestUnderTarget || blob.size > bestUnderTarget.blob.size)) {
      bestUnderTarget = candidate;
    }
    return candidate;
  }

  // First check whether the original resolution already fits at high quality.
  const highQuality = await measure(MAX_TARGET_QUALITY, 1);
  if (highQuality.blob.size <= targetBytes) {
    return { ...highQuality, result: "source-smaller" };
  }

  // If even very low JPEG quality is too large, reduce pixel dimensions too.
  let scale = 1;
  let lowQuality = await measure(MIN_TARGET_QUALITY, scale);
  let downscaleAttempts = 0;
  let lastTooLargeScale = null;

  while (lowQuality.blob.size > targetBytes && scale > 0.04 && downscaleAttempts < 6) {
    lastTooLargeScale = scale;
    const ratio = Math.sqrt(targetBytes / lowQuality.blob.size) * 0.9;
    const nextScale = Math.max(0.04, scale * Math.min(0.9, ratio));
    if (nextScale >= scale) break;
    scale = nextScale;
    lowQuality = await measure(MIN_TARGET_QUALITY, scale);
    downscaleAttempts++;
  }

  if (lowQuality.blob.size > targetBytes) {
    return { ...smallestCandidate, result: "unreachable" };
  }

  // Refine the resolution so we do not downscale more than necessary.
  if (lastTooLargeScale !== null) {
    let fittingScale = scale;
    let oversizedScale = lastTooLargeScale;
    for (let attempt = 0; attempt < 5; attempt++) {
      const middleScale = (fittingScale + oversizedScale) / 2;
      const candidate = await measure(MIN_TARGET_QUALITY, middleScale);
      if (candidate.blob.size <= targetBytes) {
        fittingScale = middleScale;
        lowQuality = candidate;
      } else {
        oversizedScale = middleScale;
      }
    }
    scale = fittingScale;
  }

  // Binary-search JPEG quality and retain the largest PDF that stays at/below the target.
  let low = MIN_TARGET_QUALITY;
  let high = MAX_TARGET_QUALITY;

  for (let attempt = 0; attempt < TARGET_SEARCH_STEPS; attempt++) {
    const quality = (low + high) / 2;
    const candidate = await measure(quality, scale);

    if (candidate.blob.size <= targetBytes) {
      low = quality;
    } else {
      high = quality;
    }

    if (bestUnderTarget &&
        targetBytes - bestUnderTarget.blob.size <= targetBytes * 0.002) {
      break;
    }
  }

  if (bestUnderTarget) return { ...bestUnderTarget, result: "best-under-target" };
  return { ...smallestCandidate, result: "unreachable" };
}

function makeUniqueFileName(fileName, usedNames) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }

  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";
  let counter = 2;
  let candidate = base + " (" + counter + ")" + extension;
  while (usedNames.has(candidate)) {
    counter++;
    candidate = base + " (" + counter + ")" + extension;
  }
  usedNames.add(candidate);
  return candidate;
}

function targetResultMessage(result, targetBytes) {
  const actual = result.blob.size;
  const targetText = formatBytes(targetBytes);
  const actualText = formatBytes(actual);

  if (actual > targetBytes) {
    return "The requested target (" + targetText +
      ") is too small for these images. The smallest generated PDF is " +
      actualText + ". Try a larger target.";
  }

  if (result.result === "source-smaller") {
    return "Output: " + actualText + " · Target: " + targetText +
      ". The images already fit at high quality, so they were not degraded just to fill the target.";
  }

  const difference = (targetBytes - actual) / targetBytes;
  if (difference <= 0.05) {
    return "Output: " + actualText + " · Target: " + targetText +
      ". Target matched closely without exceeding it.";
  }

  return "Output: " + actualText + " · Target: " + targetText +
    ". This is the closest result found below the target. The PDF is not padded with artificial data.";
}

function setSuccessStatus(title, details) {
  imgStatus.innerHTML =
    '<div class="flex flex-col items-center gap-1 text-center">' +
    '<div class="flex flex-wrap items-center justify-center gap-2 text-emerald-600 font-semibold text-lg">' +
    '<svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' +
    escapeHtml(title) +
    '</div><div class="text-sm text-gray-700">' + details + '</div></div>';
}

function resetUI() {
  if (isConverting) return;
  inpImgs.value = "";
  ctrlImgs?.classList.add("hidden");
  imgStatus.textContent = "";
  selectedImages = [];
  removeDownloadButton();

  const outputModeSection = document.querySelector(".bg-gradient-to-r.from-amber-50");
  if (outputModeSection) outputModeSection.classList.add("hidden");
}

function showDownloadButton(url, isZip = false) {
  removeDownloadButton();
  btnImgsDownload = document.createElement("a");
  btnImgsDownload.href = url;
  btnImgsDownload.download = isZip
    ? "Individual_PDFs_" + Date.now() + ".zip"
    : "Images_" + Date.now() + ".pdf";
  btnImgsDownload.innerHTML =
    '<span class="flex flex-wrap items-center justify-center gap-2 w-full"><svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span class="text-base">' +
    (isZip ? "Download ZIP" : "Download PDF") +
    "</span></span>";
  btnImgsDownload.className =
    "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold px-4 py-3 rounded-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 animate-fade-in min-h-[48px]";
  btnImgsDownload.id = "btn-imgs-download";

  const buttonContainer = btnImgsConvert.parentElement;
  if (buttonContainer) buttonContainer.appendChild(btnImgsDownload);

  activeDownloadUrl = url;
}

function removeDownloadButton() {
  if (btnImgsDownload) {
    btnImgsDownload.remove();
    btnImgsDownload = null;
  }
  if (activeDownloadUrl) {
    URL.revokeObjectURL(activeDownloadUrl);
    activeDownloadUrl = null;
  }
}

async function generateCombinedPDF() {
  const targetBytes = readTargetBytes();
  const images = await prepareImages(selectedImages);
  const pageSettings = getPageSettings();

  let result;
  if (targetBytes) {
    result = await optimizePdfToTarget(images, targetBytes, pageSettings);
  } else {
    const blob = await buildPdfCandidate(images, {
      ...pageSettings,
      quality: 0.9,
      scale: 1,
      targetMode: false
    });
    result = { blob, result: "original" };
  }

  const url = URL.createObjectURL(result.blob);
  showDownloadButton(url);

  const details = targetBytes
    ? escapeHtml(targetResultMessage(result, targetBytes))
    : "Final PDF size: " + escapeHtml(formatBytes(result.blob.size));
  setSuccessStatus("PDF ready to download!", details);
}

async function generateIndividualPDFs() {
  const downloadMethod =
    document.querySelector('input[name="download-method"]:checked')?.value || "separate";
  const targetBytes = readTargetBytes();
  const pageSettings = getPageSettings();
  const pdfBlobs = [];
  const reports = [];
  const usedFileNames = new Set();

  for (let index = 0; index < selectedImages.length; index++) {
    const file = selectedImages[index];
    const images = await prepareImages([file]);
    let result;

    if (targetBytes) {
      result = await optimizePdfToTarget(images, targetBytes, pageSettings);
    } else {
      const blob = await buildPdfCandidate(images, {
        ...pageSettings,
        quality: 0.9,
        scale: 1,
        targetMode: false
      });
      result = { blob, result: "original" };
    }

    const fileName = makeUniqueFileName(
      file.name.replace(/\.[^/.]+$/, "") + ".pdf",
      usedFileNames
    );
    pdfBlobs.push({ blob: result.blob, name: fileName });

    const detail = targetBytes
      ? targetResultMessage(result, targetBytes)
      : "Output: " + formatBytes(result.blob.size);
    reports.push(escapeHtml(fileName) + " — " + escapeHtml(detail));

    imgStatus.innerHTML =
      '<div class="text-center px-3 py-3"><span class="text-violet-600 font-semibold">Creating PDFs: ' +
      (index + 1) +
      " / " +
      selectedImages.length +
      "</span></div>";
    await nextFrame();
  }

  if (downloadMethod === "zip") {
    const JSZip = await ensureJsZip();

    imgStatus.innerHTML =
      '<div class="text-center px-3 py-3"><span class="text-violet-600 font-semibold">Creating ZIP file…</span></div>';

    const zip = new JSZip();
    pdfBlobs.forEach(({ blob, name }) => zip.file(name, blob));
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    showDownloadButton(url, true);

    setSuccessStatus(
      "ZIP file ready to download!",
      "The target applies to each PDF inside the ZIP, not to the ZIP's total size.<div class=\"mt-2 text-left\">" +
        reports.join("<br>") +
        "</div>"
    );
  } else {
    imgStatus.innerHTML =
      '<div class="text-center px-3 py-3"><span class="text-violet-600 font-semibold">Preparing individual downloads…</span></div>';
    await nextFrame();

    for (const item of pdfBlobs) {
      const url = URL.createObjectURL(item.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setSuccessStatus(
      pdfBlobs.length + " PDFs downloaded!",
      reports.join("<br>")
    );
  }
}
