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

  // ---------- When user selects files ----------
  inpCompress.addEventListener("change", () => {
    const files = Array.from(inpCompress.files || []);
    if (!files.length) return resetUI();

    compressFiles = files.filter(f => f.type.startsWith("image/"));
    if (!compressFiles.length) return alert("Please select image files.");

    ctrlCompress.classList.remove("hidden");
    compressStatus.textContent = `${compressFiles.length} image(s) loaded`;
    compressList.innerHTML = "";

    compressFiles.forEach(file => {
      const card = document.createElement("div");
      card.className =
        "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-2 flex items-center gap-3 text-xs animate-fade-in";
      const img = document.createElement("img");
      img.className = "w-12 h-12 object-cover rounded-md border";
      img.src = URL.createObjectURL(file);
      const info = document.createElement("div");
      info.className = "flex-1 overflow-hidden";
      const name = document.createElement("div");
      name.className = "truncate";
      name.textContent = file.name;
      const size = document.createElement("div");
      size.className = "text-gray-500";
      size.textContent = toMB(file.size);
      info.append(name, size);
      card.append(img, info);
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
    btnCompressZip.disabled = true;
  }

  // ---------- Main Compression ----------
  btnCompress.addEventListener("click", async () => {
    if (!compressFiles.length) return alert("Select images first");

    const tW = convertToPx(parseFloat(compressWidth.value || "0"), unitWidth.value);
    const tH = convertToPx(parseFloat(compressHeight.value || "0"), unitHeight.value);

    // Convert target size (KB / MB → bytes)
    const enteredValue = parseFloat(targetSize.value || "0");
    let tSize = 0;
    if (enteredValue > 0) {
      if (targetUnit.value === "kb") tSize = enteredValue * 1024;
      else if (targetUnit.value === "mb") tSize = enteredValue * 1024 * 1024;
    }

    compressStatus.textContent = "Processing images…";
    compressedResults = [];
    compressList.innerHTML = "";

    for (let i = 0; i < compressFiles.length; i++) {
      const file = compressFiles[i];
      try {
        const img = await loadImage(file);
        const { canvas, newW, newH } = drawScaled(img, tW, tH);

        let blob;

        // If a target size is given → use new smart compressor
        if (tSize > 0) {
          // If already smaller than target
          if (file.size <= tSize * 1.05) {
            compressStatus.textContent = `⚠️ ${file.name} already smaller than target, skipped recompression`;
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
        compressStatus.textContent = `✅ Done ${i + 1}/${compressFiles.length}`;
        await nextFrame();
      } catch (err) {
        console.error(err);
        alert(`Failed: ${file.name}`);
      }
    }

    btnCompressZip.disabled = compressedResults.length === 0;
    compressStatus.textContent = "✅ All images processed!";
  });

  // ---------- ZIP Download ----------
  btnCompressZip.addEventListener("click", async () => {
    if (!compressedResults.length) return;
    compressStatus.textContent = "Creating ZIP…";
    const zip = new JSZip();
    for (const f of compressedResults) zip.file(f.name, f.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Compressed_${Date.now()}.zip`;
    a.click();
  });

  // ---------- Helper Functions ----------
  function loadImage(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  function convertToPx(v, unit) {
    if (!v) return 0;
    if (unit === "mm") return v * 3.7795;
    if (unit === "cm") return v * 37.795;
    return v;
  }

  function drawScaled(img, w, h) {
    let newW = img.width, newH = img.height;
    if (w && h) {
      newW = w;
      newH = h;
    } else if (w) {
      newH = (img.height / img.width) * w;
    } else if (h) {
      newW = (img.width / img.height) * h;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(newW);
    canvas.height = Math.floor(newH);
    canvas.getContext("2d").drawImage(img, 0, 0, newW, newH);
    return { canvas, newW, newH };
  }

  function canvasToBlob(canvas, q) {
    return new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", q));
  }

  function makeResultCard(file, canvas, newW, newH, sizeBytes, url) {
    const card = document.createElement("div");
    card.className =
      "bg-white border rounded-xl p-2 flex items-center gap-3 text-xs animate-fade-in";
    const preview = document.createElement("img");
    preview.src = url;
    preview.className = "w-12 h-12 object-cover rounded-md border";
    const info = document.createElement("div");
    info.className = "flex-1 overflow-hidden";
    const name = document.createElement("div");
    name.className = "truncate";
    name.textContent = `${file.name} (${Math.round(newW)}×${Math.round(newH)} px)`;
    const size = document.createElement("div");
    size.className = "text-gray-500";
    size.textContent = toMB(sizeBytes);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.[^.]+$/, ".jpg");
    a.textContent = "Download";
    a.className = "text-emerald-700 hover:underline ml-2";
    info.append(name, size);
    card.append(preview, info, a);
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

    // Step 2: Downscale gradually
    let scale = 0.9;
    while (blob.size > targetBytes && scale > 0.3) {
      const tmp = document.createElement("canvas");
      tmp.width = Math.floor(canvas.width * scale);
      tmp.height = Math.floor(canvas.height * scale);
      tmp.getContext("2d").drawImage(canvas, 0, 0, tmp.width, tmp.height);
      blob = await canvasToBlob(tmp, 0.7);
      console.log(`🔄 Rescaled ${Math.round(scale * 100)}%, size=${toMB(blob.size)}`);
      scale -= 0.1;
    }

    if (blob.size > targetBytes) {
      console.warn(`⚠️ Could not reach exact target, final: ${toMB(blob.size)}`);
    }

    return { blob, quality: 0.7 };
  }
}
