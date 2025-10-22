console.log("DocMint main loaded");

// ---------- Routing between tools ----------
const buttons = Array.from(document.querySelectorAll(".tool-btn"));
const sections = Array.from(document.querySelectorAll(".tool"));
const content = document.getElementById("content");

function showTool(id) {
  sections.forEach((s) => s.classList.add("hidden"));
  document.getElementById("home-section")?.classList.add("hidden"); // ⬅️ add this
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
  buttons.forEach((b) =>
    b.setAttribute("aria-current", b.dataset.target === id)
  );
  content?.scrollIntoView({ behavior: "smooth", block: "start" });
}
// Go Home function (works for logo, title, and subtitle)
function goHome() {
  sections.forEach((s) => s.classList.add("hidden"));
  document.getElementById("home-section")?.classList.remove("hidden");
  buttons.forEach((b) => b.removeAttribute("aria-current"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Wait until DOM is ready, then attach all 3 click listeners
document.addEventListener("DOMContentLoaded", () => {
  const logo = document.getElementById("go-home-logo");
  const container = document.getElementById("go-home-container");
  const title = document.getElementById("go-home");

  logo?.addEventListener("click", goHome);
  container?.addEventListener("click", goHome);
  title?.addEventListener("click", goHome);
});


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


// ---------- Beautiful Alert System ----------
export function showAlert(message, type = 'success', duration = 4000) {
  const icons = {
    success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>`,
    error: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>`,
    warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
    </svg>`,
    info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>`
  };

  const alert = document.createElement('div');
  alert.className = `docmint-alert ${type}`;
  alert.innerHTML = `
    <div class="docmint-alert-icon">${icons[type] || icons.info}</div>
    <div class="docmint-alert-content">${escapeHtml(message)}</div>
    <button class="docmint-alert-close" aria-label="Close">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  `;

  document.body.appendChild(alert);

  // Close button handler
  const closeBtn = alert.querySelector('.docmint-alert-close');
  const removeAlert = () => {
    alert.classList.add('removing');
    setTimeout(() => alert.remove(), 300);
  };
  closeBtn.addEventListener('click', removeAlert);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(removeAlert, duration);
  }

  return alert;
}