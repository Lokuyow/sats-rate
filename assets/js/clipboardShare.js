// =====================================================
// クリップボード/共有/OGP連携ロジック
// =====================================================

import { generateAndUploadOgpImage, prepareOgpData } from "./ogpGenerator.js";

// -----------------------------------------------------
// 定数定義
// -----------------------------------------------------

const SITE_URL = "https://osats.money/";

// -----------------------------------------------------
// 通知表示
// -----------------------------------------------------

/**
 * 通知を表示する
 * @param {string} message - 表示するメッセージ
 * @param {Event} event - イベントオブジェクト
 * @param {string} align - 配置 ("right" | "left")
 */
function showNotification(message, event, align = "right") {
    const notification = document.getElementById("notification");
    notification.innerHTML = message.replace(/\n/g, "<br>");

    // Handle null event (fallback scenarios)
    if (event && event.pageX !== undefined && event.pageY !== undefined) {
        notification.style.top = `${event.pageY}px`;
        notification.style.left = `${event.pageX}px`;
    } else {
        // Fallback position: center of the viewport
        notification.style.top = "50%";
        notification.style.left = "50%";
        notification.style.transform = "translate(-50%, -50%)";
    }

    if (event && align === "left") {
        notification.style.transform = "translate(-100%, -100%)";
    } else if (event) {
        notification.style.transform = "translate(0, -100%)";
    }

    notification.style.visibility = "visible";

    setTimeout(() => {
        notification.style.visibility = "hidden";
    }, 1000);
}

// -----------------------------------------------------
// クリップボード操作
// -----------------------------------------------------

/**
 * テキストをクリップボードにコピー
 * @param {string} text - コピーするテキスト
 * @param {Event} event - イベントオブジェクト
 * @param {string} align - 通知の配置
 */
export function copyToClipboard(text, event, align = "right") {
    // Secure context check (HTTPS or localhost)
    if (!isSecureContext) {
        fallbackCopyToClipboard(text, event);
        return;
    }

    navigator.clipboard
        .writeText(text)
        .then(() => {
            const message = window.vanilla_i18n_instance.translate("showNotification.copy");
            showNotification(message, event, align);
        })
        .catch((err) => {
            console.error("Failed to copy to clipboard", err);
            fallbackCopyToClipboard(text, event);
        });
}

/**
 * フォールバック: 非セキュアコンテキスト用コピー
 * @param {string} text - コピーするテキスト
 * @param {Event} event - イベントオブジェクト
 */
function fallbackCopyToClipboard(text, event) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);

    try {
        textarea.select();
        document.execCommand("copy");
        const message = window.vanilla_i18n_instance.translate("showNotification.copy");
        showNotification(message, event);
    } catch (err) {
        console.error("Fallback copy failed:", err);
    } finally {
        document.body.removeChild(textarea);
    }
}

/**
 * クリップボードからテキストを読み取り
 * @returns {Promise<string|null>} クリップボードのテキスト
 */
export async function readFromClipboard() {
    try {
        return await navigator.clipboard.readText();
    } catch (error) {
        console.error("Failed to read from clipboard:", error);
        return null;
    }
}

// -----------------------------------------------------
// 通貨ボタンのイベントリスナー設定
// -----------------------------------------------------

/**
 * 通貨ボタンのイベントリスナーを設定
 * @param {string[]} selectedCurrencies - 選択された通貨の配列
 * @param {function} getLocaleSeparators - ロケール区切り文字取得関数
 * @param {string} selectedLocale - 選択されたロケール
 * @param {function} pasteHandler - ペーストハンドラー関数
 */
