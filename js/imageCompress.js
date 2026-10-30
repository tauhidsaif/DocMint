import {
  wireDrop,
  nextFrame,
  showAlert,
  ensureJsZip
} from "./main.js";

console.log("Loaded: Image Resize/Compress Tool");

const dzCompress = document.getElementById("dz-compress");
const inpCompress = document.getElementById("inp-compress");
const ctrlCompress = document.getElementById("ctrl-compress");
const compressList = document.getElementById("compress-list");
const compressStatus = document.getElementById("compress-status");
const compressWidth = document.getElementById("compress-width");
const compressHeight = document.getElementById("compress-height");
const unitWidth = document.getElementById("compress-unit-width");
const unitHeight = document.getElementById("compress-unit-height");
const targetSize = document.getElementById("compress-target");
const targetUnit = document.getElementById("compress-target-unit");
const btnCompress = document.getElementById("btn-compress");
const btnCompressReset = document.getElementById("btn-compress-reset");
const btnCompressZip = document.getElementById("btn-compress-zip");

const MAX_CANVAS_PIXELS = 16000000;
const TARGET_QUALITY_STEPS = 7;
let compressFiles = [];
let compressedResults = [];
const objectUrls = new Set();

if (!dzCompress || !inpCompress) {
  console.warn("Image compression elements not found.");
} else {
  wireDrop(dzCompress, inpCompress);

  inpCompress.addEventListener("change", () => {
    clearOutput();
    compressFiles = Array.from(inpCompress.files || []).filter(file =>
      file.type.startsWith("image/")
    );

    if (!compressFiles.length) {
      ctrlCompress.classList.add("hidden");
      if (inpCompress.files?.length) showAlert("Select valid image files.", "error");
      return;
    }

    ctrlCompress.classList.remove("hidden");
    compressStatus.textContent = compressFiles.length + " image(s) ready to process.";
    renderInputList();
  });

  btnCompressReset?.addEventListener("click", () => {
    if (btnCompress.disabled) return;
    inpCompress.value = "";
    compressFiles = [];
    clearOutput();
    compressList.innerHTML = "";
    compressStatus.textContent = "";
    ctrlCompress.classList.add("hidden");
  });

  btnCompress?.addEventListener("click", processImages);
  btnCompressZip?.addEventListener("click", downloadZip);
}

function clearOutput() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  compressedResults = [];
  compressList.innerHTML = "";
  if (btnCompressZip) btnCompressZip.disabled = true;
}

function createObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}

function renderInputList() {
  compressList.innerHTML = "";
  for (const file of compressFiles) {
    const row = document.createElement("div");
    row.className = "flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3";
    const name = document.createElement("div");
    name.className = "min-w-0 flex-1 truncate text-sm font-medium text-gray-800";
    name.textContent = file.name;
    const size = document.createElement("span");
    size.className = "shrink-0 text-xs text-gray-500";
    size.textContent = formatBytes(file.size);
    row.append(name, size);
    compressList.appendChild(row);
  }
}

