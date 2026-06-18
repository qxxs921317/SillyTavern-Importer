/**
 * JanitorAI Full Importer - Frontend (index.js)
 * JanitorAI URL에서 캐릭터 카드(PNG)와 로어북(JSON)을 임포트합니다.
 * 모든 alternate_greetings 포함.
 */

// ❌ (수정됨) 잘못된 경로로 스크립트를 뻗게 만들던 불필요한 import 2줄 완전 삭제!

const EXTENSION_NAME = 'janitor-full-importer';
const API_BASE = '/api/plugins/janitor-full-importer';

// ──────────────────────────────────────────────
// UI 주입
// ──────────────────────────────────────────────
const PANEL_HTML = `
<div id="janitor-importer-panel">
    <div class="janitor-importer-inner">
        <h3 style="margin:0 0 12px;font-size:1em;color:var(--SmartThemeBodyColor);">
            🧹 JanitorAI Full Importer
        </h3>
        <div class="janitor-url-row">
            <input
                id="janitor-url-input"
                type="text"
                placeholder="https://janitorai.com/characters/UUID_character-slug"
                autocomplete="off"
                spellcheck="false"
            />
            <button id="janitor-fetch-btn" class="menu_button">가져오기</button>
        </div>
        <div id="janitor-status" class="janitor-status" style="display:none;"></div>
        <div id="janitor-preview" style="display:none;">
            <div class="janitor-preview-header">
                <img id="janitor-avatar-preview" src="" alt="avatar" />
                <div class="janitor-preview-info">
                    <div id="janitor-char-name" class="janitor-char-name"></div>
                    <div id="janitor-char-meta" class="janitor-char-meta"></div>
                    <div id="janitor-greeting-count" class="janitor-greeting-count"></div>
                </div>
            </div>
            <div id="janitor-lorebook-notice" style="display:none;" class="janitor-lorebook-notice">
                📚 로어북이 포함되어 있습니다.
            </div>
            <div class="janitor-actions">
                <button id="janitor-dl-png" class="menu_button">
                    🖼️ 캐릭터 카드 PNG 다운로드
                </button>
                <button id="janitor-dl-lorebook" class="menu_button" style="display:none;">
                    📖 로어북 JSON 다운로드
                </button>
                <button id="janitor-dl-both" class="menu_button" style="display:none;">
                    💾 PNG + 로어북 모두 다운로드
                </button>
            </div>
            <div class="janitor-greeting-list" id="janitor-greeting-list">
                <div class="janitor-greeting-label">그리팅 목록 (미리보기):</div>
                <div id="janitor-greetings-container"></div>
            </div>
        </div>
    </div>
</div>`;

const PANEL_CSS = `
#janitor-importer-panel { padding: 12px 16px; background: var(--SmartThemeBlurTintColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 8px; margin: 8px 0; max-width: 600px; }
.janitor-url-row { display: flex; gap: 8px; margin-bottom: 8px; }
#janitor-url-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--SmartThemeBorderColor); background: var(--SmartThemeInputBgColor, var(--SmartThemeBlurTintColor)); color: var(--SmartThemeBodyColor); font-size: 0.85em; min-width: 0; }
.janitor-status { padding: 8px 12px; border-radius: 6px; font-size: 0.85em; margin-top: 6px; }
.janitor-status.info { background: rgba(100,150,255,0.15); color: var(--SmartThemeBodyColor); }
.janitor-status.success { background: rgba(80,200,120,0.15); color: #6fcf97; }
.janitor-status.error { background: rgba(235,87,87,0.15); color: #eb5757; }
.janitor-status.warning { background: rgba(255,180,50,0.15); color: #f2c94c; }
.janitor-preview-header { display: flex; gap: 12px; align-items: flex-start; margin: 10px 0; }
#janitor-avatar-preview { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--SmartThemeBorderColor); flex-shrink: 0; }
.janitor-char-name { font-size: 1em; font-weight: bold; color: var(--SmartThemeBodyColor); margin-bottom: 4px; }
.janitor-char-meta { font-size: 0.78em; color: var(--SmartThemeQuoteColor, #aaa); line-height: 1.5; }
.janitor-greeting-count { font-size: 0.82em; color: #a8d8a8; margin-top: 4px; }
.janitor-lorebook-notice { font-size: 0.82em; padding: 5px 10px; background: rgba(255,200,80,0.1); border-left: 3px solid #f2c94c; border-radius: 4px; margin-bottom: 8px; }
.janitor-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.janitor-actions .menu_button { font-size: 0.82em; padding: 6px 12px; }
.janitor-greeting-list { margin-top: 10px; border-top: 1px solid var(--SmartThemeBorderColor); padding-top: 8px; }
.janitor-greeting-label { font-size: 0.78em; color: var(--SmartThemeQuoteColor, #aaa); margin-bottom: 6px; }
.janitor-greeting-item { font-size: 0.78em; padding: 5px 8px; margin-bottom: 4px; background: rgba(255,255,255,0.04); border-radius: 4px; border-left: 2px solid var(--SmartThemeBorderColor); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default; }
.janitor-greeting-item:hover { background: rgba(255,255,255,0.08); white-space: normal; word-break: break-word; }
.janitor-greeting-item .greeting-tag { font-size: 0.75em; opacity: 0.6; margin-right: 4px; }
`;

