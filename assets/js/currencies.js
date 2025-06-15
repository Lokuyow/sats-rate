let currentOrder = [];
let currencyDetails = {};

async function initializeApp() {
  const { currencies, currencyDetails: details } = await loadCurrencies();
  currencyDetails = details;
  generateCurrencyCheckboxes(currencies);
  updateCheckboxStates();
  addCheckButtonListeners();
  loadOrderFromLocalStorage();
  displaySelectedCurrencies();
  initializeSortable();
  addSaveButtonListener();
  addCheckboxChangeListeners();
  checkScrollButtonVisibility();
  addDragOverEffects();
}

async function loadCurrencies() {
  try {
    const response = await fetch("../assets/data/currencies.json");
    const data = await response.json();
    return data.reduce(
      (acc, item) => {
        acc.currencies.push(item.abbreviation);
        acc.currencyDetails[item.abbreviation] = {
          name: item.name,
          emoji: item.emoji,
        };
        return acc;
      },
      { currencies: [], currencyDetails: {} }
    );
  } catch (error) {
    console.error("Failed to load currency data:", error);
    return { currencies: [], currencyDetails: {} };
  }
}

function generateCurrencyCheckboxes(currencies) {
  const container = document.getElementById("currency-container");
  container.innerHTML = "";
  currencies.forEach((currency) => {
    const currencyData = currencyDetails[currency];
    const rowLabel = createRowLabel(currency, currencyData);
    container.appendChild(rowLabel);
  });
}

function createRowLabel(currency, currencyData) {
  const rowLabel = document.createElement("label");
  rowLabel.className = "currency-row";

  const checkbox = document.createElement("input");
  checkbox.className = "currencies-checkbox";
  checkbox.type = "checkbox";
  checkbox.value = currency;
  checkbox.name = "currency";

  const emojiLabel = createEmojiLabel(currencyData.emoji);
  const abbreviationLabel = createAbbreviationLabel(currency);
  const nameLabel = createNameLabel(currencyData.name);

  rowLabel.append(checkbox, emojiLabel, abbreviationLabel, nameLabel);
  return rowLabel;
}

function createEmojiLabel(emoji) {
  const emojiLabel = document.createElement("span");
  emojiLabel.className = "currencies-emojiLabel";
  if (emoji.startsWith("/")) {
    const img = document.createElement("img");
    img.src = emoji;
    emojiLabel.appendChild(img);
  } else {
    emojiLabel.appendChild(document.createTextNode(emoji));
  }
  return emojiLabel;
}

function createAbbreviationLabel(currency) {
  const abbreviationLabel = document.createElement("span");
  abbreviationLabel.className = "currencies-abbreviationLabel";
  abbreviationLabel.appendChild(document.createTextNode(currency === "sats" ? currency : currency.toUpperCase()));
  return abbreviationLabel;
}

function createNameLabel(name) {
  const nameLabel = document.createElement("span");
  nameLabel.className = "currencies-name";
  nameLabel.appendChild(document.createTextNode(name));
  return nameLabel;
}

function updateCheckboxStates() {
  const selectedCurrencies = JSON.parse(localStorage.getItem("selectedCurrenciesLS")) || [];
  const checkboxes = document.querySelectorAll('input[name="currency"]');
  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectedCurrencies.includes(checkbox.value);
  });
}

function addCheckButtonListeners() {
  document.getElementById("checkAllButton").addEventListener("click", checkAll);
  document.getElementById("uncheckAllButton").addEventListener("click", uncheckAll);
  document.getElementById("defaultSelectionButton").addEventListener("click", selectDefaultCurrencies);
}

function checkAll() {
  const checkboxes = document.querySelectorAll('input[name="currency"]');
  checkboxes.forEach((checkbox) => {
    checkbox.checked = true;
  });
  currentOrder = Array.from(checkboxes).map((checkbox) => checkbox.value);
  displaySelectedCurrencies();
}

function uncheckAll() {
  const checkboxes = document.querySelectorAll('input[name="currency"]');
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
  currentOrder = [];
  displaySelectedCurrencies();
}

function selectDefaultCurrencies() {
  const defaultCurrencies = ["sats", "btc", "jpy", "usd", "eur"];
  const checkboxes = Array.from(document.querySelectorAll('input[name="currency"]'));

  // まずすべてのチェックボックスを外す
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  currentOrder = [];

  // デフォルトの通貨を順番に選択する
  defaultCurrencies.forEach((currency, index) => {
    const checkbox = checkboxes.find((cb) => cb.value === currency);
    if (checkbox) {
      setTimeout(() => {
        checkbox.checked = true;
        currentOrder.push(currency);
        displaySelectedCurrencies();
      }, index * 10);
    }
  });
}

function initializeSortable() {
  const sortContainer = document.querySelector(".sort-container");
  const fixContainer = document.querySelector("#fix-container");

  new Sortable(sortContainer, {
    group: "shared",
    animation: 150,
    onEnd: (evt) => {
      if (evt.to !== fixContainer) {
        currentOrder = Array.from(sortContainer.querySelectorAll(".sort-item")).map((el) => el.querySelector(".sort-icon").dataset.currency);
      }
    },
  });

  new Sortable(fixContainer.querySelector("#trash-container"), {
    group: "shared",
    animation: 150,
    sort: false,
    onAdd: (evt) => {
      const item = evt.item;
      const currency = item.querySelector(".sort-icon").dataset.currency;

      const checkbox = document.querySelector(`input[name="currency"][value="${currency}"]`);
      if (checkbox) {
        checkbox.checked = false;
      }

      item.remove();
      currentOrder = Array.from(sortContainer.querySelectorAll(".sort-item")).map((el) => el.querySelector(".sort-icon").dataset.currency);
    },
  });
}

