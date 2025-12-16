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
const IMAGE_TTL_SECONDS = 168 * 60 * 60; // 7日
const MAX_FILE_BYTES = 2 * 1024 * 1024;  // 2MB
const CACHE_MAX_AGE = 604800;            // 7日（秒）

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

const SOCIAL_BOT_PATTERN = /twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|telegrambot|line-poker|applebot/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// -----------------------------------------------------
// レスポンス生成ヘルパー
// -----------------------------------------------------
const jsonResponse = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
);

const errorResponse = (message, status) => jsonResponse({ error: message }, status);

const corsPreflightResponse = () => new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" }
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

const isSocialBot = (userAgent) => SOCIAL_BOT_PATTERN.test(userAgent);

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

    // CORS プリフライト
    if (request.method === "OPTIONS") {
        return corsPreflightResponse();
    }

    // API: OGP画像保存
    if (pathname === "/api/save-ogp" && request.method === "POST") {
        return handleSaveOgp(request, env);
    }

    // OGP画像配信
    if (pathname === "/og-image") {
        return handleOgImage(url, env);
    }

    // HTML以外かつボットでなければパススルー
    const userAgent = request.headers.get("user-agent") || "";
    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/html") && !isSocialBot(userAgent)) {
        return fetch(request);
    }

    // オリジンからレスポンス取得
    const originRes = await fetch(request);

    // 動的OGPが不要な場合はそのまま返す
    if (!shouldUseDynamicOgp(url.searchParams)) {
        return originRes;
    }

    // 旧式クエリ（カンマ区切り）は静的PNGを使用
    const imgId = isLegacyQuery(url.searchParams) ? null : url.searchParams.get('img_id');
    return rewriteOgpMeta(originRes, url, imgId);
}

// -----------------------------------------------------
// OGP画像保存 API
// -----------------------------------------------------
async function handleSaveOgp(request, env) {
    const contentType = (request.headers.get('content-type') || '').toLowerCase();

    // multipart/form-data のみ受け付け
    if (!contentType.includes('multipart/form-data')) {
        console.error('[handleSaveOgp] Unsupported Content-Type:', contentType);
        return errorResponse('Unsupported Media Type. Send multipart/form-data with field "file".', 415);
    }

    try {
        const bytes = await extractFileFromFormData(request);
        if (!bytes) {
            return errorResponse('file missing', 400);
        }

        if (bytes.length > MAX_FILE_BYTES) {
            console.error('[handleSaveOgp] File too large:', bytes.length);
            return errorResponse('File too large', 413);
        }

        if (!env.OGP_IMAGES) {
            console.error('[handleSaveOgp] R2 binding OGP_IMAGES not found!');
            return errorResponse('R2 binding not configured', 500);
        }

        // 重複チェック
        const hash = await computeSha256Hex(bytes);
        const existingImgId = await findExistingImageByHash(env, hash);
        if (existingImgId) {
            console.log('[handleSaveOgp] Duplicate detected, reusing img_id:', existingImgId);
            return jsonResponse({ img_id: existingImgId });
        }

        // 新規保存
        const imgId = await saveImageToR2(env, bytes, hash);
        console.log('[handleSaveOgp] Successfully saved:', imgId);
        return jsonResponse({ img_id: imgId });

    } catch (error) {
        console.error('[handleSaveOgp] Error:', error.message, error.stack);
        return errorResponse('Internal server error', 500);
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
    const expiresAt = Date.now() + (IMAGE_TTL_SECONDS * 1000);

    // 画像を保存
    await env.OGP_IMAGES.put(key, bytes, {
        httpMetadata: {
            contentType: 'image/png',
            cacheControl: `public, max-age=${CACHE_MAX_AGE}`
        },
        customMetadata: {
            expiresAt: expiresAt.toString(),
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
async function handleOgImage(url, env) {
    const imgId = url.searchParams.get('img_id');

    // img_idがない、または無効な形式の場合は静的OGPへリダイレクト
    if (!imgId || !isValidUuid(imgId)) {
        return redirectToStaticOgp(url.origin);
    }

    try {
        const key = `${imgId}.png`;
        const object = await env.OGP_IMAGES.get(key);

        if (!object) {
            return redirectToStaticOgp(url.origin);
        }

        // TTLチェック
        const expiresAt = parseInt(object.customMetadata?.expiresAt || '0');
        if (expiresAt && Date.now() > expiresAt) {
            // 期限切れ画像を非同期で削除
            env.OGP_IMAGES.delete(key).catch(() => { });
            return redirectToStaticOgp(url.origin);
        }

        return new Response(object.body, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
                "X-Image-Id": imgId
            }
        });
    } catch (error) {
        console.error('[handleOgImage] Error:', error);
        return redirectToStaticOgp(url.origin);
    }
}

const redirectToStaticOgp = (origin) => Response.redirect(`${origin}${STATIC_OGP_PATH}`, 302);

// -----------------------------------------------------
// 動的OGP判定
// -----------------------------------------------------
const shouldUseDynamicOgp = (params) => params.has('img_id') || params.has('ts');

// -----------------------------------------------------
// OGPメタタグ書き換え
// -----------------------------------------------------
function rewriteOgpMeta(originRes, url, imgId) {
    const params = url.searchParams;
    const { title, description } = buildOgTextFromParams(params);
    const currentUrl = url.toString();
    const ogImageUrl = imgId
        ? `${url.origin}/og-image?img_id=${imgId}`
        : `${url.origin}${STATIC_OGP_PATH}`;

    return new HTMLRewriter()
        .on('meta[property="og:title"]', new MetaContentRewriter(title))
        .on('meta[property="og:description"]', new MetaContentRewriter(description))
        .on('meta[property="og:image"]', new MetaContentRewriter(ogImageUrl))
        .on('meta[property="og:url"]', new MetaContentRewriter(currentUrl))
        .on('meta[name="twitter:card"]', new MetaContentRewriter("summary_large_image"))
        .on('meta[name="twitter:image"]', new MetaContentRewriter(ogImageUrl))
        .on('title', new TitleRewriter(title))
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

    return {
        title: `${formattedValue} ${formatCurrencyCode(key)} | ${DEFAULT_TITLE}`,
        description: `${formattedValue} ${formatCurrencyCode(key)} を含む ${currencyList.length} 通貨間の換算結果`
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

