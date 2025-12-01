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
const clearItemsBtn = document.getElementById("clearItemsBtn");
const deleteListBtn = document.getElementById("deleteListBtn");

const addItemForm = document.getElementById("addItemForm");
const itemNameInput = document.getElementById("itemName");
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

const sortByNameBtn = document.getElementById("sortByNameBtn");
const sortByPriceBtn = document.getElementById("sortByPriceBtn");

// View navigation
const navButtons = document.querySelectorAll("[data-view-target]");
const viewSections = document.querySelectorAll("section[data-view]");

let currentView = "items"; // default view

// ---------------- VIEW HANDLING ----------------
function setView(viewName) {
  currentView = viewName;
  viewSections.forEach(section => {
    const v = section.getAttribute("data-view");
    if (v === viewName) {
      section.classList.remove("view-hidden");
    } else {
      section.classList.add("view-hidden");
    }
  });

  navButtons.forEach(btn => {
    if (btn.getAttribute("data-view-target") === viewName) {
      btn.classList.add("contrast");
    } else {
      btn.classList.remove("contrast");
    }
  });
}

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-view-target");
    setView(target);
  });
});

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

function deleteItemAtIndex(index) {
  const list = getCurrentList();
  if (!list) return;
  if (index < 0 || index >= list.items.length) return;

  list.items.splice(index, 1);
  saveToCookies();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
}

function renderItems() {
  const list = getCurrentList();
  if (!list) return;

  itemsTableBody.innerHTML = "";

  list.items.forEach((item, index) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = item.name;

    const priceTd = document.createElement("td");
    priceTd.textContent = item.price.toFixed(2);

    const actionsTd = document.createElement("td");

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.className = "secondary";
    editBtn.addEventListener("click", () => {
      editItem(index);
    });

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "secondary contrast";
    deleteBtn.style.marginLeft = "0.25rem";
    deleteBtn.addEventListener("click", () => {
      const ok = confirm(`Delete "${item.name}" from this list?`);
      if (ok) deleteItemAtIndex(index);
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(nameTd);
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
      lines.push(`- ${item.name}: ${item.price.toFixed(2)}`);
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
  saveToCookies();
  renderAll();
  setView("items");
});

listSelect.addEventListener("change", () => {
  currentListId = listSelect.value;
  saveToCookies();
  renderAll();
});

clearItemsBtn.addEventListener("click", () => {
  const list = getCurrentList();
  if (!list) return;

  const ok = confirm(`Clear all items from "${list.name}"?`);
  if (!ok) return;

  list.items = [];
  saveToCookies();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
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

  saveToCookies();
  renderAll();
});

// ---------------- ADD & EDIT ITEMS ----------------
addItemForm.addEventListener("submit", event => {
  event.preventDefault(); // IMPORTANT: prevents page reload

  const list = getCurrentList();
  if (!list) return;

  const name = itemNameInput.value.trim();
  const priceStr = itemPriceInput.value.trim();

  if (!name || !priceStr) {
    alert("Please fill in both name and price.");
    return;
  }

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
  updatePerPerson();
});

function editItem(index) {
  const list = getCurrentList();
  if (!list) return;
  const item = list.items[index];
  if (!item) return;

  const newName = prompt("Edit item name:", item.name);
  if (newName === null) return; // cancelled

  const trimmedName = newName.trim();
  if (!trimmedName) {
    alert("Name cannot be empty.");
    return;
  }

  const priceStr = prompt("Edit item price:", item.price.toFixed(2));
  if (priceStr === null) return;

  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    alert("Please enter a valid non-negative price.");
    return;
  }

  list.items[index] = { name: trimmedName, price };
  saveToCookies();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
}

// ---------------- SORTING ----------------
sortByNameBtn.addEventListener("click", () => {
  const list = getCurrentList();
  if (!list) return;

  list.items.sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
  saveToCookies();
  renderItems();
});

sortByPriceBtn.addEventListener("click", () => {
  const list = getCurrentList();
  if (!list) return;

  list.items.sort((a, b) => a.price - b.price);
  saveToCookies();
  renderItems();
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
        `OK = Merge (use imported price)\n` +
        `Cancel = Keep both (add duplicate item)`;

      if (confirm(message)) {
        list.items[existingIndex].price = newItem.price;
      } else {
        list.items.push(newItem);
      }
    }
  });

  importCodeTextarea.value = "";
  saveToCookies();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
});

// ---------------- SHARE & SUMMARY ----------------
refreshShareCodeBtn.addEventListener("click", () => {
  renderShareCode();
});

generateSummaryBtn.addEventListener("click", () => {
  renderSummary();
});

// per-person changes
splitPeopleInput.addEventListener("input", () => {
  updatePerPerson();
});

// ---------------- INIT ----------------
loadFromCookies();
renderAll();
setView("items"); // start on items view
updatePerPerson();
