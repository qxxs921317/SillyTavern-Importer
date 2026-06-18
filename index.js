/**
 * 🧹 JanitorAI Full Importer - Frontend (index.js)
 * data/default-user/extensions/ 호환 버전
 * ES module import 없이 window 전역 접근 방식 사용
 */

(function () {
    'use strict';

    const EXTENSION_NAME = 'janitor-full-importer';
    const API_BASE = '/api/plugins/janitor-full-importer';

    // ──────────────────────────────────────────────
    // ST 전역 API 헬퍼 (import 대신 window 접근)
    // ──────────────────────────────────────────────
    function getRequestHeaders() {
        // ST가 window에 노출하는 헬퍼 or 직접 구성
        if (window.getRequestHeaders) return window.getRequestHeaders();
        const token = document.cookie.match(/token=([^;]+)/)?.[1] || '';
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    // ──────────────────────────────────────────────
    // CSS
    // ──────────────────────────────────────────────
    const PANEL_CSS = `
#janitor-importer-panel { padding:12px 16px; max-width:600px; }
.janitor-url-row { display:flex; gap:8px; margin-bottom:8px; }
#janitor-url-input {
    flex:1; padding:6px 10px; border-radius:6px; min-width:0;
    border:1px solid var(--SmartThemeBorderColor);
    background:var(--SmartThemeBlurTintColor);
    color:var(--SmartThemeBodyColor); font-size:0.85em;
}
.janitor-status { padding:8px 12px; border-radius:6px; font-size:0.85em; margin-top:6px; }
.janitor-status.info    { background:rgba(100,150,255,.15); }
.janitor-status.success { background:rgba(80,200,120,.15); color:#6fcf97; }
.janitor-status.error   { background:rgba(235,87,87,.15);  color:#eb5757; }
.janitor-status.warning { background:rgba(255,180,50,.15); color:#f2c94c; }
.janitor-preview-header { display:flex; gap:12px; align-items:flex-start; margin:10px 0; }
#janitor-avatar-preview {
    width:72px; height:72px; object-fit:cover;
    border-radius:6px; border:1px solid var(--SmartThemeBorderColor); flex-shrink:0;
}
.janitor-char-name  { font-size:1em; font-weight:bold; margin-bottom:4px; }
.janitor-char-meta  { font-size:0.78em; opacity:.7; line-height:1.5; }
.janitor-greeting-count { font-size:0.82em; color:#a8d8a8; margin-top:4px; }
.janitor-lorebook-notice {
    font-size:0.82em; padding:5px 10px; margin-bottom:8px;
    background:rgba(255,200,80,.1); border-left:3px solid #f2c94c; border-radius:4px;
}
.janitor-actions { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
.janitor-actions .menu_button { font-size:0.82em; padding:6px 12px; }
.janitor-greeting-list { margin-top:10px; border-top:1px solid var(--SmartThemeBorderColor); padding-top:8px; }
.janitor-greeting-label { font-size:0.78em; opacity:.6; margin-bottom:6px; }
.janitor-greeting-item {
    font-size:0.78em; padding:5px 8px; margin-bottom:4px;
    background:rgba(255,255,255,.04); border-radius:4px;
    border-left:2px solid var(--SmartThemeBorderColor);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:default;
}
.janitor-greeting-item:hover { background:rgba(255,255,255,.08); white-space:normal; word-break:break-word; }
.greeting-tag { font-size:.75em; opacity:.6; margin-right:4px; }
`;

    // ──────────────────────────────────────────────
    // HTML
    // ──────────────────────────────────────────────
    const PANEL_HTML = `
<div id="janitor-importer-panel">
    <div class="janitor-url-row">
        <input id="janitor-url-input" type="text"
            placeholder="https://janitorai.com/characters/UUID_character-slug"
            autocomplete="off" spellcheck="false" />
        <button id="janitor-fetch-btn" class="menu_button">가져오기</button>
    </div>
    <div id="janitor-status" class="janitor-status" style="display:none;"></div>
    <div id="janitor-preview" style="display:none;">
        <div class="janitor-preview-header">
            <img id="janitor-avatar-preview" src="" alt="avatar" />
            <div>
                <div id="janitor-char-name" class="janitor-char-name"></div>
                <div id="janitor-char-meta"  class="janitor-char-meta"></div>
                <div id="janitor-greeting-count" class="janitor-greeting-count"></div>
            </div>
        </div>
        <div id="janitor-lorebook-notice" class="janitor-lorebook-notice" style="display:none;">
            📚 로어북이 포함되어 있습니다.
        </div>
        <div class="janitor-actions">
            <button id="janitor-dl-png"      class="menu_button">🖼️ 캐릭터 카드 PNG</button>
            <button id="janitor-dl-lorebook" class="menu_button" style="display:none;">📖 로어북 JSON</button>
            <button id="janitor-dl-both"     class="menu_button" style="display:none;">💾 PNG + 로어북</button>
        </div>
        <div class="janitor-greeting-list">
            <div class="janitor-greeting-label">그리팅 목록 (클릭하면 전체 보기):</div>
            <div id="janitor-greetings-container"></div>
        </div>
    </div>
</div>`;

    // ──────────────────────────────────────────────
    // CRC32
    // ──────────────────────────────────────────────
    const CRC32_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            t[i] = c;
        }
        return t;
    })();

    function crc32(data) {
        let c = 0xffffffff;
        for (let i = 0; i < data.length; i++) c = CRC32_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    // ──────────────────────────────────────────────
    // PNG tEXt 임베딩
    // ──────────────────────────────────────────────
    function embedCharInPng(pngBytes, cardData) {
        const base64    = btoa(unescape(encodeURIComponent(JSON.stringify(cardData))));
        const enc       = new TextEncoder();
        const keyBytes  = enc.encode('chara');
        const valBytes  = enc.encode(base64);
        const chunkData = new Uint8Array(keyBytes.length + 1 + valBytes.length);
        chunkData.set(keyBytes);
        chunkData[keyBytes.length] = 0;
        chunkData.set(valBytes, keyBytes.length + 1);

        const chunkType = enc.encode('tEXt');
        const crcInput  = new Uint8Array(chunkType.length + chunkData.length);
        crcInput.set(chunkType); crcInput.set(chunkData, chunkType.length);

        const chunk = new Uint8Array(4 + 4 + chunkData.length + 4);
        const view  = new DataView(chunk.buffer);
        view.setUint32(0, chunkData.length, false);
        chunk.set(chunkType, 4);
        chunk.set(chunkData, 8);
        view.setUint32(8 + chunkData.length, crc32(crcInput), false);

        let iendOffset = -1;
        for (let i = pngBytes.length - 12; i > 0; i--) {
            if (pngBytes[i]===0x49&&pngBytes[i+1]===0x45&&pngBytes[i+2]===0x4E&&pngBytes[i+3]===0x44) {
                iendOffset = i - 4; break;
            }
        }
        if (iendOffset === -1) throw new Error('PNG IEND 청크 없음');

        const out = new Uint8Array(pngBytes.length + chunk.length);
        out.set(pngBytes.subarray(0, iendOffset));
        out.set(chunk, iendOffset);
        out.set(pngBytes.subarray(iendOffset), iendOffset + chunk.length);
        return out;
    }

    // ──────────────────────────────────────────────
    // JanitorAI → TavernAI V2 변환
    // ──────────────────────────────────────────────
    function janitorToTavernV2(jaiData) {
        const meta = jaiData.character || jaiData;
        const def  = jaiData.character_definition || jaiData.definition || {};

        const firstMes = def.first_mes || meta.greeting || '';
        const altRaw   = def.alternate_greetings || meta.alternate_greetings || [];
        const alternate_greetings = Array.isArray(altRaw)
            ? altRaw.filter(g => typeof g === 'string' && g.trim())
            : [];

        const lorebookRaw = def.lorebook || meta.lorebook || null;
        let characterBook = undefined;
        if (lorebookRaw?.entries?.length) {
            const entries = lorebookRaw.entries.map((e, i) => ({
                uid: i,
                key: Array.isArray(e.keywords) ? e.keywords : [e.key||''].filter(Boolean),
                keysecondary: e.secondary_keywords || [],
                comment:  e.comment || e.name || '',
                content:  e.content || '',
                constant: e.constant || false,
                selective: e.selective || false,
                order:    e.order ?? i,
                position: e.position || 'before_char',
                disable:  e.disabled || false,
                addMemo:  true,
                displayIndex: i,
                probability: e.probability ?? 100,
                useProbability: e.probability != null,
            }));
            characterBook = {
                name: lorebookRaw.name || `${meta.name || 'character'} Lorebook`,
                entries,
            };
        }

        const card = {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name:        meta.name || '',
                description: def.description || def.personality || '',
                personality: def.personality || '',
                scenario:    def.scenario || '',
                first_mes:   firstMes,
                mes_example: def.mes_example || def.example_dialogs || '',
                alternate_greetings,
                creator:       meta.author_name || meta.creator || '',
                creator_notes: def.creator_notes || meta.description || '',
                tags:          Array.isArray(meta.tags) ? meta.tags : [],
                system_prompt: def.system_prompt || '',
                post_history_instructions: def.post_history_instructions || '',
                character_book: characterBook,
                extensions: {
                    janitor_id:  meta.id || '',
                    janitor_nsfw: meta.is_nsfw || false,
                    janitor_chat_count: meta.chat_count || 0,
                    janitor_origin_url: `https://janitorai.com/characters/${meta.id||''}`,
                },
            },
        };
        return card;
    }

    // ──────────────────────────────────────────────
    // 유틸
    // ──────────────────────────────────────────────
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function sanitize(name) {
        return (name || 'character').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    }

    function setStatus(msg, type = 'info') {
        const el = document.getElementById('janitor-status');
        if (!el) return;
        el.textContent  = msg;
        el.className    = `janitor-status ${type}`;
        el.style.display = msg ? 'block' : 'none';
    }

    // ──────────────────────────────────────────────
    // 아바타 fetch
    // ──────────────────────────────────────────────
    async function fetchAvatarBytes(url) {
        if (!url) return null;
        // 백엔드 프록시 우선
        try {
            const r = await fetch(`${API_BASE}/avatar?url=${encodeURIComponent(url)}`);
            if (r.ok) return new Uint8Array(await r.arrayBuffer());
        } catch {}
        // 직접 fallback
        try {
            const r = await fetch(url);
            if (r.ok) return new Uint8Array(await r.arrayBuffer());
        } catch {}
        return null;
    }

    async function createDefaultAvatar(name) {
        const canvas = Object.assign(document.createElement('canvas'), { width: 400, height: 400 });
        const ctx    = canvas.getContext('2d');
        ctx.fillStyle = '#2a2a3a'; ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#8888aa'; ctx.font = 'bold 180px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((name||'?')[0].toUpperCase(), 200, 200);
        return new Promise(res => canvas.toBlob(b => {
            const r = new FileReader();
            r.onload = () => res(new Uint8Array(r.result));
            r.readAsArrayBuffer(b);
        }, 'image/png'));
    }

    // ──────────────────────────────────────────────
    // 미리보기 렌더
    // ──────────────────────────────────────────────
    function renderPreview(jaiData, card) {
        const meta     = jaiData.character || jaiData;
        const greetings = [card.data.first_mes, ...card.data.alternate_greetings].filter(Boolean);
        const altCount  = card.data.alternate_greetings.length;
        const hasBook   = !!card.data.character_book?.entries?.length;

        document.getElementById('janitor-char-name').textContent = card.data.name;
        document.getElementById('janitor-char-meta').innerHTML   =
            `👤 ${card.data.creator||'작성자 불명'}  💬 ${(meta.chat_count||0).toLocaleString()}회` +
            (meta.is_nsfw ? '  🔞 NSFW' : '  ✅ SFW');
        document.getElementById('janitor-greeting-count').textContent =
            `🗣️ 그리팅 총 ${greetings.length}개` +
            (altCount > 0 ? ` (기본 1 + 대체 ${altCount})` : '');

        const avatarUrl = meta.profile_pic_url || meta.avatar_url || '';
        if (avatarUrl) document.getElementById('janitor-avatar-preview').src = avatarUrl;

        document.getElementById('janitor-lorebook-notice').style.display = hasBook ? 'block' : 'none';
        document.getElementById('janitor-dl-lorebook').style.display     = hasBook ? '' : 'none';
        document.getElementById('janitor-dl-both').style.display         = hasBook ? '' : 'none';

        const container = document.getElementById('janitor-greetings-container');
        container.innerHTML = '';
        greetings.forEach((g, i) => {
            const d = document.createElement('div');
            d.className = 'janitor-greeting-item'; d.title = g;
            d.innerHTML = `<span class="greeting-tag">${i===0?'기본':`#${i}`}</span>${g.slice(0,120)}${g.length>120?'…':''}`;
            container.appendChild(d);
        });

        document.getElementById('janitor-preview').style.display = 'block';
    }

    // ──────────────────────────────────────────────
    // 상태 저장
    // ──────────────────────────────────────────────
    let _lastJaiData = null;
    let _lastCard    = null;

    // ──────────────────────────────────────────────
    // 캐릭터 fetch
    // ──────────────────────────────────────────────
    async function fetchCharacter(input) {
        const match = input.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (!match) { setStatus('❌ 유효한 JanitorAI URL 또는 UUID를 입력하세요.', 'error'); return; }

        const charId = match[1];
        document.getElementById('janitor-preview').style.display = 'none';
        document.getElementById('janitor-fetch-btn').disabled    = true;
        setStatus('⏳ 가져오는 중...', 'info');

        try {
            const resp = await fetch(`${API_BASE}/character/${charId}`, {
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await resp.json().catch(() => ({}));

            if (!resp.ok) {
                setStatus(data.cloudflare
                    ? '⚠️ Cloudflare에 막혔습니다. JanitorAI에서 직접 export 후 사용하세요.'
                    : `❌ ${data.error || resp.statusText}`,
                    data.cloudflare ? 'warning' : 'error');
                return;
            }

            _lastJaiData = data;
            _lastCard    = janitorToTavernV2(data);

            const altCount = _lastCard.data.alternate_greetings.length;
            setStatus(`✅ 로드 완료! 그리팅 ${1 + altCount}개 (alternate: ${altCount}개)`, 'success');
            renderPreview(data, _lastCard);
        } catch (err) {
            setStatus(`❌ 오류: ${err.message}`, 'error');
        } finally {
            document.getElementById('janitor-fetch-btn').disabled = false;
        }
    }

    // ──────────────────────────────────────────────
    // 다운로드
    // ──────────────────────────────────────────────
    async function downloadPng() {
        if (!_lastCard || !_lastJaiData) return;
        const meta = _lastJaiData.character || _lastJaiData;
        const name = sanitize(meta.name);
        setStatus('⏳ PNG 생성 중...', 'info');
        try {
            let bytes = await fetchAvatarBytes(meta.profile_pic_url || meta.avatar_url || '');
            if (!bytes) bytes = await createDefaultAvatar(meta.name);
            downloadBlob(new Blob([embedCharInPng(bytes, _lastCard)], { type:'image/png' }), `${name}.png`);
            setStatus('✅ PNG 다운로드 완료!', 'success');
        } catch (err) {
            setStatus(`❌ PNG 생성 실패: ${err.message}`, 'error');
        }
    }

    function downloadLorebook() {
        if (!_lastCard?.data?.character_book) return;
        const meta = _lastJaiData.character || _lastJaiData;
        const name = sanitize(meta.name);
        const lb   = _lastCard.data.character_book;
        const stLb = {
            name:       lb.name,
            entries:    Object.fromEntries(lb.entries.map((e,i) => [i, e])),
            extensions: {},
        };
        downloadBlob(new Blob([JSON.stringify(stLb, null, 2)], { type:'application/json' }), `${name}_lorebook.json`);
        setStatus('✅ 로어북 다운로드 완료!', 'success');
    }

    async function downloadBoth() { await downloadPng(); downloadLorebook(); }

    // ──────────────────────────────────────────────
    // 초기화
    // ──────────────────────────────────────────────
    function init() {
        // CSS
        const style = document.createElement('style');
        style.textContent = PANEL_CSS;
        document.head.appendChild(style);

        // 패널을 Extensions Settings에 추가
        const wrapper = document.createElement('div');
        wrapper.className = 'inline-drawer';
        wrapper.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🧹 JanitorAI Full Importer</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">${PANEL_HTML}</div>`;

        const target = document.getElementById('extensions_settings2')
                    || document.getElementById('extensions_settings')
                    || document.querySelector('.extension_settings');
        if (target) target.appendChild(wrapper);
        else document.addEventListener('DOMContentLoaded', () => {
            (document.getElementById('extensions_settings2')
             || document.getElementById('extensions_settings'))?.appendChild(wrapper);
        });

        // 이벤트
        document.addEventListener('click', e => {
            if (e.target.id === 'janitor-fetch-btn') {
                const v = document.getElementById('janitor-url-input')?.value?.trim();
                if (v) fetchCharacter(v);
            }
            if (e.target.id === 'janitor-dl-png')      downloadPng();
            if (e.target.id === 'janitor-dl-lorebook') downloadLorebook();
            if (e.target.id === 'janitor-dl-both')     downloadBoth();
        });
        document.addEventListener('keydown', e => {
            if (e.target.id === 'janitor-url-input' && e.key === 'Enter') {
                const v = e.target.value.trim();
                if (v) fetchCharacter(v);
            }
        });

        console.log('[🧹 JanitorFullImporter] 로드 완료');
    }

    // jQuery 있으면 $(init), 없으면 DOMContentLoaded
    if (typeof jQuery !== 'undefined') jQuery(init);
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
