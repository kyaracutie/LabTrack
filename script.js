import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";



/* LABTRACK
   Original-style interface + student/staff roles + borrowing and returns.
   Prototype storage: localStorage in this browser.
*/

const STORAGE_KEY = "labtrack_original_v3";
const THEME_KEY = "labtrack_theme_v3";


const INITIAL_ITEMS = [
  {
    id: "LT001", name: "Test Tube", category: "Glassware",
    total: 43, available: 42, location: "Cabinet A1",
    symbol: "🧪",
    description: "A small cylindrical tube used to hold, mix, or heat small quantities of substances.",
    uses: ["Holding small samples.", "Mixing small quantities of liquids.", "Heating suitable samples when used with proper equipment."],
    safety: ["Use a test-tube holder when heating.", "Never point a heated test tube toward another person.", "Check for cracks before use."]
  },
  {
    id: "LT002", name: "Beaker (250 mL)", category: "Glassware",
    total: 20, available: 20, location: "Cabinet A2",
    symbol: "⚗️",
    description: "A wide-mouthed container used for mixing, holding, and heating liquids.",
    uses: ["Holding and mixing solutions.", "Heating compatible liquids.", "Estimating liquid volume."],
    safety: ["Use heat-resistant beakers for heating.", "Do not use a beaker as a substitute for precise volume measurement.", "Inspect glass for cracks."]
  },
  {
    id: "LT003", name: "Graduated Cylinder", category: "Measuring Equipment",
    total: 12, available: 12, location: "Cabinet B1",
    symbol: "📏",
    description: "A tall measuring vessel used to measure liquid volume.",
    uses: ["Measuring liquid volumes.", "Reading the meniscus at eye level."],
    safety: ["Place it on a flat surface.", "Handle glass cylinders carefully.", "Do not heat unless the equipment is specifically designed for it."]
  },
  {
    id: "LT004", name: "Erlenmeyer Flask", category: "Glassware",
    total: 15, available: 15, location: "Cabinet A3",
    symbol: "⚗️",
    description: "A conical flask useful for mixing liquids with reduced risk of splashing.",
    uses: ["Swirling and mixing solutions.", "Holding liquids during experiments.", "Some heating applications when suitable."],
    safety: ["Use appropriate protective equipment.", "Check for cracks.", "Use a suitable heat source and heat-resistant flask."]
  },
  {
    id: "LT005", name: "Volumetric Flask", category: "Glassware",
    total: 10, available: 10, location: "Cabinet A4",
    symbol: "🧪",
    description: "A flask calibrated to contain one specific volume, commonly used to prepare solutions.",
    uses: ["Preparing standard solutions.", "Making a solution up to a calibration mark."],
    safety: ["Do not heat unless specifically permitted.", "Read the calibration mark at eye level.", "Use the correct stopper."]
  },
  {
    id: "LT006", name: "Funnel", category: "Glassware",
    total: 18, available: 18, location: "Cabinet B2",
    symbol: "🔻",
    description: "A cone-shaped tool that guides liquids into narrow containers and can support filtration.",
    uses: ["Transferring liquids.", "Supporting filter paper during filtration."],
    safety: ["Secure the funnel properly.", "Pour slowly to prevent overflow.", "Clean after use."]
  },
  {
    id: "LT007", name: "Glass Stirring Rod", category: "Glassware",
    total: 25, available: 25, location: "Cabinet B3",
    symbol: "〰️",
    description: "A glass rod used to stir solutions and help guide liquid while pouring.",
    uses: ["Stirring mixtures.", "Guiding liquid during transfer."],
    safety: ["Avoid excessive force.", "Check for chipped or broken ends.", "Do not use damaged rods."]
  },
  {
    id: "LT008", name: "Dropper", category: "Transfer Equipment",
    total: 20, available: 20, location: "Cabinet B4",
    symbol: "💧",
    description: "A tool used to transfer small amounts of liquid, usually drop by drop.",
    uses: ["Adding liquid in small quantities.", "Transferring samples when appropriate."],
    safety: ["Do not use the same dropper for incompatible chemicals.", "Never pipette by mouth.", "Follow laboratory disposal rules."]
  },
  {
    id: "LT009", name: "Microscope", category: "Optical Equipment",
    total: 5, available: 5, location: "Equipment Shelf 1",
    symbol: "🔬",
    description: "An optical instrument used to magnify small objects and structures.",
    uses: ["Viewing cells and microorganisms.", "Examining prepared slides."],
    safety: ["Carry with two hands.", "Begin focusing with the low-power objective.", "Clean lenses only with approved lens paper."]
  },
  {
    id: "LT010", name: "Digital Balance", category: "Measuring Equipment",
    total: 4, available: 4, location: "Equipment Shelf 2",
    symbol: "⚖️",
    description: "An instrument used to measure the mass of an object or sample.",
    uses: ["Measuring sample mass.", "Weighing materials for experiments."],
    safety: ["Keep liquids away from the instrument.", "Use a weighing container.", "Follow the balance's calibration and zeroing instructions."]
  },
  {
    id: "LT011", name: "Thermometer", category: "Measuring Equipment",
    total: 10, available: 10, location: "Cabinet C1",
    symbol: "🌡️",
    description: "An instrument used to measure temperature.",
    uses: ["Measuring liquid or environmental temperature.", "Monitoring temperature changes."],
    safety: ["Use the correct temperature range.", "Avoid impacts and sudden temperature changes.", "Report damaged thermometers."]
  },
  {
    id: "LT012", name: "Forceps", category: "Tools",
    total: 15, available: 15, location: "Cabinet C2",
    symbol: "🗜️",
    description: "A grasping tool used to hold small objects or specimens.",
    uses: ["Picking up small objects.", "Handling specimens that should not be touched directly."],
    safety: ["Use the appropriate type for the task.", "Clean after use.", "Do not use damaged forceps."]
  }
];

const app = document.getElementById("app");
const toast = document.getElementById("toast");
const modalRoot = document.getElementById("modal-root");

let currentUser = null;
let currentPage = "dashboard";
let selectedGuideId = "LT001";
let searchText = "";
let recordSearchText = "";
let cameraStream = null;
let cameraActive = false;
let toastTimer = null;

function cloneInitialItems() {
  return INITIAL_ITEMS.map(item => ({
    ...item,
    uses: [...item.uses],
    safety: [...item.safety]
  }));
}

function freshData() {
  return {
    items: cloneInitialItems(),
    records: [],
    nextRecordId: 1
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return freshData();

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.records)) {
      return freshData();
    }

    return parsed;
  } catch (error) {
    console.error("LabTrack storage could not be loaded:", error);
    return freshData();
  }
}

