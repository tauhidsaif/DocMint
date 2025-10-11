import { wireDrop, nextFrame, toMB } from "./main.js";

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

let compressFiles = [];
let compressedResults = [];

if (!dzCompress || !inpCompress) {
  console.warn("⚠️ Compress elements not found in HTML.");
} else {
  // ---------- Setup drag/drop ----------
  wireDrop(dzCompress, inpCompress);

  // ✅ Style buttons for full responsiveness
  if (btnCompress) {
    btnCompress.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold px-4 py-3 rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 min-h-[48px]";
    btnCompress.innerHTML = `
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
      </svg>
      <span>Process Images</span>
    `;
  }

  if (btnCompressReset) {
    btnCompressReset.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm min-h-[48px]";
    btnCompressReset.innerHTML = `
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      <span>Reset</span>
    `;
  }

  if (btnCompressZip) {
    btnCompressZip.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold px-4 py-3 rounded-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed";
    btnCompressZip.innerHTML = `
      <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      <span>Download All as ZIP</span>
    `;
  }

  // ✅ Style input fields for better mobile visibility
  if (compressWidth) {
    compressWidth.className = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[44px]";
  }
  if (compressHeight) {
    compressHeight.className = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[44px]";
  }
  if (targetSize) {
    targetSize.className = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[44px]";
  }
  if (unitWidth) {
    unitWidth.className = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-base bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[44px]";
  }
  if (unitHeight) {
    unitHeight.className = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-base bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[44px]";
  }
  if (targetUnit) {
    targetUnit.className = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-base bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[44px]";
  }

  // ---------- When user selects files ----------
  inpCompress.addEventListener("change", () => {
    const files = Array.from(inpCompress.files || []);
    if (!files.length) return resetUI();

    compressFiles = files.filter(f => f.type.startsWith("image/"));
    if (!compressFiles.length) {
      alert("Please select image files.");
      return resetUI();
    }

    ctrlCompress.classList.remove("hidden");
    compressStatus.innerHTML = `
      <div class="text-center px-3 py-2">
        <div class="flex flex-wrap items-center justify-center gap-2">
          <span class="text-blue-600 font-bold text-2xl">${compressFiles.length}</span> 
          <span class="text-gray-700 text-base">image(s) loaded</span>
        </div>
      </div>
    `;
    compressList.innerHTML = "";

    compressFiles.forEach(file => {
      const card = document.createElement("div");
      card.className =
        "bg-white border-2 border-gray-200 rounded-lg p-3 flex flex-col gap-3 text-sm animate-fade-in shadow-sm";
      
      const topRow = document.createElement("div");
      topRow.className = "flex items-center gap-3";
      
      const img = document.createElement("img");
      img.className = "w-16 h-16 object-cover rounded-lg border-2 border-gray-300 flex-shrink-0";
      img.src = URL.createObjectURL(file);
      
      const info = document.createElement("div");
      info.className = "flex-1 min-w-0";
      
      const name = document.createElement("div");
      name.className = "truncate font-medium text-gray-800";
      name.textContent = file.name;
      
      const size = document.createElement("div");
      size.className = "text-gray-600 text-sm mt-1";
      size.textContent = toMB(file.size);
      
      info.append(name, size);
      topRow.append(img, info);
      card.appendChild(topRow);
      compressList.appendChild(card);
    });
  });

  btnCompressReset.addEventListener("click", resetUI);

  function resetUI() {
    inpCompress.value = "";
    compressFiles = [];
    compressedResults = [];
    compressList.innerHTML = "";
    ctrlCompress.classList.add("hidden");
    compressStatus.textContent = "";
    if (btnCompressZip) btnCompressZip.disabled = true;
  }

  // ---------- Main Compression ----------
  btnCompress.addEventListener("click", async () => {
    if (!compressFiles.length) {
      alert("Select images first");
      return;
    }

    const tW = convertToPx(parseFloat(compressWidth.value || "0"), unitWidth.value);
    const tH = convertToPx(parseFloat(compressHeight.value || "0"), unitHeight.value);

    // Convert target size (KB / MB → bytes)
    const enteredValue = parseFloat(targetSize.value || "0");
    let tSize = 0;
    if (enteredValue > 0) {
      if (targetUnit.value === "kb") tSize = enteredValue * 1024;
      else if (targetUnit.value === "mb") tSize = enteredValue * 1024 * 1024;
    }

    btnCompress.disabled = true;
    compressStatus.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-3 text-center px-3 py-3">
        <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-blue-600 font-medium text-base">Processing images... Please wait</span>
      </div>
    `;
    compressedResults = [];
    compressList.innerHTML = "";

    for (let i = 0; i < compressFiles.length; i++) {
      const file = compressFiles[i];
      try {
        const img = await loadImage(file);
        const { canvas, newW, newH } = drawScaled(img, tW, tH);

        let blob;

        // If a target size is given → use smart compressor
        if (tSize > 0) {
          // If already smaller than target
          if (file.size <= tSize * 1.05) {
            console.log(`✅ ${file.name} already smaller than target`);
            blob = file;
          } else {
            const result = await compressToMaxSize(canvas, tSize);
            blob = result.blob;
          }
        } else {
          // No target → just normal quality 0.8
          blob = await canvasToBlob(canvas, 0.8);
        }

        const url = URL.createObjectURL(blob);
        const card = makeResultCard(file, canvas, newW, newH, blob.size, url);
        compressList.appendChild(card);

        compressedResults.push({ name: file.name.replace(/\.[^.]+$/, ".jpg"), blob });
        
        const percentage = Math.round(((i + 1) / compressFiles.length) * 100);
        compressStatus.innerHTML = `
          <div class="space-y-3 px-4 w-full max-w-md mx-auto">
            <div class="flex flex-wrap items-center justify-center gap-2 text-base">
              <span class="text-blue-600 font-semibold">Processing:</span>
              <span class="text-gray-700">${i + 1} / ${compressFiles.length}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div class="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
        await nextFrame();
      } catch (err) {
        console.error("Error processing:", err);
        alert(`Failed: ${file.name}`);
      }
    }

    if (btnCompressZip) btnCompressZip.disabled = compressedResults.length === 0;
    compressStatus.innerHTML = `
      <div class="flex flex-wrap items-center justify-center gap-2 text-emerald-600 font-semibold text-lg px-3 py-2">
        <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-center">All images processed!</span>
      </div>
    `;
    btnCompress.disabled = false;
  });

  // ---------- ZIP Download ----------
  btnCompressZip.addEventListener("click", async () => {
    if (!compressedResults.length) return;
    
    if (typeof JSZip === 'undefined') {
      alert("⚠️ JSZip library not loaded. Please check your script imports.");
      return;
    }
    
    compressStatus.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-3 text-center px-3 py-3">
        <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-emerald-600 font-medium text-base">Creating ZIP... Please wait</span>
      </div>
    `;
    
    try {
      const zip = new JSZip();
      for (const f of compressedResults) {
        zip.file(f.name, f.blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Compressed_${Date.now()}.zip`;
      a.click();
      
      compressStatus.innerHTML = `
        <div class="flex flex-wrap items-center justify-center gap-2 text-emerald-600 font-semibold text-lg px-3 py-2">
          <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="text-center">ZIP downloaded successfully!</span>
        </div>
      `;
    } catch (err) {
      console.error("ZIP creation error:", err);
      alert("Failed to create ZIP file");
    }
  });

  // ---------- Helper Functions ----------
  function loadImage(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error(`Failed to load image: ${file.name}`));
      img.src = URL.createObjectURL(file);
    });
  }

  function convertToPx(v, unit) {
    if (!v || v <= 0) return 0;
    if (unit === "mm") return v * 3.7795;
    if (unit === "cm") return v * 37.795;
    return v; // px
  }

  function drawScaled(img, w, h) {
    let newW = img.width, newH = img.height;
    if (w && h) {
      newW = w;
      newH = h;
    } else if (w) {
      newW = w;
      newH = (img.height / img.width) * w;
    } else if (h) {
      newH = h;
      newW = (img.width / img.height) * h;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(newW);
    canvas.height = Math.floor(newH);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, newW, newH);
    return { canvas, newW, newH };
  }

  function canvasToBlob(canvas, q) {
    return new Promise(res => {
      canvas.toBlob(b => res(b || new Blob()), "image/jpeg", q);
    });
  }

  function makeResultCard(file, canvas, newW, newH, sizeBytes, url) {
    const card = document.createElement("div");
    card.className =
      "bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-3 flex flex-col gap-3 text-sm animate-fade-in shadow-md";
    
    const topRow = document.createElement("div");
    topRow.className = "flex items-center gap-3";
    
    const preview = document.createElement("img");
    preview.src = url;
    preview.className = "w-16 h-16 object-cover rounded-lg border-2 border-emerald-300 flex-shrink-0";
    
    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";
    
    const name = document.createElement("div");
    name.className = "truncate font-semibold text-gray-800";
    name.textContent = file.name;
    
    const dimensions = document.createElement("div");
    dimensions.className = "text-gray-700 text-sm mt-1";
    dimensions.textContent = `${Math.round(newW)} × ${Math.round(newH)} px`;
    
    const size = document.createElement("div");
    size.className = "text-emerald-700 font-semibold text-sm mt-1";
    size.textContent = toMB(sizeBytes);
    
    info.append(name, dimensions, size);
    topRow.append(preview, info);
    
    const downloadBtn = document.createElement("a");
    downloadBtn.href = url;
    downloadBtn.download = file.name.replace(/\.[^.]+$/, ".jpg");
    downloadBtn.className = "w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-all";
    downloadBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      <span>Download</span>
    `;
    
    card.append(topRow, downloadBtn);
    return card;
  }

  // ---------- Smart Compressor (Target = Max Size) ----------
  async function compressToMaxSize(canvas, targetBytes) {
    let quality = 0.9;
    let blob = await canvasToBlob(canvas, quality);

    // Step 1: Try quality adjustments
    for (let q = 0.9; q >= 0.1; q -= 0.1) {
      blob = await canvasToBlob(canvas, q);
      if (blob.size <= targetBytes) {
        console.log(`✅ Reached target via quality ${q.toFixed(2)} → ${toMB(blob.size)}`);
        return { blob, quality: q };
      }
    }

    // Step 2: Downscale gradually if quality compression not enough
    let scale = 0.9;
    const originalCanvas = canvas;
    while (blob.size > targetBytes && scale > 0.3) {
      const tmp = document.createElement("canvas");
      tmp.width = Math.floor(originalCanvas.width * scale);
      tmp.height = Math.floor(originalCanvas.height * scale);
      const ctx = tmp.getContext("2d");
      ctx.drawImage(originalCanvas, 0, 0, tmp.width, tmp.height);
      blob = await canvasToBlob(tmp, 0.7);
      console.log(`🔄 Rescaled to ${Math.round(scale * 100)}%, size=${toMB(blob.size)}`);
      
      if (blob.size <= targetBytes) {
        console.log(`✅ Target reached via rescaling at ${Math.round(scale * 100)}%`);
        return { blob, quality: 0.7 };
      }
      scale -= 0.1;
    }

    if (blob.size > targetBytes) {
      console.warn(`⚠️ Could not reach exact target, final: ${toMB(blob.size)}`);
    }

    return { blob, quality: 0.7 };
  }
}