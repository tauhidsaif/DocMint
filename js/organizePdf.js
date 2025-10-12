import { wireDrop, nextFrame, showAlert } from "./main.js";

console.log("Loaded: PDF Organizer Tool (DocMint Style ✨)");

const dzOrg = document.getElementById("dz-org");
const inpOrg = document.getElementById("inp-org");
const ctrlOrg = document.getElementById("ctrl-org");
const orgPages = document.getElementById("org-pages");
const orgStatus = document.getElementById("org-status");
const btnOrgSave = document.getElementById("btn-org-save");
const btnOrgReset = document.getElementById("btn-org-reset");

let pdfDoc = null;
let pages = [];

// === Drag & Drop Setup ===
wireDrop(dzOrg, inpOrg);

inpOrg.addEventListener("change", async () => {
  const file = inpOrg.files[0];
  if (!file) return;

  orgStatus.innerHTML = `<div class="text-emerald-600 font-medium animate-pulse">📄 Loading PDF...</div>`;
  ctrlOrg.classList.add("hidden");
  orgPages.innerHTML = "";
  pages = [];

  const pdfData = new Uint8Array(await file.arrayBuffer());
  pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;

  orgStatus.innerHTML = `<div class="text-emerald-700 font-semibold">✅ Loaded ${pdfDoc.numPages} page(s)</div>`;
  ctrlOrg.classList.remove("hidden");

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const div = document.createElement("div");
    div.className =
      "relative bg-white/90 border-2 border-emerald-100 rounded-2xl shadow-md hover:shadow-2xl cursor-move overflow-hidden group transition-all duration-300 hover:scale-[1.03] animate-fade-in";
    div.draggable = true;
    div.dataset.index = i - 1;

    const number = document.createElement("div");
    number.textContent = i;
    number.className =
      "absolute bottom-2 left-2 text-xs bg-emerald-600/80 text-white rounded-full w-6 h-6 flex items-center justify-center font-semibold shadow-md";

    const delBtn = document.createElement("button");
    delBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
    delBtn.className =
      "absolute top-2 right-2 bg-gradient-to-r from-red-500 to-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-red-500/30";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      div.classList.add("scale-95", "opacity-0");
      setTimeout(() => {
        div.remove();
        pages = pages.filter((p) => p !== div);
        orgStatus.innerHTML = `<div class='text-red-600 font-medium'>🗑️ Page removed (${pages.length} left)</div>`;
      }, 200);
    };

    div.append(canvas, delBtn, number);
    orgPages.appendChild(div);
    pages.push(div);

    await nextFrame();
  }

  setupDragAndDrop();
});

// === Stable, Clean Drag & Drop ===
function setupDragAndDrop() {
  let dragItem = null;
  const placeholder = document.createElement("div");
  placeholder.className =
    "border-2 border-dashed border-emerald-400 rounded-2xl h-32 my-2 opacity-70 transition-all duration-150";

  orgPages.addEventListener("dragstart", (e) => {
    const target = e.target.closest("[draggable='true']");
    if (!target) return;
    dragItem = target;
    target.classList.add("opacity-40", "scale-95", "border-emerald-400");
    target.style.boxShadow = "0 0 20px rgba(16, 185, 129, 0.4)";
  });

  orgPages.addEventListener("dragend", () => {
    if (dragItem) {
      dragItem.classList.remove("opacity-40", "scale-95", "border-emerald-400");
      dragItem.style.boxShadow = "";
    }
    placeholder.remove();
    dragItem = null;
    updatePageOrder();
  });

  orgPages.addEventListener("dragover", (e) => {
    e.preventDefault();
    const target = e.target.closest("[draggable='true']");
    if (!target || target === dragItem) return;

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) orgPages.insertBefore(placeholder, target);
    else orgPages.insertBefore(placeholder, target.nextSibling);
  });

  orgPages.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dragItem && placeholder.parentNode) {
      orgPages.insertBefore(dragItem, placeholder);
      placeholder.remove();
      updatePageOrder();
    }
  });
}

function updatePageOrder() {
  pages = Array.from(orgPages.children).filter((el) => el.dataset.index);
  pages.forEach((el, i) => {
    const num = el.querySelector("div:last-child");
    if (num) num.textContent = i + 1;
  });
}

// === Save Organized PDF ===
btnOrgSave.addEventListener("click", async () => {
if (!pdfDoc) return showAlert("Load a PDF first.", "warning");
  orgStatus.innerHTML = `<div class='text-blue-600 font-medium animate-pulse'>💾 Creating organized PDF...</div>`;
  btnOrgSave.disabled = true;
  btnOrgSave.textContent = "Saving...";

  const { PDFDocument } = window.PDFLib;
  const newPdf = await PDFDocument.create();
  const oldPdf = await PDFDocument.load(await pdfDoc.getData());

  const order = Array.from(orgPages.children)
    .filter((div) => div.dataset.index)
    .map((div) => parseInt(div.dataset.index));

  for (const idx of order) {
    const [page] = await newPdf.copyPages(oldPdf, [idx]);
    newPdf.addPage(page);
  }

  const pdfBytes = await newPdf.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `Organized_${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);

  orgStatus.innerHTML = `<div class='text-emerald-700 font-semibold'>✅ PDF saved successfully!</div>`;
  btnOrgSave.disabled = false;
  btnOrgSave.textContent = "💾 Save PDF";
});

// === Reset ===
btnOrgReset.addEventListener("click", () => {
  inpOrg.value = "";
  ctrlOrg.classList.add("hidden");
  orgPages.innerHTML = "";
  orgStatus.innerHTML = `<div class='text-gray-600 font-medium'>🔄 Reset complete.</div>`;
  pdfDoc = null;
  pages = [];
});
