// =====================================================
// Cloudflare Worker for sats-rate OGP
// R2を使用した動的PNG OGP画像配信
// =====================================================

// -----------------------------------------------------
// 定数
// -----------------------------------------------------
const DEFAULT_TITLE = "おいくらサッツ";
const DEFAULT_DESCRIPTION = "ビットコイン、サッツ、日本円、米ドルなど複数通貨間換算ツール";
const STATIC_OGP_PATH = "/assets/images/ogp.png";
const MAX_FILE_BYTES = 2 * 1024 * 1024;  // 2MB
const CACHE_MAX_AGE = 31536000;           // 1年（秒）

// CORS ヘッダーを動的に生成（オリジン検証付き）
function getCorsHeaders(origin) {
    const allowedOrigin = isAllowedOrigin(origin) ? origin : 'null';
    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}

const SOCIAL_BOT_PATTERN = /twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|telegrambot|line-poker|applebot/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const MAX_TEXT_LENGTH = 200; // メタタグの最大長

// 許可されたオリジン（本番環境では実際のドメインに変更）
const ALLOWED_ORIGINS = [
    'https://osats.money',
    'https://www.osats.money'
];

// -----------------------------------------------------
// レスポンス生成ヘルパー
// -----------------------------------------------------
const jsonResponse = (data, status = 200, origin = null) => new Response(
    JSON.stringify(data),
    { status, headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) } }
);

const errorResponse = (message, status, origin = null) => jsonResponse({ error: message }, status, origin);

const corsPreflightResponse = (origin) => new Response(null, {
    status: 204,
    headers: { ...getCorsHeaders(origin), "Access-Control-Max-Age": "86400" }
});

// -----------------------------------------------------
// ユーティリティ関数
// -----------------------------------------------------
const formatCurrencyCode = (code) => code === 'sats' ? 'sats' : code.toUpperCase();

const parseCurrencyList = (currencies) => {
    const separator = currencies.includes('-') ? '-' : ',';
    return currencies.split(separator).map(s => s.trim()).filter(Boolean);
};

const isLegacyQuery = (params) => params.get('currencies')?.includes(',') ?? false;


const isValidUuid = (id) => UUID_PATTERN.test(id);

function generateUuidV4() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function computeSha256Hex(uint8arr) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8arr.buffer);
    return [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// HTMLエスケープ（XSS対策）
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// テキストの長さとパターンを検証
function sanitizeText(text, maxLength = MAX_TEXT_LENGTH) {
    if (!text) return '';
    const str = String(text).trim();
    // 長さ制限
    const truncated = str.length > maxLength ? str.substring(0, maxLength) : str;
    return escapeHtml(truncated);
}

// PNGファイルの検証（マジックバイト）
function isPngFile(bytes) {
    if (!bytes || bytes.length < PNG_MAGIC_BYTES.length) return false;
    for (let i = 0; i < PNG_MAGIC_BYTES.length; i++) {
        if (bytes[i] !== PNG_MAGIC_BYTES[i]) return false;
    }
    return true;
}

// オリジンの検証
function isAllowedOrigin(origin) {
    if (!origin) return false;
    // 開発環境の判定（localhost）
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
    return ALLOWED_ORIGINS.includes(origin);
}

// -----------------------------------------------------
// メインハンドラー
// -----------------------------------------------------
export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    }
};

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const origin = request.headers.get('origin');

    // CORS プリフライト
    if (request.method === "OPTIONS") {
        return corsPreflightResponse(origin);
    }

    // API: OGP画像保存
    if (pathname === "/api/save-ogp" && request.method === "POST") {
        return handleSaveOgp(request, env);
    }

    // OGP画像配信
    // /og-image または /og-image/<uuid>.png を受け付ける
    if (pathname.startsWith("/og-image")) {
        return handleOgImage(url, env, request);
    }

    // 静的アセット（画像、CSS、JS、フォントなど）はそのままパススルー
    if (pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|css|js|ico|woff|woff2|ttf|eot|json)$/i)) {
        return fetch(request);
    }

    // オリジンからレスポンス取得
    const originRes = await fetch(request);

    // HTML以外のレスポンスはそのまま返す
    const contentType = originRes.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
        return originRes;
    }

    // 旧式クエリ（カンマ区切り）は静的PNGを使用
    let imgId = isLegacyQuery(url.searchParams) ? null : url.searchParams.get('img_id');
    // img_idの検証 - 無効な場合はnullにフォールバック
    if (imgId && !isValidUuid(imgId)) {
        console.warn('[handleRequest] Invalid img_id format, using static OGP');
        imgId = null;
    }
    return rewriteOgpMeta(originRes, url, imgId);
}

