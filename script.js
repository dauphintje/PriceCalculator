// ---------------- UTILITIES ----------------
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

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function loadLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function showMessage(type, text) {
  // type: "info" | "error"
  const area = document.getElementById("messageArea");
  if (!area) return;

  const article = document.createElement("article");
  article.setAttribute("role", "status");
  if (type === "error") {
    article.setAttribute("data-theme", "danger");
  }

  article.textContent = text;
  area.innerHTML = "";
  area.appendChild(article);

  setTimeout(() => {
    if (area.contains(article)) {
      area.removeChild(article);
    }
  }, 4000);
}

// ---------------- DATA MODEL ----------------
let shoppingLists = [];
let currentListId = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function getCurrentList() {
  return shoppingLists.find(l => l.id === currentListId) || null;
}

function saveState() {
  const json = JSON.stringify(shoppingLists);
  setCookie("shoppingLists", json);
  saveLocal("shoppingLists", json);

  if (currentListId) {
    setCookie("currentListId", currentListId);
    saveLocal("currentListId", currentListId);
  }
}

function loadState() {
  let json = loadLocal("shoppingLists") || getCookie("shoppingLists");
  const currentIdCookie = loadLocal("currentListId") || getCookie("currentListId");

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
                .map(it => ({
                  name: it.name,
                  price: it.price,
                  category: typeof it.category === "string" ? it.category : ""
                }))
            : []
        }));
      }
    } catch {
      showMessage("error", "Saved data was corrupted. Starting fresh.");
      shoppingLists = [];
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
const clearItemsBtn = document.getElementById("clearItemsBtn");
const deleteListBtn = document.getElementById("deleteListBtn");

const addItemForm = document.getElementById("addItemForm");
const itemNameInput = document.getElementById("itemName");
const itemCategoryInput = document.getElementById("itemCategory");
const itemPriceInput = document.getElementById("itemPrice");
const itemsTableBody = document.querySelector("#itemsTable tbody");
const totalPriceSpan = document.getElementById("totalPrice");

const splitPeopleInput = document.getElementById("splitPeople");
const perPersonInput = document.getElementById("perPerson");

const shareCodeTextarea = document.getElementById("shareCode");
const refreshShareCodeBtn = document.getElementById("refreshShareCodeBtn");

const summaryTextTextarea = document.getElementById("summaryText");
const generateSummaryBtn = document.getElementById("generateSummaryBtn");

const importCodeTextarea = document.getElementById("importCode");
const importBtn = document.getElementById("importBtn");

const sortSelect = document.getElementById("sortSelect");
const searchInput = document.getElementById("searchInput");

// MENU COLLAPSE
const topBar = document.querySelector(".top-bar");
const topBarExtra = document.getElementById("topBarExtra");
const menuToggleBtn = document.getElementById("menuToggleBtn");

// ---------------- RENDER ----------------
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

function deleteItemAtIndex(index) {
  const list = getCurrentList();
  if (!list) return;
  if (index < 0 || index >= list.items.length) return;

  list.items.splice(index, 1);
  saveState();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
  showMessage("info", "Item deleted.");
}

function editItem(index) {
  const list = getCurrentList();
  if (!list) return;
  const item = list.items[index];
  if (!item) return;

  const newName = prompt("Edit item name:", item.name);
  if (newName === null) return;
  const trimmedName = newName.trim();
  if (!trimmedName) {
    showMessage("error", "Name cannot be empty.");
    return;
  }

  const newCategory = prompt("Edit category:", item.category || "");
  if (newCategory === null) return;

  const priceStr = prompt("Edit item price:", item.price.toFixed(2));
  if (priceStr === null) return;

  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    showMessage("error", "Please enter a valid non-negative price.");
    return;
  }

  list.items[index] = {
    name: trimmedName,
    category: newCategory.trim(),
    price
  };

  saveState();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
  showMessage("info", "Item updated.");
}

