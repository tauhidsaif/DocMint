import { wireDrop, nextFrame, toMB, showAlert, ensurePdfLib } from "./main.js";

console.log("Loaded: Merge PDFs Tool");

const dzMerge = document.getElementById("dz-merge");
const inpMerge = document.getElementById("inp-merge");
const ctrlMerge = document.getElementById("ctrl-merge");
const mergeList = document.getElementById("merge-list");
const mergeStatus = document.getElementById("merge-status");
const btnMerge = document.getElementById("btn-merge");
const btnMergeReset = document.getElementById("btn-merge-reset");

let mergeFiles = [];
let downloadUrl = null;

if (!dzMerge || !inpMerge) {
  console.warn("Merge PDF elements not found.");
} else {
  wireDrop(dzMerge, inpMerge);

  inpMerge.addEventListener("change", () => {
    const files = Array.from(inpMerge.files || []);
    clearDownload();

    mergeFiles = files.filter(file =>
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (!mergeFiles.length) {
      ctrlMerge.classList.add("hidden");
      mergeList.innerHTML = "";
      mergeStatus.textContent = "";
      if (files.length) showAlert("Please select valid PDF files.", "error");
      return;
    }

    ctrlMerge.classList.remove("hidden");
    mergeStatus.textContent = mergeFiles.length + " PDF file(s) ready to merge.";
    mergeList.innerHTML = "";

    mergeFiles.forEach((file, index) => {
      const card = document.createElement("div");
      card.className =
        "flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white p-3 shadow-sm";
      const details = document.createElement("div");
      details.className = "min-w-0";
      const name = document.createElement("div");
      name.className = "truncate text-sm font-semibold text-gray-800";
      name.textContent = (index + 1) + ". " + file.name;
      const size = document.createElement("div");
      size.className = "mt-1 text-xs text-gray-500";
      size.textContent = toMB(file.size);
      details.append(name, size);
      card.append(details);
      mergeList.append(card);
    });
  });

  btnMergeReset?.addEventListener("click", () => {
    if (btnMerge.disabled) return;
    inpMerge.value = "";
    mergeFiles = [];
    mergeList.innerHTML = "";
    mergeStatus.textContent = "";
    ctrlMerge.classList.add("hidden");
    clearDownload();
  });

  btnMerge?.addEventListener("click", async () => {
    if (!mergeFiles.length) {
      showAlert("Select at least one PDF file first.", "warning");
      return;
    }

    btnMerge.disabled = true;
    btnMergeReset.disabled = true;
    inpMerge.disabled = true;
    clearDownload();

    try {
      mergeStatus.textContent = "Loading PDF tools…";
      const { PDFDocument } = await ensurePdfLib();
      const mergedPdf = await PDFDocument.create();

      for (let index = 0; index < mergeFiles.length; index++) {
        const file = mergeFiles[index];
        mergeStatus.textContent =
          "Merging " + (index + 1) + " of " + mergeFiles.length + ": " + file.name;

        try {
          const source = await PDFDocument.load(await file.arrayBuffer());
          const copiedPages = await mergedPdf.copyPages(source, source.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
        } catch (error) {
          throw new Error('Could not read "' + file.name + '". It may be damaged or password-protected.');
        }

        await nextFrame();
      }

      if (mergedPdf.getPageCount() === 0) {
        throw new Error("No pages were available to merge.");
      }

      const bytes = await mergedPdf.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: "application/pdf" });
      downloadUrl = URL.createObjectURL(blob);
      showDownloadButton(downloadUrl);

      mergeStatus.innerHTML =
        '<div class="font-semibold text-emerald-700">Merge complete · ' +
        mergedPdf.getPageCount() + " pages · " + toMB(blob.size) + "</div>";
      showAlert("PDFs merged successfully.", "success");
    } catch (error) {
      console.error("Merge failed:", error);
      mergeStatus.textContent = error?.message || "Could not merge these PDFs.";
      showAlert(error?.message || "Could not merge these PDFs.", "error");
    } finally {
      btnMerge.disabled = false;
      btnMergeReset.disabled = false;
      inpMerge.disabled = false;
    }
  });
}

function showDownloadButton(url) {
  const old = document.getElementById("btn-merge-download");
  old?.remove();

  const anchor = document.createElement("a");
  anchor.id = "btn-merge-download";
  anchor.href = url;
  anchor.download = "Merged_" + Date.now() + ".pdf";
  anchor.className =
    "flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700";
  anchor.textContent = "Download merged PDF";

  btnMerge.parentElement?.appendChild(anchor);
}

function clearDownload() {
  document.getElementById("btn-merge-download")?.remove();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = null;
}