// -----------------------------------------------------
// OGP画像保存 API
// -----------------------------------------------------
async function handleSaveOgp(request, env) {
    const origin = request.headers.get('origin');

    // オリジン検証（開発環境ではlocalhostを許可）
    if (!isAllowedOrigin(origin)) {
        console.warn('[handleSaveOgp] Forbidden origin:', origin);
        return errorResponse('Forbidden', 403, origin);
    }

    const contentType = (request.headers.get('content-type') || '').toLowerCase();

    // multipart/form-data のみ受け付け
    if (!contentType.includes('multipart/form-data')) {
        console.error('[handleSaveOgp] Unsupported Content-Type:', contentType);
        return errorResponse('Unsupported Media Type. Send multipart/form-data with field "file".', 415, origin);
    }

    try {
        const bytes = await extractFileFromFormData(request);
        if (!bytes) {
            return errorResponse('file missing', 400, origin);
        }

        if (bytes.length > MAX_FILE_BYTES) {
            console.error('[handleSaveOgp] File too large:', bytes.length);
            return errorResponse('File too large', 413, origin);
        }

        // PNG形式の検証（SVG等を拒否）
        if (!isPngFile(bytes)) {
            console.error('[handleSaveOgp] Invalid file format - only PNG allowed');
            return errorResponse('Invalid file format. Only PNG images are allowed.', 415, origin);
        }

        if (!env.OGP_IMAGES) {
            console.error('[handleSaveOgp] R2 binding OGP_IMAGES not found!');
            return errorResponse('R2 binding not configured', 500, origin);
        }

        // 重複チェック
        const hash = await computeSha256Hex(bytes);
        const existingImgId = await findExistingImageByHash(env, hash);
        if (existingImgId) {
            console.log('[handleSaveOgp] Duplicate detected, reusing img_id:', existingImgId);
            return jsonResponse({ img_id: existingImgId }, 200, origin);
        }

        // 新規保存
        const imgId = await saveImageToR2(env, bytes, hash);
        console.log('[handleSaveOgp] Successfully saved:', imgId);
        return jsonResponse({ img_id: imgId }, 200, origin);

    } catch (error) {
        console.error('[handleSaveOgp] Error:', error.message, error.stack);
        return errorResponse('Internal server error', 500, origin);
    }
}

async function extractFileFromFormData(request) {
    const form = await request.formData();
    const file = form.get('file') || form.get('image');
    if (!file) return null;

    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
}

async function findExistingImageByHash(env, hash) {
    const mappingKey = `hashes/${hash}.json`;
    const existingMapping = await env.OGP_IMAGES.get(mappingKey);
    return existingMapping?.customMetadata?.img_id || null;
}

async function saveImageToR2(env, bytes, hash) {
    const imgId = generateUuidV4();
    const key = `${imgId}.png`;

    // 画像を保存
    await env.OGP_IMAGES.put(key, bytes, {
        httpMetadata: {
            contentType: 'image/png',
            cacheControl: `public, max-age=${CACHE_MAX_AGE}, immutable`
        },
        customMetadata: {
            createdAt: Date.now().toString()
        }
    });

    // ハッシュマッピングを保存
    const mappingKey = `hashes/${hash}.json`;
    await env.OGP_IMAGES.put(mappingKey, '', {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
            img_id: imgId,
            hash,
            createdAt: Date.now().toString()
        }
    });

    return imgId;
}

// -----------------------------------------------------
// OGP画像配信
// -----------------------------------------------------
async function handleOgImage(url, env, request) {
    // img_id はクエリパラメータまたはパス (/og-image/<uuid>.png) から取得可能
    let imgId = url.searchParams.get('img_id');
    if (!imgId) {
        const m = url.pathname.match(/^\/og-image\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.png)?$/i);
        if (m) imgId = m[1];
    }

    // img_idがない、または無効な形式の場合は静的OGPを直接返す（Twitterbotはリダイレクトを追跡しないため）
    if (!imgId || !isValidUuid(imgId)) {
        return fetchStaticOgp(url.origin, request);
    }

    try {
        const key = `${imgId}.png`;
        const object = await env.OGP_IMAGES.get(key);

        if (!object) {
            return fetchStaticOgp(url.origin, request);
        }

        // TTLはR2のライフサイクルに任せる（期限切れオブジェクトはR2側で自動削除され、存在しない場合は上で静的OGPを返す）

        return new Response(object.body, {
            headers: {
                "Content-Type": "image/png",
                // Long cache + immutable for content-addressed images
                "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
                "X-Content-Type-Options": "nosniff",
                "X-Image-Id": imgId
            }
        });
    } catch (error) {
        console.error('[handleOgImage] Error:', error);
        return fetchStaticOgp(url.origin, request);
    }
}

