import {
  wireDrop,
  nextFrame,
  showAlert,
  ensurePdfJs,
  ensurePdfLib
} from "./main.js";

console.log("Loaded: PDF Organizer Tool");

const dzOrg = document.getElementById("dz-org");
const inpOrg = document.getElementById("inp-org");
const ctrlOrg = document.getElementById("ctrl-org");
const orgPages = document.getElementById("org-pages");
const orgStatus = document.getElementById("org-status");
const btnOrgSave = document.getElementById("btn-org-save");
const btnOrgReset = document.getElementById("btn-org-reset");

let pdfDoc = null;
let loading = false;
let saving = false;
let draggedPage = null;

if (dzOrg && inpOrg) {
  wireDrop(dzOrg, inpOrg);
  setupReordering();

  inpOrg.addEventListener("change", loadSelectedPdf);
  btnOrgSave?.addEventListener("click", saveOrganizedPdf);
  btnOrgReset?.addEventListener("click", resetOrganizer);
} else {
  console.warn("PDF Organizer elements not found.");
}

async function loadSelectedPdf() {
  const file = inpOrg.files?.[0];
  if (!file || loading) return;

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showAlert("Select a valid PDF file.", "error");
    inpOrg.value = "";
    return;
  }

  loading = true;
  btnOrgSave.disabled = true;
  btnOrgReset.disabled = true;
  ctrlOrg.classList.add("hidden");
  orgPages.innerHTML = "";
  await disposePdf();

  try {
    orgStatus.textContent = "Loading PDF…";
    const pdfjsLib = await ensurePdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;

    ctrlOrg.classList.remove("hidden");
    orgStatus.textContent = "Loaded " + pdfDoc.numPages + " page(s). Drag to reorder, or use the arrow controls.";

    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
      orgStatus.textContent = "Preparing page previews · " + pageNumber + " / " + pdfDoc.numPages;
      const page = await pdfDoc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(0.32, 180 / base.width, 240 / base.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Could not render a page preview.");
      await page.render({ canvasContext: context, viewport }).promise;
      page.cleanup?.();

      orgPages.appendChild(createPageCard(pageNumber - 1, pageNumber, canvas));
      await nextFrame();
    }

    renumberPages();
    orgStatus.textContent = pdfDoc.numPages + " page(s) ready. Reorder or remove pages, then save.";
  } catch (error) {
    console.error("PDF load failed:", error);
    await disposePdf();
    orgStatus.textContent = "Could not open this PDF: " + (error?.message || "Unknown error");
    showAlert("Could not open this PDF. It may be damaged or password-protected.", "error");
  } finally {
    loading = false;
    btnOrgSave.disabled = !pdfDoc || orgPages.children.length === 0;
    btnOrgReset.disabled = false;
  }
}

function createPageCard(index, displayNumber, canvas) {
  const card = document.createElement("article");
  card.className =
    "page-card relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-2 shadow-sm transition-shadow hover:shadow-md";
  card.dataset.index = String(index);
  card.draggable = true;

  canvas.className = "block max-h-52 w-full rounded-lg bg-gray-50 object-contain";
  card.appendChild(canvas);

  const footer = document.createElement("div");
  footer.className = "mt-2 flex items-center justify-between gap-2";
  const number = document.createElement("span");
  number.className = "page-number text-xs font-semibold text-gray-600";
  number.textContent = "Page " + displayNumber;

  const actions = document.createElement("div");
  actions.className = "page-actions flex items-center gap-1";

  const up = createActionButton("↑", "Move page up", "text-gray-600 hover:bg-emerald-50");
  up.addEventListener("click", () => {
    const previous = card.previousElementSibling;
    if (previous) orgPages.insertBefore(card, previous);
    renumberPages();
  });

  const down = createActionButton("↓", "Move page down", "text-gray-600 hover:bg-emerald-50");
  down.addEventListener("click", () => {
    const next = card.nextElementSibling;
    if (next) orgPages.insertBefore(next, card);
    renumberPages();
  });

  const remove = createActionButton("×", "Remove page", "text-rose-600 hover:bg-rose-50");
  remove.addEventListener("click", () => {
    card.remove();
    canvas.width = canvas.height = 0;
    renumberPages();
  });

  actions.append(up, down, remove);
  footer.append(number, actions);
  card.appendChild(footer);
  return card;
}