export function setupEventListenersForCurrencyButtons(
    selectedCurrencies,
    getLocaleSeparators,
    selectedLocale,
    pasteHandler
) {
    selectedCurrencies.forEach((currency) => {
        // コピーイベントリスナーの設定
        const copyButton = document.getElementById("copy-" + currency);
        if (copyButton) {
            copyButton.addEventListener("click", function (event) {
                copySingleCurrencyToClipboard(event, getLocaleSeparators, selectedLocale);
            });
        }

        // ペーストイベントリスナーの設定
        const pasteButton = document.getElementById("paste-" + currency);
        if (pasteButton) {
            pasteButton.addEventListener("click", function () {
                pasteHandler(currency);
            });
        }
    });
}

/**
 * 単一通貨をクリップボードにコピー
 * @param {Event} event - クリックイベント
 * @param {function} getLocaleSeparators - ロケール区切り文字取得関数
 * @param {string} selectedLocale - 選択されたロケール
 */
function copySingleCurrencyToClipboard(event, getLocaleSeparators, selectedLocale) {
    const currency = event.target.dataset.currency;
    const inputValue = document.getElementById(currency).value;
    const separators = getLocaleSeparators(selectedLocale);
    const sanitizedValue = inputValue.replace(new RegExp(`\\${separators.groupSeparator}`, "g"), "");
    copyToClipboard(sanitizedValue, event, "left");
}

// -----------------------------------------------------
// Web Share API
// -----------------------------------------------------

/**
 * Web Share APIで共有（OGP画像生成付き）
 * @param {object} options - オプション
 * @param {string} options.lastUpdatedField - 最後に更新されたフィールド
 * @param {string[]} options.selectedCurrencies - 選択された通貨の配列
 * @param {function} options.parseInput - 入力値パース関数
 * @param {string} options.selectedLocale - 選択されたロケール
 * @param {number} options.lastUpdatedTimestamp - 最終更新タイムスタンプ
 * @param {function} options.getLocaleSeparators - ロケール区切り文字取得関数
 * @param {Event} event - イベントオブジェクト
 */
export async function shareViaWebAPIEvent(options, event) {
    const {
        lastUpdatedField,
        selectedCurrencies,
        parseInput,
        selectedLocale,
        lastUpdatedTimestamp,
        getLocaleSeparators,
    } = options;

    // イベント伝播を防止
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        // OGP画像を生成してR2にアップロード
        const { baseNormalized, outputData } = prepareOgpData(
            lastUpdatedField,
            selectedCurrencies,
            parseInput,
            selectedLocale
        );
        const imgId = await generateAndUploadOgpImage(
            lastUpdatedField,
            baseNormalized,
            outputData,
            lastUpdatedTimestamp
        );
        const queryParams = generateQueryStringFromValues(
            lastUpdatedField,
            selectedCurrencies,
            getLocaleSeparators,
            selectedLocale,
            parseInput,
            imgId
        );
        shareViaWebAPI(queryParams, event);
    } catch (error) {
        console.error("Failed to generate OGP image:", error);
        console.error("Error stack:", error.stack);
        alert(`エラーが発生しました: ${error.message}\n\nコンソールで詳細を確認してください。`);
        // フォールバック: img_idなしで共有
        const queryParams = generateQueryStringFromValues(
            lastUpdatedField,
            selectedCurrencies,
            getLocaleSeparators,
            selectedLocale,
            parseInput,
            null
        );
        shareViaWebAPI(queryParams, event);
    }
}

/**
 * サイトをWeb Share APIで共有
 * @param {Event} event - イベントオブジェクト
 */
export function shareSiteViaWebAPIEvent(event) {
    const siteText = window.vanilla_i18n_instance.translate("shareSite.text");

    if (!isSecureContext || !navigator.share) {
        fallbackShareSiteViaClipboard(siteText, SITE_URL, event);
        return;
    }

    navigator.share({ title: siteText, url: SITE_URL }).catch((error) => {
        console.log("Sharing failed", error);
        fallbackShareSiteViaClipboard(siteText, SITE_URL, event);
    });
}

/**
 * サイトURLをクリップボードにコピー（名称＋URLの2行）
 * @param {Event} event - イベントオブジェクト
 */