// 静的OGP画像を直接フェッチして返す（リダイレクトではなく、Twitterbot対応）
async function fetchStaticOgp(origin, request) {
    try {
        const staticUrl = `${origin}${STATIC_OGP_PATH}`;
        const response = await fetch(staticUrl, {
            headers: {
                'User-Agent': request.headers.get('User-Agent') || ''
            }
        });

        if (!response.ok) {
            // フェッチに失敗した場合のみリダイレクトにフォールバック
            return Response.redirect(`${origin}${STATIC_OGP_PATH}`, 302);
        }

        // 画像を直接返す（リダイレクトなし）
        return new Response(response.body, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400",
                "X-Content-Type-Options": "nosniff"
            }
        });
    } catch (error) {
        console.error('[fetchStaticOgp] Error:', error);
        return Response.redirect(`${origin}${STATIC_OGP_PATH}`, 302);
    }
}

// -----------------------------------------------------
// OGPメタタグ書き換え
// -----------------------------------------------------
function rewriteOgpMeta(originRes, url, imgId) {
    const params = url.searchParams;
    const { title, description } = buildOgTextFromParams(params);
    const currentUrl = url.toString();
    // 可能なら拡張子付きのパス形式を使う（bots が拡張子のないURLを嫌うケースを回避）
    const ogImageUrl = imgId
        ? `${url.origin}/og-image/${imgId}.png`
        : `${url.origin}${STATIC_OGP_PATH}`;

    return new HTMLRewriter()
        .on('meta[property="og:title"]', new MetaContentRewriter(title))
        .on('meta[property="og:description"]', new MetaContentRewriter(description))
        .on('meta[property="og:image"]', new MetaContentRewriter(ogImageUrl))
        .on('meta[property="og:url"]', new MetaContentRewriter(currentUrl))
        .on('meta[name="twitter:card"]', new MetaContentRewriter("summary_large_image"))
        .on('title', new TitleRewriter(title))
        .on('head', new HeadInjector(ogImageUrl, title, description))
        .transform(originRes);
}

// -----------------------------------------------------
// OGPテキスト生成
// -----------------------------------------------------
function buildOgTextFromParams(params) {
    const currencies = params.get('currencies');
    if (!currencies) {
        return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    }

    const currencyList = parseCurrencyList(currencies);
    const baseCurrency = findBaseCurrency(params);

    if (!baseCurrency) {
        return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    }

    const { key, value } = baseCurrency;
    const formattedValue = formatNumberWithLocale(value, params);
    const currencyCode = formatCurrencyCode(key);

    // タイトルと説明をサニタイズ（XSS対策）
    return {
        title: sanitizeText(`${formattedValue} ${currencyCode} | ${DEFAULT_TITLE}`),
        description: sanitizeText(`${formattedValue} ${currencyCode} を含む ${currencyList.length} 通貨間の計算結果`)
    };
}

function findBaseCurrency(params) {
    const SKIP_PARAMS = new Set(['currencies', 'img_id', 'd']);
    const CURRENCY_CODE_PATTERN = /^[a-z]{2,4}$/i;

    for (const [key, value] of params.entries()) {
        if (SKIP_PARAMS.has(key)) continue;
        if (CURRENCY_CODE_PATTERN.test(key) && value) {
            return { key, value };
        }
    }
    return null;
}

function formatNumberWithLocale(valueStr, params) {
    const s = String(valueStr).trim();
    if (!s) return s;

    // 小数点の正規化
    const normalized = s.includes(',') && !s.includes('.')
        ? s.replace(/,/g, '.')
        : s.replace(/,/g, '');

    const num = Number(normalized);
    if (Number.isNaN(num)) return s;

    const locale = params.get('d') === 'c' ? 'de-DE' : 'en-US';
    const parts = normalized.split('.');
    const fracLength = Math.min(parts[1]?.length || 0, 8);

    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: fracLength,
        useGrouping: true
    }).format(num);
}

// -----------------------------------------------------
// HTMLRewriter クラス
// -----------------------------------------------------
class MetaContentRewriter {
    constructor(content) {
        this.content = content;
    }
    element(el) {
        el.setAttribute("content", this.content);
    }
}

class TitleRewriter {
    constructor(title) {
        this.title = title;
    }
    element(el) {
        el.setInnerContent(this.title);
    }
}

// head に追加の OGP 画像メタを挿入する
// XSS対策: 安全なメタ要素作成（エスケープ済みの値のみ使用）
class HeadInjector {
    constructor(ogImageUrl, title, description) {
        // URLと文字列の検証・サニタイズ
        this.ogImageUrl = sanitizeText(ogImageUrl, 500);
        this.title = sanitizeText(title);
        this.description = sanitizeText(description);
    }
    element(el) {
        // 安全にエスケープされた値でメタ要素を追加
        // HTMLRewriterは setAttribute 経由で安全に挿入
        const metaTags = [
            `<meta property="og:image:type" content="image/png">`,
            `<meta property="og:image:width" content="1200">`,
            `<meta property="og:image:height" content="630">`
        ].join('');

        // 既にエスケープ済みなのでhtml:trueは安全
        el.append(metaTags, { html: true });
    }
}