function createActionButton(label, ariaLabel, extraClass) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.title = ariaLabel;
  button.className =
    "flex h-8 w-8 items-center justify-center rounded-lg text-base font-semibold transition-colors " + extraClass;
  return button;
}

function setupReordering() {
  // These delegated listeners are registered once, not once per PDF load.
  orgPages.addEventListener("dragstart", event => {
    const card = event.target.closest(".page-card");
    if (!card) return;
    draggedPage = card;
    card.classList.add("opacity-50");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.index || "");
    }
  });

  orgPages.addEventListener("dragover", event => {
    if (!draggedPage) return;
    event.preventDefault();
    const target = event.target.closest(".page-card");
    if (!target || target === draggedPage) return;

    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    orgPages.insertBefore(draggedPage, before ? target : target.nextElementSibling);
  });

  orgPages.addEventListener("drop", event => {
    if (draggedPage) event.preventDefault();
  });

  orgPages.addEventListener("dragend", () => {
    draggedPage?.classList.remove("opacity-50");
    draggedPage = null;
    renumberPages();
  });
}

function renumberPages() {
  const cards = Array.from(orgPages.querySelectorAll(".page-card"));
  cards.forEach((card, index) => {
    const label = card.querySelector(".page-number");
    if (label) label.textContent = "Page " + (index + 1);
    const up = card.querySelector('button[aria-label="Move page up"]');
    const down = card.querySelector('button[aria-label="Move page down"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === cards.length - 1;
  });

  btnOrgSave.disabled = loading || saving || cards.length === 0 || !pdfDoc;
  if (cards.length === 0 && pdfDoc) {
    orgStatus.textContent = "All pages removed. Add a page back or reset to load the PDF again.";
  }
}

async function saveOrganizedPdf() {
  if (!pdfDoc || saving) return;
  const order = Array.from(orgPages.querySelectorAll(".page-card"))
    .map(card => Number.parseInt(card.dataset.index, 10))
    .filter(Number.isInteger);

  if (!order.length) {
    showAlert("Keep at least one page in the PDF.", "warning");
    return;
  }

  saving = true;
  btnOrgSave.disabled = true;
  btnOrgReset.disabled = true;
  orgStatus.textContent = "Building your organized PDF…";

  let url = null;
  try {
    const { PDFDocument } = await ensurePdfLib();
    const original = await PDFDocument.load(await pdfDoc.getData());
    const output = await PDFDocument.create();

    for (const pageIndex of order) {
      const [page] = await output.copyPages(original, [pageIndex]);
      output.addPage(page);
      await nextFrame();
    }

    const bytes = await output.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: "application/pdf" });
    url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Organized_" + Date.now() + ".pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    orgStatus.textContent =
      "Saved successfully · " + order.length + " page(s) · " +
      (blob.size / 1024 / 1024).toFixed(2) + " MB";
    showAlert("Organized PDF downloaded.", "success");
  } catch (error) {
    console.error("PDF save failed:", error);
    orgStatus.textContent = "Could not save PDF: " + (error?.message || "Unknown error");
    showAlert("Could not save the organized PDF.", "error");
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 15000);
    saving = false;
    btnOrgSave.disabled = !pdfDoc || order.length === 0;
    btnOrgReset.disabled = false;
  }
}

async function resetOrganizer() {
  if (loading || saving) return;
  inpOrg.value = "";
  orgPages.querySelectorAll("canvas").forEach(canvas => {
    canvas.width = canvas.height = 0;
  });
  orgPages.innerHTML = "";
  ctrlOrg.classList.add("hidden");
  orgStatus.textContent = "";
  await disposePdf();
  btnOrgSave.disabled = true;
}

async function disposePdf() {
  if (!pdfDoc) return;
  const oldDocument = pdfDoc;
  pdfDoc = null;
  try {
    await oldDocument.destroy();
  } catch (error) {
    console.warn("PDF cleanup warning:", error);
  }
}