function displaySelectedCurrencies() {
  const sortContainer = document.querySelector(".sort-container");
  sortContainer.innerHTML = "";

  const selectedCurrencies = Array.from(document.querySelectorAll('input[name="currency"]:checked')).map((el) => el.value);
  const orderedSelectedCurrencies = currentOrder.length > 0 ? currentOrder.filter((currency) => selectedCurrencies.includes(currency)) : selectedCurrencies;

  orderedSelectedCurrencies.forEach((currency) => {
    const emoji = currencyDetails[currency].emoji;

    // 新しいコンテナを作成
    const floatingItemContainer = document.createElement("div");
    floatingItemContainer.classList.add("sort-item");
    floatingItemContainer.classList.add("normal-btn");

    // drag-indicator を作成
    const dragIndicator = document.createElement("div");
    dragIndicator.classList.add("drag-indicator");

    // sort-icon を作成
    const floatingItem = document.createElement("div");
    floatingItem.classList.add("sort-icon");
    floatingItem.dataset.currency = currency;
    if (emoji.startsWith("/")) {
      const img = document.createElement("img");
      img.src = emoji;
      floatingItem.appendChild(img);
    } else {
      floatingItem.textContent = emoji;
    }

    // コンテナに drag-indicator と sort-icon を追加
    floatingItemContainer.appendChild(dragIndicator);
    floatingItemContainer.appendChild(floatingItem);

    // コンテナを sortContainer に追加
    sortContainer.appendChild(floatingItemContainer);
  });

  requestAnimationFrame(() => {
    checkScrollButtonVisibility();
    requestAnimationFrame(updatePosition);
  });
}

function updateSelectedCurrencies(currency, isChecked) {
  if (isChecked) {
    if (!currentOrder.includes(currency)) {
      currentOrder.push(currency);
    }
  } else {
    currentOrder = currentOrder.filter((item) => item !== currency);
  }
  displaySelectedCurrencies();
}

function addCheckboxChangeListeners() {
  const checkboxes = document.querySelectorAll('input[name="currency"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => updateSelectedCurrencies(checkbox.value, checkbox.checked));
  });
}

function checkScrollButtonVisibility() {
  const scrollUpButton = document.getElementById("scrollUpButton");
  const scrollDownButton = document.getElementById("scrollDownButton");
  const sortContainer = document.querySelector(".sort-container");

  if (window.innerWidth <= 767) {
    const isScrollable = sortContainer.scrollHeight > sortContainer.clientHeight;

    if (isScrollable) {
      scrollUpButton.style.display = "block";
      scrollDownButton.style.display = "block";
      sortContainer.classList.remove("no-scroll-button");
    } else {
      scrollUpButton.style.display = "none";
      scrollDownButton.style.display = "none";
      sortContainer.classList.add("no-scroll-button");
    }
  } else {
    scrollUpButton.style.display = "none";
    scrollDownButton.style.display = "none";
    sortContainer.classList.add("no-scroll-button");
  }
}

function loadOrderFromLocalStorage() {
  const storedOrder = JSON.parse(localStorage.getItem("selectedCurrenciesLS")) || [];
  if (storedOrder.length > 0) {
    currentOrder = storedOrder;
  }
}

function addSaveButtonListener() {
  document.getElementById("saveSelectedCurrenciesBtn").addEventListener("click", saveSelectedCurrenciesBtn);
}

function saveSelectedCurrenciesBtn() {
  const orderedSelectedCurrencies = currentOrder.filter((currency) =>
    Array.from(document.querySelectorAll('input[name="currency"]:checked'))
      .map((el) => el.value)
      .includes(currency)
  );

  localStorage.setItem("selectedCurrenciesLS", JSON.stringify(orderedSelectedCurrencies));
  window.location.href = "/";
}

document.getElementById("scrollUpButton").addEventListener("click", function () {
  const sortContainer = document.querySelector(".sort-container");
  sortContainer.scrollBy({
    top: -sortContainer.clientHeight,
    left: 0,
    behavior: "smooth",
  });
});

document.getElementById("scrollDownButton").addEventListener("click", function () {
  const sortContainer = document.querySelector(".sort-container");
  sortContainer.scrollBy({
    top: sortContainer.clientHeight,
    left: 0,
    behavior: "smooth",
  });
});

function updatePosition() {
  const parentElement = document.querySelector(".currencies-main");
  const parentRect = parentElement.getBoundingClientRect();
  const parentRightEdge = parentRect.right;

  // 親要素の右端に固定
  const floatingField = document.querySelector(".floating-field");
  floatingField.style.right = `${document.documentElement.clientWidth - parentRightEdge}px`;
}

window.addEventListener("load", function () {
  requestAnimationFrame(updatePosition);
  window.addEventListener("resize", updatePosition);
});

document.addEventListener("DOMContentLoaded", initializeApp);

function addDragOverEffects() {
  const trashContainer = document.querySelector("#trash-container");

  // ドラッグオーバー時
  trashContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    trashContainer.classList.add('drag-over');
  });

  // ドラッグリーブ時
  trashContainer.addEventListener('dragleave', (e) => {
    trashContainer.classList.remove('drag-over');
  });

  // ドロップ時
  trashContainer.addEventListener('drop', (e) => {
    trashContainer.classList.remove('drag-over');
  });
}
