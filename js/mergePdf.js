import { wireDrop, nextFrame, toMB } from "./main.js";

console.log("Loaded: Merge PDFs Tool");

// ---------- UI Elements ----------
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

// ---------- Safe initialization ----------
if (!dzMerge || !inpMerge) {
  console.warn("⚠️ Merge PDF elements not found in HTML. Skipping initialization.");
} else {
  // ---------- Wire drag/drop ----------
  wireDrop(dzMerge, inpMerge);

  // ---------- File select ----------
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
      alert("Please select valid PDF files.");
      inpMerge.value = "";
      return;
    }

    ctrlMerge?.classList.remove("hidden");
    mergeStatus.textContent = `${mergeFiles.length} file(s) ready to merge`;

    mergeList.innerHTML = "";
    mergeFiles.forEach((file, i) => {
      const card = document.createElement("div");
      card.className =
        "bg-white border rounded-xl p-2 flex items-center justify-between text-xs animate-fade-in";

      const name = document.createElement("div");
      name.className = "truncate text-gray-700";
      name.textContent = `${i + 1}. ${file.name}`;

      const size = document.createElement("div");
      size.className = "text-gray-500";
      size.textContent = toMB(file.size);

      card.append(name, size);
      mergeList.appendChild(card);
    });
  });

  // ---------- Reset ----------
  btnMergeReset?.addEventListener("click", () => {
    inpMerge.value = "";
    mergeFiles = [];
    mergeList.innerHTML = "";
    ctrlMerge?.classList.add("hidden");
    mergeStatus.textContent = "";
    removeDownloadButton();
  });

  // ---------- Merge ----------
  btnMerge?.addEventListener("click", async () => {
    if (!mergeFiles.length) return alert("Select some PDF files first");

    const { PDFDocument } = window.PDFLib || {};
    if (!PDFDocument) {
      alert("⚠️ PDF-LIB not loaded. Check your script imports.");
      return;
    }

    mergeStatus.textContent = "⏳ Merging PDFs…";
    btnMerge.disabled = true;
    btnMerge.classList.add("opacity-50", "cursor-not-allowed");

    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < mergeFiles.length; i++) {
      const file = mergeFiles[i];
      try {
        const bytes = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));

        mergeStatus.textContent = `📄 Merged ${i + 1}/${mergeFiles.length}`;
        await nextFrame();
      } catch (e) {
        console.error("❌ Error merging:", e);
        alert(`Failed to merge ${file.name}`);
      }
    }

    const pdfBytes = await mergedPdf.save();
    mergedPdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(mergedPdfBlob);

    mergeStatus.textContent = "✅ Merge complete!";
    showDownloadButton(url);

    btnMerge.disabled = false;
    btnMerge.classList.remove("opacity-50", "cursor-not-allowed");
  });

  // ---------- Show Download Button beside Merge/Reset ----------
  function showDownloadButton(url) {
    removeDownloadButton();
    btnMergeDownload = document.createElement("a");
    btnMergeDownload.href = url;
    btnMergeDownload.download = `Merged_${Date.now()}.pdf`;
    btnMergeDownload.textContent = "⬇️ Download PDF";
    btnMergeDownload.className =
      "bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition";
    btnMergeDownload.id = "btn-merge-download";

    const buttonRow = btnMerge.parentElement;
    buttonRow.appendChild(btnMergeDownload);

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------- Remove old download button ----------
  function removeDownloadButton() {
    if (btnMergeDownload) {
      btnMergeDownload.remove();
      btnMergeDownload = null;
    }
  }
}