let data = {
  items: [],
  records: []
};

let unsubscribeInventory = null;
let unsubscribeRecords = null;

function startInventorySync() {
  // Stop the previous listener before starting another one.
  if (unsubscribeInventory) {
    unsubscribeInventory();
    unsubscribeInventory = null;
  }

  unsubscribeInventory = onSnapshot(
    collection(db, "inventory"),
    snapshot => {
      data.items = snapshot.docs.map(itemDoc => ({
        id: itemDoc.id,
        ...itemDoc.data()
      }));

      renderApp();
    },
    error => {
      console.error("Inventory sync error:", error);
      showToast("Could not synchronize inventory.");
    }
  );
}

function startRecordsSync() {
  if (unsubscribeRecords) {
    unsubscribeRecords();
    unsubscribeRecords = null;
  }

  if (!currentUser) return;

  const recordsRef = collection(db, "records");

  const recordsQuery = roleIsStaff()
    ? recordsRef
    : query(
        recordsRef,
        where("studentUid", "==", currentUser.uid)
      );

  unsubscribeRecords = onSnapshot(
    recordsQuery,
    snapshot => {
      data.records = snapshot.docs.map(recordDoc => ({
        id: recordDoc.id,
        ...recordDoc.data()
      }));

      renderApp();
    },
    error => {
      console.error("Records sync error:", error);
      showToast("Could not synchronize borrowing records.");
    }
  );
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("LabTrack storage could not be saved:", error);
    showToast("Could not save. Browser storage may be full or unavailable.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function dateText(value) {
  if (!value) return "—";

  const date = value?.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showModal(title, message, confirmText, onConfirm) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <section class="modal-card" role="dialog" aria-modal="true"
               aria-labelledby="modalTitle">
        <h2 id="modalTitle">${escapeHTML(title)}</h2>
        <p>${escapeHTML(message).replace(/\n/g, "<br>")}</p>
        <div class="modal-actions">
          <button class="btn btn-outline" data-action="close-modal">Cancel</button>
          <button class="btn btn-primary" data-action="confirm-modal">
            ${escapeHTML(confirmText)}
          </button>
        </div>
      </section>
    </div>
  `;

  modalRoot._confirmAction = onConfirm;
}

function closeModal() {
  modalRoot.innerHTML = "";
  modalRoot._confirmAction = null;
}

function findItem(id) {
  const normalized = String(id || "").trim().toUpperCase();
  return data.items.find(item => item.id.toUpperCase() === normalized);
}

function findActiveRecord(itemId, studentUid) {
  return data.records.find(record =>
    record.itemId === itemId &&
    record.status === "Borrowed" &&
    record.studentUid === studentUid
  );
}

function activeRecords(name = null) {
  return data.records.filter(record =>
    record.status === "Borrowed" &&
    (name === null ||
      record.studentName.toLowerCase() === name.toLowerCase())
  );
}

function totalAvailable() {
  return data.items.reduce((sum, item) => sum + item.available, 0);
}

function totalUnits() {
  return data.items.reduce((sum, item) => sum + item.total, 0);
}

function roleIsStaff() {
  return currentUser?.role === "staff";
}

function statusBadge(status) {
  const css = status === "Returned"
    ? "badge-returned"
    : status === "Borrowed"
      ? "badge-borrowed"
      : "badge-pending";

  return `<span class="badge ${css}">${escapeHTML(status)}</span>`;
}

function stockBadge(item) {
  if (item.enabled === false) {
    return '<span class="badge badge-unavailable">Disabled by staff</span>';
  }

  return item.available > 0
    ? '<span class="badge badge-available">Available</span>'
    : '<span class="badge badge-unavailable">Out of stock</span>';
}

function statCard(label, value, icon, caption = "") {
  return `
    <article class="stat-card">
      <div class="stat-top">
        <span>${escapeHTML(label)}</span>
        <span class="stat-icon">${icon}</span>
      </div>
      <div class="stat-value">${value}</div>
      <div class="stat-caption">${escapeHTML(caption)}</div>
    </article>
  `;
}

/* ---------- Login and welcome ---------- */

function renderWelcome() {
  stopCamera();

  app.innerHTML = `
    <section class="welcome-screen">
      <div class="welcome-content">
        <div class="logo">
  <img src="images/logo.png" alt="LabTrack Logo" class="logo-img">
</div>
        <p class="eyebrow">YOUR DIGITAL LABORATORY ASSISTANT</p>
        <h1>Welcome to <span>LabTrack.</span></h1>
        <p class="welcome-description">
          Identify laboratory apparatus, learn how to use them,
          and keep track of every borrowing and return in one place.
        </p>
        <button class="btn btn-primary" data-action="show-login">
          Get Started <span>→</span>
        </button>
        <div class="welcome-features">
          <span>⌕ QR Scanner</span>
          <span>◷ Borrowing Logbook</span>
          <span>▦ Apparatus Guide</span>
        </div>
      </div>
      <div class="welcome-art">
        <div class="art-circle"></div>
        <div class="art-card art-card-one">
          <span class="art-icon">⚗</span><span>Laboratory tools</span>
        </div>
        <div class="art-card art-card-two">
          <span class="art-icon">▦</span><span>Smart inventory</span>
        </div>
        <div class="art-glass">⚗</div>
        <div class="art-caption">CHEM-Q Tech.</div>
      </div>
    </section>
  `;
}

function renderLogin() {
  stopCamera();

  app.innerHTML = `
    <section class="login-wrap">
      <div class="login-card">

        <div class="logo">
          <img src="images/logo.png" alt="LabTrack Logo" class="logo-img">
        </div>

        <p class="eyebrow">LABORATORY MANAGEMENT</p>
        <h1>Log in to LabTrack</h1>
        <p class="muted">Access your laboratory account.</p>

        <form id="loginForm">

          <div id="nameField">
            <label class="form-label" for="loginName">Full name</label>
            <input
              id="loginName"
              name="loginName"
              placeholder="Enter your full name"
              autocomplete="name"
            >
          </div>

          <label class="form-label" for="loginEmail">Email address</label>
          <input
            id="loginEmail"
            name="loginEmail"
            type="email"
            placeholder="Enter your Gmail address"
            autocomplete="email"
            required
          >

          <label class="form-label" for="loginPassword">Password</label>

          <div style="display:flex; gap:8px; align-items:center;">
            <input
              id="loginPassword"
              name="loginPassword"
              type="password"
              placeholder="Enter your password"
              autocomplete="current-password"
              style="flex:1; min-width:0;"
              required
            >

            <button
              type="button"
              class="btn btn-outline"
              data-action="toggle-password"
              data-target="loginPassword"
            >Show</button>
          </div>

          <button
            class="btn btn-primary btn-block"
            type="submit"
            id="loginSubmit"
          >
            Log In →
          </button>

        </form>

        <div style="margin-top:16px;">
          <button
            class="btn btn-outline btn-block"
            type="button"
            id="registerToggle"
          >
            Create Student Account
          </button>
        </div>

        <p class="small muted" style="margin-top:20px;">
          Laboratory staff must use their authorized staff account.
        </p>

        <button
          class="btn btn-outline btn-block"
          data-action="show-welcome"
        >
          ← Back to Welcome
        </button>

      </div>
    </section>
  `;

  let registrationMode = false;

  const form = document.getElementById("loginForm");
  const nameField = document.getElementById("nameField");
  const nameInput = document.getElementById("loginName");
  const passwordInput = document.getElementById("loginPassword");
  const submitButton = document.getElementById("loginSubmit");
  const registerButton = document.getElementById("registerToggle");

  registerButton.addEventListener("click", () => {
    registrationMode = !registrationMode;

    nameField.style.display = registrationMode ? "block" : "none";
    nameInput.required = registrationMode;

    submitButton.textContent = registrationMode
      ? "Create Account →"
      : "Log In →";

    registerButton.textContent = registrationMode
      ? "Already have an account? Log In"
      : "Create Student Account";

    passwordInput.autocomplete = registrationMode
      ? "new-password"
      : "current-password";
  });

  nameField.style.display = "none";
}



function login(name, role) {
  currentUser = { name: name.trim(), role };
  currentPage = "dashboard";
  searchText = "";
  renderApp();
}

/* ---------- Navigation and application shell ---------- */

function navItems() {
  if (roleIsStaff()) {
    return [
      ["dashboard", "⌂", "Dashboard"],
      ["inventory", "▦", "Inventory"],
      ["records", "◷", "All Track Records"],
      ["scanner", "⌕", "QR Scanner"],
      ["guide", "⚗", "Apparatus Guide"],
      ["settings", "⚙", "Customize Design"]
    ];
  }

  return [
    ["dashboard", "⌂", "Dashboard"],
    ["scanner", "⌕", "QR Scanner"],
    ["guide", "⚗", "Apparatus Guide"],
    ["myrecords", "◷", "My Logbook"],
    ["settings", "⚙", "Customize Design"]
  ];
}

function pageHeader(title, description, extra = "") {
  return `
    <div class="page-header">
      <div>
        <h2>${title}</h2>
        <p>${description}</p>
      </div>
      ${extra}
    </div>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="nav-label">Workspace</div>
      ${navItems().map(([page, icon, label]) => `
        <button class="nav-btn ${currentPage === page ? "active" : ""}"
                data-action="navigate" data-page="${page}">
          <span class="nav-icon">${icon}</span>
          <span>${label}</span>
        </button>
      `).join("")}
      <div class="sidebar-note">
        <strong>LabTrack tip</strong><br>
        Scan an apparatus QR code to identify the item and start a borrowing
        or return transaction.
      </div>
    </aside>
  `;
}

function renderApp() {
  if (!currentUser) {
    renderWelcome();
    return;
  }

  stopCamera();

  let page = "";

  switch (currentPage) {
    case "dashboard":
      page = roleIsStaff() ? renderStaffDashboard() : renderStudentDashboard();
      break;
    case "inventory":
      page = roleIsStaff() ? renderInventoryPage() : renderStudentDashboard();
      break;
    case "records":
      page = roleIsStaff() ? renderAllRecords() : renderStudentDashboard();
      break;
    case "scanner":
      page = renderScannerPage();
      break;
    case "guide":
      page = renderGuidePage();
      break;
    case "myrecords":
      page = roleIsStaff() ? renderAllRecords() : renderMyRecords();
      break;
    case "settings":
      page = renderSettingsPage();
      break;
    default:
      currentPage = "dashboard";
      page = roleIsStaff() ? renderStaffDashboard() : renderStudentDashboard();
  }

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">
  <img src="images/logo.png" alt="LabTrack Logo" class="brand-logo-img">
</div>
          <div>
            <h1>LabTrack</h1>
            <p>Laboratory Equipment Management</p>
          </div>
        </div>
        <div class="topbar-actions">
          <span class="role-chip">
            ${roleIsStaff() ? "Laboratory Staff" : "Student"}
          </span>
          <button class="btn" data-action="logout">Log out</button>
        </div>
      </header>
      <div class="workspace">
        ${renderSidebar()}
        <main class="main-content">${page}</main>
      </div>
    </div>
  `;

  applySavedTheme();
}

function navigate(page) {
  currentPage = page;
  searchText = "";
  renderApp();
}

/* ---------- Student dashboard ---------- */

function renderStudentDashboard() {
  const active = activeRecords(currentUser.name).length;

  return `
    ${pageHeader(
      `Hello, ${escapeHTML(currentUser.name)}! 👋`,
      "Find your laboratory apparatus, borrow items, and keep track of returns.",
      `<button class="btn btn-primary" data-action="navigate" data-page="scanner">
        ⌕ Scan QR Code
      </button>`
    )}

    <div class="notice">
      <span class="notice-icon">ⓘ</span>
      <span>
        <strong>Borrowing and returns:</strong> Borrowing decreases the
        available quantity. When you physically return an apparatus, scan
        its QR code again and confirm the return to update the inventory.
      </span>
    </div>

    <div class="stats-grid">
      ${statCard("Available Units", totalAvailable(), "▦", "Across all apparatus")}
      ${statCard("My Active Borrowings", active, "◷", "Items not yet returned")}
      ${statCard("Apparatus Types", data.items.length, "⚗", "Available in the guide")}
      ${statCard("My Transactions", data.records.filter(r =>
        r.studentName.toLowerCase() === currentUser.name.toLowerCase()
      ).length, "✓", "Borrowing and return records")}
    </div>

    ${renderApparatusPanel()}
  `;
}

/* ---------- Staff dashboard ---------- */

function renderStaffDashboard() {
  const returned = data.records.filter(r => r.status === "Returned").length;

  return `
    ${pageHeader(
      "Laboratory Staff Dashboard",
      `Welcome, ${escapeHTML(currentUser.name)}. Monitor the inventory and borrowing logbook.`
    )}

    <div class="notice">
      <span class="notice-icon">ⓘ</span>
      <span>
        Review the track records after each borrowing or return. This
        demonstration stores records in the current browser only.
      </span>
    </div>

    <div class="stats-grid">
      ${statCard("Total Units", totalUnits(), "▦", "All inventory")}
      ${statCard("Available Units", totalAvailable(), "✓", "Ready for borrowing")}
      ${statCard("Currently Borrowed", activeRecords().length, "◷", "Active transactions")}
      ${statCard("Completed Returns", returned, "↩", "Return confirmations")}
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Quick Actions</h3>
          <p>Manage the laboratory inventory and transaction history.</p>
        </div>
      </div>
      <div class="search-bar">
        <button class="btn btn-primary" data-action="navigate" data-page="records">
          View All Track Records
        </button>
        <button class="btn btn-secondary" data-action="navigate" data-page="inventory">
          Open Inventory
        </button>
        <button class="btn btn-outline" data-action="navigate" data-page="scanner">
          Scan Apparatus
        </button>
      </div>
    </section>

    ${recordsTable(data.records.slice().reverse().slice(0, 8), false, "Recent Transactions")}
    ${renderInventoryTable(false)}
  `;
}

/* ---------- Apparatus cards and inventory ---------- */

function renderApparatusPanel() {
  const term = searchText.toLowerCase();

  const items = data.items.filter(item =>
    item.name.toLowerCase().includes(term) ||
    item.id.toLowerCase().includes(term) ||
    item.category.toLowerCase().includes(term)
  );

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Laboratory Apparatus</h3>
          <p>Search the guide or borrow an available item.</p>
        </div>
        <button class="btn btn-secondary" data-action="navigate" data-page="guide">
          Open Guide
        </button>
      </div>

      <div class="search-bar">
        <input id="apparatusSearch" type="search"
          placeholder="Search by name, category, or ID..."
          value="${escapeHTML(searchText)}">
        <button class="btn btn-outline" data-action="clear-search">Clear</button>
      </div>

      <div id="apparatusGrid" class="apparatus-grid">
        ${renderApparatusCards(items)}
      </div>
    </section>
  `;
}

function renderApparatusCards(items) {
  if (!items.length) {
    return '<div class="empty-state">No matching apparatus found.</div>';
  }

  return items.map(item => `
    <article class="apparatus-card">
      <div class="apparatus-symbol">${escapeHTML(item.symbol || "⚗")}</div>
      <span class="apparatus-id">${escapeHTML(item.id)}</span>
      <h3>${escapeHTML(item.name)}</h3>
      <p>${escapeHTML(item.category)}<br>Location: ${escapeHTML(item.location)}</p>
      ${stockBadge(item)}
      <div class="stock-count">
        ${item.available}
        <small>of ${item.total} available</small>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary"
          data-action="borrow" data-id="${escapeHTML(item.id)}"
          ${roleIsStaff() || item.available < 1 || item.enabled === false ? "disabled" : ""}>
          Borrow One
        </button>
        <button class="btn btn-outline"
          data-action="open-guide" data-id="${escapeHTML(item.id)}">
          View Instructions
        </button>
        <button class="btn btn-secondary"
          data-action="identify" data-id="${escapeHTML(item.id)}">
          Apparatus Details
        </button>
      </div>
    </article>
  `).join("");
}

function renderInventoryTable(showTitle = true) {
  return `
    <section class="panel">
      ${showTitle ? `
        <div class="panel-header">
          <div>
            <h3>Inventory Overview</h3>
            <p>Update apparatus quantities and laboratory availability.</p>
          </div>
        </div>
      ` : ""}

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Apparatus ID</th>
              <th>Apparatus</th>
              <th>Location</th>
              <th>Total Units</th>
              <th>Available</th>
              <th>Enable Borrowing</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${escapeHTML(item.id)}</td>
                <td>${escapeHTML(item.name)}</td>
                <td>${escapeHTML(item.location)}</td>
                <td>
                  <input
                    type="number"
                    id="inventory-total-${escapeHTML(item.id)}"
                    min="0"
                    step="1"
                    value="${item.total}"
                    aria-label="Total units for ${escapeHTML(item.name)}"
                    style="width:90px"
                  >
                </td>
                <td><strong>${item.available}</strong></td>
                <td>
                  <input
                    type="checkbox"
                    id="inventory-enabled-${escapeHTML(item.id)}"
                    ${item.enabled !== false ? "checked" : ""}
                    aria-label="Enable borrowing for ${escapeHTML(item.name)}"
                    style="width:auto"
                  >
                </td>
                <td>${stockBadge(item)}</td>
                <td>
                  <button
                    class="btn btn-primary btn-small"
                    data-action="save-inventory-item"
                    data-id="${escapeHTML(item.id)}"
                  >Save</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderInventoryPage() {
  if (!roleIsStaff()) {
    return renderStudentDashboard();
  }

  return `
    ${pageHeader(
      "Inventory",
      "Manage apparatus quantities and choose which items students can borrow."
    )}

    <div class="notice">
      <span class="notice-icon">✓</span>
      <span>
        Set the total physical stock and enable or disable borrowing for
        each apparatus. Available quantities update automatically when
        borrowing records are taken into account.
      </span>
    </div>

    ${renderInventoryTable()}
  `;
}

/* ---------- Borrowing and returning ---------- */

function borrowItem(itemId) {
  if (!currentUser || roleIsStaff()) {
    showToast("Borrowing is available from the student interface.");
    return;
  }

  const item = findItem(itemId);

  if (!item) {
    showToast("Apparatus not found.");
    return;
  }

  if (item.enabled === false) {
  showToast("This apparatus has been disabled by laboratory staff.");
  return;
}

  if (item.available < 1) {
    showToast("This apparatus is currently unavailable.");
    return;
  }

  if (findActiveRecord(item.id, currentUser.uid)) {
    showToast("You already have an active borrowing for this apparatus.");
    return;
  }

  showModal(
    "Confirm Borrowing",
    `Borrow one ${item.name} (${item.id})?\n\nAvailable now: ${item.available}.\nAfter borrowing: ${item.available - 1}.`,
    "Confirm Borrow",
    () => completeBorrow(item.id)
  );
}

async function completeBorrow(itemId) {
  if (!currentUser || roleIsStaff()) return;

  const itemRef = doc(db, "inventory", itemId);
  const recordRef = doc(collection(db, "records"));

  try {
    if (findActiveRecord(itemId, currentUser.uid)) {
      showToast("You already have an active borrowing for this apparatus.");
      closeModal();
      return;
    }

    await runTransaction(db, async transaction => {
      const itemSnapshot = await transaction.get(itemRef);

      if (!itemSnapshot.exists()) {
        throw new Error("APPARATUS_NOT_FOUND");
      }

      const item = itemSnapshot.data();

      if (item.enabled === false) {
        throw new Error("APPARATUS_DISABLED");
      }

      if (item.available < 1) {
        throw new Error("OUT_OF_STOCK");
      }

      transaction.update(itemRef, {
        available: item.available - 1
      });

      transaction.set(recordRef, {
        studentUid: currentUser.uid,
        studentName: currentUser.name,
        itemId: itemId,
        itemName: item.name,
        quantity: 1,
        borrowedAt: serverTimestamp(),
        returnedAt: null,
        status: "Borrowed"
      });
    });

    closeModal();
    showToast("Borrowing recorded successfully.");
    currentPage = "myrecords";
    renderApp();

  } catch (error) {
    console.error("Borrowing transaction error:", error);

    const messages = {
      APPARATUS_NOT_FOUND: "Apparatus not found.",
      APPARATUS_DISABLED: "This apparatus is currently disabled.",
      OUT_OF_STOCK: "No units are currently available."
    };

    showToast(
      messages[error.message] ||
      "Could not complete borrowing. Check your connection and Firebase permissions."
    );
  }
}

function confirmReturn(recordId) {
  if (!currentUser || roleIsStaff()) {
    showToast("Return confirmation is available from the student interface.");
    return;
  }

  const record = data.records.find(r => r.id === String(recordId));

  if (!record) {
    showToast("Borrowing record not found.");
    return;
  }

  if (record.studentUid !== currentUser.uid) {
    showToast("You can only return your own borrowing records.");
    return;
  }

  if (record.status !== "Borrowed") {
    showToast("This borrowing has already been returned.");
    return;
  }

  showModal(
    "Confirm Apparatus Return",
    `Are you sure you have physically returned ${record.itemName} (${record.itemId})?`,
    "Confirm Return",
    () => completeReturn(record.id)
  );
}

async function completeReturn(recordId) {
  if (!currentUser || roleIsStaff()) return;

  const recordRef = doc(db, "records", String(recordId));

  try {
    await runTransaction(db, async transaction => {
      const recordSnapshot = await transaction.get(recordRef);

      if (!recordSnapshot.exists()) {
        throw new Error("RECORD_NOT_FOUND");
      }

      const record = recordSnapshot.data();

      if (record.studentUid !== currentUser.uid) {
        throw new Error("NOT_OWNER");
      }

      if (record.status !== "Borrowed") {
        throw new Error("ALREADY_RETURNED");
      }

      const itemRef = doc(db, "inventory", record.itemId);
      const itemSnapshot = await transaction.get(itemRef);

      if (!itemSnapshot.exists()) {
        throw new Error("APPARATUS_NOT_FOUND");
      }

      const item = itemSnapshot.data();

      if (item.available >= item.total) {
        throw new Error("INVENTORY_LIMIT");
      }

      transaction.update(recordRef, {
        status: "Returned",
        returnedAt: serverTimestamp()
      });

      transaction.update(itemRef, {
        available: item.available + 1
      });
    });

    closeModal();
    showToast("Return recorded successfully.");
    currentPage = "myrecords";
    renderApp();

  } catch (error) {
    console.error("Return transaction error:", error);

    const messages = {
      RECORD_NOT_FOUND: "Borrowing record not found.",
      NOT_OWNER: "You cannot return another student's record.",
      ALREADY_RETURNED: "This apparatus has already been returned.",
      APPARATUS_NOT_FOUND: "The apparatus is missing from inventory.",
      INVENTORY_LIMIT: "Inventory count has reached its total."
    };

    showToast(
      messages[error.message] ||
      "Could not complete return. Check your connection and Firebase permissions."
    );
  }
}

/* ---------- QR scanner ---------- */

function renderScannerPage() {
  return `
    ${pageHeader(
      "QR Code Scanner",
      "Scan an apparatus label to identify it and start a borrowing or return."
    )}

    <div class="notice">
      <span class="notice-icon">⌕</span>
      <span>
        Each apparatus QR code should contain its unique ID, such as
        <strong>LT001</strong>. Camera scanning requires browser support
        and a secure connection such as HTTPS or localhost.
      </span>
    </div>

    <div class="scan-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Scan with Camera</h3>
            <p>Point your camera at the QR label.</p>
          </div>
        </div>

        <div class="scan-illustration">
          <div>
            <div class="qr-symbol">▦</div>
            <p>Position the apparatus QR code inside the camera view.</p>
          </div>
        </div>

        <button class="btn btn-primary btn-block" data-action="start-camera">
          Start Camera Scanner
        </button>
        <button class="btn btn-outline btn-block" data-action="stop-camera">
          Stop Camera
        </button>

        <video id="scanVideo" class="scan-video hidden"
               autoplay muted playsinline></video>
        <p id="cameraStatus" class="small muted" aria-live="polite"></p>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Enter Apparatus ID</h3>
            <p>Use this if camera scanning is unavailable.</p>
          </div>
        </div>

        <form id="manualScanForm">
          <label class="form-label" for="manualApparatusId">Apparatus ID</label>
          <input id="manualApparatusId" name="manualApparatusId"
                 placeholder="Example: LT001" required>
          <button class="btn btn-primary btn-block" type="submit">
            Identify Apparatus
          </button>
        </form>

        <div class="notice" style="margin-top:20px">
          <span class="notice-icon">ⓘ</span>
          <span>
            Students can borrow an available item or confirm a return for
            their active borrowing. Staff can identify items and inspect records.
          </span>
        </div>
      </section>
    </div>
  `;
}

function processScannedCode(rawValue) {
  const raw = String(rawValue || "").trim();

  if (!raw) {
    showToast("No apparatus ID detected.");
    return;
  }

  let id = raw;

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      id = url.searchParams.get("id") ||
           url.searchParams.get("apparatus") ||
           raw;
    }
  } catch (_) {
    // Treat the value as a plain apparatus ID.
  }

  const item = findItem(id);

  if (!item) {
    showToast(`Unknown apparatus ID: ${id}`);
    return;
  }

  stopCamera();

  if (roleIsStaff()) {
    closeModal();
    showModal(
      item.name,
      `ID: ${item.id}\nCategory: ${item.category}\nAvailable: ${item.available} of ${item.total}\nLocation: ${item.location}`,
      "View Inventory",
      () => {
        closeModal();
        currentPage = "inventory";
        renderApp();
      }
    );
    return;
  }

  const active = findActiveRecord(item.id, currentUser.uid);

  if (active) {
    showModal(
      "Active Borrowing Found",
      `You have an active borrowing for ${item.name} (${item.id}).\n\nConfirm only if you have physically returned it to the laboratory.`,
      "Confirm Return",
      () => completeReturnFromScan(active.id)
    );
    return;
  }

  if (item.enabled === false || item.available < 1) {
  showToast(`${item.name} is currently unavailable.`);
  return;
}

  showModal(
    "Apparatus Identified",
    `${item.name} (${item.id})\n${item.available} units available.\n\nDo you want to borrow one?`,
    "Borrow One",
    () => completeBorrow(item.id)
  );
}