function applySortAndFilter(items) {
  let filtered = [...items];

  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(q);
      const catMatch = (item.category || "").toLowerCase().includes(q);
      return nameMatch || catMatch;
    });
  }

  const sortMode = sortSelect.value;
  if (sortMode === "name") {
    filtered.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  } else if (sortMode === "price") {
    filtered.sort((a, b) => a.price - b.price);
  }

  return filtered;
}

function renderItems() {
  const list = getCurrentList();
  if (!list) return;

  itemsTableBody.innerHTML = "";

  const itemsToShow = applySortAndFilter(list.items);

  if (!itemsToShow.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No items to show.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    itemsTableBody.appendChild(tr);
    return;
  }

  itemsToShow.forEach(item => {
    const actualIndex = list.items.indexOf(item);

    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = item.name;

    const catTd = document.createElement("td");
    catTd.textContent = item.category || "";

    const priceTd = document.createElement("td");
    priceTd.textContent = item.price.toFixed(2);

    const actionsTd = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.className = "secondary";
    editBtn.addEventListener("click", () => {
      editItem(actualIndex);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "secondary contrast";
    deleteBtn.style.marginLeft = "0.25rem";
    deleteBtn.addEventListener("click", () => {
      const ok = confirm(`Delete "${item.name}" from this list?`);
      if (ok) deleteItemAtIndex(actualIndex);
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(nameTd);
    tr.appendChild(catTd);
    tr.appendChild(priceTd);
    tr.appendChild(actionsTd);
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

function updatePerPerson() {
  const list = getCurrentList();
  if (!list || !list.items.length) {
    perPersonInput.value = "";
    return;
  }
  const total = list.items.reduce((sum, item) => sum + item.price, 0);
  let people = parseInt(splitPeopleInput.value, 10);
  if (isNaN(people) || people <= 0) {
    perPersonInput.value = "";
    return;
  }
  const each = total / people;
  perPersonInput.value = each.toFixed(2);
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

function renderSummary() {
  const list = getCurrentList();
  if (!list) {
    summaryTextTextarea.value = "";
    return;
  }

  const lines = [];
  lines.push(`Shopping list: ${list.name}`);
  if (!list.items.length) {
    lines.push("No items.");
  } else {
    list.items.forEach(item => {
      const cat = item.category ? ` (${item.category})` : "";
      lines.push(`- ${item.name}${cat}: ${item.price.toFixed(2)}`);
    });
    const total = list.items.reduce((sum, item) => sum + item.price, 0);
    lines.push("");
    lines.push(`Total: ${total.toFixed(2)}`);
  }

  summaryTextTextarea.value = lines.join("\n");
}

function renderAll() {
  renderListSelect();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
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
  saveState();
  renderAll();
  showMessage("info", `Created list "${name}".`);
});

listSelect.addEventListener("change", () => {
  currentListId = listSelect.value;
  saveState();
  renderAll();
  showMessage("info", "Switched list.");
});

clearItemsBtn.addEventListener("click", () => {
  const list = getCurrentList();
  if (!list) return;

  const ok = confirm(`Clear all items from "${list.name}"?`);
  if (!ok) return;

  list.items = [];
  saveState();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
  showMessage("info", "All items cleared.");
});

deleteListBtn.addEventListener("click", () => {
  const list = getCurrentList();
  if (!list) return;

  if (shoppingLists.length === 1) {
    const ok = confirm(
      `"${list.name}" is your only list.\nIf you delete it, a new empty default list will be created.\n\nContinue?`
    );
    if (!ok) return;

    shoppingLists = [];
    const defaultList = {
      id: generateId(),
      name: "Default list",
      items: []
    };
    shoppingLists.push(defaultList);
    currentListId = defaultList.id;
  } else {
    const ok = confirm(`Delete the list "${list.name}" and all its items?`);
    if (!ok) return;

    shoppingLists = shoppingLists.filter(l => l.id !== list.id);
    currentListId = shoppingLists[0].id;
  }

  saveState();
  renderAll();
  showMessage("info", "List deleted.");
});

// ---------------- ADD ITEM ----------------
addItemForm.addEventListener("submit", event => {
  event.preventDefault();

  const list = getCurrentList();
  if (!list) {
    showMessage("error", "No list selected.");
    return;
  }

  const name = itemNameInput.value.trim();
  const category = itemCategoryInput.value.trim();
  const priceStr = itemPriceInput.value.trim();

  if (!name || !priceStr) {
    showMessage("error", "Please fill in at least name and price.");
    return;
  }

  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    showMessage("error", "Please enter a valid non-negative price.");
    return;
  }

  list.items.push({ name, category, price });

  itemNameInput.value = "";
  itemCategoryInput.value = "";
  itemPriceInput.value = "";

  saveState();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
  showMessage("info", "Item added.");
});

// ---------------- SORT & SEARCH ----------------
sortSelect.addEventListener("change", () => {
  renderItems();
});

searchInput.addEventListener("input", () => {
  renderItems();
});

// ---------------- IMPORT & MERGE ----------------
importBtn.addEventListener("click", () => {
  const list = getCurrentList();
  if (!list) {
    showMessage("error", "No current list selected.");
    return;
  }

  const code = importCodeTextarea.value.trim();
  if (!code) {
    showMessage("error", "Please paste a code to import.");
    return;
  }

  let imported;
  try {
    const json = decodeURIComponent(atob(code));
    imported = JSON.parse(json);
  } catch {
    showMessage("error", "Invalid code format.");
    return;
  }

  if (!imported || !Array.isArray(imported.items)) {
    showMessage("error", "This code does not contain a valid list.");
    return;
  }

  const importedItems = imported.items
    .filter(it => typeof it.name === "string" && typeof it.price === "number")
    .map(it => ({
      name: it.name,
      price: it.price,
      category: typeof it.category === "string" ? it.category : ""
    }));

  if (!importedItems.length) {
    showMessage("error", "The imported list has no valid items.");
    return;
  }

  importedItems.forEach(newItem => {
    const existingIndex = list.items.findIndex(
      it => it.name.trim().toLowerCase() === newItem.name.trim().toLowerCase()
    );

    if (existingIndex === -1) {
      list.items.push(newItem);
    } else {
      const existing = list.items[existingIndex];
      const message =
        `Item "${newItem.name}" already exists.\n\n` +
        `Existing price: ${existing.price.toFixed(2)}\n` +
        `Imported price: ${newItem.price.toFixed(2)}\n\n` +
        `OK = Merge (use imported price & category)\n` +
        `Cancel = Keep both (add duplicate item)`;

      if (confirm(message)) {
        list.items[existingIndex].price = newItem.price;
        list.items[existingIndex].category = newItem.category;
      } else {
        list.items.push(newItem);
      }
    }
  });

  importCodeTextarea.value = "";
  saveState();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
  showMessage("info", "List imported and merged.");
});

// ---------------- SHARE & SUMMARY ----------------
refreshShareCodeBtn.addEventListener("click", () => {
  renderShareCode();
  showMessage("info", "Share code refreshed.");
});

generateSummaryBtn.addEventListener("click", () => {
  renderSummary();
  showMessage("info", "Summary generated.");
});

splitPeopleInput.addEventListener("input", () => {
  updatePerPerson();
});

// ---------------- MENU COLLAPSE LOGIC ----------------
function applyMenuCollapsed(collapsed) {
  if (!topBar || !topBarExtra || !menuToggleBtn) return;

  if (collapsed) {
    topBar.classList.add("menu-collapsed");
    menuToggleBtn.textContent = "More";
  } else {
    topBar.classList.remove("menu-collapsed");
    menuToggleBtn.textContent = "Less";
  }

  // store preference
  saveLocal("menuCollapsed", collapsed ? "1" : "0");
}

menuToggleBtn.addEventListener("click", () => {
  const isCollapsed = topBar.classList.contains("menu-collapsed");
  applyMenuCollapsed(!isCollapsed);
});

// ---------------- INIT ----------------
loadState();
renderAll();
updatePerPerson();
showMessage("info", "Shopping lists loaded.");

// restore menu collapsed state
const menuCollapsedSaved = loadLocal("menuCollapsed");
if (menuCollapsedSaved === "1") {
  applyMenuCollapsed(true);
} else {
  applyMenuCollapsed(false);
}
