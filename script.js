// ---------------- COOKIE HELPERS ----------------
function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}

function getCookie(name) {
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

// ---------------- DATA MODEL ----------------
let shoppingLists = [];
let currentListId = null;

// generate simple unique id
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function getCurrentList() {
  return shoppingLists.find(l => l.id === currentListId) || null;
}

function saveToCookies() {
  setCookie("shoppingLists", JSON.stringify(shoppingLists));
  if (currentListId) setCookie("currentListId", currentListId);
}

// ---------------- LOAD FROM COOKIES ----------------
function loadFromCookies() {
  const json = getCookie("shoppingLists");
  const currentIdCookie = getCookie("currentListId");

  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        shoppingLists = parsed.map(l => ({
          id: String(l.id),
          name: String(l.name || "Untitled"),
          items: Array.isArray(l.items)
            ? l.items
                .filter(it => it && typeof it.name === "string" && typeof it.price === "number")
                .map(it => ({ name: it.name, price: it.price }))
            : []
        }));
      }
    } catch {
      // ignore bad cookie
    }
  }

  if (!shoppingLists.length) {
    const defaultList = {
      id: generateId(),
      name: "Default list",
      items: []
    };
    shoppingLists.push(defaultList);
    currentListId = defaultList.id;
  } else {
    currentListId = shoppingLists.some(l => l.id === currentIdCookie)
      ? currentIdCookie
      : shoppingLists[0].id;
  }
}

// ---------------- DOM ELEMENTS ----------------
const listSelect = document.getElementById("listSelect");
const newListNameInput = document.getElementById("newListName");
const createListBtn = document.getElementById("createListBtn");

const addItemForm = document.getElementById("addItemForm");
const itemNameInput = document.getElementById("itemName");
const itemPriceInput = document.getElementById("itemPrice");
const itemsTableBody = document.querySelector("#itemsTable tbody");
const totalPriceSpan = document.getElementById("totalPrice");

const shareCodeTextarea = document.getElementById("shareCode");
const refreshShareCodeBtn = document.getElementById("refreshShareCodeBtn");

const importCodeTextarea = document.getElementById("importCode");
const importBtn = document.getElementById("importBtn");

// ---------------- RENDER FUNCTIONS ----------------
function renderListSelect() {
  listSelect.innerHTML = "";
  shoppingLists.forEach(list => {
    const opt = document.createElement("option");
    opt.value = list.id;
    opt.textContent = list.name;
    if (list.id === currentListId) opt.selected = true;
    listSelect.appendChild(opt);
  });
}

function renderItems() {
  const list = getCurrentList();
  if (!list) return;

  itemsTableBody.innerHTML = "";
  list.items.forEach(item => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = item.name;

    const priceTd = document.createElement("td");
    priceTd.textContent = item.price.toFixed(2);

    tr.appendChild(nameTd);
    tr.appendChild(priceTd);
    itemsTableBody.appendChild(tr);
  });
}

function renderTotal() {
  const list = getCurrentList();
  if (!list) {
    totalPriceSpan.textContent = "0.00";
    return;
  }
  const total = list.items.reduce((sum, item) => sum + item.price, 0);
  totalPriceSpan.textContent = total.toFixed(2);
}

function renderShareCode() {
  const list = getCurrentList();
  if (!list) {
    shareCodeTextarea.value = "";
    return;
  }
  const payload = {
    name: list.name,
    items: list.items
  };
  const json = JSON.stringify(payload);
  const code = btoa(encodeURIComponent(json));
  shareCodeTextarea.value = code;
}

function renderAll() {
  renderListSelect();
  renderItems();
  renderTotal();
  renderShareCode();
}

// ---------------- LIST MANAGEMENT ----------------
createListBtn.addEventListener("click", () => {
  const name = newListNameInput.value.trim() || "New list";
  const newList = {
    id: generateId(),
    name,
    items: []
  };
  shoppingLists.push(newList);
  currentListId = newList.id;

  newListNameInput.value = "";
  saveToCookies();
  renderAll();
});

listSelect.addEventListener("change", () => {
  currentListId = listSelect.value;
  saveToCookies();
  renderAll();
});

// ---------------- ADD ITEM ----------------
addItemForm.addEventListener("submit", event => {
  event.preventDefault();

  const list = getCurrentList();
  if (!list) return;

  const name = itemNameInput.value.trim();
  const priceStr = itemPriceInput.value.trim();

  if (!name || !priceStr) return;

  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    alert("Please enter a valid non-negative price.");
    return;
  }

  list.items.push({ name, price });

  itemNameInput.value = "";
  itemPriceInput.value = "";

  saveToCookies();
  renderItems();
  renderTotal();
  renderShareCode();
});

// ---------------- IMPORT & MERGE ----------------
importBtn.addEventListener("click", () => {
  const list = getCurrentList();
  if (!list) {
    alert("No current list selected.");
    return;
  }

  const code = importCodeTextarea.value.trim();
  if (!code) {
    alert("Please paste a code to import.");
    return;
  }

  let imported;
  try {
    const json = decodeURIComponent(atob(code));
    imported = JSON.parse(json);
  } catch {
    alert("Invalid code format.");
    return;
  }

  if (!imported || !Array.isArray(imported.items)) {
    alert("This code does not contain a valid list.");
    return;
  }

  const importedItems = imported.items
    .filter(it => typeof it.name === "string" && typeof it.price === "number")
    .map(it => ({ name: it.name, price: it.price }));

  if (!importedItems.length) {
    alert("The imported list has no valid items.");
    return;
  }

  // Merge with duplicate handling
  importedItems.forEach(newItem => {
    const existingIndex = list.items.findIndex(
      it => it.name.trim().toLowerCase() === newItem.name.trim().toLowerCase()
    );

    if (existingIndex === -1) {
      // no duplicate, just add
      list.items.push(newItem);
    } else {
      const existing = list.items[existingIndex];
      const message =
        `Item "${newItem.name}" already exists.\n\n` +
        `Existing price: ${existing.price.toFixed(2)}\n` +
        `Imported price: ${newItem.price.toFixed(2)}\n\n` +
        `OK = Merge (use imported price)\n` +
        `Cancel = Keep both (add duplicate item)`;

      if (confirm(message)) {
        // merge: update existing price
        list.items[existingIndex].price = newItem.price;
      } else {
        // keep duplicate as separate row
        list.items.push(newItem);
      }
    }
  });

  importCodeTextarea.value = "";
  saveToCookies();
  renderItems();
  renderTotal();
  renderShareCode();
});

// ---------------- SHARE CODE REFRESH ----------------
refreshShareCodeBtn.addEventListener("click", () => {
  renderShareCode();
});

// ---------------- INIT ----------------
loadFromCookies();
renderAll();