function completeReturnFromScan(recordId) {
  const record = data.records.find(
    r => r.id === String(recordId)
  );

  if (
    !record ||
    record.status !== "Borrowed" ||
    record.studentUid !== currentUser.uid
  ) {
    closeModal();
    showToast("This active borrowing could not be confirmed.");
    return;
  }

  completeReturn(record.id);
}

async function startCamera() {
  const video = document.getElementById("scanVideo");
  const status = document.getElementById("cameraStatus");

  if (!video || !status) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Camera access is unavailable. Use manual ID entry.";
    return;
  }

  if (!("BarcodeDetector" in window)) {
    status.textContent =
      "This browser does not support built-in QR detection. Use manual ID entry or try a supported browser.";
    return;
  }

  try {
    stopCamera();

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    video.srcObject = cameraStream;
    video.classList.remove("hidden");
    await video.play();

    status.textContent = "Camera active. Point it at a QR code.";
    cameraActive = true;

    const scanFrame = async () => {
      if (!cameraActive || !cameraStream) return;

      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video);

          if (codes.length && codes[0].rawValue) {
            const value = codes[0].rawValue;
            stopCamera();
            processScannedCode(value);
            return;
          }
        }
      } catch (error) {
        console.error("QR detection error:", error);
      }

      if (cameraActive) requestAnimationFrame(scanFrame);
    };

    requestAnimationFrame(scanFrame);
  } catch (error) {
    console.error("Camera startup failed:", error);
    status.textContent =
      "Camera could not start. Allow camera permission or use manual ID entry.";
    stopCamera();
  }
}