async function processImages() {
  if (!compressFiles.length) {
    showAlert("Select images first.", "warning");
    return;
  }

  let targetBytes = 0;
  try {
    const entered = Number.parseFloat(targetSize.value || "0");
    if (targetSize.value.trim() && (!Number.isFinite(entered) || entered <= 0)) {
      throw new Error("Enter a valid target file size.");
    }
    if (entered > 0) {
      targetBytes = targetUnit.value === "kb"
        ? entered * 1024
        : entered * 1024 * 1024;
    }
  } catch (error) {
    showAlert(error.message, "warning");
    return;
  }

  const widthValue = Number.parseFloat(compressWidth.value || "0");
  const heightValue = Number.parseFloat(compressHeight.value || "0");
  if ((compressWidth.value && (!Number.isFinite(widthValue) || widthValue <= 0)) ||
      (compressHeight.value && (!Number.isFinite(heightValue) || heightValue <= 0))) {
    showAlert("Width and height must be positive numbers.", "warning");
    return;
  }

  const targetWidth = convertToPx(widthValue, unitWidth.value);
  const targetHeight = convertToPx(heightValue, unitHeight.value);

  btnCompress.disabled = true;
  btnCompressReset.disabled = true;
  btnCompressZip.disabled = true;
  clearOutput();
  renderInputList();

  let failures = 0;
  let overTarget = 0;

  try {
    for (let index = 0; index < compressFiles.length; index++) {
      const file = compressFiles[index];
      let canvas = null;

      try {
        compressStatus.textContent =
          "Processing " + (index + 1) + " of " + compressFiles.length + ": " + file.name;

        const image = await loadImage(file);
        const scaled = drawScaled(image, targetWidth, targetHeight);
        canvas = scaled.canvas;

        let result;
        if (targetBytes > 0) {
          result = await compressToMaxSize(canvas, targetBytes);
        } else {
          result = {
            blob: await canvasToBlob(canvas, 0.86),
            reached: true,
            quality: 0.86,
            scale: 1
          };
        }

        if (targetBytes > 0 && result.blob.size > targetBytes) overTarget++;

        const url = createObjectUrl(result.blob);
        const outputName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        compressList.appendChild(
          makeResultCard(file, scaled.newW, scaled.newH, result, targetBytes, url, outputName)
        );
        compressedResults.push({ name: outputName, blob: result.blob });
      } catch (error) {
        failures++;
        console.error("Image processing failed:", file.name, error);
        showAlert("Could not process " + file.name + ".", "error");
      } finally {
        if (canvas) canvas.width = canvas.height = 0;
      }

      await nextFrame();
    }

    btnCompressZip.disabled = compressedResults.length === 0;
    const summary = compressedResults.length + " image(s) processed";
    const issues = [];
    if (failures) issues.push(failures + " failed");
    if (overTarget) issues.push(overTarget + " could not fit the requested size");
    compressStatus.textContent = summary + (issues.length ? " · " + issues.join(" · ") : " successfully.");
  } finally {
    btnCompress.disabled = false;
    btnCompressReset.disabled = false;
  }
}

async function compressToMaxSize(sourceCanvas, targetBytes) {
  let workingCanvas = sourceCanvas;
  let scale = 1;
  let lowQualityBlob = await canvasToBlob(workingCanvas, 0.12);

  // Lower pixel dimensions only when even low JPEG quality cannot meet the limit.
  let resizeAttempts = 0;
  while (lowQualityBlob.size > targetBytes && resizeAttempts < 6 && scale > 0.08) {
    const ratio = Math.sqrt(targetBytes / lowQualityBlob.size) * 0.88;
    const nextScale = Math.max(0.08, scale * Math.min(0.88, ratio));
    if (nextScale >= scale) break;
    scale = nextScale;
    workingCanvas = resizeCanvas(sourceCanvas, scale);
    lowQualityBlob = await canvasToBlob(workingCanvas, 0.12);
    resizeAttempts++;
  }

  if (lowQualityBlob.size > targetBytes) {
    return { blob: lowQualityBlob, reached: false, quality: 0.12, scale };
  }

  // Find the best JPEG quality that remains within the maximum size.
  let low = 0.12;
  let high = 0.92;
  let bestBlob = lowQualityBlob;
  let bestQuality = low;

  for (let attempt = 0; attempt < TARGET_QUALITY_STEPS; attempt++) {
    const quality = (low + high) / 2;
    const candidate = await canvasToBlob(workingCanvas, quality);
    if (candidate.size <= targetBytes) {
      low = quality;
      bestBlob = candidate;
      bestQuality = quality;
    } else {
      high = quality;
    }
    if (targetBytes - bestBlob.size <= targetBytes * 0.01) break;
  }

  if (workingCanvas !== sourceCanvas) {
    workingCanvas.width = workingCanvas.height = 0;
  }

  return { blob: bestBlob, reached: true, quality: bestQuality, scale };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read " + file.name));
    };
    image.src = url;
  });
}

