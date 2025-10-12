import { wireDrop, nextFrame, toMB, showAlert } from "./main.js";

console.log("Loaded: PDF → JPG Tool (Low-Lag Preview + HQ Download)");

const dzPdf = document.getElementById("dz-pdf");
const inpPdf = document.getElementById("inp-pdf");
const ctrlPdf = document.getElementById("ctrl-pdf");
const pdfStatus = document.getElementById("pdf-status");
const pdfOut = document.getElementById("pdf-output");
const btnPdfConvert = document.getElementById("btn-pdf-convert");
const btnPdfZip = document.getElementById("btn-pdf-zip");
const btnPdfReset = document.getElementById("btn-pdf-reset");
const pdfConcurrency = document.getElementById("pdf-concurrency");

let pdfFile = null;
let pdfGenerated = [];

if (!dzPdf || !inpPdf) {
  console.warn("⚠️ PDF → JPG elements missing in HTML.");
} else {
  wireDrop(dzPdf, inpPdf);

  inpPdf.addEventListener("change", () => {
    const f = inpPdf.files?.[0];
    const label = document.getElementById("dz-pdf-label");
    if (!f) {
      label.textContent = "Drop a PDF here or click to choose";
      return;
    }
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      showAlert("Select a valid PDF file.", "error");
      inpPdf.value = "";
      label.textContent = "Drop a PDF here or click to choose";
      return;
    }

    pdfFile = f;
    ctrlPdf.classList.remove("hidden");
    pdfStatus.innerHTML = `<span class='text-emerald-700 font-semibold'>${f.name}</span> • ${toMB(f.size)}`;
    label.textContent = f.name;
    pdfOut.innerHTML = "";
    pdfGenerated = [];
    btnPdfZip.disabled = true;
  });

  btnPdfReset?.addEventListener("click", () => {
    pdfFile = null;
    pdfOut.innerHTML = "";
    ctrlPdf.classList.add("hidden");
    pdfStatus.textContent = "";
    pdfGenerated = [];
    btnPdfZip.disabled = true;
    inpPdf.value = "";
    document.getElementById("dz-pdf-label").textContent =
      "Drop a PDF here or click to choose";
  });

  btnPdfConvert?.addEventListener("click", async () => {
    if (!pdfFile) return showAlert("Choose a PDF file first.", "warning");
    if (!window["pdfjsLib"]) return showAlert("pdf.js not loaded properly.", "error");

    const concurrency = Math.max(1, Math.min(4, parseInt(pdfConcurrency?.value || "2", 10)));
    const dpr = window.devicePixelRatio || 1;

    pdfStatus.innerHTML = `<div class='animate-pulse text-emerald-600'>Reading PDF…</div>`;
    pdfOut.innerHTML = "";
    pdfGenerated = [];
    btnPdfZip.disabled = true;

    try {
      const ab = await pdfFile.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: ab }).promise;
      const total = doc.numPages;
      pdfStatus.innerHTML = `<div class='text-emerald-600 font-medium'>Loaded ${total} page(s)…</div>`;

      const pages = Array.from({ length: total }, (_, i) => i + 1);
      const results = await runWithConcurrency(pages, concurrency, async (pageNum, idx) => {
        pdfStatus.innerHTML = `<div class='text-gray-700'>Rendering preview <span class='text-emerald-600 font-semibold'>${pageNum}/${total}</span>…</div>`;
        const result = await renderPreviewAndPrepareDownload(pageNum, doc, 600, 850, 2400, 3400, dpr);
        pdfStatus.innerHTML = `<div class='text-emerald-700'>Rendered ${idx + 1}/${total}</div>`;
        return result;
      });

      const valid = results.filter((r) => !r.error).sort((a, b) => a.index - b.index);
      pdfGenerated = valid.map((s) => ({ name: s.name, blob: s.blob }));
      pdfStatus.innerHTML = `<div class='text-emerald-700 font-semibold'>✅ Done • ${pdfGenerated.length}/${total} converted</div>`;
      btnPdfZip.disabled = pdfGenerated.length === 0;
    } catch (err) {
      console.error(err);
      pdfStatus.innerHTML = `<div class='text-red-600 font-semibold'>❌ Error during conversion</div>`;
showAlert("Failed to render PDF. Try a smaller scale or simpler file.", "error");    }
  });

  async function renderPreviewAndPrepareDownload(i, doc, lowW, lowH, fullW, fullH, dpr) {
    const card = document.createElement("div");
    card.className =
      "bg-white/90 border-2 border-emerald-100 rounded-2xl p-4 shadow-md hover:shadow-2xl transition-all duration-300 animate-fade-in relative overflow-hidden";
    card.style.background = "linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)";

    const skeleton = document.createElement("div");
    skeleton.className =
      "rounded-xl h-40 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 animate-pulse";
    card.appendChild(skeleton);

    const info = document.createElement("div");
    info.className = "mt-3 flex justify-between text-xs text-gray-600 items-center";

    const meta = document.createElement("div");
    meta.innerHTML = `<span class='text-gray-700 font-semibold'>Page ${i}</span>`;

    const link = document.createElement("a");
    link.textContent = "Rendering…";
    link.className = "pointer-events-none text-gray-400 font-medium";

    info.append(meta, link);
    card.append(info);
    pdfOut.appendChild(card);
    await nextFrame();

    const page = await doc.getPage(i);

    // Low-res preview render
    const lowViewport = page.getViewport({
      scale: (lowW / page.getViewport({ scale: 1 }).width) * dpr,
    });
    const lowCanvas = document.createElement("canvas");
    lowCanvas.width = lowViewport.width;
    lowCanvas.height = lowViewport.height;
    const lowCtx = lowCanvas.getContext("2d", { alpha: false });
    await page.render({ canvasContext: lowCtx, viewport: lowViewport }).promise;

    const lowUrl = lowCanvas.toDataURL("image/jpeg", 0.4);
    const img = new Image();
    img.src = lowUrl;
    img.className =
      "rounded-xl shadow-md hover:shadow-xl hover:scale-[1.02] transition-transform duration-300 border border-gray-200";
    await img.decode().catch(() => {});
    card.replaceChild(img, skeleton);

    // Full-quality download (in background)
    const fullViewport = page.getViewport({
      scale: (fullW / page.getViewport({ scale: 1 }).width) * dpr,
    });
    const fullCanvas = new OffscreenCanvas(fullViewport.width, fullViewport.height);
    const fullCtx = fullCanvas.getContext("2d", { alpha: false });
    await page.render({ canvasContext: fullCtx, viewport: fullViewport }).promise;
    const fullBlob = await fullCanvas.convertToBlob({ type: "image/jpeg", quality: 1.0 });

    const downloadName = `${(pdfFile?.name || "page").replace(/\.pdf$/i, "")}_${i}.jpg`;
    link.href = URL.createObjectURL(fullBlob);
    link.download = downloadName;
    link.textContent = "Download JPG";
    link.className =
      "text-emerald-700 hover:underline hover:text-emerald-800 font-semibold transition-colors duration-300";
    meta.innerHTML = `<span class='text-gray-700'>${Math.round(fullViewport.width)}×${Math.round(fullViewport.height)} HQ</span>`;

    page.cleanup?.();
    lowCanvas.width = lowCanvas.height = 0;
    fullCanvas.width = fullCanvas.height = 0;
    await nextFrame();

    return { index: i, name: downloadName, blob: fullBlob };
  }

  btnPdfZip?.addEventListener("click", async () => {
    if (!pdfGenerated.length) return;
    pdfStatus.innerHTML = `<div class='text-blue-600 font-medium animate-pulse'>Zipping…</div>`;
    const zip = new JSZip();
    for (const f of pdfGenerated) zip.file(f.name, f.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(pdfFile?.name || "output").replace(/\.pdf$/i, "")}_jpg.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    pdfStatus.innerHTML = `<div class='text-blue-700 font-semibold'>📦 ZIP ready</div>`;
  });

  async function runWithConcurrency(items, limit, worker) {
    const results = [];
    const queue = [...items];
    let active = 0;

    return new Promise((resolve) => {
      const next = async () => {
        if (!queue.length && active === 0) return resolve(results);
        while (active < limit && queue.length) {
          const item = queue.shift();
          active++;
          worker(item, results.length)
            .then((r) => results.push(r))
            .catch((err) => results.push({ error: err }))
            .finally(() => {
              active--;
              next();
            });
        }
      };
      next();
    });
  }
}