function stopCamera() {
  cameraActive = false;

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = document.getElementById("scanVideo");

  if (video) {
    video.pause();
    video.srcObject = null;
    video.classList.add("hidden");
  }
}

/* ---------- Apparatus guide ---------- */

function renderGuidePage() {
  const selected = findItem(selectedGuideId) || data.items[0];

  return `
    ${pageHeader(
      "Apparatus Guide",
      "Learn the purpose, common uses, and basic safety precautions for laboratory equipment."
    )}

    <div class="guide-layout">
      <section class="panel">
        <div class="panel-header">
          <h3>Apparatus List</h3>
        </div>
        <div class="guide-list">
          ${data.items.map(item => `
            <button class="guide-item ${item.id === selected.id ? "active" : ""}"
                    data-action="open-guide" data-id="${escapeHTML(item.id)}">
              <strong>${escapeHTML(item.name)}</strong>
              <span>${escapeHTML(item.id)} · ${escapeHTML(item.category)}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <section class="panel guide-detail">
        <div class="apparatus-symbol">${escapeHTML(selected.symbol || "⚗")}</div>
        <span class="apparatus-id">${escapeHTML(selected.id)}</span>
        <h2>${escapeHTML(selected.name)}</h2>
        <p>${escapeHTML(selected.description)}</p>

        <div class="notice">
          <span class="notice-icon">▦</span>
          <span>
            <strong>Inventory:</strong> ${selected.available} available out of
            ${selected.total}. Storage: ${escapeHTML(selected.location)}.
          </span>
        </div>

        <h3>Common Uses</h3>
        <ul>${selected.uses.map(use => `<li>${escapeHTML(use)}</li>`).join("")}</ul>

        <h3>Safety Reminders</h3>
        <ul>${selected.safety.map(rule => `<li>${escapeHTML(rule)}</li>`).join("")}</ul>

        ${roleIsStaff() ? "" : `
          <button class="btn btn-primary"
            data-action="borrow" data-id="${escapeHTML(selected.id)}"
            ${selected.available < 1 ? "disabled" : ""}>
            Borrow This Apparatus
          </button>
        `}
        <button class="btn btn-secondary"
          data-action="navigate" data-page="scanner">
          ⌕ Open QR Scanner
        </button>
      </section>
    </div>
  `;
}

/* ---------- Borrowing logbook and staff records ---------- */

function recordsTable(records, showStudentAction, title) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>${escapeHTML(title)}</h3>
          <p>Borrowing status, timestamps, and transaction history.</p>
        </div>
      </div>

      ${records.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Student</th>
                <th>Apparatus</th>
                <th>Borrowed At</th>
                <th>Returned At</th>
                <th>Status</th>
                ${showStudentAction ? "<th>Action</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${records.map(record => `
                <tr>
                  <td>#${record.id}</td>
                  <td>${escapeHTML(record.studentName)}</td>
                  <td>
                    ${escapeHTML(record.itemName)}
                    <div class="small muted">${escapeHTML(record.itemId)}</div>
                  </td>
                  <td>${dateText(record.borrowedAt)}</td>
                  <td>${dateText(record.returnedAt)}</td>
                  <td>${statusBadge(record.status)}</td>
                  ${showStudentAction ? `
                    <td>
                      ${record.status === "Borrowed" ? `
                        <button class="btn btn-secondary btn-small"
                          data-action="return-record" data-record="${record.id}">
                          Confirm Return
                        </button>
                      ` : "—"}
                    </td>
                  ` : ""}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty-state">
          <div style="font-size:2rem">◷</div>
          <strong>No transactions yet</strong>
          <p>Borrowed and returned apparatus will appear here.</p>
        </div>
      `}
    </section>
  `;
}

