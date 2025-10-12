import { wireDrop, nextFrame, toMB, showAlert } from "./main.js";

console.log("Loaded: Merge PDFs Tool");

const dzMerge = document.getElementById("dz-merge");
const inpMerge = document.getElementById("inp-merge");
const ctrlMerge = document.getElementById("ctrl-merge");
const mergeList = document.getElementById("merge-list");
const mergeStatus = document.getElementById("merge-status");
const btnMerge = document.getElementById("btn-merge");
const btnMergeReset = document.getElementById("btn-merge-reset");

let btnMergeDownload = null;
let mergeFiles = [];
let mergedPdfBlob = null;

if (!dzMerge || !inpMerge) {
  console.warn("⚠️ Merge PDF elements not found in HTML. Skipping initialization.");
} else {
  wireDrop(dzMerge, inpMerge);

  // ✅ Merge button - flexible multi-line layout
  if (btnMerge) {
    btnMerge.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold px-4 py-3 rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 min-h-[48px]";
    btnMerge.innerHTML = `
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      <span>Merge PDFs</span>
    `;
  }

  // ✅ Reset button - flexible multi-line layout
  if (btnMergeReset) {
    btnMergeReset.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 text-sm min-h-[48px]";
    btnMergeReset.innerHTML = `
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      <span>Reset</span>
    `;
  }

  inpMerge.addEventListener("change", () => {
    const files = Array.from(inpMerge.files || []);
    if (!files.length) {
      ctrlMerge?.classList.add("hidden");
      mergeList.innerHTML = "";
      mergeStatus.textContent = "";
      removeDownloadButton();
      return;
    }

    mergeFiles = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (!mergeFiles.length) {
      showAlert("Please select valid PDF files.", "error");
      inpMerge.value = "";
      return;
    }

    ctrlMerge?.classList.remove("hidden");
    mergeStatus.innerHTML = `
      <div class="text-center px-3 py-2">
        <div class="flex flex-wrap items-center justify-center gap-2">
          <span class="text-indigo-600 font-bold text-2xl">${mergeFiles.length}</span> 
          <span class="text-gray-700 text-base">file(s) ready to merge</span>
        </div>
      </div>
    `;

    mergeList.innerHTML = "";
    mergeFiles.forEach((file, i) => {
      const card = document.createElement("div");
      card.className =
        "bg-gradient-to-br from-white to-gray-50 border-2 border-indigo-100 rounded-lg p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in";

      const topRow = document.createElement("div");
      topRow.className = "flex items-center gap-2 min-w-0";

      const numberBadge = document.createElement("div");
      numberBadge.className =
        "flex-shrink-0 w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold";
      numberBadge.textContent = i + 1;

      const name = document.createElement("div");
      name.className = "truncate text-gray-800 font-medium text-sm flex-1";
      name.textContent = file.name;

      topRow.append(numberBadge, name);

      const size = document.createElement("div");
      size.className =
        "self-start text-indigo-600 font-semibold text-sm bg-indigo-50 px-3 py-1.5 rounded-md";
      size.textContent = toMB(file.size);

      card.append(topRow, size);
      mergeList.appendChild(card);
    });

    removeDownloadButton();
  });

  btnMergeReset?.addEventListener("click", () => {
    inpMerge.value = "";
    mergeFiles = [];
    mergeList.innerHTML = "";
    ctrlMerge?.classList.add("hidden");
    mergeStatus.textContent = "";
    removeDownloadButton();
  });

  btnMerge?.addEventListener("click", async () => {
    if (!mergeFiles.length) return showAlert("Select some PDF files first.", "warning");

    const { PDFDocument } = window.PDFLib || {};
    if (!PDFDocument) {
      showAlert("PDF-LIB not loaded. Check your script imports.", "error");
      return;
    }

    mergeStatus.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-3 text-center px-3 py-3">
        <div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-indigo-600 font-medium text-base">Merging PDFs... Please wait</span>
      </div>
    `;
    btnMerge.disabled = true;

    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < mergeFiles.length; i++) {
      const file = mergeFiles[i];
      try {
        const bytes = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));

        const percentage = Math.round(((i + 1) / mergeFiles.length) * 100);
        mergeStatus.innerHTML = `
          <div class="space-y-3 px-4 w-full max-w-md mx-auto">
            <div class="flex flex-wrap items-center justify-center gap-2 text-base">
              <span class="text-indigo-600 font-semibold">Merging:</span>
              <span class="text-gray-700">${i + 1} / ${mergeFiles.length}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
        await nextFrame();
      } catch (e) {
        console.error("❌ Error merging:", e);
        showAlert(`Failed to merge: ${file.name}`, "error");
      }
    }

    const pdfBytes = await mergedPdf.save();
    mergedPdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(mergedPdfBlob);

    mergeStatus.innerHTML = `
      <div class="flex flex-wrap items-center justify-center gap-2 text-emerald-600 font-semibold text-lg px-3 py-2">
        <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-center">Merge complete!</span>
      </div>
    `;
    showDownloadButton(url);

    btnMerge.disabled = false;
  });

  function showDownloadButton(url) {
    removeDownloadButton();
    btnMergeDownload = document.createElement("a");
    btnMergeDownload.href = url;
    btnMergeDownload.download = `Merged_${Date.now()}.pdf`;
    btnMergeDownload.innerHTML = `
      <span class="flex flex-wrap items-center justify-center gap-2 w-full">
        <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <span class="text-base">Download Merged PDF</span>
      </span>
    `;
    btnMergeDownload.className =
      "w-full flex flex-wrap items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold px-4 py-3 rounded-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 animate-fadeIn min-h-[48px]";
    btnMergeDownload.id = "btn-merge-download";

    const buttonRow = btnMerge.parentElement;
    if (buttonRow) {
      buttonRow.appendChild(btnMergeDownload);
    }

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function removeDownloadButton() {
    if (btnMergeDownload) {
      btnMergeDownload.remove();
      btnMergeDownload = null;
    }
  }
}