function convertToPx(value, unit) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (unit === "mm") return value * 3.7795;
  if (unit === "cm") return value * 37.795;
  return value;
}

function drawScaled(image, width, height) {
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  let newWidth = originalWidth;
  let newHeight = originalHeight;

  if (width && height) {
    newWidth = width;
    newHeight = height;
  } else if (width) {
    newWidth = width;
    newHeight = (originalHeight / originalWidth) * width;
  } else if (height) {
    newHeight = height;
    newWidth = (originalWidth / originalHeight) * height;
  }

  // Prevent huge requested dimensions from exhausting browser memory.
  const pixelCount = newWidth * newHeight;
  if (pixelCount > MAX_CANVAS_PIXELS) {
    const factor = Math.sqrt(MAX_CANVAS_PIXELS / pixelCount);
    newWidth *= factor;
    newHeight *= factor;
  }

  newWidth = Math.max(1, Math.round(newWidth));
  newHeight = Math.max(1, Math.round(newHeight));

  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not create image canvas.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, newWidth, newHeight);
  context.drawImage(image, 0, 0, newWidth, newHeight);

  return { canvas, newW: newWidth, newH: newHeight };
}

function resizeCanvas(source, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not create resized canvas.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode this image."));
    }, "image/jpeg", quality);
  });
}

function makeResultCard(file, width, height, result, targetBytes, url, outputName) {
  const card = document.createElement("article");
  card.className =
    "flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm";

  const row = document.createElement("div");
  row.className = "flex items-center gap-3 min-w-0";
  const preview = document.createElement("img");
  preview.src = url;
  preview.alt = "Compressed preview of " + file.name;
  preview.loading = "lazy";
  preview.className = "h-16 w-16 shrink-0 rounded-xl border border-gray-200 bg-gray-50 object-cover";

  const info = document.createElement("div");
  info.className = "min-w-0 flex-1";
  const name = document.createElement("div");
  name.className = "truncate font-semibold text-gray-800";
  name.textContent = file.name;
  const dimensions = document.createElement("div");
  dimensions.className = "mt-1 text-xs text-gray-500";
  dimensions.textContent = width + " × " + height + " px";
  const size = document.createElement("div");
  size.className = "mt-1 text-xs font-semibold text-emerald-700";
  size.textContent = formatBytes(result.blob.size) +
    (targetBytes ? (result.reached ? " · within target" : " · target not reached") : "");
  info.append(name, dimensions, size);
  row.append(preview, info);

  const download = document.createElement("a");
  download.href = url;
  download.download = outputName;
  download.className =
    "flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700";
  download.textContent = "Download JPG";
  card.append(row, download);
  return card;
}

async function downloadZip() {
  if (!compressedResults.length) return;

  btnCompressZip.disabled = true;
  try {
    compressStatus.textContent = "Loading ZIP tools…";
    const JSZip = await ensureJsZip();
    const zip = new JSZip();
    compressedResults.forEach(file => zip.file(file.name, file.blob));

    const blob = await zip.generateAsync(
      { type: "blob" },
      metadata => {
        compressStatus.textContent = "Creating ZIP… " + Math.round(metadata.percent) + "%";
      }
    );
    const url = createObjectUrl(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Compressed_" + Date.now() + ".zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    compressStatus.textContent = "ZIP downloaded · " + formatBytes(blob.size);
  } catch (error) {
    console.error("ZIP creation failed:", error);
    compressStatus.textContent = "Could not create ZIP: " + (error?.message || "Unknown error");
    showAlert("Could not create the ZIP file.", "error");
  } finally {
    btnCompressZip.disabled = compressedResults.length === 0;
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}