// ──────────────────────────────────────────────
// CRC32 테이블 (PNG tEXt 청크용)
// ──────────────────────────────────────────────
function buildCRC32Table() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c;
    }
    return table;
}
const CRC32_TABLE = buildCRC32Table();

function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// ──────────────────────────────────────────────
// PNG tEXt 청크 임베딩
// ──────────────────────────────────────────────
function embedCharInPng(pngBytes, cardData) {
    const jsonStr = JSON.stringify(cardData);
    const base64  = btoa(unescape(encodeURIComponent(jsonStr)));
    
    const keyword  = 'chara';
    const enc      = new TextEncoder();
    const keyBytes = enc.encode(keyword);
    const valBytes = enc.encode(base64);
    
    const chunkData = new Uint8Array(keyBytes.length + 1 + valBytes.length);
    chunkData.set(keyBytes, 0);
    chunkData[keyBytes.length] = 0; // null byte
    chunkData.set(valBytes, keyBytes.length + 1);
    
    const chunkType  = enc.encode('tEXt');
    const chunkLen   = chunkData.length;
    
    const crcInput   = new Uint8Array(chunkType.length + chunkData.length);
    crcInput.set(chunkType, 0);
    crcInput.set(chunkData, chunkType.length);
    const checksum   = crc32(crcInput);
    
    const chunk = new Uint8Array(4 + 4 + chunkLen + 4);
    const view  = new DataView(chunk.buffer);
    
    view.setUint32(0, chunkLen, false);           // length (big-endian)
    chunk.set(chunkType, 4);                       // "tEXt"
    chunk.set(chunkData, 8);                       // data
    view.setUint32(8 + chunkLen, checksum, false); // CRC32
    
    let iendOffset = -1;
    for (let i = pngBytes.length - 12; i > 0; i--) {
        if (pngBytes[i] === 0x49 && pngBytes[i+1] === 0x45 && pngBytes[i+2] === 0x4E && pngBytes[i+3] === 0x44) {
            iendOffset = i - 4;
            break;
        }
    }
    
    if (iendOffset === -1) throw new Error('PNG IEND 청크를 찾을 수 없습니다.');
    
    const result = new Uint8Array(pngBytes.length + chunk.length);
    result.set(pngBytes.subarray(0, iendOffset), 0);
    result.set(chunk, iendOffset);
    result.set(pngBytes.subarray(iendOffset), iendOffset + chunk.length);
    
    return result;
}