function renderMyRecords() {
  const records = data.records
    .filter(record =>
      record.studentName.toLowerCase() === currentUser.name.toLowerCase()
    )
    .slice()
    .reverse();

  return `
    ${pageHeader(
      "My Borrowing Logbook",
      "Review your active borrowings and previous return confirmations."
    )}
    <div class="notice">
      <span class="notice-icon">↩</span>
      <span>
        For a QR-based return, open QR Scanner and scan the apparatus again.
        You can also confirm a return from this logbook. Only confirm after
        physically handing the item back.
      </span>
    </div>
    ${recordsTable(records, true, "My Transactions")}
  `;
}

function renderAllRecords() {
  const records = data.records.slice().reverse();

  return `
    ${pageHeader(
      "All Track Records",
      "Laboratory staff can monitor who borrowed each apparatus and when it was returned.",
      `<button class="btn btn-outline" data-action="export-records">Export CSV</button>`
    )}

    <div class="stats-grid">
      ${statCard("All Transactions", data.records.length, "◷", "Total borrowing records")}
      ${statCard("Active Borrowings", activeRecords().length, "↗", "Not yet returned")}
      ${statCard("Completed Returns", data.records.filter(r =>
        r.status === "Returned"
      ).length, "✓", "Confirmed returns")}
      ${statCard("Available Units", totalAvailable(), "▦", "Current inventory")}
    </div>

    <section class="panel">
      <div class="search-bar">
        <input id="recordSearch" type="search"
          placeholder="Search by student, apparatus, ID, or status..."
          value="${escapeHTML(recordSearchText)}">
        <button class="btn btn-outline" data-action="clear-record-search">Clear</button>
      </div>
      <div id="recordResults">
        ${recordsTable(records, false, "Borrowing and Return History")}
      </div>
    </section>
  `;
}

