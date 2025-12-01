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
const shareMenuOptions = document.getElementById("shareMenuOptions");

const summaryTextTextarea = document.getElementById("summaryText");
const generateSummaryBtn = document.getElementById("generateSummaryBtn");

const importCodeTextarea = document.getElementById("importCode");
const importBtn = document.getElementById("importBtn");

const sortSelect = document.getElementById("sortSelect");
const searchInput = document.getElementById("searchInput");

const topBar = document.querySelector(".top-bar");
const dialogBackdrop = document.getElementById("dialogBackdrop");
const dialogTitle = document.getElementById("dialogTitle");
const dialogContent = document.getElementById("dialogContent");
const dialogCancel = document.getElementById("dialogCancel");
const dialogConfirm = document.getElementById("dialogConfirm");
const topBarMenu = document.querySelector(".top-bar-menu");
const menuToggle = document.querySelector(".menu-toggle");

async function openDialog({
  title = "",
  message = "",
  contentNode = null,
  confirmText = "Confirm",
  cancelText = "Cancel",
  focusElement = null
} = {}) {
  if (!dialogBackdrop || !dialogTitle || !dialogContent || !dialogCancel || !dialogConfirm) {
    return false;
  }

  dialogTitle.textContent = title;
  dialogContent.innerHTML = "";

  if (contentNode) {
    dialogContent.appendChild(contentNode);
  } else if (message) {
    const p = document.createElement("p");
    p.textContent = message;
    dialogContent.appendChild(p);
  }

  dialogConfirm.textContent = confirmText;
  dialogCancel.textContent = cancelText;

  dialogBackdrop.hidden = false;

  const target = focusElement || dialogConfirm;
  setTimeout(() => {
    target?.focus();
  }, 0);

  return new Promise(resolve => {
    function cleanup(result) {
      dialogBackdrop.hidden = true;
      dialogConfirm.removeEventListener("click", onConfirm);
      dialogCancel.removeEventListener("click", onCancel);
      dialogBackdrop.removeEventListener("click", onBackdropClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }

    function onConfirm(event) {
      event.preventDefault();
      cleanup(true);
    }

    function onCancel(event) {
      event.preventDefault();
      cleanup(false);
    }

    function onBackdropClick(event) {
      if (event.target === dialogBackdrop) {
        cleanup(false);
      }
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(false);
      } else if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
        event.preventDefault();
        cleanup(true);
      }
    }

    dialogConfirm.addEventListener("click", onConfirm);
    dialogCancel.addEventListener("click", onCancel);
    dialogBackdrop.addEventListener("click", onBackdropClick);
    document.addEventListener("keydown", onKeydown);
  });
}

function confirmDialog(message, options = {}) {
  return openDialog({
    title: options.title || "Confirm",
    message,
    confirmText: options.confirmText || "Confirm",
    cancelText: options.cancelText || "Cancel"
  });
}

async function promptItemDetails(existingItem) {
  const form = document.createElement("form");
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Item name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = existingItem.name;
  nameInput.required = true;
  nameLabel.appendChild(nameInput);

  const categoryLabel = document.createElement("label");
  categoryLabel.textContent = "Category";
  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.value = existingItem.category || "";
  categoryLabel.appendChild(categoryInput);

const priceLabel = document.createElement("label");
  priceLabel.textContent = "Price";
  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.step = "0.01";
  priceInput.min = "0";
  priceInput.value = existingItem.price.toFixed(2);
  priceLabel.appendChild(priceInput);

  form.appendChild(nameLabel);
  form.appendChild(categoryLabel);
  form.appendChild(priceLabel);

  const confirmed = await openDialog({
    title: "Edit item",
    contentNode: form,
    confirmText: "Save",
    cancelText: "Cancel",
    focusElement: nameInput
  });

  if (!confirmed) return null;

  const trimmedName = nameInput.value.trim();
  const trimmedCategory = categoryInput.value.trim();
  const priceValue = parseFloat(priceInput.value.trim());

  if (!trimmedName) {
    showMessage("error", "Name cannot be empty.");
    return null;
  }

  if (isNaN(priceValue) || priceValue < 0) {
    showMessage("error", "Please enter a valid non-negative price.");
    return null;
  }

  return {
    name: trimmedName,
    category: trimmedCategory,
    price: priceValue
  };
}