// ──────────────────────────────────────────────
// JanitorAI → TavernAI V2 변환
// ──────────────────────────────────────────────
function janitorToTavernV2(jaiData) {
    const meta = jaiData.character || jaiData;
    const def  = jaiData.character_definition || jaiData.definition || {};
    
    const firstMes          = def.first_mes || meta.greeting || '';
    const altGreetingsRaw   = def.alternate_greetings || meta.alternate_greetings || [];
    
    const alternate_greetings = Array.isArray(altGreetingsRaw)
        ? altGreetingsRaw.filter(g => typeof g === 'string' && g.trim())
        : [];
        
    const lorebookRaw = def.lorebook || meta.lorebook || null;
    let lorebook      = null;
    if (lorebookRaw && Array.isArray(lorebookRaw.entries) && lorebookRaw.entries.length > 0) {
        lorebook = buildLorebookJson(lorebookRaw, meta.name || 'character');
    }
    
    const card = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
            name:             meta.name || '',
            description:      def.description || def.personality || '',
            personality:      def.personality  || '',
            scenario:         def.scenario      || '',
            first_mes:        firstMes,
            mes_example:      def.mes_example || def.example_dialogs || '',
            alternate_greetings,
            creator:          meta.author_name  || meta.creator || '',
            creator_notes:    def.creator_notes || meta.description || '',
            tags:             Array.isArray(meta.tags) ? meta.tags : [],
            system_prompt:    def.system_prompt || '',
            post_history_instructions: def.post_history_instructions || '',
            character_book:   lorebook ? {
                name:    lorebookRaw.name || `${meta.name || 'character'} lorebook`,
                entries: lorebook.entries,
            } : undefined,
            extensions: {
                janitor_id:       meta.id || '',
                janitor_nsfw:     meta.is_nsfw    || false,
                janitor_chat_count: meta.chat_count || 0,
                janitor_origin_url: `https://janitorai.com/characters/${meta.id || ''}`,
            },
        },
    };
    return { card, lorebook };
}

function buildLorebookJson(lorebookRaw, charName) {
    const entries = (lorebookRaw.entries || []).map((entry, idx) => ({
        uid:          idx,
        key:          Array.isArray(entry.keywords) ? entry.keywords : [entry.key || ''].filter(Boolean),
        keysecondary: entry.secondary_keywords || [],
        comment:      entry.comment || entry.name || '',
        content:      entry.content || '',
        constant:     entry.constant || false,
        selective:    entry.selective || false,
        order:        entry.order ?? idx,
        position:     entry.position || 'before_char',
        disable:      entry.disabled || false,
        addMemo:      true,
        displayIndex: idx,
        probability:  entry.probability ?? 100,
        useProbability: entry.probability != null,
    }));
    return {
        name:           lorebookRaw.name || `${charName} Lorebook`,
        description:    lorebookRaw.description || '',
        scan_depth:     lorebookRaw.scan_depth     ?? 100,
        token_budget:   lorebookRaw.token_budget   ?? 2048,
        recursive_scanning: lorebookRaw.recursive_scanning ?? false,
        extensions:     {},
        entries,
    };
}

// ──────────────────────────────────────────────
// 다운로드 헬퍼
// ──────────────────────────────────────────────
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'character';
}

// ──────────────────────────────────────────────
// 아바타 PNG 가져오기
// ──────────────────────────────────────────────
async function fetchAvatarBytes(avatarUrl) {
    if (!avatarUrl) return null;
    try {
        const proxied = `${API_BASE}/avatar?url=${encodeURIComponent(avatarUrl)}`;
        const resp    = await fetch(proxied);
        if (!resp.ok) throw new Error(`avatar ${resp.status}`);
        const buf = await resp.arrayBuffer();
        return new Uint8Array(buf);
    } catch (e) {
        console.warn('[JanitorImporter] 아바타 fetch 실패, 직접 시도:', e.message);
        try {
            const resp = await fetch(avatarUrl);
            if (!resp.ok) throw new Error(`direct ${resp.status}`);
            const buf = await resp.arrayBuffer();
            return new Uint8Array(buf);
        } catch (e2) {
            console.warn('[JanitorImporter] 아바타 직접 fetch도 실패:', e2.message);
            return null;
        }
    }
}