/* ---------- Theme customization ---------- */

function defaultTheme() {
  return {
    primary: "#173f35",
    accent: "#75a98a",
    background: "#f5f8f5"
  };
}

function loadTheme() {
  try {
    return {
      ...defaultTheme(),
      ...(JSON.parse(localStorage.getItem(THEME_KEY) || "{}"))
    };
  } catch (_) {
    return defaultTheme();
  }
}


function applySavedTheme() {
  // Use the colors defined in style.css.
  // Do not override them with previously saved theme settings.
  localStorage.removeItem(THEME_KEY);
}


function hexToLight(hex) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "e4f1e9";
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  const mix = value => Math.round(value * .12 + 255 * .88);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function renderSettingsPage() {
  return `
    ${pageHeader(
      "Settings",
      "Manage LabTrack information and demonstration data."
    )}

    ${roleIsStaff() ? `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Staff Password</h3>
            <p>Change the password required for Laboratory Staff login.</p>
          </div>
        </div>

        <p class="small muted" style="margin-top:14px">
          After changing the password, use the new password at your next
          Laboratory Staff login.
        </p>
      </section>
    ` : ""}

    <section class="panel">
      <h3>Prototype Information</h3>

      <div class="setting-row">
        <div>
          <strong>Data storage</strong>
          <p>Records are saved in this browser using localStorage.</p>
        </div>
      </div>

      <div class="setting-row">
        <div>
          <strong>Staff access</strong>
          <p>
            Staff login requires a password in this browser-based
            demonstration. This is not secure server authentication.
          </p>
        </div>
      </div>

      <div class="setting-row">
        <div>
          <strong>Reset demo data</strong>
          <p>
            Restore the original apparatus quantities and clear all
            transactions.
          </p>
        </div>

        <button class="btn btn-danger" data-action="reset-data">
          Reset Data
        </button>
      </div>
    </section>
  `;
}

