// =====================================================
// OGP画像生成（Canvas）
// =====================================================

// -----------------------------------------------------
// 定数定義
// -----------------------------------------------------

/** Canvas寸法 */
const CANVAS = {
    WIDTH: 1200,
    HEIGHT: 630
};

/** フォント設定 */
const FONTS = {
    FAMILY: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    SIZE: {
        TITLE: 100,
        FOOTER_DATE: 50,
        FOOTER_CREDIT: 34
    }
};

/** 色設定 */
const COLORS = {
    BACKGROUND: '#F5F7F6',
    TITLE: '#1a1a1a',
    OUTPUT: '#333',
    FOOTER: '#666',
    SEPARATOR: '#999'
};

/** レイアウト設定 */
const LAYOUT = {
    TITLE_Y: 130,
    SEPARATOR: { Y: 150, X_START: 100, X_END: 1100 },
    OUTPUT_SHIFT: 135,
    ICON: { SIZE: 80, PADDING: 15 },
    FOOTER_Y_OFFSET: 20,
    CREDIT_X_OFFSET: 20
};

/** 出力行のフォント設定（行数に応じた動的設定） */
const OUTPUT_FONT_CONFIGS = {
    1: { fontSize: 95, startY: 370, lineSpacing: 0 },
    2: { fontSize: 90, startY: 320, lineSpacing: 130 },
    3: { fontSize: 85, startY: 270, lineSpacing: 115 },
    4: { fontSize: 70, startY: 235, lineSpacing: 95 }
};

/** 最大出力通貨数 */
const MAX_OUTPUT_CURRENCIES = 4;

/** JSTオフセット（ミリ秒） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// -----------------------------------------------------
// フォーマット関数
// -----------------------------------------------------

/**
 * 通貨コードを表示用にフォーマット
 * @param {string} code - 通貨コード
 * @returns {string} フォーマットされた通貨コード
 */
function formatCurrencyCode(code) {
    return code === 'sats' ? 'sats' : code.toUpperCase();
}

/**
 * UNIXタイムスタンプをJST形式の文字列に変換
 * @param {number} timestampMs - ミリ秒単位のタイムスタンプ
 * @returns {string} "YYYY/MM/DD HH:mm" 形式の文字列
 */
function formatTimestampToJST(timestampMs) {
    const jstDate = new Date(timestampMs + JST_OFFSET_MS);
    const pad = (n) => String(n).padStart(2, '0');

    return `${jstDate.getUTCFullYear()}/${pad(jstDate.getUTCMonth() + 1)}/${pad(jstDate.getUTCDate())} ${pad(jstDate.getUTCHours())}:${pad(jstDate.getUTCMinutes())}`;
}

/**
 * 数値文字列をOGP用にフォーマット（桁区切り、最大8小数桁）
 * @param {string} valueStr - 数値文字列
 * @returns {string} フォーマットされた数値文字列
 */
function formatNumber(valueStr) {
    const num = parseFloat(valueStr);
    if (isNaN(num)) return valueStr;

    const fracLength = Math.min((valueStr.split('.')[1] || '').length, 8);

    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: fracLength,
        useGrouping: true
    }).format(num);
}

// -----------------------------------------------------
// Canvas描画ヘルパー関数
// -----------------------------------------------------

/**
 * Canvas要素を作成し2Dコンテキストを返す
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
 */
function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS.WIDTH;
    canvas.height = CANVAS.HEIGHT;
    return { canvas, ctx: canvas.getContext('2d') };
}

/**
 * 背景を塗りつぶす
 * @param {CanvasRenderingContext2D} ctx
 */
function drawBackground(ctx) {
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
}

/**
 * タイトル（入力値と通貨コード）を描画
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} baseKey - 基準通貨コード
 * @param {string} baseValue - 基準通貨の値
 */
function drawTitle(ctx, baseKey, baseValue) {
    const title = `${formatNumber(baseValue)} ${formatCurrencyCode(baseKey)} =`;
    ctx.font = `bold ${FONTS.SIZE.TITLE}px ${FONTS.FAMILY}`;
    ctx.fillStyle = COLORS.TITLE;
    ctx.textAlign = 'center';
    ctx.fillText(title, CANVAS.WIDTH / 2, LAYOUT.TITLE_Y);
}