// ──────────────────────────────────────────────
// 기본 PNG 생성 (아바타 없을 때)
// ──────────────────────────────────────────────
function createDefaultAvatar(name) {
    const canvas = document.createElement('canvas');
    canvas.width  = 400;
    canvas.height = 400;
    const ctx     = canvas.getContext('2d');
    
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 0, 400, 400);
    
    ctx.fillStyle = '#8888aa';
    ctx.font      = 'bold 180px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name || '?')[0].toUpperCase(), 200, 200);
    
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.readAsArrayBuffer(blob);
        }, 'image/png');
    });
}

// ──────────────────────────────────────────────
// 상태 표시 및 미리보기 렌더링
// ──────────────────────────────────────────────
function setStatus(msg, type = 'info') {
    const el = document.getElementById('janitor-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = `janitor-status ${type}`;
    el.style.display = msg ? 'block' : 'none';
}

function renderPreview(jaiData, card) {
    const meta  = jaiData.character || jaiData;
    const greetings = [card.data.first_mes, ...card.data.alternate_greetings].filter(Boolean);
    
    document.getElementById('janitor-char-name').textContent = card.data.name;
    document.getElementById('janitor-char-meta').innerHTML =
        `👤 ${card.data.creator || '작성자 불명'}&nbsp;&nbsp;` +
        `💬 ${meta.chat_count?.toLocaleString() || 0}회 채팅&nbsp;&nbsp;` +
        (meta.is_nsfw ? '🔞 NSFW' : '✅ SFW');
        
    const greetingCount = card.data.alternate_greetings.length;
    document.getElementById('janitor-greeting-count').textContent =
        `🗣️ 그리팅 총 ${greetings.length}개` +
        (greetingCount > 0 ? ` (기본 1개 + 대체 ${greetingCount}개)` : ' (기본 1개)');
        
    const avatarUrl = meta.profile_pic_url || meta.avatar_url || '';
    if (avatarUrl) {
        document.getElementById('janitor-avatar-preview').src = avatarUrl;
    }
    
    const hasLorebook = card.data.character_book?.entries?.length > 0;
    document.getElementById('janitor-lorebook-notice').style.display = hasLorebook ? 'block' : 'none';
    document.getElementById('janitor-dl-lorebook').style.display     = hasLorebook ? 'inline-flex' : 'none';
    document.getElementById('janitor-dl-both').style.display         = hasLorebook ? 'inline-flex' : 'none';
    
    const container = document.getElementById('janitor-greetings-container');
    container.innerHTML = '';
    greetings.forEach((g, i) => {
        const div = document.createElement('div');
        div.className = 'janitor-greeting-item';
        div.title     = g;
        div.innerHTML = `<span class="greeting-tag">${i === 0 ? '기본' : `#${i}`}</span>${g.slice(0, 120)}${g.length > 120 ? '…' : ''}`;
        container.appendChild(div);
    });
    
    document.getElementById('janitor-preview').style.display = 'block';
}

// ──────────────────────────────────────────────
// 메인 로직: 캐릭터 가져오기
// ──────────────────────────────────────────────
let _lastJaiData = null;
let _lastCard    = null;

async function fetchCharacter(urlOrId) {
    const uuidMatch = urlOrId.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (!uuidMatch) {
        setStatus('❌ 유효한 JanitorAI 캐릭터 URL이나 ID를 입력하세요.', 'error');
        return;
    }
    const charId = uuidMatch[1];
    
    document.getElementById('janitor-preview').style.display = 'none';
    document.getElementById('janitor-fetch-btn').disabled    = true;
    setStatus('⏳ 캐릭터 데이터를 가져오는 중...', 'info');
    
    try {
        // ❌ (수정됨) 헤더 요구사항 삭제하여 경로 꼬임 방지!
        const resp = await fetch(`${API_BASE}/character/${charId}`);
        
        let data;
        try {
            data = await resp.json();
        } catch {
            setStatus('❌ 서버 응답 파싱 실패', 'error');
            return;
        }
        
        if (!resp.ok) {
            if (data.cloudflare) {
                setStatus('⚠️ Cloudflare 차단됨. JanitorAI에서 직접 캐릭터를 export하거나, 아래 수동 입력 방식을 사용하세요.', 'warning');
            } else {
                setStatus(`❌ 오류: ${data.error || resp.statusText}`, 'error');
            }
            return;
        }
        
        _lastJaiData = data;
        const { card, lorebook } = janitorToTavernV2(data);
        _lastCard    = card;
        
        const greetCount = card.data.alternate_greetings.length;
        setStatus(`✅ 캐릭터 로드 완료! 그리팅 ${1 + greetCount}개 (alternate: ${greetCount}개)`, 'success');
        renderPreview(data, card);
    } catch (err) {
        console.error('[JanitorImporter]', err);
        setStatus(`❌ 요청 실패: ${err.message}`, 'error');
    } finally {
        document.getElementById('janitor-fetch-btn').disabled = false;
    }
}

// ──────────────────────────────────────────────
// 다운로드 액션
// ──────────────────────────────────────────────
async function downloadPng() {
    if (!_lastCard || !_lastJaiData) return;
    const meta      = _lastJaiData.character || _lastJaiData;
    const name      = sanitizeFilename(meta.name || 'character');
    const avatarUrl = meta.profile_pic_url || meta.avatar_url || '';
    
    setStatus('⏳ PNG 생성 중...', 'info');
    try {
        let pngBytes = await fetchAvatarBytes(avatarUrl);
        if (!pngBytes) {
            pngBytes = await createDefaultAvatar(meta.name || '?');
        }
        const embedded = embedCharInPng(pngBytes, _lastCard);
        const blob     = new Blob([embedded], { type: 'image/png' });
        downloadBlob(blob, `${name}.png`);
        setStatus('✅ PNG 다운로드 완료!', 'success');
    } catch (err) {
        console.error('[JanitorImporter] PNG 생성 오류:', err);
        setStatus(`❌ PNG 생성 실패: ${err.message}`, 'error');
    }
}

function downloadLorebook() {
    if (!_lastCard?.data?.character_book) return;
    const meta = _lastJaiData.character || _lastJaiData;
    const name = sanitizeFilename(meta.name || 'character');
    const lb   = _lastCard.data.character_book;
    
    const stLorebook = {
        name:               lb.name,
        entries:            Object.fromEntries(lb.entries.map((e, i) => [i, e])),
        extensions:         {},
        originalData:       lb,
    };
    
    const blob = new Blob([JSON.stringify(stLorebook, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${name}_lorebook.json`);
    setStatus('✅ 로어북 JSON 다운로드 완료!', 'success');
}

async function downloadBoth() {
    await downloadPng();
    downloadLorebook();
}

// ──────────────────────────────────────────────
// 초기화
// ──────────────────────────────────────────────
jQuery(async () => {
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
    
    const settingsHtml = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>${EXTENSION_NAME} (🧹마법 빗자루)</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                ${PANEL_HTML.replace('display:none;', '')}
            </div>
        </div>
    `;
    
    // ❌ (수정됨) #extensions_settings2 -> ✅ #extensions_settings 로 올바르게 수정!
    $('#extensions_settings').append(settingsHtml);
    
    $(document).on('click', '#janitor-fetch-btn', () => {
        const url = document.getElementById('janitor-url-input')?.value?.trim();
        if (url) fetchCharacter(url);
    });
    
    $(document).on('keydown', '#janitor-url-input', (e) => {
        if (e.key === 'Enter') {
            const url = e.target.value.trim();
            if (url) fetchCharacter(url);
        }
    });
    
    $(document).on('click', '#janitor-dl-png',      () => downloadPng());
    $(document).on('click', '#janitor-dl-lorebook', () => downloadLorebook());
    $(document).on('click', '#janitor-dl-both',     () => downloadBoth());
    
    console.log('[JanitorFullImporter] 로드 완료');
});