/* ---------- CSV export ---------- */

function exportRecords() {
  if (!roleIsStaff()) {
    showToast("Only laboratory staff can export all records.");
    return;
  }

  const fields = [
    "Record ID", "Student", "Apparatus ID", "Apparatus",
    "Borrowed At", "Returned At", "Status"
  ];

  const rows = data.records.map(record => [
    record.id,
    record.studentName,
    record.itemId,
    record.itemName,
    record.borrowedAt,
    record.returnedAt || "",
    record.status
  ]);

  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [fields, ...rows].map(row => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "LabTrack_Records.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Transaction records exported.");
}

/* ---------- Event handlers ---------- */


document.addEventListener("submit", async event => {
  if (event.target.id === "loginForm") {
  event.preventDefault();

  const nameInput = document.getElementById("loginName");
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const isRegistration = nameInput.required;
  const name = nameInput.value.trim();

  if (isRegistration && !name) {
    showToast("Enter your full name.");
    return;
  }

  const submitButton = document.getElementById("loginSubmit");
  submitButton.disabled = true;
  submitButton.textContent = "Please wait...";

  try {
    let userCredential;

    if (isRegistration) {
      // Create a student account.
      userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(userCredential.user, {
        displayName: name
      });

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        role: "student",
        createdAt: serverTimestamp()
      });

      showToast("Student account created successfully.");

    } else {
      // Sign in to an existing account.
      userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
    }

    const firebaseUser = userCredential.user;

    // Check whether this account is the authorized staff account.
    const staffRef = doc(db, "staff", firebaseUser.uid);
    const staffSnapshot = await getDoc(staffRef);

    let role = "student";

    if (staffSnapshot.exists() &&
        staffSnapshot.data().role === "staff") {
      role = "staff";
    }

    // Get the saved student profile, if one exists.
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnapshot = await getDoc(userRef);

    const savedName = userSnapshot.exists()
      ? userSnapshot.data().name
      : "";

    const displayName =
      firebaseUser.displayName ||
      savedName ||
      name ||
      email.split("@")[0];

    currentUser = {
      uid: firebaseUser.uid,
      name: displayName,
      email: firebaseUser.email,
      role: role
    };

    currentPage = "dashboard";
    searchText = "";

    renderApp();

  } catch (error) {
    console.error("Firebase login error:", error);

    const messages = {
      "auth/email-already-in-use": "This email already has an account. Please log in.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/weak-password": "Your password must contain at least 6 characters.",
      "auth/user-not-found": "No account was found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/network-request-failed": "Network error. Check your internet connection.",
      "permission-denied": "Firestore permission denied. Check your database rules.",
"unauthenticated": "Please log in again.",
"failed-precondition": "A required Firebase database condition was not met."
    };

    const errorMessage =
  messages[error.code] ||
  `${error.code || "Unknown error"}: ${error.message || "No additional details"}`;

showToast(errorMessage);

  } finally {
    const button = document.getElementById("loginSubmit");

    if (button) {
      button.disabled = false;
      button.textContent = isRegistration
        ? "Create Account →"
        : "Log In →";
    }
  }

  return;
}

  if (event.target.id === "manualScanForm") {
    event.preventDefault();
    processScannedCode(
      document.getElementById("manualApparatusId").value
    );
    return;
  }



  if (event.target.id === "themeForm") {
    event.preventDefault();

    const primary = document.getElementById("themePrimary").value.trim();
    const accent = document.getElementById("themeAccent").value.trim();
    const background = document.getElementById("themeBackground").value.trim();
    const hexPattern = /^#[0-9a-fA-F]{6}$/;

    if (![primary, accent, background].every(color => hexPattern.test(color))) {
      showToast("Use valid six-digit hex colors, such as #173F35.");
      return;
    }

    localStorage.setItem(THEME_KEY, JSON.stringify({
      primary,
      accent,
      background
    }));

    applySavedTheme();
    showToast("Theme saved.");
    renderApp();
  }
});


