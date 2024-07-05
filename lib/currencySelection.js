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
}

async function loadCurrencies() {
    try {
        const response = await fetch('./lib/currencies.json');
        const data = await response.json();
        return data.reduce((acc, item) => {
            acc.currencies.push(item.abbreviation);
            acc.currencyDetails[item.abbreviation] = {
                name: item.name,
                emoji: item.emoji
            };
            return acc;
        }, { currencies: [], currencyDetails: {} });
    } catch (error) {
        console.error('Failed to load currency data:', error);
        return { currencies: [], currencyDetails: {} };
    }
}

function generateCurrencyCheckboxes(currencies) {
    const container = document.getElementById('currency-container');
    container.innerHTML = '';
    currencies.forEach(currency => {
        const currencyData = currencyDetails[currency];
        const rowLabel = createRowLabel(currency, currencyData);
        container.appendChild(rowLabel);
    });
}

function createRowLabel(currency, currencyData) {
    const rowLabel = document.createElement('label');
    rowLabel.className = 'currency-row';

    const checkbox = document.createElement('input');
    checkbox.className = 'currency-selection-checkbox';
    checkbox.type = 'checkbox';
    checkbox.value = currency;
    checkbox.name = 'currency';

    const emojiLabel = createEmojiLabel(currencyData.emoji);
    const abbreviationLabel = createAbbreviationLabel(currency);
    const nameLabel = createNameLabel(currencyData.name);

    rowLabel.append(checkbox, emojiLabel, abbreviationLabel, nameLabel);
    return rowLabel;
}

function createEmojiLabel(emoji) {
    const emojiLabel = document.createElement('span');
    emojiLabel.className = 'currency-selection-emojiLabel';
    if (emoji.startsWith('./')) {
        const img = document.createElement('img');
        img.src = emoji;
        emojiLabel.appendChild(img);
    } else {
        emojiLabel.appendChild(document.createTextNode(emoji));
    }
    return emojiLabel;
}

function createAbbreviationLabel(currency) {
    const abbreviationLabel = document.createElement('span');
    abbreviationLabel.className = 'currency-selection-abbreviationLabel';
    abbreviationLabel.appendChild(document.createTextNode(currency === 'sats' ? currency : currency.toUpperCase()));
    return abbreviationLabel;
}

function createNameLabel(name) {
    const nameLabel = document.createElement('span');
    nameLabel.className = 'currency-selection-name';
    nameLabel.appendChild(document.createTextNode(name));
    return nameLabel;
}

function updateCheckboxStates() {
    const selectedCurrencies = JSON.parse(localStorage.getItem('selectedCurrenciesLS')) || [];
    const checkboxes = document.querySelectorAll('input[name="currency"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectedCurrencies.includes(checkbox.value);
    });
}

function addCheckButtonListeners() {
    document.getElementById('checkAllButton').addEventListener('click', checkAll);
    document.getElementById('uncheckAllButton').addEventListener('click', uncheckAll);
}

function checkAll() {
    const checkboxes = document.querySelectorAll('input[name="currency"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    currentOrder = Array.from(checkboxes).map(checkbox => checkbox.value);
    displaySelectedCurrencies();
}

function uncheckAll() {
    const checkboxes = document.querySelectorAll('input[name="currency"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    currentOrder = [];
    displaySelectedCurrencies();
}

function initializeSortable() {
    const floatingContainer = document.querySelector('.floating-container');
    new Sortable(floatingContainer, {
        animation: 150,
        onEnd: () => {
            currentOrder = Array.from(floatingContainer.querySelectorAll('.floating-item')).map(el => el.dataset.currency);
        }
    });
}

function displaySelectedCurrencies() {
    const floatingContainer = document.querySelector('.floating-container');
    floatingContainer.innerHTML = '';

    const selectedCurrencies = Array.from(document.querySelectorAll('input[name="currency"]:checked')).map(el => el.value);
    const orderedSelectedCurrencies = currentOrder.length > 0 ? currentOrder.filter(currency => selectedCurrencies.includes(currency)) : selectedCurrencies;

    orderedSelectedCurrencies.forEach(currency => {
        const emoji = currencyDetails[currency].emoji;
        const floatingItem = document.createElement('div');
        floatingItem.classList.add('floating-item');
        floatingItem.dataset.currency = currency;
        if (emoji.startsWith('./')) {
            const img = document.createElement('img');
            img.src = emoji;
            floatingItem.appendChild(img);
        } else {
            floatingItem.textContent = emoji;
        }
        floatingContainer.appendChild(floatingItem);
    });
}

function updateSelectedCurrencies(currency, isChecked) {
    if (isChecked) {
        if (!currentOrder.includes(currency)) {
            currentOrder.push(currency);
        }
    } else {
        currentOrder = currentOrder.filter(item => item !== currency);
    }
    displaySelectedCurrencies();
}

function addCheckboxChangeListeners() {
    const checkboxes = document.querySelectorAll('input[name="currency"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => updateSelectedCurrencies(checkbox.value, checkbox.checked));
    });
}

function loadOrderFromLocalStorage() {
    const storedOrder = JSON.parse(localStorage.getItem('selectedCurrenciesLS')) || [];
    if (storedOrder.length > 0) {
        currentOrder = storedOrder;
    }
}

function addSaveButtonListener() {
    document.getElementById('saveSelectedCurrenciesBtn').addEventListener('click', saveSelectedCurrenciesBtn);
}

function saveSelectedCurrenciesBtn() {
    const orderedSelectedCurrencies = currentOrder.filter(currency =>
        Array.from(document.querySelectorAll('input[name="currency"]:checked')).map(el => el.value).includes(currency)
    );

    localStorage.setItem('selectedCurrenciesLS', JSON.stringify(orderedSelectedCurrencies));
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', initializeApp);
