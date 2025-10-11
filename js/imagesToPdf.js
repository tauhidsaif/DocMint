import { wireDrop, nextFrame, toMB } from "./main.js";

console.log("Loaded: Images → PDF Tool (Custom Size Control)");

const dzImgs = document.getElementById("dz-imgs");
const inpImgs = document.getElementById("inp-imgs");
const ctrlImgs = document.getElementById("ctrl-imgs");
const imgStatus = document.getElementById("img-status");
const btnImgsConvert = document.getElementById("btn-imgs-convert");
const btnImgsReset = document.getElementById("btn-imgs-reset");
const imgMargin = document.getElementById("img-margin");
const paperSizeSelect = document.getElementById("img-page");
const fitModeSelect = document.getElementById("img-fitmode");

const sizeModeSelect = document.getElementById("size-mode");
const desiredSizeInput = document.getElementById("desired-size");
const desiredUnitSelect = document.getElementById("desired-unit");

let btnImgsDownload = null;
let selectedImages = [];
let generatedPdfBlob = null;

if (!dzImgs || !inpImgs) {
  console.warn("⚠️ Missing UI elements for Images→PDF Tool");
} else {
  wireDrop(dzImgs, inpImgs);

  inpImgs.addEventListener("change", () => {
    const files = Array.from(inpImgs.files || []);
    selectedImages = files.filter(f => f.type.startsWith("image/"));
    if (!selectedImages.length) {
      resetUI();
      alert("Please select valid image files.");
      return;
    }
    ctrlImgs?.classList.remove("hidden");
    imgStatus.innerHTML = `<span class="text-blue-600 font-medium">${selectedImages.length}</span> image(s) ready for conversion.`;
    removeDownloadButton();
  });

  btnImgsReset?.addEventListener("click", resetUI);

  btnImgsConvert?.addEventListener("click", async () => {
    if (!selectedImages.length) return alert("Please select some images first.");

    const { PDFDocument } = window.PDFLib || {};
    if (!PDFDocument) return alert("⚠️ PDF-LIB not loaded. Check your script imports.");

    btnImgsConvert.disabled = true;
    btnImgsConvert.classList.add("opacity-50", "cursor-not-allowed");
    imgStatus.textContent = "⏳ Converting images to PDF... Please wait.";

    const pdfDoc = await PDFDocument.create();
    const margin = Math.max(0, parseInt(imgMargin?.value || "0", 10));
    const paper = paperSizeSelect?.value || "A4";
    const fitMode = fitModeSelect?.value || "fit";

    const sizes = {
      A4: [595.28, 841.89],
      A3: [841.89, 1190.55],
      Letter: [612, 792],
      Legal: [612, 1008],
      Auto: null,
    };

    const sizeMode = sizeModeSelect?.value || "original";
    let targetBytes = null;
    if (sizeMode === "desired") {
      const target = parseFloat(desiredSizeInput?.value || "0");
      if (target > 0) {
        const unit = desiredUnitSelect?.value || "MB";
        targetBytes = unit === "KB" ? target * 1024 : target * 1024 * 1024;
      }
    }

    let quality = 0.9; // initial image compression quality
    let pdfBlob = null;

    // Try multiple compression rounds until size fits
    for (let attempt = 0; attempt < 6; attempt++) {
      const tempPdf = await PDFDocument.create();

      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        const compressedBlob = await compressImage(file, quality);
        const bytes = await compressedBlob.arrayBuffer();

        let pdfImage;
        try {
          pdfImage = compressedBlob.type === "image/jpeg"
            ? await tempPdf.embedJpg(bytes)
            : await tempPdf.embedPng(bytes);
        } catch (e) {
          console.error(`Failed to embed: ${file.name}`, e);
          continue;
        }

        const [pw, ph] = sizes[paper] || [pdfImage.width, pdfImage.height];
        const page = tempPdf.addPage([pw, ph]);

        const iw = pdfImage.width;
        const ih = pdfImage.height;
        let dw = iw, dh = ih;

        if (sizes[paper]) {
          if (fitMode === "fit") {
            const scale = Math.min((pw - margin * 2) / iw, (ph - margin * 2) / ih);
            dw = iw * scale;
            dh = ih * scale;
          } else if (fitMode === "stretch") {
            dw = pw - margin * 2;
            dh = ph - margin * 2;
          }
        }

        const x = (pw - dw) / 2;
        const y = (ph - dh) / 2;
        page.drawImage(pdfImage, { x, y, width: dw, height: dh });

        imgStatus.innerHTML = `🖼️ Processing <span class="font-semibold">${i + 1}</span> / ${selectedImages.length}`;
        await nextFrame();
      }

      const pdfBytes = await tempPdf.save();
      pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

      if (!targetBytes) break; // No size control needed

      const size = pdfBlob.size;
      console.log(`Attempt ${attempt + 1}: ${size / 1024 / 1024} MB`);

      const diff = size - targetBytes;
      if (Math.abs(diff) <= targetBytes * 0.05) {
        console.log("✅ Target size reached!");
        break;
      }

      if (diff > 0) quality = Math.max(0.3, quality - 0.15);
      else quality = Math.min(1, quality + 0.05);
    }

    const url = URL.createObjectURL(pdfBlob);
    showDownloadButton(url);
    imgStatus.innerHTML = "✅ PDF ready to download!";
    btnImgsConvert.disabled = false;
    btnImgsConvert.classList.remove("opacity-50", "cursor-not-allowed");
  });
}

// ---------- Helper: Compress image using <canvas> ----------
async function compressImage(file, quality = 0.9) {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const mime = file.type.includes("png") ? "image/png" : "image/jpeg";
  const blob = await new Promise(res => canvas.toBlob(res, mime, quality));
  return blob || file;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- UI Helpers ----------
function resetUI() {
  inpImgs.value = "";
  ctrlImgs?.classList.add("hidden");
  imgStatus.textContent = "";
  selectedImages = [];
  generatedPdfBlob = null;
  removeDownloadButton();
}

function showDownloadButton(url) {
  removeDownloadButton();
  btnImgsDownload = document.createElement("a");
  btnImgsDownload.href = url;
  btnImgsDownload.download = `Images_${Date.now()}.pdf`;
  btnImgsDownload.innerHTML = "⬇️ Download PDF";
  btnImgsDownload.className =
    "bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200";
  btnImgsDownload.id = "btn-imgs-download";
  btnImgsConvert.parentElement.appendChild(btnImgsDownload);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function removeDownloadButton() {
  if (btnImgsDownload) {
    btnImgsDownload.remove();
    btnImgsDownload = null;
  }
}