export function copySiteToClipboardEvent(event) {
    const siteText = window.vanilla_i18n_instance.translate("shareSite.text");
    const textToCopy = `${siteText}\n${SITE_URL}`;
    copyToClipboard(textToCopy, event, "right");
}

/**
 * Web Share APIで共有
 * @param {string} queryParams - クエリパラメータ
 * @param {Event} event - イベントオブジェクト
 */
function shareViaWebAPI(queryParams, event) {
    const shareUrl = `${SITE_URL}${queryParams}`;

    if (!isSecureContext || !navigator.share) {
        fallbackShareViaClipboard(shareUrl, event);
        return;
    }

    navigator.share({
        url: shareUrl,
    }).catch((error) => {
        console.error("Sharing failed", error);
        fallbackShareViaClipboard(shareUrl, event);
    });
}

// -----------------------------------------------------
// フォールバック共有関数
// -----------------------------------------------------

/**
 * フォールバック: サイト情報をクリップボードにコピー
 * @param {string} siteText - サイト名
 * @param {string} siteUrl - サイトURL
 * @param {Event} event - イベントオブジェクト
 */
function fallbackShareSiteViaClipboard(siteText, siteUrl, event) {
    const textToCopy = `${siteText}\n${siteUrl}`;
    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);

    try {
        textarea.select();
        document.execCommand("copy");
        const message = window.vanilla_i18n_instance.translate("showNotification.copy");
        showNotification(message, event, "left");
    } catch (err) {
        console.error("Fallback share failed:", err);
    } finally {
        document.body.removeChild(textarea);
    }
}

/**
 * フォールバック: URLをクリップボードにコピー
 * @param {string} url - 共有URL
 * @param {Event} event - イベントオブジェクト
 */
function fallbackShareViaClipboard(url, event) {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);

    try {
        textarea.select();
        document.execCommand("copy");
        const message = window.vanilla_i18n_instance.translate("showNotification.copy");
        showNotification(message, event, "left");
    } catch (err) {
        console.error("Fallback share failed:", err);
    } finally {
        document.body.removeChild(textarea);
    }
}

// -----------------------------------------------------
// クエリ文字列生成
// -----------------------------------------------------

/**
 * 共有用クエリ文字列を生成
 * @param {string} lastUpdatedField - 最後に更新されたフィールド
 * @param {string[]} selectedCurrencies - 選択された通貨の配列
 * @param {function} getLocaleSeparators - ロケール区切り文字取得関数
 * @param {string} selectedLocale - 選択されたロケール
 * @param {function} parseInput - 入力値パース関数
 * @param {string|null} imgId - OGP画像ID
 * @returns {string} クエリ文字列
 */
export function generateQueryStringFromValues(
    lastUpdatedField,
    selectedCurrencies,
    getLocaleSeparators,
    selectedLocale,
    parseInput,
    imgId = null
) {
    if (!lastUpdatedField || !selectedCurrencies.length) return "";

    const baseKey = lastUpdatedField;
    const separators = getLocaleSeparators(selectedLocale);
    const decimalFormat = separators.decimalSeparator === "," ? "c" : "p";

    // 画面に表示されている値を取得し、URLに適した形式に変換
    const baseDisplayValue = document.getElementById(baseKey).value;
    const baseNormalized = parseInput(baseDisplayValue, selectedLocale);
    const baseValue = baseNormalized.replace(".", separators.decimalSeparator);

    // currencies パラメータ（全選択通貨、ハイフン区切り）
    const currencies = selectedCurrencies.join("-");

    // 各通貨のkey=valueペアを構築（入力値のみ）
    const params = new URLSearchParams();
    params.set(baseKey, baseValue);
    params.set("currencies", currencies);

    // img_idがあれば追加
    if (imgId) {
        params.set("img_id", imgId);
    }

    params.set("d", decimalFormat);

    return `?${params.toString()}`;
}
