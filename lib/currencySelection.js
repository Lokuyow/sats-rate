import { currencyManager } from './currencyManager.js';

async function initializeApp() {
    const { currencies, currencyDetails } = await loadCurrencies();
    generateCurrencyCheckboxes(currencies, currencyDetails);
    updateCheckboxStates();
    addCheckButtonListeners();
    const saveButton = document.getElementById('saveSelectedCurrenciesBtn');
    saveButton.addEventListener('click', () => saveSelectedCurrenciesBtn());
}

async function loadCurrencies() {
    let currencies = [];
    let currencyDetails = {};
    try {
        const response = await fetch('./lib/currencies.json');
        const data = await response.json();
        data.forEach(item => {
            currencies.push(item.abbreviation);
            currencyDetails[item.abbreviation] = {
                name: item.name,
                emoji: item.emoji
            };
        });
    } catch (error) {
        console.error('Failed to load currency data:', error);
    }
    return { currencies, currencyDetails };
}

function generateCurrencyCheckboxes(currencies, currencyDetails) {
    const container = document.getElementById('currency-container');
    container.innerHTML = '';

    currencies.forEach(currency => {
        const currencyData = currencyDetails[currency]; // 略語から通貨データを取得

        // 各行を囲むラベル
        const rowLabel = document.createElement('label');
        rowLabel.className = 'currency-row';

        // チェックボックスの列
        const checkbox = document.createElement('input');
        checkbox.className = 'currency-selection-checkbox';
        checkbox.type = 'checkbox';
        checkbox.value = currency;
        checkbox.name = 'currency';
        rowLabel.appendChild(checkbox);

        // 絵文字の列
        const emojiLabel = document.createElement('span');
        emojiLabel.className = 'currency-selection-emojiLabel';
        // URLかどうかをチェック
        if (currencyData.emoji.startsWith('./')) {
            const img = document.createElement('img');
            img.src = currencyData.emoji;
            emojiLabel.appendChild(img);
        } else {
            emojiLabel.appendChild(document.createTextNode(currencyData.emoji));
        }
        rowLabel.appendChild(emojiLabel);

        // 略称の列
        const abbreviationLabel = document.createElement('span');
        abbreviationLabel.className = 'currency-selection-abbreviationLabel';
        // 'sats' の場合だけ小文字にする
        abbreviationLabel.appendChild(document.createTextNode(currency === 'sats' ? currency : currency.toUpperCase()));
        rowLabel.appendChild(abbreviationLabel);

        // 名前の列
        const nameLabel = document.createElement('span');
        nameLabel.className = 'currency-selection-name';
        nameLabel.appendChild(document.createTextNode(currencyData.name));
        rowLabel.appendChild(nameLabel);

        // 行をコンテナに追加
        container.appendChild(rowLabel);
    });
}

async function saveSelectedCurrenciesBtn() {
    const selectedCurrencies = Array.from(document.querySelectorAll('input[name="currency"]:checked')).map(el => el.value);
    await currencyManager.fetchCurrencyData(selectedCurrencies);
    localStorage.setItem('selectedCurrenciesLS', JSON.stringify(selectedCurrencies));
    window.location.href = 'index.html';
}

function updateCheckboxStates() {
    const selectedCurrencies = JSON.parse(localStorage.getItem('selectedCurrenciesLS')) || [];

    const checkboxes = document.querySelectorAll('input[name="currency"]');
    checkboxes.forEach(checkbox => {
        if (selectedCurrencies.includes(checkbox.value)) {
            checkbox.checked = true;
        } else {
            checkbox.checked = false;
        }
    });
}


// ボタンにイベントリスナーを追加
function addCheckButtonListeners() {
    const checkAllButton = document.getElementById('checkAllButton');
    checkAllButton.addEventListener('click', checkAll);

    const uncheckAllButton = document.getElementById('uncheckAllButton');
    uncheckAllButton.addEventListener('click', uncheckAll);
}

// 全てのチェックボックスにチェックを入れる
function checkAll() {
    const checkboxes = document.querySelectorAll('input[name="currency"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

// 全てのチェックボックスからチェックを外す
function uncheckAll() {
    const checkboxes = document.querySelectorAll('input[name="currency"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}


document.addEventListener('DOMContentLoaded', initializeApp);