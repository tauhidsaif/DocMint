console.log("DocMint main loaded");

// ---------- Routing between tools ----------
const buttons = Array.from(document.querySelectorAll(".tool-btn"));
const sections = Array.from(document.querySelectorAll(".tool"));
const content = document.getElementById("content");

function showTool(id) {
  sections.forEach((s) => s.classList.add("hidden"));
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
  buttons.forEach((b) =>
    b.setAttribute("aria-current", b.dataset.target === id)
  );
  content?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Add click handlers safely
buttons.forEach((b) => {
  b.addEventListener("click", () => {
    const target = b.dataset.target;
    if (target) showTool(target);
  });
});

// ---------- Search filter ----------
const search = document.getElementById("search");
if (search) {
  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    buttons.forEach((b) => {
      const t = b.textContent.toLowerCase();
      b.classList.toggle("hidden", !t.includes(q));
    });
  });
}

// ---------- Helpers (shared utilities) ----------
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
export const toMB = (n) => (n / 1024 / 1024).toFixed(2) + " MB";

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch])
  );

// ---------- Drag & Drop (shared) ----------
export function wireDrop(dz, input) {
  if (!dz || !input) return; // prevent null errors

  // Click to open file selector
  dz.addEventListener("click", () => input.click());

  // Highlight on drag
  ["dragenter", "dragover"].forEach((eName) =>
    dz.addEventListener(eName, (e) => {
      e.preventDefault();
      dz.classList.add("bg-emerald-100", "border-emerald-500");
    })
  );

  // Remove highlight when leaving
  ["dragleave", "drop"].forEach((eName) =>
    dz.addEventListener(eName, (e) => {
      e.preventDefault();
      dz.classList.remove("bg-emerald-100", "border-emerald-500");
    })
  );

  // Handle file drop
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files?.length) {
      input.files = files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}