async function promptItemDetails(existingItem) {
  const form = document.createElement("form");
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Item name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = existingItem.name;
  nameInput.required = true;
  nameLabel.appendChild(nameInput);

  const categoryLabel = document.createElement("label");
  categoryLabel.textContent = "Category";
  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.value = existingItem.category || "";
  categoryLabel.appendChild(categoryInput);

  const priceLabel = document.createElement("label");
  priceLabel.textContent = "Price";
  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.step = "0.01";
  priceInput.min = "0";
  priceInput.value = existingItem.price.toFixed(2);
  priceLabel.appendChild(priceInput);

  form.appendChild(nameLabel);
  form.appendChild(categoryLabel);
  form.appendChild(priceLabel);

  const confirmed = await openDialog({
    title: "Edit item",
    contentNode: form,
    confirmText: "Save",
    cancelText: "Cancel",
    focusElement: nameInput
  });

  if (!confirmed) return null;

  const trimmedName = nameInput.value.trim();
  const trimmedCategory = categoryInput.value.trim();
  const priceValue = parseFloat(priceInput.value.trim());

  if (!trimmedName) {
    showMessage("error", "Name cannot be empty.");
    return null;
  }

  if (isNaN(priceValue) || priceValue < 0) {
    showMessage("error", "Please enter a valid non-negative price.");
    return null;
  }

  return {
    name: trimmedName,
    category: trimmedCategory,
    price: priceValue
  };
}

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

async function editItem(index) {
  const list = getCurrentList();
  if (!list) return;
  const item = list.items[index];
  if (!item) return;

  const updated = await promptItemDetails(item);
  if (!updated) return;

  list.items[index] = updated;

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
      deleteBtn.addEventListener("click", async () => {
        const ok = await confirmDialog(`Delete "${item.name}" from this list?`, {
          confirmText: "Delete"
        });
        if (ok) deleteItemAtIndex(actualIndex);
      });
      deleteBtn.addEventListener("click", async () => {
        const ok = await confirmDialog(`Delete "${item.name}" from this list?`, {
          confirmText: "Delete"
        });
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
  lines.push(`Price calculator: ${list.name}`);
  lines.push(`Price calculator: ${list.name}`);
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

  clearItemsBtn.addEventListener("click", async () => {
    const list = getCurrentList();
    if (!list) return;

    const ok = await confirmDialog(`Clear all items from "${list.name}"?`, {
      confirmText: "Clear"
    });
    if (!ok) return;

    list.items = [];
    saveState();
    renderItems();
    renderTotal();
    renderShareCode();
    updatePerPerson();
    showMessage("info", "All items cleared.");
  });

deleteListBtn.addEventListener("click", async () => {
  const list = getCurrentList();
  if (!list) return;

  if (shoppingLists.length === 1) {
    const ok = await confirmDialog(
      `"${list.name}" is your only list.\nIf you delete it, a new empty default list will be created.\n\nContinue?`,
      { confirmText: "Delete" }
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
    const ok = await confirmDialog(`Delete the list "${list.name}" and all its items?`, {
      confirmText: "Delete"
    });
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
importBtn.addEventListener("click", async () => {
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

    for (const newItem of importedItems) {
      const existingIndex = list.items.findIndex(
        it => it.name.trim().toLowerCase() === newItem.name.trim().toLowerCase()
      );

      if (existingIndex === -1) {
        list.items.push(newItem);
        continue;
      }

      const existing = list.items[existingIndex];
      const message =
        `Item "${newItem.name}" already exists.\n\n` +
        `Existing price: ${existing.price.toFixed(2)}\n` +
        `Imported price: ${newItem.price.toFixed(2)}\n\n` +
        `Merge = use imported price & category\n` +
        `Keep both = add duplicate item`;

      const merge = await confirmDialog(message, {
        title: "Merge duplicate?",
        confirmText: "Merge",
        cancelText: "Keep both"
      });

      if (merge) {
        list.items[existingIndex].price = newItem.price;
        list.items[existingIndex].category = newItem.category;
      } else {
        list.items.push(newItem);
      }
    }

  importCodeTextarea.value = "";
  saveState();
  renderItems();
  renderTotal();
  renderShareCode();
  updatePerPerson();
  showMessage("info", "List imported and merged.");
});

// ---------------- SHARE & SUMMARY ----------------
function toggleShareMenu(openExplicitly = null) {
  if (!shareMenuOptions) return;
  const shouldOpen = openExplicitly !== null ? openExplicitly : shareMenuOptions.hidden;
  if (shouldOpen) {
    renderShareCode();
  }
  shareMenuOptions.hidden = !shouldOpen;
}

refreshShareCodeBtn.addEventListener("click", event => {
  event.stopPropagation();
  toggleShareMenu();
});

document.addEventListener("click", event => {
  if (!shareMenuOptions || !refreshShareCodeBtn) return;
  const container = refreshShareCodeBtn.closest(".share-menu");
  if (container && !container.contains(event.target)) {
    toggleShareMenu(false);
  }
});

shareMenuOptions?.addEventListener("click", async event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.shareAction;
  if (!action) return;

  const code = shareCodeTextarea.value.trim();
  const list = getCurrentList();
  const listName = list ? list.name : "list";
  const shareText = `Price calculator list "${listName}": ${code}`;

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(code);
      showMessage("info", "Share code copied.");
    } catch {
      showMessage("error", "Could not copy to clipboard.");
    }
  } else if (action === "whatsapp") {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  } else if (action === "sms") {
    const url = `sms:?body=${encodeURIComponent(shareText)}`;
    window.open(url, "_self");
  }

  toggleShareMenu(false);
});

generateSummaryBtn.addEventListener("click", () => {
  renderSummary();
  showMessage("info", "Summary generated.");
});
function toggleShareMenu(openExplicitly = null) {
  if (!shareMenuOptions) return;
  const shouldOpen = openExplicitly !== null ? openExplicitly : shareMenuOptions.hidden;
  if (shouldOpen) {
    renderShareCode();
  }
  shareMenuOptions.hidden = !shouldOpen;
}

refreshShareCodeBtn.addEventListener("click", event => {
  event.stopPropagation();
  toggleShareMenu();
});

document.addEventListener("click", event => {
  if (!shareMenuOptions || !refreshShareCodeBtn) return;
  const container = refreshShareCodeBtn.closest(".share-menu");
  if (container && !container.contains(event.target)) {
    toggleShareMenu(false);
  }
});

shareMenuOptions?.addEventListener("click", async event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.shareAction;
  if (!action) return;

  const code = shareCodeTextarea.value.trim();
  const list = getCurrentList();
  const listName = list ? list.name : "list";
  const shareText = `Price calculator list "${listName}": ${code}`;

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(code);
      showMessage("info", "Share code copied.");
    } catch {
      showMessage("error", "Could not copy to clipboard.");
    }
  } else if (action === "whatsapp") {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  } else if (action === "sms") {
    const url = `sms:?body=${encodeURIComponent(shareText)}`;
    window.open(url, "_self");
  }

  toggleShareMenu(false);
});

generateSummaryBtn.addEventListener("click", () => {
  renderSummary();
  showMessage("info", "Summary generated.");
});

splitPeopleInput.addEventListener("input", () => {
  updatePerPerson();
});

// ---------------- HAMBURGER MENU ----------------
let mobileMenuOpen = false;

function setMenuOpen(open) {
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;

  if (isDesktop) {
    open = true;
  } else {
    mobileMenuOpen = open;
  }

  const menuVisible = isDesktop || open;

  if (topBarMenu) {
    // Ensure the element always exists in the layout so the toggle works on mobile
    topBarMenu.hidden = false;
    topBarMenu.style.display = menuVisible ? "flex" : "none";
  }

  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", String(menuVisible));
  }

  if (topBar) {
    topBar.classList.toggle("menu-open", menuVisible);
  }
}

