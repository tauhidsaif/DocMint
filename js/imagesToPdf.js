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
  
  // ✅ Convert button - fixed alignment
  if (btnImgsConvert) {
    btnImgsConvert.className =
      "w-full flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100";
  }
  
  // ✅ Reset button - fixed alignment
  if (btnImgsReset) {
    btnImgsReset.className =
      "w-full flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm sm:text-base";
  }

  inpImgs.addEventListener("change", () => {
    const files = Array.from(inpImgs.files || []);
    selectedImages = files.filter(f => f.type.startsWith("image/"));
    if (!selectedImages.length) {
      resetUI();
      alert("Please select valid image files.");
      return;
    }
    ctrlImgs?.classList.remove("hidden");
    imgStatus.innerHTML = `<div class="text-center px-2"><span class="text-emerald-500 font-bold text-lg sm:text-xl">${selectedImages.length}</span> <span class="text-gray-700 text-sm sm:text-base">image(s) ready</span></div>`;
    removeDownloadButton();
  });

  btnImgsReset?.addEventListener("click", resetUI);

  btnImgsConvert?.addEventListener("click", async () => {
    if (!selectedImages.length) return alert("Please select some images first.");

    const { PDFDocument } = window.PDFLib || {};
    if (!PDFDocument) return alert("⚠️ PDF-LIB not loaded. Check your script imports.");

    btnImgsConvert.disabled = true;
    imgStatus.innerHTML =
      '<div class="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center px-2"><div class="w-5 h-5 sm:w-6 sm:h-6 border-3 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div><span class="text-violet-600 font-medium text-sm sm:text-base">Converting images... Please wait</span></div>';

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

    let quality = 0.9;
    let pdfBlob = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const tempPdf = await PDFDocument.create();

      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        const compressedBlob = await compressImage(file, quality);
        const bytes = await compressedBlob.arrayBuffer();

        let pdfImage;
        try {
          pdfImage =
            compressedBlob.type === "image/jpeg"
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
        let dw = iw,
          dh = ih;

        if (sizes[paper]) {
          if (fitMode === "fit") {
            const scale = Math.min(
              (pw - margin * 2) / iw,
              (ph - margin * 2) / ih
            );
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

        const percentage = Math.round(((i + 1) / selectedImages.length) * 100);
        imgStatus.innerHTML = `
          <div class="space-y-2 px-3 sm:px-4 w-full max-w-md mx-auto">
            <div class="flex items-center justify-center gap-2 text-sm sm:text-base">
              <span class="text-violet-600 font-semibold">Processing:</span>
              <span class="text-gray-700">${i + 1} / ${selectedImages.length}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 sm:h-2.5 overflow-hidden">
              <div class="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 h-full rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
        await nextFrame();
      }

      const pdfBytes = await tempPdf.save();
      pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

      if (!targetBytes) break;

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
    imgStatus.innerHTML =
      '<div class="flex items-center justify-center gap-2 text-emerald-600 font-semibold text-base sm:text-lg px-2"><svg class="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span class="text-center">PDF ready to download!</span></div>';
    btnImgsConvert.disabled = false;
  });
}

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
  btnImgsDownload.innerHTML = `
    <span class="flex items-center justify-center gap-2 sm:gap-3">
      <svg class="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      <span class="text-sm sm:text-base md:text-lg">Download PDF</span>
    </span>
  `;
  btnImgsDownload.className =
    "w-full flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold px-5 py-3 sm:px-6 sm:py-3.5 md:px-8 md:py-4 rounded-lg sm:rounded-xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 animate-fadeIn";
  btnImgsDownload.id = "btn-imgs-download";
  
  const buttonContainer = btnImgsConvert.parentElement;
  if (buttonContainer) {
    buttonContainer.appendChild(btnImgsDownload);
  }
  
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function removeDownloadButton() {
  if (btnImgsDownload) {
    btnImgsDownload.remove();
    btnImgsDownload = null;
  }
}
