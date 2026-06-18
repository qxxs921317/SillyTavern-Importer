/**
 * JanitorAI Full Importer - Backend (server.js)
 * ST 서버 측에서 JanitorAI API를 프록시합니다.
 * Cloudflare 차단 시를 대비한 헤더 설정 포함.
 */

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * @param {import('express').Router} router
 */
module.exports = function (router) {
    /**
     * GET /api/plugins/janitor-full-importer/character/:id
     * JanitorAI 캐릭터 데이터를 가져와서 반환합니다.
     */
    router.get('/character/:id', async (req, res) => {
        const characterId = req.params.id;

        // UUID 형식 검증
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(characterId)) {
            return res.status(400).json({ error: '유효하지 않은 캐릭터 ID입니다.' });
        }

        const apiUrl = `https://janitorai.com/hampter/characters/${characterId}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Referer': `https://janitorai.com/characters/${characterId}`,
                    'Origin': 'https://janitorai.com',
                    'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                },
                timeout: 15000,
            });

            if (response.status === 403) {
                return res.status(403).json({
                    error: 'Cloudflare 차단됨',
                    message: 'JanitorAI가 서버 요청을 차단했습니다. 브라우저 직접 요청 모드를 사용하세요.',
                    cloudflare: true,
                });
            }

            if (!response.ok) {
                return res.status(response.status).json({
                    error: `JanitorAI API 오류: ${response.status} ${response.statusText}`,
                });
            }

            const data = await response.json();
            return res.json(data);
        } catch (error) {
            console.error('[JanitorFullImporter] fetch 오류:', error.message);
            return res.status(500).json({
                error: '서버 오류',
                message: error.message,
                cloudflare: error.message.includes('403') || error.message.includes('cloudflare'),
            });
        }
    });

    /**
     * GET /api/plugins/janitor-full-importer/avatar
     * 아바타 이미지를 바이너리로 가져옵니다 (CORS 우회용)
     */
    router.get('/avatar', async (req, res) => {
        const imageUrl = req.query.url;

        if (!imageUrl || !imageUrl.startsWith('http')) {
            return res.status(400).json({ error: '유효하지 않은 이미지 URL입니다.' });
        }

        try {
            const response = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://janitorai.com/',
                },
                timeout: 10000,
            });

            if (!response.ok) {
                return res.status(response.status).json({ error: `이미지 fetch 실패: ${response.status}` });
            }

            const contentType = response.headers.get('content-type') || 'image/png';
            const buffer = await response.buffer();

            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'max-age=3600');
            return res.send(buffer);
        } catch (error) {
            console.error('[JanitorFullImporter] 아바타 fetch 오류:', error.message);
            return res.status(500).json({ error: error.message });
        }
    });
};