/**
 * 区切り線を描画
 * @param {CanvasRenderingContext2D} ctx
 */
function drawSeparator(ctx) {
    ctx.strokeStyle = COLORS.SEPARATOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LAYOUT.SEPARATOR.X_START, LAYOUT.SEPARATOR.Y);
    ctx.lineTo(LAYOUT.SEPARATOR.X_END, LAYOUT.SEPARATOR.Y);
    ctx.stroke();
}

/** 通貨コードのフォントサイズ比率（数値に対する割合） */
const CODE_FONT_SIZE_RATIO = 0.80;

/**
 * 出力通貨の行を描画
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{value: string, code: string}>} outputData - 出力通貨データ
 */
function drawOutputRows(ctx, outputData) {
    const config = OUTPUT_FONT_CONFIGS[Math.min(outputData.length, MAX_OUTPUT_CURRENCIES)] || OUTPUT_FONT_CONFIGS[4];
    const centerX = CANVAS.WIDTH / 2 + LAYOUT.OUTPUT_SHIFT;
    const numberX = centerX - 10;
    const codeX = centerX + 10;

    const valueFontSize = config.fontSize;
    const codeFontSize = Math.round(config.fontSize * CODE_FONT_SIZE_RATIO);

    ctx.fillStyle = COLORS.OUTPUT;

    outputData.forEach((data, i) => {
        const y = config.startY + i * config.lineSpacing;

        // 数値を描画
        ctx.font = `${valueFontSize}px ${FONTS.FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(data.value, numberX, y);

        // 通貨コードを少し小さいフォントで描画
        ctx.font = `${codeFontSize}px ${FONTS.FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(data.code, codeX, y);
    });
}

/**
 * 画像を非同期で読み込む
 * @param {string} src - 画像パス
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * アイコン画像を左下に描画
 * @param {CanvasRenderingContext2D} ctx
 */
async function drawIcon(ctx) {
    try {
        const icon = await loadImage('assets/images/icon_x192.png');
        const { SIZE, PADDING } = LAYOUT.ICON;
        ctx.drawImage(icon, PADDING, CANVAS.HEIGHT - SIZE - PADDING, SIZE, SIZE);
    } catch (error) {
        console.warn('OGPアイコンの読み込みに失敗しました:', error);
    }
}

/**
 * フッター（日付とクレジット）を描画
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} timestampSec - UNIXタイムスタンプ（秒）
 */
function drawFooter(ctx, timestampSec) {
    const footerY = CANVAS.HEIGHT - LAYOUT.FOOTER_Y_OFFSET;
    ctx.fillStyle = COLORS.FOOTER;

    // 日付（中央）
    ctx.textAlign = 'center';
    ctx.font = `${FONTS.SIZE.FOOTER_DATE}px ${FONTS.FAMILY}`;
    ctx.fillText(formatTimestampToJST(timestampSec * 1000), CANVAS.WIDTH / 2, footerY);

    // クレジット（右寄せ）
    ctx.textAlign = 'right';
    ctx.font = `${FONTS.SIZE.FOOTER_CREDIT}px ${FONTS.FAMILY}`;
    ctx.fillText('Source: CoinGecko', CANVAS.WIDTH - LAYOUT.CREDIT_X_OFFSET, footerY);
}

// -----------------------------------------------------
// Canvas生成（メイン）
// -----------------------------------------------------

/**
 * OGP画像用のCanvasを生成
 * @param {string} baseKey - 基準通貨のキー
 * @param {string} baseNormalized - 基準通貨の正規化された値
 * @param {Array<{value: string, code: string}>} outputData - 出力通貨データ
 * @param {number} timestamp - レート取得時のUNIXタイムスタンプ（秒）
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateOgpCanvas(baseKey, baseNormalized, outputData, timestamp) {
    const { canvas, ctx } = createCanvas();

    drawBackground(ctx);
    drawTitle(ctx, baseKey, baseNormalized);
    drawSeparator(ctx);
    drawOutputRows(ctx, outputData);
    await drawIcon(ctx);
    drawFooter(ctx, timestamp);

    return canvas;
}

// -----------------------------------------------------
// アップロード機能
// -----------------------------------------------------

/** APIエンドポイント設定 */
const API = {
    PRODUCTION: 'https://osats.money/api/save-ogp',
    LOCAL_PORTS: [8787],
    PATH: '/api/save-ogp',
    TIMEOUT_MS: 5000
};

/**
 * ローカル環境かどうかを判定
 * @returns {boolean}
 */
function isLocalEnvironment() {
    const hostname = window.location.hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost';
}

/**
 * APIエンドポイント候補のリストを取得
 * @returns {string[]}
 */
function getApiEndpoints() {
    if (!isLocalEnvironment()) {
        return [`${window.location.origin}${API.PATH}`];
    }
    // ローカル環境: 本番優先、次にローカル開発サーバー
    return [
        API.PRODUCTION,
        ...API.LOCAL_PORTS.flatMap(port => [
            `${window.location.protocol}//127.0.0.1:${port}${API.PATH}`,
            `${window.location.protocol}//localhost:${port}${API.PATH}`
        ])
    ];
}

/**
 * CanvasをBlobに変換
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
            'image/png'
        );
    });
}

/**
 * タイムアウト付きでBlobをアップロード
 * @param {string} url - APIエンドポイント
 * @param {Blob} blob - アップロードするBlob
 * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
 * @returns {Promise<Response|null>}
 */
async function uploadWithTimeout(url, blob, timeoutMs = API.TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const form = new FormData();
        form.append('file', blob, 'ogp.png');

        const response = await fetch(url, {
            method: 'POST',
            body: form,
            signal: controller.signal
        });

        console.log('Upload response status:', response.status, 'from', url);
        return response;
    } catch (error) {
        const message = error.name === 'AbortError' ? 'timed out' : error.message;
        console.error(`Upload ${message} for`, url);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 複数のエンドポイントに対して順次アップロードを試行
 * @param {Blob} blob - アップロードするBlob
 * @param {string[]} endpoints - APIエンドポイントのリスト
 * @returns {Promise<{response: Response, url: string}|null>}
 */
async function tryUploadToEndpoints(blob, endpoints) {
    for (const url of endpoints) {
        const response = await uploadWithTimeout(url, blob);
        if (response?.ok) {
            console.log('OGP uploaded successfully to:', url);
            return { response, url };
        }
        console.warn('Upload failed or not ok, trying next candidate:', url);
    }
    return null;
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
        const canvas = await generateOgpCanvas(baseKey, baseNormalized, outputData, timestamp);
        const blob = await canvasToBlob(canvas);
        const endpoints = getApiEndpoints();

        console.log('OGP upload candidates:', endpoints);

        const uploadResult = await tryUploadToEndpoints(blob, endpoints);

        if (!uploadResult) {
            throw new Error('All upload endpoints failed');
        }

        const result = await uploadResult.response.json();
        console.log('Upload successful, img_id:', result.img_id);
        return result.img_id || null;
    } catch (error) {
        console.error('Failed to generate and upload OGP image:', error);
        console.error('Error stack:', error.stack);
        alert(window.vanilla_i18n_instance?.translate('alerts.ogpUploadFailed') || '共有用画像のアップロードに失敗しました。');
        return null;
    }
}

// -----------------------------------------------------
// データ準備
// -----------------------------------------------------

/**
 * DOM要素から通貨の値を取得
 * @param {string} currencyKey - 通貨キー
 * @returns {string} 通貨の値（デフォルト: '0'）
 */
function getCurrencyValue(currencyKey) {
    return document.getElementById(currencyKey)?.value || '0';
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
    const baseNormalized = parseInputFn(getCurrencyValue(baseKey), selectedLocale);

    const outputCurrencies = selectedCurrencies
        .filter(key => key !== baseKey)
        .slice(0, MAX_OUTPUT_CURRENCIES);

    const outputData = outputCurrencies.map(key => {
        const normalized = parseInputFn(getCurrencyValue(key), selectedLocale);
        return {
            value: formatNumber(normalized),
            code: formatCurrencyCode(key)
        };
    });

    return { baseNormalized, outputData };
}