function syncMenuForViewport() {
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  setMenuOpen(isDesktop ? true : mobileMenuOpen);
}

menuToggle?.addEventListener("click", () => {
  setMenuOpen(!mobileMenuOpen);
});

syncMenuForViewport();

// ---------------- AUTO-COLLAPSE MENU ON MOBILE SCROLL ----------------
// Only lock the menu open while text inputs are focused (not when tapping buttons)
const topBarInputs = topBar?.querySelectorAll("input, select, textarea") || [];
let menuLocked = false;
let lastScrollY = window.scrollY;

function updateMenuCollapse() {
  if (!topBar) return;

  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  if (!isMobile) {
    topBar.classList.remove("menu-collapsed");
    return;
  }

  if (menuLocked || mobileMenuOpen) {
    topBar.classList.remove("menu-collapsed");
    return;
  }

  const currentY = window.scrollY;
  const scrollingDown = currentY > lastScrollY;
  const atTop = currentY <= 1;

  if (atTop) {
    topBar.classList.remove("menu-collapsed");
  } else if (scrollingDown) {
    topBar.classList.add("menu-collapsed");
  } else {
    topBar.classList.remove("menu-collapsed");
  }

  lastScrollY = currentY;
}

topBarInputs.forEach(input => {
  input.addEventListener("focus", () => {
    menuLocked = true;
    topBar?.classList.remove("menu-collapsed");
  });

  input.addEventListener("blur", () => {
    const stillFocused = Array.from(topBarInputs).some(el => el === document.activeElement);
    menuLocked = stillFocused;
    if (!menuLocked) {
      updateMenuCollapse();
    }
  });
});

function handleResize() {
  syncMenuForViewport();
  updateMenuCollapse();
}

window.addEventListener("scroll", updateMenuCollapse);
window.addEventListener("resize", handleResize);

// ---------------- INIT ----------------
loadState();
renderAll();
updatePerPerson();
updateMenuCollapse();
showMessage("info", "Price calculator ready.");
