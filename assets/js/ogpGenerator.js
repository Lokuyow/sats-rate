// =====================================================
// OGP画像生成（Canvas）
// =====================================================

const OGP_WIDTH = 1200;
const OGP_HEIGHT = 630;
const OGP_FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const OGP_MAX_OUTPUT_CURRENCIES = 4;
const JST_OFFSET = 9 * 60 * 60 * 1000;

const OGP_FONT_CONFIGS = {
    1: { fontSize: 95, startY: 370, lineSpacing: 0 },
    2: { fontSize: 90, startY: 320, lineSpacing: 130 },
    3: { fontSize: 85, startY: 265, lineSpacing: 115 },
    4: { fontSize: 70, startY: 235, lineSpacing: 95 }
};

/**
 * 通貨コードをフォーマット
 */
function formatCurrencyCodeForOgp(code) {
    return code === 'sats' ? 'sats' : code.toUpperCase();
}

/**
 * タイムスタンプをJSTフォーマット
 */
function formatTimestampForOgp(timestamp) {
    const date = new Date(timestamp);
    const jstDate = new Date(date.getTime() + JST_OFFSET);

    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getUTCDate()).padStart(2, '0');
    const hour = String(jstDate.getUTCHours()).padStart(2, '0');
    const minute = String(jstDate.getUTCMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hour}:${minute}`;
}

/**
 * 数値をOGP用にフォーマット（桁区切りあり、最大8桁）
 */
function formatNumberForOgp(valueStr) {
    const num = parseFloat(valueStr);
    if (isNaN(num)) return valueStr;

    const parts = valueStr.split('.');
    const fracLength = parts[1] ? Math.min(parts[1].length, 8) : 0;

    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: fracLength,
        useGrouping: true
    }).format(num);
}

/**
 * OGP画像用のCanvasを生成
 * @param {string} baseKey - 基準通貨のキー
 * @param {string} baseNormalized - 基準通貨の正規化された値
 * @param {Array<{value: string, code: string}>} outputData - 出力通貨データ
 * @param {number} timestamp - レート取得時のUNIXタイムスタンプ（秒）
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateOgpCanvas(baseKey, baseNormalized, outputData, timestamp) {
    const canvas = document.createElement('canvas');
    canvas.width = OGP_WIDTH;
    canvas.height = OGP_HEIGHT;
    const ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = '#F5F7F6';
    ctx.fillRect(0, 0, OGP_WIDTH, OGP_HEIGHT);

    // メインタイトル（入力値 通貨コード =）
    const mainTitle = `${formatNumberForOgp(baseNormalized)} ${formatCurrencyCodeForOgp(baseKey)} =`;
    ctx.font = `bold 100px ${OGP_FONT_FAMILY}`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.fillText(mainTitle, OGP_WIDTH / 2, 130);

    // 区切り線
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 150);
    ctx.lineTo(1100, 150);
    ctx.stroke();

    // フォント設定を取得
    const config = OGP_FONT_CONFIGS[Math.min(outputData.length, OGP_MAX_OUTPUT_CURRENCIES)] || OGP_FONT_CONFIGS[4];

    // 出力行を描画（数値と通貨記号を分けて整列）
    ctx.font = `${config.fontSize}px ${OGP_FONT_FAMILY}`;
    ctx.fillStyle = '#333';
    // 全体を右に寄せるオフセット（px）
    const OUTPUT_SHIFT = 135;
    const centerX = OGP_WIDTH / 2 + OUTPUT_SHIFT;
    const numberX = centerX - 10; // 数値の右端位置
    const codeX = centerX + 10;   // 通貨記号の左端位置

    outputData.forEach((data, i) => {
        const y = config.startY + (i * config.lineSpacing);
        // 数値を右揃えで描画
        ctx.textAlign = 'right';
        ctx.fillText(data.value, numberX, y);
        // 通貨記号を左揃えで描画
        ctx.textAlign = 'left';
        ctx.fillText(data.code, codeX, y);
    });

    // アイコン画像の読み込みと描画（左下）
    try {
        const iconImage = new Image();
        iconImage.src = 'assets/images/icon_x192.png';
        await new Promise((resolve, reject) => {
            iconImage.onload = resolve;
            iconImage.onerror = reject;
        });

        // アイコンのサイズと位置設定
        const iconSize = 80; // 80x80px
        const iconPadding = 15; // 左端と下端からの余白
        const iconX = iconPadding;
        const iconY = OGP_HEIGHT - iconSize - iconPadding;

        ctx.drawImage(iconImage, iconX, iconY, iconSize, iconSize);
    } catch (error) {
        console.warn('OGPアイコンの読み込みに失敗しました:', error);
    }

    // フッター: 日付を中央に表示（レート取得時間）
    const dateText = formatTimestampForOgp(timestamp * 1000);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.font = `50px ${OGP_FONT_FAMILY}`;
    ctx.fillText(dateText, OGP_WIDTH / 2, OGP_HEIGHT - 20);

    // Source credit (Right Bottom)
    ctx.textAlign = 'right';
    ctx.font = `34px ${OGP_FONT_FAMILY}`;
    ctx.fillText('Source: CoinGecko', OGP_WIDTH - 20, OGP_HEIGHT - 20);

    return canvas;
}

/**
 * OGP画像を生成してR2にアップロード
 * @param {string} baseKey - 基準通貨のキー
 * @param {string} baseNormalized - 基準通貨の正規化された値
 * @param {Array<{value: string, code: string}>} outputData - 出力通貨データ
 * @param {number} timestamp - レート取得時のUNIXタイムスタンプ（秒）
 * @returns {Promise<string|null>} img_id または null
 */
export async function generateAndUploadOgpImage(baseKey, baseNormalized, outputData, timestamp) {
    try {
        // Canvas生成
        const canvas = await generateOgpCanvas(baseKey, baseNormalized, outputData, timestamp);
        const isLocalHost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        // Prefer production endpoint first for reliability, then fall back to local dev endpoints when running locally.
        const apiCandidates = isLocalHost
            ? [
                'https://osats.money/api/save-ogp', // prefer production
                `${window.location.protocol}//127.0.0.1:8787/api/save-ogp`,
                `${window.location.protocol}//localhost:8787/api/save-ogp`,
            ]
            : [`${window.location.origin}/api/save-ogp`];

        console.log('OGP upload candidates:', apiCandidates);

        // Generate a binary Blob and send as multipart/form-data (FormData)
        const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
        if (!blob) {
            throw new Error('Failed to create OGP blob');
        }

        // upload helper with timeout using AbortController. Always sends FormData(blob).
        const tryUpload = async (apiUrl, timeoutMs = 5000) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const form = new FormData();
                form.append('file', blob, 'ogp.png');
                const resp = await fetch(apiUrl, {
                    method: 'POST',
                    body: form,
                    signal: controller.signal,
                });

                clearTimeout(timeout);
                console.log('Upload response status:', resp.status, 'from', apiUrl);
                return resp;
            } catch (err) {
                clearTimeout(timeout);
                if (err.name === 'AbortError') {
                    console.error('Upload timed out for', apiUrl);
                } else {
                    console.error('Upload fetch error for', apiUrl, err);
                }
                return null;
            }
        };

        let response = null;
        let successfulUrl = null;
        for (const apiUrl of apiCandidates) {
            response = await tryUpload(apiUrl);
            if (response && response.ok) {
                successfulUrl = apiUrl;
                break;
            }
            console.warn('Upload failed or not ok, trying next candidate:', apiUrl);
        }

        if (successfulUrl) {
            console.log('OGP uploaded successfully to:', successfulUrl);
        }

        if (!response || !response.ok) {
            const errorText = response ? await response.clone().text().catch(() => '') : '';
            console.error('Upload error response:', errorText);
            throw new Error(`Upload failed: ${response ? response.status : 'no-response'} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Upload successful, img_id:', result.img_id);
        return result.img_id || null;
    } catch (error) {
        console.error('Failed to generate and upload OGP image:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error, null, 2));
        alert(`共有用画像のアップロードに失敗しました。`);
        return null;
    }
}

/**
 * OGP用の出力通貨データを準備
 * @param {string} baseKey - 基準通貨のキー
 * @param {string[]} selectedCurrencies - 選択された通貨の配列
 * @param {function} parseInputFn - 入力値をパースする関数
 * @param {string} selectedLocale - 選択されたロケール
 * @returns {{baseNormalized: string, outputData: Array<{value: string, code: string}>}}
 */
export function prepareOgpData(baseKey, selectedCurrencies, parseInputFn, selectedLocale) {
    const baseDisplayValue = document.getElementById(baseKey)?.value || '0';
    const baseNormalized = parseInputFn(baseDisplayValue, selectedLocale);

    const outputCurrencies = selectedCurrencies.filter(key => key !== baseKey).slice(0, OGP_MAX_OUTPUT_CURRENCIES);
    const outputData = outputCurrencies.map(key => {
        const displayValue = document.getElementById(key)?.value || '0';
        const normalized = parseInputFn(displayValue, selectedLocale);
        return {
            value: formatNumberForOgp(normalized),
            code: formatCurrencyCodeForOgp(key)
        };
    });

    return { baseNormalized, outputData };
}