document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "toggle-password") {
  const targetId = button.dataset.target;
  const passwordInput = document.getElementById(targetId);

  if (!passwordInput) return;

  const showing = passwordInput.type === "password";

  passwordInput.type = showing ? "text" : "password";
  button.textContent = showing ? "Hide" : "Show";
  button.setAttribute(
    "aria-label",
    showing ? "Hide password" : "Show password"
  );

  return;
}
  const id = button.dataset.id;

  if (action === "show-login") renderLogin();
  if (action === "show-welcome") renderWelcome();

 if (action === "logout") {
  try {
    stopCamera();
    closeModal();

    await signOut(auth);

    currentUser = null;
    currentPage = "dashboard";
    searchText = "";

    renderWelcome();

  } catch (error) {
    console.error("Logout error:", error);
    showToast("Could not log out. Please try again.");
  }
}

  if (action === "navigate") {
    closeModal();
    navigate(button.dataset.page);
  }

  if (action === "borrow") borrowItem(id);


if (action === "save-inventory-item") {
  if (!roleIsStaff()) {
    showToast("Only laboratory staff can change inventory.");
    return;
  }

  const item = findItem(id);

  if (!item) {
    showToast("Apparatus not found.");
    return;
  }

  const totalInput = document.getElementById(
    `inventory-total-${id}`
  );
  const enabledInput = document.getElementById(
    `inventory-enabled-${id}`
  );

  if (!totalInput || !enabledInput) return;

  const newTotal = Number(totalInput.value);

  if (
    totalInput.value.trim() === "" ||
    !Number.isSafeInteger(newTotal) ||
    newTotal < 0
  ) {
    showToast("Enter a valid non-negative whole-number quantity.");
    return;
  }

  const borrowedCount = data.records.filter(record =>
    record.itemId === item.id &&
    record.status === "Borrowed"
  ).reduce((total, record) => total + (record.quantity || 1), 0);

  if (newTotal < borrowedCount) {
    showToast(
      `At least ${borrowedCount} total units are needed because that many are currently borrowed.`
    );
    return;
  }

  try {
    await updateDoc(doc(db, "inventory", item.id), {
      total: newTotal,
      available: newTotal - borrowedCount,
      enabled: enabledInput.checked
    });

    showToast(`${item.name} inventory updated successfully.`);
  } catch (error) {
    console.error("Inventory update error:", error);
    showToast("Could not update inventory. Check Firebase permissions.");
  }
}


  if (action === "return-record") {
    confirmReturn(button.dataset.record);
  }

  if (action === "open-guide") {
    selectedGuideId = id;
    currentPage = "guide";
    renderApp();
  }

  if (action === "identify") {
    const item = findItem(id);
    if (!item) return;

    showModal(
      item.name,
      `ID: ${item.id}\nCategory: ${item.category}\nAvailable: ${item.available} of ${item.total}\nLocation: ${item.location}`,
      "Open Guide",
      () => {
        closeModal();
        selectedGuideId = item.id;
        currentPage = "guide";
        renderApp();
      }
    );
  }

  if (action === "clear-search") {
    searchText = "";
    renderApp();
  }

  if (action === "start-camera") startCamera();

  if (action === "stop-camera") {
    stopCamera();
    const status = document.getElementById("cameraStatus");
    if (status) status.textContent = "Camera stopped.";
  }

  if (action === "close-modal") closeModal();

  if (action === "confirm-modal") {
    const callback = modalRoot._confirmAction;
    if (typeof callback === "function") callback();
  }

  if (action === "reset-theme") {
    localStorage.removeItem(THEME_KEY);
    applySavedTheme();
    renderApp();
    showToast("Theme reset.");
  }

  if (action === "reset-data") {
    showModal(
      "Reset LabTrack Data?",
      "This will restore the starting inventory and erase all borrowing and return records in this browser. This cannot be undone.",
      "Reset All Data",
      () => {
        data = freshData();
        saveData();
        closeModal();
        renderApp();
        showToast("Demo data reset.");
      }
    );
  }

  if (action === "export-records") exportRecords();

  if (action === "clear-record-search") {
    recordSearchText = "";
    renderApp();
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "apparatusSearch") {
    searchText = event.target.value;

    const grid = document.getElementById("apparatusGrid");
    if (!grid) return;

    const term = searchText.toLowerCase();
    const filtered = data.items.filter(item =>
      item.name.toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );

    grid.innerHTML = renderApparatusCards(filtered);
  }

  if (event.target.id === "recordSearch") {
    recordSearchText = event.target.value;

    const term = recordSearchText.toLowerCase();
    const filtered = data.records.slice().reverse().filter(record =>
      record.studentName.toLowerCase().includes(term) ||
      record.itemName.toLowerCase().includes(term) ||
      record.itemId.toLowerCase().includes(term) ||
      record.status.toLowerCase().includes(term)
    );

    const results = document.getElementById("recordResults");
    if (results) {
      results.innerHTML = recordsTable(
        filtered, false, "Borrowing and Return History"
      );
    }
  }
});

document.addEventListener("change", event => {
  if (event.target.matches("#themeForm input")) {
    const input = event.target;
    const preview = input.parentElement.querySelector(".color-preview");

    if (preview && /^#[0-9a-fA-F]{6}$/.test(input.value.trim())) {
      preview.style.background = input.value.trim();
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopCamera();
});

// Start at the original welcome screen and restore the selected theme.
applySavedTheme();
renderWelcome();

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    try {
      const staffRef = doc(db, "staff", firebaseUser.uid);
      const staffSnapshot = await getDoc(staffRef);

      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnapshot = await getDoc(userRef);

      const role =
        staffSnapshot.exists() &&
        staffSnapshot.data().role === "staff"
          ? "staff"
          : "student";

      const savedName = userSnapshot.exists()
        ? userSnapshot.data().name
        : "";

      currentUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName ||
              savedName ||
              firebaseUser.email.split("@")[0],
        email: firebaseUser.email,
        role: role
      };

      currentPage = "dashboard";
startInventorySync();
startRecordsSync();
renderApp();

    } catch (error) {
      console.error("Authentication state error:", error);
      showToast("Could not load your account.");
    }
  } else {
  if (unsubscribeInventory) {
  unsubscribeInventory();
  unsubscribeInventory = null;
}

if (unsubscribeRecords) {
  unsubscribeRecords();
  unsubscribeRecords = null;
}

  currentUser = null;
  data.items = [];
  renderWelcome();
}
});
