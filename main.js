        // Темы
        function applyTheme(themeName) {
    document.body.className = ''; // Сначала очищаем все классы тем
    document.body.style.backgroundImage = ''; // Сбрасываем фон

    if (themeName !== 'dark') {
        document.body.classList.add(`${themeName}-theme`);
        // Для темы light-blue меняем название класса, чтобы старые стили сработали
        if(themeName === 'light-blue') {
            document.body.classList.remove('light-blue-theme');
            document.body.classList.add('light-theme');
        }
    }
    localStorage.setItem('theme', themeName);
    const themeSelect = document.getElementById('theme-select');
    if(themeSelect) themeSelect.value = themeName;
        // Зажигаем первый огонёк гирлянды при применении темы
    if (themeName === 'new-year') {
        const activeButton = document.querySelector('.tab-button.active');
        if (activeButton && !activeButton.hasAttribute('data-color')) {
            const colors = ['red', 'blue', 'green', 'yellow'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            activeButton.setAttribute('data-color', randomColor);
        }
    } else {
         // Убираем цвета, если тема не новогодняя
         document.querySelectorAll('.tab-button').forEach(b => b.removeAttribute('data-color'));
    }
}

async function setGradientBackground(imageUrl) {
    const theme = localStorage.getItem('theme') || 'dark';
    if (theme !== 'gradient') return;

    if (imageUrl) {
        document.body.style.backgroundImage = `
            linear-gradient(rgba(26, 26, 29, 0.85), rgba(26, 26, 29, 0.95)), 
            url(${imageUrl})
        `;
    } else {
        document.body.style.backgroundImage = '';
    }
}
    // --- НАСТРОЙКИ ---
    const MYSQL_API_URL = 'api.php'; 
    const SECRET_PASSWORD = 'kuvalda';
    
    document.addEventListener('DOMContentLoaded', () => {
        const TMDB_API_KEY = 'd9241e4bce979feca67dc2cebc3278d9';
        const KINOPOISK_BASE_URL = 'https://kinopoiskapiunofficial.tech/api';
        const DEEPSEEK_API_URL = 'https://api.artemox.com/v1/chat/completions';
        const DEEPSEEK_API_KEY = 'sk-KgS4VDXVHHpyLS9pCgHp3A';
        const MY_CLOUDFLARE_WORKER_URL = 'https://maxkat.accentualz2.workers.dev/?url=';
        const API_PROXY = MY_CLOUDFLARE_WORKER_URL;
        const CORS_PROXY_URL = MY_CLOUDFLARE_WORKER_URL; 
        const ANIME_FILLER_API_URL = 'https://anime-filler.xsun.io/api/info?id=';
        const IMAGE_PROXY = 'https://wsrv.nl/?url=';
        const IMAGE_BASE_URL_W500 = 'image.tmdb.org/t/p/w500';
        const IMAGE_BASE_URL_ORIGINAL = 'image.tmdb.org/t/p/original';
        const COMMENT_WORD_LIMIT=10;const ITEMS_PER_PAGE=20;const ANIMATION_GENRE_ID=16;
        const quotes = ["Элементарно, мой дорогой Ватсон.", "May the Force be with you.", "I'll be back.", "Houston, we have a problem.", "Show me the money!", "You can't handle the truth!", "Кофе? — Только если он черный, как ночь безлунная.", "Why so serious?", "В чем сила, брат? — В деньгах вся сила, брат!", "With great power comes great responsibility.", "It's a trap!", "Winter is coming.", "Я требую продолжения банкета!"];
        
        let initialSubtitle = "";
        const movieGrid=document.getElementById('movie-grid');
        const ratedMoviesList=document.getElementById('rated-movies-list');
        const plansList=document.getElementById('plans-list');
        let moviesDataCache={},ratings={},plans={}, hiddenCountries = [], disableAnime = false, animeFillerCache = {}, randomizerSettings = {};
        let page=1,totalPages=1,isLoadingMore=false,isSearchMode=false;
        let currentFilteredRatings=[],currentFilteredPlans=[],ratedMoviesPage=1,plansPage=1;
        let ratingSortDirection='desc';
        let episodeTitleDebounce, aiSearchHistory = [], randomMoviesHistory = [], lastAiQuery = '', searchDebounceTimeout;
        let openModalCount = 0;
        let isModalOpening = false;
        let aiSearchCooldownEnd = 0, similarSearchCooldownEnd = 0, episodeAiSearchCooldownEnd = 0;
        let lastScrollY = 0;
        let currentCurrency = localStorage.getItem('userCurrency') || 'USD';
        let exchangeRate = null;
        let currentFilmography = [];

        // --- ЛОГИКА РАБОТЫ С MYSQL API ---
        const parseJsonFields = (dataObject) => {
            for (const id in dataObject) {
                try {
                    if (dataObject[id].movieData && typeof dataObject[id].movieData === 'string') dataObject[id].movieData = JSON.parse(dataObject[id].movieData);
                    if (dataObject[id].katya && typeof dataObject[id].katya === 'string') dataObject[id].katya = JSON.parse(dataObject[id].katya);
                    if (dataObject[id].maxim && typeof dataObject[id].maxim === 'string') dataObject[id].maxim = JSON.parse(dataObject[id].maxim);
                } catch (e) {
                    console.error(`Failed to parse JSON for ID ${id}:`, e);
                    delete dataObject[id];
                }
            }
            return dataObject;
        };

        async function loadInitialData() {
            try {
                const response = await fetch(`${MYSQL_API_URL}?action=get_all_data`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API Error ${response.status}: ${errorText}`);
                }
                const data = await response.json();
                if (data.error) throw new Error(data.error);

                ratings = parseJsonFields(data.ratings || {});
                plans = parseJsonFields(data.plans || {});
                kpApiKeysManager.keys = data.kp_api_keys || [];
                hiddenCountries = data.settings?.hidden_countries || [];
                disableAnime = data.settings?.disable_anime || false;

            } catch (e) {
                console.error("Ошибка загрузки данных с сервера:", e);
                showMessage("Не удалось загрузить данные с сервера. Проверьте консоль (F12).", "Ошибка");
            }
        }
        
        async function postToApi(action, body, isFormData = false) {
            const headers = {};
            let finalBody = body;

            if (!isFormData) {
                headers['Content-Type'] = 'application/json';
                finalBody = JSON.stringify({ ...body, password: SECRET_PASSWORD });
            } else {
                finalBody.append('password', SECRET_PASSWORD);
            }

            const response = await fetch(`${MYSQL_API_URL}?action=${action}`, {
                method: 'POST',
                headers: headers,
                body: finalBody
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({error: 'Unknown API error'}));
                throw new Error(error.error || 'API request failed');
            }
            return response.json();
        }

        const kpApiKeysManager = {
            keys: [],
            getKey() {
                const availableKeys = this.keys.filter(k => !k.disabledUntil || k.disabledUntil < Date.now()).sort((a, b) => a.count - b.count);
                if (availableKeys.length === 0) return null;
                const keyData = availableKeys[0];
                postToApi('update_kp_key', { keyId: keyData.id, updateData: { count: 1 } }).catch(console.error);
                return keyData;
            },
            async disableKey(keyString) {
                const keyData = this.keys.find(k => k.key === keyString);
                if (keyData) {
                    const disabledUntil = Date.now() + 24 * 60 * 60 * 1000;
                    keyData.disabledUntil = disabledUntil;
                    await postToApi('update_kp_key', { keyId: keyData.id, updateData: { disabledUntil }});
                    console.warn(`Kinopoisk API key ${keyString.substring(0, 8)}... disabled for 24 hours.`);
                }
            },
            async addKey(keyString) {
                if (!keyString || this.keys.some(k => k.key === keyString)) return false;
                const result = await postToApi('add_kp_key', { key: keyString });
                this.keys.push({ id: result.id, key: keyString, count: 0, disabledUntil: 0 });
                return true;
            },
            async deleteKey(keyId) {
                await postToApi('delete_kp_key', { keyId });
                this.keys = this.keys.filter(k => k.id != keyId);
            }
        };
        
        // --- ЛОГИКА ОБНОВЛЕНИЯ ВЕРСИИ ---
        async function updateApp(newVersion) {
            await showMessage('Доступна новая версия приложения. Сайт будет перезагружен для обновления.', 'Обновление');
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                }
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
                
                localStorage.setItem('app_version', newVersion);
                location.reload();
            } catch (error) {
                console.error('Failed to update app:', error);
                localStorage.setItem('app_version', newVersion);
                location.reload();
            }
        }

        async function checkVersion() {
            try {
                const response = await fetch(`version.txt?t=${Date.now()}`);
                if (!response.ok) return;
                const serverVersion = (await response.text()).trim();
                const localVersion = localStorage.getItem('app_version');

                if (serverVersion && localVersion && serverVersion !== localVersion) {
                    await updateApp(serverVersion);
                } else if (!localVersion) {
                    localStorage.setItem('app_version', serverVersion);
                }
            } catch (error) {
                console.warn('Version check failed:', error);
            }
        }
        
        async function fetchExchangeRate() {
            if (exchangeRate) return;
            try {
                const response = await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/rub.json');
                const data = await response.json();
                exchangeRate = data.rub;
            } catch (e) {
                console.error("Failed to fetch exchange rate:", e);
                exchangeRate = 90; // Fallback
            }
        }
        
        async function init(){
    // ЗАМЕНЕНО: Используем localStorage для тем, чтобы они сохранялись между сессиями
    const savedTheme = localStorage.getItem('theme') || 'dark'; 
    applyTheme(savedTheme);

    initialSubtitle = quotes[Math.floor(Math.random() * quotes.length)]; document.getElementById('subtitle-text').textContent = initialSubtitle; const mainPasswordPrompt=document.getElementById('password-prompt');if(localStorage.getItem('isVerified')==='true'){startApp();}else{mainPasswordPrompt.classList.add('visible');document.getElementById('password-form').addEventListener('submit',e=>{e.preventDefault();const input=document.getElementById('password-input');if(input.value.trim().toLowerCase()==='kuvalda'){localStorage.setItem('isVerified','true');mainPasswordPrompt.classList.remove('visible');startApp();}else{input.value='';input.style.border='1px solid var(--danger-color)';setTimeout(()=>input.style.border='1px solid #475569',1000);}});}}
        async function startApp(){
            await Promise.all([loadInitialData(), fetchExchangeRate(), populateGenreFilter('#filmography-genre')]);
            loadInitialContent();
            setupEventListeners();
            if(localStorage.getItem('isVerified')==='true'){
                document.getElementById('admin-tab-btn').style.display='flex';
            }
            checkVersion();
            setInterval(checkVersion, 5 * 60 * 1000);
        }
        
        const openModal = (modalEl) => {
            if (modalEl.classList.contains('visible')) return;
            
            if (openModalCount === 0) {
                const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
                document.body.style.paddingRight = `${scrollbarWidth}px`;
                document.body.classList.add('modal-open');
            }
            
            modalEl.classList.add('visible');
            openModalCount++;
        };

        const closeModal = (modalEl) => {
    if (modalEl && modalEl.id === 'movie-details-modal') setGradientBackground(null); // <--- ДОБАВЛЕНО
    if (!modalEl || !modalEl.classList.contains('visible')) return;
            
            modalEl.classList.remove('visible');
            openModalCount--;

            if (openModalCount <= 0) {
                document.body.classList.remove('modal-open');
                document.body.style.paddingRight = '';
            }
            
            if (openModalCount < 0) openModalCount = 0;
        };
        
        const showConfirmation = (message, title = 'Подтверждение') => {
            return new Promise(resolve => {
                const modal = document.getElementById('confirm-modal');
                modal.querySelector('#confirm-title').textContent = title;
                modal.querySelector('#confirm-message').textContent = message;
                
                const yesBtn = modal.querySelector('#confirm-yes');
                const noBtn = modal.querySelector('#confirm-no');
                const closeBtn = modal.querySelector('.modal-close');

                const cleanup = () => {
                    yesBtn.replaceWith(yesBtn.cloneNode(true));
                    noBtn.replaceWith(noBtn.cloneNode(true));
                    if(closeBtn) closeBtn.replaceWith(closeBtn.cloneNode(true));
                    closeModal(modal);
                };

                const onYes = () => { cleanup(); resolve(true); };
                const onNo = () => { cleanup(); resolve(false); };
                
                modal.querySelector('#confirm-yes').addEventListener('click', onYes, { once: true });
                modal.querySelector('#confirm-no').addEventListener('click', onNo, { once: true });
                if(closeBtn) closeBtn.addEventListener('click', onNo, { once: true });
                modal.addEventListener('click', (e) => { if (e.target === modal) onNo(); }, { once: true });

                openModal(modal);
            });
        };

        const showMessage = (message, title = 'Уведомление') => {
            return new Promise(resolve => {
                const modal = document.getElementById('message-modal');
                modal.querySelector('#message-title').textContent = title;
                modal.querySelector('#message-text').textContent = message;
                const okBtn = modal.querySelector('#message-ok');
                
                const onOk = () => {
                    okBtn.removeEventListener('click', onOk);
                    closeModal(modal);
                    resolve(true);
                };
                
                okBtn.addEventListener('click', onOk, { once: true });
                openModal(modal);
            });
        };
        
        async function fetchViaProxy(url, options = {}) {
            const fullUrl = `${API_PROXY}${encodeURIComponent(url)}`;
            try {
                const response = await fetch(fullUrl, options);
                if (!response.ok) throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
                return await response.json();
            } catch (e) {
                console.error(`Fetch failed with proxy:`, e);
                throw e; 
            }
        }
        
        function buildTmdbUrl(path, params = {}) { const baseUrl = `https://api.themoviedb.org/3${path}`; const url = new URL(baseUrl); url.searchParams.append('api_key', TMDB_API_KEY); const finalParams = { language: 'ru-RU', ...params }; for (const key in finalParams) { url.searchParams.set(key, finalParams[key]); } return url.toString(); }
        async function fetchProxiedApi(url, options = {}){ try { return await fetchViaProxy(url, options); } catch(e) { return null; }}
        async function fetchKinopoiskApi(url) {
            const keyData = kpApiKeysManager.getKey();
            if (!keyData) { console.error("All Kinopoisk API keys are currently unavailable."); return null; }
            try {
                const response = await fetch(url, { headers: { 'X-API-KEY': keyData.key } });
                if (response.status === 402) { await kpApiKeysManager.disableKey(keyData.key); return fetchKinopoiskApi(url); }
                if (response.ok) return await response.json();
                if (response.status === 404) return null;
            } catch (error) { console.warn(`KP API request failed with key ${keyData.key.substring(0,4)}...:`, error); }
            return null;
        }

        const getScoreColor=score=>{if(score===null||score<=0)return'var(--text-muted)';const hue=(score/10)*120;return`hsl(${hue},70%,45%)`;};
        const formatScore=score=>(score%1===0)?score:score.toFixed(1);
        function getProxiedImageUrl(path, original = false){if(!path)return 'https://i.imgur.com/k2oTj0b.png'; const baseUrl = original ? IMAGE_BASE_URL_ORIGINAL : IMAGE_BASE_URL_W500; return`${IMAGE_PROXY}${baseUrl}${path}`;}
        function formatVoteCount(count) { if (count === undefined || count === null) return ''; if (count < 1000) return count.toString(); if (count < 1000000) return Math.floor(count / 1000) + 'K'; return Math.floor(count / 1000000) + 'M'; }
        
        const isoToFlag = isoCode => { try { return String.fromCodePoint(...isoCode.toUpperCase().split('').map(char => 0x1F1E6 + char.charCodeAt(0) - 'A'.charCodeAt(0))); } catch(e) { return ''; }};
        const getCountryFlags = countries => { if (!countries || countries.length === 0) return 'н/д'; return countries.map(c => c.iso_3166_1 ? isoToFlag(c.iso_3166_1) : '').join(' '); };
        
        function formatMovieRuntime(totalMinutes) {
            if (!totalMinutes || totalMinutes <= 0) return 'н/д';
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            let result = '';
            if (hours > 0) {
                result += `${hours} ч `;
            }
            if (minutes > 0) {
                result += `${minutes} мин`;
            }
            return result.trim();
        }

        async function getSeriesEpisodeRuntime(tvData) {
            if (tvData.episode_run_time && tvData.episode_run_time.length > 0) {
                const avgRuntime = Math.round(tvData.episode_run_time.reduce((a, b) => a + b, 0) / tvData.episode_run_time.length);
                if (avgRuntime > 0) return avgRuntime;
            }
            if (tvData.seasons && tvData.seasons.length > 0) {
                const firstSeason = tvData.seasons.find(s => s.season_number > 0);
                if (firstSeason) {
                    try {
                        const seasonDetails = await fetchProxiedApi(buildTmdbUrl(`/tv/${tvData.id}/season/${firstSeason.season_number}`));
                        if (seasonDetails && seasonDetails.episodes && seasonDetails.episodes.length > 0) {
                            const runtimes = seasonDetails.episodes.map(ep => ep.runtime).filter(rt => rt && rt > 0);
                            if (runtimes.length > 0) {
                                const avgRuntime = Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length);
                                return avgRuntime > 0 ? avgRuntime : null;
                            }
                        }
                    } catch (e) {
                        console.error(`Fallback failed to get runtime for season ${firstSeason.season_number}`, e);
                        return null;
                    }
                }
            }
            return null;
        }

        const formatCurrency = (amount) => {
            const suffix = currentCurrency === 'RUB' ? '₽' : '$';
            if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace('.0', '')} млрд ${suffix}`;
            if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')} млн ${suffix}`;
            return `${amount.toLocaleString('ru-RU')} ${suffix}`;
        };

        function getBoxOfficeInnerHtml(budget, revenue) {
            const isRub = currentCurrency === 'RUB';
            const finalBudget = isRub ? budget * exchangeRate : budget;
            const finalRevenue = isRub ? revenue * exchangeRate : revenue;
            
            const ratio = revenue / budget;
            let statusColor;

            if (ratio < 1) { // Провал
                statusColor = 'var(--danger-color)';
            } else if (ratio < 2) { // Окупился
                statusColor = '#f97316'; // Orange
            } else { // Успех
                statusColor = '#22c55e'; // Green
            }

            return `<span class="status-indicator" style="background-color: ${statusColor};"></span>
                    <span class="box-office-numbers">
                        ${formatCurrency(finalRevenue)}<span class="separator">|</span>${formatCurrency(finalBudget)}
                    </span>`;
        }

        const createBoxOfficeHTML = (budget, revenue) => {
            if (!budget || !revenue || budget <= 1000 || revenue <= 1000) return '';
            
            const innerHtml = getBoxOfficeInnerHtml(budget, revenue);
            
            return `<span class="label">Сборы:</span>
                    <div class="value box-office-line clickable" data-budget="${budget}" data-revenue="${revenue}">
                        ${innerHtml}
                    </div>`;
        };

        async function getKinopoiskId(filmId) {
            const filmData = moviesDataCache[filmId];
            if (!filmData) return null;
            if (filmData.kinopoiskId) return filmData.kinopoiskId;
        
            const [mediaType, tmdbId] = filmId.split('-');
            let kinopoiskId = null;
        
            try {
                const externalIdsData = await fetchProxiedApi(buildTmdbUrl(`/${mediaType}/${tmdbId}/external_ids`));
                const imdbId = externalIdsData?.imdb_id;
                if (imdbId) {
                    const kpSearchData = await fetchKinopoiskApi(`${KINOPOISK_BASE_URL}/v2.2/films?imdbId=${imdbId}`);
                    kinopoiskId = kpSearchData?.items?.[0]?.kinopoiskId;
                }
            } catch (e) {
                console.warn(`KP search by IMDb ID failed for ${tmdbId}:`, e);
            }
        
            if (!kinopoiskId) {
                try {
                    const title = filmData.name || filmData.title;
                    const year = (filmData.release_date || filmData.first_air_date)?.substring(0, 4);
                    if (title) {
                        const searchUrl = `${KINOPOISK_BASE_URL}/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(title)}`;
                        const kpSearchByTitle = await fetchKinopoiskApi(searchUrl);
        
                        if (kpSearchByTitle?.films && kpSearchByTitle.films.length > 0) {
                            let bestMatch = null;
                            if (year) {
                                bestMatch = kpSearchByTitle.films.find(item => item.year == year);
                            }
                            kinopoiskId = bestMatch?.filmId || kpSearchByTitle.films[0]?.filmId;
                        }
                    }
                } catch(e) {
                    console.warn(`KP search by title failed for "${filmData.title || filmData.name}":`, e);
                }
            }
            
            if (kinopoiskId) {
                moviesDataCache[filmId].kinopoiskId = kinopoiskId;
                return kinopoiskId;
            }
        
            return null;
        }
        const isValidTitle = (title) => title && title.trim() && !/^(episode|эпизод) \d+$/i.test(title.trim());
        async function fetchEpisodeTitle(filmId, seasonNumber, episodeNumber) { const [type, id] = filmId.split('-'); const tmdbEpisodeData = await fetchProxiedApi(buildTmdbUrl(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`)); if (tmdbEpisodeData && isValidTitle(tmdbEpisodeData.name)) { return tmdbEpisodeData.name; } const kinopoiskId = await getKinopoiskId(filmId); if (kinopoiskId) { const kpSeasonsData = await fetchKinopoiskApi(`${KINOPOISK_BASE_URL}/v2.2/films/${kinopoiskId}/seasons`); const kpSeason = kpSeasonsData?.items?.find(s => s.number == seasonNumber); const kpEpisode = kpSeason?.episodes?.find(ep => ep.episodeNumber == episodeNumber); const title = kpEpisode?.nameRu || kpEpisode?.nameEn; if (isValidTitle(title)) return title; } return null; }
        
        async function updateCardWithKpRating(item, cardElement) {
            if (cardElement.dataset.kpChecked) return;
            cardElement.dataset.kpChecked = "true";
            const ratingElement = cardElement.querySelector('.movie-card__rating');
            if (!ratingElement || ratingElement.classList.contains('future-release-icon')) return;
            const filmId = `${item.media_type}-${item.id}`;
            const kpRatingCacheKey = `kp_rating_v1_${filmId}`;
            const cachedRating = sessionStorage.getItem(kpRatingCacheKey);
            if(cachedRating) {
                ratingElement.innerHTML = cachedRating;
                return;
            }
            const kinopoiskId = await getKinopoiskId(filmId);
            if (!kinopoiskId) return;
            try {
                const kpData = await fetchKinopoiskApi(`${KINOPOISK_BASE_URL}/v2.2/films/${kinopoiskId}`);
                if (kpData && typeof kpData.ratingKinopoisk === 'number' && kpData.ratingKinopoisk > 0) {
                    const html = `<div style="display: flex; align-items: center; gap: 0.25rem;"><span class="vote-count">(${formatVoteCount(kpData.ratingKinopoiskVoteCount)})</span><span style="color: #ff8c00;">★ ${kpData.ratingKinopoisk.toFixed(1)}</span></div>`;
                    ratingElement.innerHTML = html;
                    sessionStorage.setItem(kpRatingCacheKey, html);
                }
            } catch (e) {
                console.error(`Failed to get KP rating for ${item.title || item.name}:`, e);
            }
        }

        async function updateCardWithPostCreditScene(item, cardElement) { const filmId = `${item.media_type}-${item.id}`; const fullData = await getFullMovieData(filmId); if (fullData && fullData.postCreditsScene) { const marker = document.createElement('div'); marker.className = 'movie-card__post-credits-scene'; marker.innerHTML = '👁️‍🗨️'; cardElement.querySelector('.movie-card__image-container').appendChild(marker); } }
        
        async function updateCardOnGrid(filmId) { const cardInGrid = document.querySelector(`.movie-card[data-id="${filmId}"]`); if (cardInGrid) { await getFullMovieData(filmId); cardInGrid.innerHTML = createMovieCardHTML(moviesDataCache[filmId]); } }
        
        function createMovieCardHTML(i) {
            const mediaType = i.media_type;
            const fId = `${mediaType}-${i.id}`;
            const title = i.title || i.name;
            const releaseDateStr = i.release_date || i.first_air_date;
            const r = ratings[fId];
            const p = plans[fId];
            let rh = '', specialMarkerHTML = '', pcsHTML = '', addToPlanButtonHTML = '';
        
            if (!r) {
                const inPlanClass = p ? 'in-plan' : '';
                addToPlanButtonHTML = `<button class="add-to-plan-btn ${inPlanClass}" title="Добавить в планы">+</button>`;
            }
        
            if (r) {
                let p_scores = [];
                if (r.katya?.score > 0) p_scores.push(`<span class="rating-entry">К:<span class="score-badge-small" style="background-color:${getScoreColor(r.katya.score)}">${formatScore(r.katya.score)}</span></span>`);
                if (r.maxim?.score > 0) p_scores.push(`<span class="rating-entry">М:<span class="score-badge-small" style="background-color:${getScoreColor(r.maxim.score)}">${formatScore(r.maxim.score)}</span></span>`);
                if (p_scores.length > 0) rh = `<div class="movie-card__our-rating">${p_scores.join('<br>')}</div>`;
                
                const specialIcons = { heart: '❤️', poop: '💩', cross: '❌', rewatch: '🔄' };
                const katyaSpecials = (r.katya?.special || '').split(',').filter(s => s && specialIcons[s]);
                const maximSpecials = (r.maxim?.special || '').split(',').filter(s => s && specialIcons[s]);
                const allUniqueSpecials = [...new Set([...katyaSpecials, ...maximSpecials])];
                
                if (allUniqueSpecials.length > 0) {
                     specialMarkerHTML = `<div class="movie-card__special-marker">${allUniqueSpecials.map(s => `<span>${specialIcons[s]}</span>`).join('')}</div>`;
                }
            }
        
            const fullData = moviesDataCache[fId];
            if (fullData && fullData.postCreditsScene) {
                pcsHTML = `<div class="movie-card__post-credits-scene">👁️‍🗨️</div>`;
            }
        
            const poster = getProxiedImageUrl(i.poster_path);
            const isSearchTabAll = document.getElementById('search-view').classList.contains('active') && document.getElementById('type-filter-search').value === 'multi';
            let typeIconHTML = '';
            if (isSearchTabAll) {
                const isAnimated = (i.genre_ids || []).includes(ANIMATION_GENRE_ID);
                if (i.media_type === 'movie') typeIconHTML = isAnimated ? '<span title="Мультфильм">🎨</span>' : '<span title="Фильм">🎞️</span>';
                else if (i.media_type === 'tv') typeIconHTML = isAnimated ? '<span title="Мультсериал">🖌️</span>' : '<span title="Сериал">📺</span>';
            }
            const titleHTML = `<span class="movie-card__title-text">${title}</span>${typeIconHTML}`;
            
            let ratingAndVotesHTML;
            const releaseDateObj = releaseDateStr ? new Date(releaseDateStr) : null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const isFutureRelease = releaseDateObj && releaseDateObj > today;
            const isUnconfirmedRelease = !releaseDateStr && !(i.overview && i.overview.trim() !== '') && !(i.genre_ids && i.genre_ids.length > 0);

            if (isFutureRelease || isUnconfirmedRelease) {
                ratingAndVotesHTML = `<span class="movie-card__rating future-release-icon">⏳</span>`;
            } else {
                const kpRatingCacheKey = `kp_rating_v1_${fId}`;
                const cachedRating = sessionStorage.getItem(kpRatingCacheKey);
                ratingAndVotesHTML = cachedRating ? cachedRating : `<span class="movie-card__rating"><span class="vote-count">(${formatVoteCount(i.vote_count)})</span><span>★ ${i.vote_average.toFixed(1)}</span></span>`;
            }

            return `<div class="movie-card__image-container">
                        <img src="${poster}" alt="${title}" class="movie-card__poster" loading="lazy">
                        ${addToPlanButtonHTML}
                        ${rh}
                        ${specialMarkerHTML}
                        ${pcsHTML}
                    </div>
                    <div class="movie-card__info">
                        <div><h3 class="movie-card__title">${titleHTML}</h3></div>
                        <div class="movie-card__details">
                            <span>${releaseDateStr ? releaseDateStr.substring(0, 4) : 'н/д'}</span>
                            ${ratingAndVotesHTML}
                        </div>
                    </div>`;
        }
        
        function displayMovies(d, clearGrid = true, container = movieGrid) {
            if (clearGrid) container.innerHTML = '';
            
            const moviesToFilter = (d.results || []).filter(m => {
                if (!m) return false;
                const hasPoster = !!m.poster_path;
                const hasOverview = m.overview && m.overview.trim() !== '';
                const hasDate = !!(m.release_date || m.first_air_date);
                const hasGenres = m.genre_ids && m.genre_ids.length > 0;
                const isRussianShort = m.overview && m.overview.toLowerCase().includes('russian short');
                return (hasPoster || hasOverview || hasDate || hasGenres) && !isRussianShort;
            });

            const moviesToDisplay = moviesToFilter.filter(m => {
                if (!m.origin_country || m.origin_country.length === 0) return true;
        
                const isJapanese = m.origin_country.includes('JP');
                const isAnimeSeries = m.media_type === 'tv' && m.genre_ids?.includes(ANIMATION_GENRE_ID);
        
                if (disableAnime && isJapanese && isAnimeSeries) {
                    return false;
                }
        
                for (const country of m.origin_country) {
                    if (hiddenCountries.includes(country)) {
                        if (country === 'JP') {
                            if (isAnimeSeries) {
                                continue; 
                            } else {
                                return false; 
                            }
                        } else {
                            return false;
                        }
                    }
                }
                
                return true;
            });

            const query = document.getElementById('search-input').value.trim();
            if (moviesToDisplay.length === 0 && clearGrid) {
                if (isFilmographyMode()) {
                     container.innerHTML = `<p class="loading-indicator">Для этого актера нет работ, соответствующих фильтрам.</p>`;
                } else if (isSearchMode && query) {
                    container.innerHTML = `<div class="no-results-message"><p>Ничего не найдено по запросу «<span class="query-text">${query}</span>».</p><p>Попробуйте другие ключевые слова или найдите в Google.</p><a href="https://www.google.com/search?q=${encodeURIComponent(query)}" target="_blank" class="google-search-link"><span>🔍</span> Искать в Google</a></div>`;
                } else {
                    container.innerHTML = `<p class="loading-indicator">Тут пустовато...</p>`;
                }
                return;
            }

            moviesToDisplay.forEach(i => {
                if (!i || (!i.title && !i.name) || !i.media_type || !['movie', 'tv'].includes(i.media_type)) return;
                const fId = `${i.media_type}-${i.id}`;
                if (document.querySelector(`.movie-card[data-id="${fId}"]`)) {
                    return;
                }
                moviesDataCache[fId] = { ...moviesDataCache[fId], ...i };
                const c = document.createElement('div');
                c.className = 'movie-card';
                c.dataset.id = fId;
                c.innerHTML = createMovieCardHTML(i);
                container.appendChild(c);
                updateCardWithKpRating(i, c);
                updateCardWithPostCreditScene(i, c);
            });
        }
        async function getFullMovieData(filmId) { if (moviesDataCache[filmId]?.credits) return moviesDataCache[filmId]; let [type, id] = filmId.split('-'); const url = buildTmdbUrl(`/${type}/${id}`, { append_to_response: 'keywords,external_ids,images,credits', include_image_language: 'ru,null' }); const data = await fetchProxiedApi(url); if (!data) return null; let hasPostCreditsScene = false; const keywordsList = data.keywords?.keywords || data.keywords?.results; if (keywordsList) { hasPostCreditsScene = keywordsList.some(kw => [179431, 203445].includes(kw.id)); } const fullData = { ...moviesDataCache[filmId], ...data, media_type: type, postCreditsScene: hasPostCreditsScene }; moviesDataCache[filmId] = fullData; const cardElement = document.querySelector(`.movie-card[data-id="${filmId}"]`); if (cardElement) { updateCardWithKpRating(fullData, cardElement); } await getKinopoiskId(filmId); return fullData; }
        
        async function createCastHTML(credits, kpData) {
            if (!credits || !credits.cast || credits.cast.length === 0) return '';
        
            const cast = credits.cast.slice(0, 15);
            const castItems = cast.map(actor => {
                const kpActor = kpData?.persons?.find(p => p.nameRu === actor.name || p.nameEn === actor.name);
                const character = kpActor?.description || actor.character || 'н/д';
        
                return `
                <div class="actor-item" data-person-id="${actor.id}" data-person-name="${actor.name}">
                    <img src="${getProxiedImageUrl(actor.profile_path)}" alt="${actor.name}" class="actor-photo" loading="lazy">
                    <div class="actor-info">
                        <span class="actor-name">${actor.name}</span>
                        <span class="actor-character">${character}</span>
                    </div>
                </div>`;
            }).join('');
        
            return `
                <div class="cast-container">
                    <div class="cast-toggle">
                        <span>Актерский состав</span>
                        <span class="arrow">▼</span>
                    </div>
                    <div class="cast-list">
                        ${castItems}
                    </div>
                </div>`;
        }
        
        async function showMovieDetails(filmId, fromRatings = false){
    setGradientBackground(null); // <--- ДОБАВЛЕНО
    if (isModalOpening) return;
    isModalOpening = true;

            const modal = document.getElementById('movie-details-modal');
            const loader = modal.querySelector('.modal-loader');
            const modalBody = document.getElementById('modal-body');
            const ratingForm = document.getElementById('rating-form');
            const modalContent = modal.querySelector('.modal-content');

            modalContent.scrollTop = 0;
            modalBody.innerHTML = '';
            ratingForm.style.display = 'none';
            loader.classList.remove('hidden');
            openModal(modal);

            try {
                const data = await getFullMovieData(filmId);
                if (!data) throw new Error("Failed to fetch movie data.");
                
                const kinopoiskId = await getKinopoiskId(filmId);
                let kpData = null;
                if (kinopoiskId) {
                    kpData = await fetchKinopoiskApi(`${KINOPOISK_BASE_URL}/v2.2/films/${kinopoiskId}`);
                }

                if (plans[filmId] && !plans[filmId].movieData.genres) {
                    const planUpdate = { ...plans[filmId], movieData: data };
                    await postToApi('save_plan', { filmId, planData: planUpdate });
                }
                
                const { production_countries, genres, overview, credits } = data;
                const countryFlags = getCountryFlags(production_countries);
                const genreStr = (genres && genres.length > 0) ? genres.map(i=>i.name).join(', '):'Н/Д';
                const desc = overview || 'Описание отсутствует.';
                const title = data.title||data.name;
                const releaseDateStr = data.release_date||data.first_air_date;
                const posterUrl = getProxiedImageUrl(data.poster_path)
                setGradientBackground(getProxiedImageUrl(data.backdrop_path || data.poster_path, true)); // <--- ДОБАВЛЕНО;
                const descriptionHTML = (desc.length > 200) ? `<p class="modal-description" data-full-text="${encodeURIComponent(desc)}">${desc.substring(0,200)}...<span class="show-more-btn">показать полностью &rarr;</span></p>` : `<p class="modal-description">${desc}</p>`;
                
                const isAnimated = (data.genres || []).some(g => g.id === ANIMATION_GENRE_ID);
                const isRated = !!ratings[filmId];
                const isPlanned = !!plans[filmId];
                
                const similarLink = `<span class="similar-link" title="Найти похожее (ИИ)" data-film-id="${filmId}" data-film-name="${title}" data-is-animated="${isAnimated}">👀</span>`;
                const planLink = `<span class="plan-link" title="Добавить в планы" data-id="${filmId}">+</span>`;

                let titleActionsHTML = '';
                if (isRated || isPlanned) {
                    titleActionsHTML = similarLink;
                } else {
                    titleActionsHTML = planLink + similarLink;
                }

                const collectionAction = data.belongs_to_collection ? `<span class="collection-link" title="Показать всю коллекцию" data-collection-id="${data.belongs_to_collection.id}" data-collection-name="${data.belongs_to_collection.name}">📎</span>` : '';
                const episodesAction = data.media_type === 'tv' ? `<span class="episodes-link" title="Список серий" data-film-id="${filmId}">🗂️</span>` : '';
                const framesAction = `<span class="frames-link" title="Кадры">🖼️</span>`;
                const googleAction = `<a href="https://www.google.com/search?q=${encodeURIComponent(title + ' ' + (releaseDateStr||'').substring(0,4))}" target="_blank" class="google-link" title="Искать в Google">🌐</a>`;
                
                let secondaryActionsHTML = `<div class="modal-secondary-actions">${collectionAction}${episodesAction}${framesAction}${googleAction}</div>`;
                
                const boxOfficeHTML = createBoxOfficeHTML(data.budget, data.revenue);
                const castHTML = await createCastHTML(credits, kpData);
                
                let durationHTML = '';
                if (data.media_type === 'movie' && data.runtime > 0) {
                    durationHTML = `<span class="label">Идёт:</span><span class="value">${formatMovieRuntime(data.runtime)}</span>`;
                } else if (data.media_type === 'tv') {
                    const avgRuntime = await getSeriesEpisodeRuntime(data);
                    if (avgRuntime) {
                       durationHTML = `<span class="label">Серия:</span><span class="value">≈ ${avgRuntime} мин</span>`;
                    }
                }

                modalBody.innerHTML = `<img src="${posterUrl}" alt="Постер" class="modal-poster-large">
                    <div class="modal-info-wrapper">
                        <div class="modal-title-row">
                            <div class="title-main-block">
                               <h2 data-id="${filmId}">${title}</h2>
                               <p>${data.original_title||data.original_name||''}</p>
                            </div>
                            <div class="title-actions">${titleActionsHTML}</div>
                        </div>
                        ${secondaryActionsHTML}
                        <div class="info-grid">
                            <span class="label">Год:</span><span class="value">${releaseDateStr?releaseDateStr.substring(0,4):'н/д'}</span>
                            <span class="label">Страна:</span><span class="value country-flags">${countryFlags}</span>
                            <span class="label">Жанр:</span><span class="value">${genreStr}</span>
                            ${durationHTML}
                            ${boxOfficeHTML}
                        </div>
                        ${descriptionHTML}
                        ${castHTML}
                    </div>`;

                
                const showMoreBtn=modalBody.querySelector('.show-more-btn');
                if(showMoreBtn) showMoreBtn.addEventListener('click', e => e.target.parentElement.innerHTML = decodeURIComponent(e.target.parentElement.dataset.fullText));
                
                ratingForm.dataset.filmId = filmId;
                const personSwitcher = ratingForm.querySelector('.person-switcher');
                const submitBtn = ratingForm.querySelector('.form-submit-btn');
                const carouselContainer = ratingForm.querySelector('.rating-carousel-container');

                const releaseDateObj = releaseDateStr ? new Date(releaseDateStr) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isFutureRelease = releaseDateObj && releaseDateObj > today;
                const isUnconfirmedRelease = !releaseDateStr && !(overview && overview.trim() !== '') && !(genres && genres.length > 0);
                
                personSwitcher.style.display = 'flex';
                carouselContainer.style.display = '';
                ratingForm.classList.remove('person-selected');
                personSwitcher.querySelector('.active')?.classList.remove('active');
                
                if (isFutureRelease || isUnconfirmedRelease) {
                    personSwitcher.style.display = 'none';
                    carouselContainer.style.display = 'none';
                    submitBtn.textContent = isUnconfirmedRelease ? 'Нет данных о выходе' : 'Фильм еще не вышел';
                    submitBtn.disabled = true;
                } else {
                    submitBtn.textContent = 'Выберите, кто ставит оценку';
                    submitBtn.disabled = true;

                    const existingRating = ratings[filmId];
                    const hasKatyaRating = existingRating?.katya && (existingRating.katya.score > 0 || existingRating.katya.comment || existingRating.katya.special);
                    const hasMaximRating = existingRating?.maxim && (existingRating.maxim.score > 0 || existingRating.maxim.comment || existingRating.maxim.special);

                    ['katya','maxim'].forEach(p=>{
                        const slide=document.querySelector(`.rating-slide[data-person="${p}"]`);
                        setupScore(p,existingRating?.[p]?.score);
                        setupSpecialRating(p,existingRating?.[p]?.special||'');
                        slide.querySelector('.comment-input').value=existingRating?.[p]?.comment||'';
                    });

                    const carouselSlider=document.querySelector('.rating-carousel-slider');
                    carouselSlider.style.transition='none';
                    carouselSlider.style.transform='translateX(0)';
                    setTimeout(() => carouselSlider.style.transition='',50);

                    if (hasKatyaRating && !hasMaximRating) {
                       personSwitcher.querySelector('.person-btn.katya').click();
                    } else if (!hasKatyaRating && hasMaximRating) {
                       personSwitcher.querySelector('.person-btn.maxim').click();
                    } else if (fromRatings && hasKatyaRating) {
                        personSwitcher.querySelector('.person-btn.katya').click();
                    } else if (fromRatings && hasMaximRating) {
                        personSwitcher.querySelector('.person-btn.maxim').click();
                    }
                }
                
                loader.classList.add('hidden');
                ratingForm.style.display = 'block';

            } catch(e) {
                console.error("Error showing movie details:", e);
                closeModal(modal);
            } finally {
                isModalOpening = false;
            }
        }
        
        const processCommentText = (text) => {
            if (!text) return '';
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">(ссылка)</a>');
        };

        const createCommentHTML = (comment, className) => {
            if (!comment) return '';
            const processedFullComment = processCommentText(comment);
            const words = comment.split(' ');

            if (words.length > COMMENT_WORD_LIMIT) {
                const shortText = words.slice(0, COMMENT_WORD_LIMIT).join(' ');
                const processedShortComment = processCommentText(shortText);
                return `<div class="${className} comment-clickable" data-state="short" data-short="${encodeURIComponent(processedShortComment)}" data-full="${encodeURIComponent(processedFullComment)}">${processedShortComment}...</div>`;
            }
            return `<div class="${className}">${processedFullComment}</div>`;
        };
        

        const getDateTimestamp = (dateValue) => {
            if (!dateValue) return 0;
            if (typeof dateValue.toDate === 'function') { return dateValue.toDate().getTime(); }
            if (typeof dateValue === 'string') { return new Date(dateValue.replace(' ', 'T') + 'Z').getTime(); }
            if (dateValue instanceof Date) { return dateValue.getTime(); }
            return 0;
        };

        function displayRatedMovies(isNewFilter=true){if(isNewFilter)ratedMoviesPage=1;const filters={sort:document.getElementById('sort-filter-ratings').value,author:document.getElementById('author-filter-ratings').value,stars:document.getElementById('stars-filter-ratings').value,type:document.getElementById('type-filter-ratings').value,genre:document.querySelector('#type-filter-ratings option:checked').dataset.genre,excludeGenre:document.querySelector('#type-filter-ratings option:checked').dataset.excludeGenre,starsEl:document.getElementById('stars-filter-ratings'),searchQuery:document.getElementById('ratings-search-input').value.trim().toLowerCase()};if(isNewFilter){let items=Object.entries(ratings);currentFilteredRatings=items.filter(([id,d])=>{if(!d.movieData||(!d.movieData.title&&!d.movieData.name))return false;const{movieData}=d;if(filters.type!=='all'){if(movieData.media_type!==filters.type)return false;const isAnimated=movieData.genre_ids?movieData.genre_ids.includes(ANIMATION_GENRE_ID):false;if(filters.genre&&!isAnimated)return false;if(filters.excludeGenre&&isAnimated)return false}const byAuthor=!filters.author||filters.author==='all'||(d.katya&&filters.author==='katya'&&(d.katya.score||d.katya.special||d.katya.comment))||(d.maxim&&filters.author==='maxim'&&(d.maxim.score||d.maxim.special||d.maxim.comment));if(!byAuthor)return false;let byStars=true;if(filters.stars&&filters.stars!=='all'){if(['heart','poop','cross','rewatch'].includes(filters.stars)){byStars=(d.katya?.special||'').includes(filters.stars)||(d.maxim?.special||'').includes(filters.stars)}else if(filters.stars.startsWith('rating_')){const min=parseFloat(filters.starsEl.options[filters.starsEl.selectedIndex].dataset.min);const max=parseFloat(filters.starsEl.options[filters.starsEl.selectedIndex].dataset.max);byStars=(d.katya?.score>=min&&d.katya?.score<=max)||(d.maxim?.score>=min&&d.maxim?.score<=max)}}if(!byStars)return false;if(filters.searchQuery){const title=(movieData.title||movieData.name||'').toLowerCase();const originalTitle=(movieData.original_title||movieData.original_name||'').toLowerCase();if(!title.includes(filters.searchQuery)&&!originalTitle.includes(filters.searchQuery))return false}return true});if(filters.sort==='rating'){const getSumScore=item=>{let total=0;['katya','maxim'].forEach(p=>{if(!item[1][p])return;if((item[1][p].special||'').includes('heart'))total+=11;if((item[1][p].special||'').includes('poop'))total-=1;if((item[1][p].special||'').includes('cross'))total-=2;if(item[1][p].score>0)total+=item[1][p].score});return total};currentFilteredRatings.sort((a,b)=>ratingSortDirection==='desc'?getSumScore(b)-getSumScore(a):getSumScore(a)-getSumScore(b))}else{currentFilteredRatings.sort((a,b)=>filters.sort==='newest'?getDateTimestamp(b[1].ratedAt)-getDateTimestamp(a[1].ratedAt):getDateTimestamp(a[1].ratedAt)-getDateTimestamp(b[1].ratedAt))}}renderPaginatedList(ratedMoviesList,currentFilteredRatings,ratedMoviesPage,([filmId,d])=>{const m=d.movieData;if(!m)return;const poster=getProxiedImageUrl(m.poster_path);const specialIcons={heart:'❤️',poop:'💩',cross:'❌',rewatch:'🔄'};const getRatingHTML=p=>{if(!d[p])return'';const score=d[p].score;const scoreBadge=score>0?`<span class="score-badge" style="background-color:${getScoreColor(score)}">${formatScore(score)}</span>`:'';const specialHtml=(d[p].special||'').split(',').filter(s=>s&&specialIcons[s]).map(s=>`<span class="special-rating-icon">${specialIcons[s]}</span>`).join('');return scoreBadge+specialHtml};const kRating=getRatingHTML('katya'),mRating=getRatingHTML('maxim');const isKatyaRated = d.katya && (d.katya.score > 0 || d.katya.comment || d.katya.special); const isMaximRated = d.maxim && (d.maxim.score > 0 || d.maxim.comment || d.maxim.special); const kH= isKatyaRated ?`<div class="rating-block rating-block--katya"><div class="person-rating"><div class="person-rating__header"><span class="rating-block__person">😺 Катя:</span>${kRating}</div>${createCommentHTML(d.katya.comment,'rating-block__comment')}</div></div>`:'';const mH= isMaximRated ?`<div class="rating-block rating-block--maxim"><div class="person-rating"><div class="person-rating__header"><span class="rating-block__person">👾 Максим:</span>${mRating}</div>${createCommentHTML(d.maxim.comment,'rating-block__comment')}</div></div>`:'';const ratedAtDate = d.ratedAt ? new Date(getDateTimestamp(d.ratedAt)) : null; const ratedAtStr = ratedAtDate ? ratedAtDate.toLocaleDateString('ru-RU') : ''; const i=document.createElement('div');i.className='rated-movie-item';i.dataset.id=filmId;i.innerHTML=`<div class="details-click-area"><div class="list-item__image-container"><img src="${poster}" alt="Постер" class="list-item__poster"></div><div class="rated-movie__details"><h3>${m.title||m.name||'Фильм'} (${(m.release_date||m.first_air_date)?(m.release_date||m.first_air_date).substring(0,4):'н/д'})</h3>${kH}${mH}<div class="rated-item-footer">Оценено: ${ratedAtStr}</div></div></div><button class="delete-btn" title="Удалить оценку">&times;</button>`;ratedMoviesList.appendChild(i)},isNewFilter)}
        function displayPlans(isNewFilter=true){if(isNewFilter)plansPage=1;const filters={sort:document.getElementById('sort-filter-plans').value,author:document.getElementById('author-filter-plans').value,priority:document.getElementById('priority-filter-plans').value,type:document.getElementById('type-filter-plans').value,genre:document.querySelector('#type-filter-plans option:checked').dataset.genre,excludeGenre:document.querySelector('#type-filter-plans option:checked').dataset.excludeGenre,searchQuery:document.getElementById('plans-search-input').value.trim().toLowerCase()};if(isNewFilter){let items=Object.entries(plans);currentFilteredPlans=items.filter(([id,d])=>{if(!d.movieData||(!d.movieData.title&&!d.movieData.name))return false;const{movieData}=d;if(filters.type!=='all'){if(movieData.media_type!==filters.type)return false;const isAnimated=movieData.genre_ids?movieData.genre_ids.includes(ANIMATION_GENRE_ID):false;if(filters.genre&&!isAnimated)return false;if(filters.excludeGenre&&isAnimated)return false}const byAuthor=!filters.author||filters.author==='all'||d.proposedBy===filters.author;if(!byAuthor)return false;const byPriority=!filters.priority||filters.priority==='all'||d.priority==filters.priority;if(!byPriority)return false;if(filters.searchQuery){const title=(movieData.title||movieData.name||'').toLowerCase();const originalTitle=(movieData.original_title||movieData.original_name||'').toLowerCase();if(!title.includes(filters.searchQuery)&&!originalTitle.includes(filters.searchQuery))return false}return true});if(filters.sort==='priority'){currentFilteredPlans.sort((a,b)=>(b[1].priority||0)-(a[1].priority||0)||(getDateTimestamp(b[1].proposedAt))-(getDateTimestamp(a[1].proposedAt)))}else{currentFilteredPlans.sort((a,b)=>filters.sort==='newest'?(getDateTimestamp(b[1].proposedAt))-(getDateTimestamp(a[1].proposedAt)):(getDateTimestamp(a[1].proposedAt))-(getDateTimestamp(b[1].proposedAt)))}}renderPaginatedList(plansList,currentFilteredPlans,plansPage,([filmId,d])=>{const m=d.movieData;if(!m)return;const poster=getProxiedImageUrl(m.poster_path);const progressHtml=(d.progress_percentage>0)?`<div class="progress-bar-wrapper"><div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${d.progress_percentage}%;"></div></div><span class="progress-percentage">${d.progress_percentage}%</span></div>`:'';let progressInfoText= '';let progressInfoAttrs= `class="progress-info" data-id="${filmId}"`;if(m.media_type==='tv'){const hasEpisodeTitle = d.episode_title && d.episode_title.trim() !== '';const baseText=(d.season&&d.episode)?`С.${d.season} Э.${d.episode}`:'';if(hasEpisodeTitle){const titleWords=d.episode_title.split(' ');const fullText=`${baseText} — ${d.episode_title}`;if(titleWords.length>2&&baseText){const truncatedText=`${baseText} — ${titleWords.slice(0,2).join(' ')}...`;progressInfoText=truncatedText;progressInfoAttrs+=` data-state="truncated" data-full="${encodeURIComponent(fullText)}" data-truncated="${encodeURIComponent(truncatedText)}"`}else{progressInfoText=fullText}}else if(baseText){progressInfoText=baseText; progressInfoAttrs=`class="progress-info no-title" data-id="${filmId}"`;}}const pA=d.proposedAt?new Date(getDateTimestamp(d.proposedAt)).toLocaleDateString('ru-RU'):'';const cHtml=createCommentHTML(d.comment,'plan-block__comment'),pI=d.proposedBy==='katya'?'😺':'👾',pN=d.proposedBy==='katya'?'Катей':'Максимом',medalIcons={1:'🥉',2:'🥈',3:'🥇'},priorityIcon=d.priority>0?`<span class="priority-medal">${medalIcons[d.priority]}</span>`:'',pH=`<div class="plan-block plan-block--${d.proposedBy}"><div class="person-rating"><div class="person-rating__header">${pI} Предложено ${pN} ${priorityIcon}</div>${cHtml}</div></div><div class="plan-item-footer">${progressHtml}<div class="plan-footer__bottom-line">${progressInfoText?`<span ${progressInfoAttrs}>${progressInfoText}</span>`:'<span>&nbsp;</span>'}<span class="date-and-edit"><span>${pA}</span>${m.media_type==='tv'?`<span class="edit-progress-btn" data-id="${filmId}" title="Изменить прогресс">✏️</span>`:''}</span></div></div>`;const i=document.createElement('div');i.className='planned-movie-item';i.dataset.id=filmId; const pcsHTML = moviesDataCache[filmId]?.postCreditsScene ? `<div class="movie-card__post-credits-scene">👁️‍🗨️</div>` : ''; i.innerHTML=`<div class="details-click-area"><div class="list-item__image-container"><img src="${poster}" alt="Постер" class="list-item__poster">${pcsHTML}</div><div class="planned-movie__details"><h3>${m.title||m.name||'Фильм'} (${(m.release_date||m.first_air_date)?(m.release_date||m.first_air_date).substring(0,4):'н/д'})</h3>${pH}</div></div><button class="delete-btn" title="Удалить из планов">&times;</button>`;plansList.appendChild(i); updatePlanItemWithPostCreditScene(filmId, i);},isNewFilter)}
        
        async function updatePlanItemWithPostCreditScene(filmId, itemElement) {
            const fullData = await getFullMovieData(filmId);
            if (fullData && fullData.postCreditsScene) {
                const container = itemElement.querySelector('.list-item__image-container');
                if (container && !container.querySelector('.movie-card__post-credits-scene')) {
                     container.insertAdjacentHTML('beforeend', '<div class="movie-card__post-credits-scene">👁️‍🗨️</div>');
                }
            }
        }

        async function fetchAndProcessContent(isLoadMore = false) {
            if (isFilmographyMode()) {
                displayFilteredFilmography();
                return;
            }

            const selectedOption = document.getElementById('type-filter-search').selectedOptions[0];
            const type = selectedOption.value;
            const genre = selectedOption.dataset.genre;
            const excludeGenre = selectedOption.dataset.excludeGenre;
            const query = document.getElementById('search-input').value.trim();
        
            if (!isLoadMore) {
                document.getElementById('subtitle-text').textContent = initialSubtitle;
                movieGrid.innerHTML = `<p class="loading-indicator">Загрузка...</p>`;
                page = 1;
                totalPages = 1;
                isLoadingMore = false;
                isSearchMode = !!query;
                aiSearchHistory = [];
                exitFilmographyMode(); 
            } else {
                if (isLoadingMore || page >= totalPages) return;
                isLoadingMore = true;
                movieGrid.insertAdjacentHTML('beforeend', '<p class="loading-indicator">Загрузка...</p>');
            }
        
            let path, params = { page: page };
            if (!isSearchMode) {
                params['vote_count.gte'] = 50;
            }
            const searchType = type === 'multi' ? 'multi' : type;
        
            if (isSearchMode) {
                path = `/search/${searchType}`;
                params.query = query;
            } else {
                if (genre || excludeGenre) {
                    const discoverType = type === 'multi' ? 'movie' : type;
                    path = `/discover/${discoverType}`;
                    params.sort_by = 'popularity.desc';
                    if (genre) params.with_genres = genre;
                    if (excludeGenre) params.without_genres = excludeGenre;
                } else {
                    const trendingType = type === 'multi' ? 'all' : type;
                    path = `/trending/${trendingType}/week`;
                }
            }
        
            const url = buildTmdbUrl(path, params);
            const data = await fetchProxiedApi(url);
        
            if (isLoadMore) {
                const indicator = movieGrid.querySelector('.loading-indicator');
                if (indicator) indicator.remove();
            }
        
            if (data && data.results) {
                 if (isSearchMode) {
                    data.results.sort((a, b) => b.vote_count - a.vote_count);
                }
                
                if (['movie', 'tv'].includes(searchType) && type !== 'multi') {
                    data.results.forEach(item => { item.media_type = searchType; });
                }
        
                let finalResults = data.results;
        
                if (type !== 'multi') {
                    const isAnimatedFilter = !!genre;
                    const isNotAnimatedFilter = !!excludeGenre;
        
                    finalResults = finalResults.filter(item => {
                        if (item.media_type !== type) return false;
                        const isItemAnimated = item.genre_ids && item.genre_ids.includes(ANIMATION_GENRE_ID);
                        if (isAnimatedFilter && !isItemAnimated) return false;
                        if (isNotAnimatedFilter && isItemAnimated) return false;
                        return true;
                    });
                }
        
                totalPages = data.total_pages;
                displayMovies({ results: finalResults }, !isLoadMore);
                page++;
            } else if (!isLoadMore) {
                displayMovies({ results: [] }, true);
            }
            isLoadingMore = false;
        }

        const loadInitialContent = () => fetchAndProcessContent(false);
        const loadMoreContent = () => fetchAndProcessContent(true);
        function renderPaginatedList(listElement,items,page,renderItemFn,isNewFilter){if(isNewFilter)listElement.innerHTML='';const start=(page-1)*ITEMS_PER_PAGE,end=start+ITEMS_PER_PAGE;const pageItems=items.slice(start,end);if(items.length===0&&page===1){listElement.innerHTML=`<p class="loading-indicator">Тут пустовато...</p>`;return}pageItems.forEach(item=>renderItemFn(item))}
        
        async function setupProgressUI(form, filmId) {
            const filmData = await getFullMovieData(filmId);
            const seasonSelect = form.querySelector('select[id$="season-select"]');
            const episodeInput = form.querySelector('input[id$="episode"]');
            const seasonInfo = form.querySelector('.season-info');
            const episodeTitleDisplay = form.querySelector('.episode-title-display');

            seasonSelect.disabled = true; episodeInput.disabled = true;

            if (!filmData || filmData.media_type !== 'tv') {
                seasonInfo.textContent = "Не сериал";
                return;
            }

            seasonInfo.textContent = "Загрузка сезонов...";
            const tmdbTvDetails = await fetchProxiedApi(buildTmdbUrl(`/tv/${filmData.id}`));
            const seasonsData = tmdbTvDetails?.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0);

            if (!seasonsData || seasonsData.length === 0) {
                seasonInfo.textContent = "Сезоны не найдены";
                return;
            }
            
            seasonSelect.innerHTML = '';
            seasonsData.forEach(season => {
                const option = document.createElement('option');
                option.value = season.season_number;
                option.textContent = season.name || `Сезон ${season.season_number}`;
                option.dataset.episodeCount = season.episode_count;
                seasonSelect.appendChild(option);
            });

            seasonInfo.textContent = "";
            seasonSelect.disabled = false;
            episodeInput.disabled = false;

            const updateEpisodeTitle = () => {
                clearTimeout(episodeTitleDebounce);
                episodeTitleDisplay.classList.remove('visible');
                episodeTitleDebounce = setTimeout(async () => {
                    const season = seasonSelect.value;
                    const episode = episodeInput.value;
                    if (season && episode > 0) {
                        episodeTitleDisplay.textContent = 'Загрузка названия...';
                        episodeTitleDisplay.classList.add('visible');
                        const title = await fetchEpisodeTitle(filmId, season, episode);
                        episodeTitleDisplay.textContent = title || '';
                        if (!title) episodeTitleDisplay.classList.remove('visible');
                    }
                }, 300);
            };

            const handleEpisodeInputChange = (e) => {
                const input = e.target;
                const max = parseInt(input.max, 10);
                if (!isNaN(max) && max > 0) {
                    let value = parseInt(input.value, 10);
                    if (!isNaN(value)) {
                        if (value < 1) input.value = 1;
                        else if (value > max) input.value = max;
                    }
                }
                updateEpisodeTitle();
            };
            
            const handleSeasonChange = () => {
                const selectedOption = seasonSelect.options[seasonSelect.selectedIndex];
                if (selectedOption) {
                    const episodeCount = selectedOption.dataset.episodeCount;
                    episodeInput.max = episodeCount;
                    seasonInfo.textContent = `/ ${episodeCount}`;
                }
                handleEpisodeInputChange({ target: episodeInput });
            };
            
            seasonSelect.addEventListener('change', handleSeasonChange);
            episodeInput.addEventListener('input', handleEpisodeInputChange);

            const existingPlan = plans[filmId];
            if (existingPlan?.season && seasonSelect.querySelector(`[value="${existingPlan.season}"]`)) {
                seasonSelect.value = existingPlan.season;
            } else {
                if (seasonSelect.options.length > 0) seasonSelect.selectedIndex = 0;
            }
            episodeInput.value = existingPlan?.episode || 1;
            
            handleSeasonChange();
        }

        async function openAddToPlanModal(filmId, isEdit = false, fromGrid = false) {
            const modal = document.getElementById('add-to-plan-modal');
            const form = document.getElementById('add-to-plan-form');
            const titleEl = modal.querySelector('.add-to-plan-title');
            const submitBtn = form.querySelector('.form-submit-btn');

            form.reset();
            const progressTracker = form.querySelector('#plan-progress-tracker');
            progressTracker.classList.remove('visible');
            progressTracker.querySelector('#plan-season-select').innerHTML = '';
            progressTracker.querySelector('#plan-episode').value = '';
            progressTracker.querySelector('.season-info').textContent = '';
            progressTracker.querySelector('.episode-title-display').classList.remove('visible');
            delete form.dataset.seasonsDataLoaded;

            setupMedals(0);

            if (isEdit) {
                const plan = plans[filmId];
                if (!plan) return;
                titleEl.textContent = 'Редактировать план';
                submitBtn.textContent = 'Сохранить изменения';
                form.dataset.mode = 'edit';
                form.querySelector('#proposer-select').value = plan.proposedBy;
                form.querySelector('#plan-comment').value = plan.comment || '';
                setupMedals(plan.priority || 0);
            } else {
                const filmData = await getFullMovieData(filmId);
                if(!filmData) { showMessage("Не удалось получить данные о фильме.", "Ошибка"); return; }
                const title = filmData.title||filmData.name||'Название не найдено';
                const year=(filmData.release_date||filmData.first_air_date||'').substring(0,4);
                titleEl.textContent = `${title} ${year?`(${year})`:''}`.trim();
                submitBtn.textContent = 'Добавить';
                form.dataset.mode = 'add';
            }

            form.dataset.filmId = filmId;
            form.dataset.fromGrid = fromGrid; 

            const filmData = await getFullMovieData(filmId);
            const progressGroup=document.getElementById('plan-progress-group');
            const isSeries=filmData.media_type==='tv';
            progressGroup.style.display = isSeries && !isEdit ? 'block' : 'none'; 
            
            openModal(modal);
        }

        async function openProgressModal(filmId) {
            if (isModalOpening) return;
            isModalOpening = true;
        
            const modal = document.getElementById('progress-modal');
            const form = document.getElementById('progress-form');

            form.reset();
            form.querySelector('#progress-season-select').innerHTML = '';
            form.querySelector('.season-info').textContent = '';
            form.querySelector('.episode-title-display').classList.remove('visible');
        
            const formLoader = document.getElementById('progress-form-loader');
            const formContent = document.getElementById('progress-form-content');

            try {
                const plan = plans[filmId];
                if (!plan) throw new Error("План не найден");
                
                modal.querySelector('.modal-content').scrollTop = 0;
                
                formLoader.style.display = 'block';
                formContent.style.visibility = 'hidden';
                
                openModal(modal);

                modal.querySelector('.progress-title').textContent = `Прогресс: ${plan.movieData.title || plan.movieData.name}`;
                form.dataset.filmId = filmId;

                await setupProgressUI(form, filmId);
                
                formLoader.style.display = 'none';
                formContent.style.visibility = 'visible';
            } catch (error) {
                console.error("Ошибка при открытии окна прогресса:", error);
                closeModal(modal);
            } finally {
                isModalOpening = false;
            }
        }
        
        async function calculateProgressAndTitle(form, filmData){const trackProgress=form.id==='progress-form'||form.querySelector('#plan-progress-toggle').checked;if(!trackProgress||!filmData||filmData.media_type!=='tv')return{season:null,episode:null,progress_percentage:0,episode_title:null};const seasonSelect=form.querySelector('select[id$="season-select"]');const episodeInput=form.querySelector('input[id$="episode"]');const filmId=form.dataset.filmId;const selectedSeason=parseInt(seasonSelect.value,10);const currentEpisode=parseInt(episodeInput.value,10);if(isNaN(selectedSeason)||isNaN(currentEpisode)||currentEpisode<=0)return{season:null,episode:null,progress_percentage:0,episode_title:null};const episodeTitle=await fetchEpisodeTitle(filmId,selectedSeason,currentEpisode);const url=buildTmdbUrl(`/tv/${filmData.id}`);const tvDetails=await fetchProxiedApi(url);if(!tvDetails)return{season:selectedSeason,episode:currentEpisode,progress_percentage:0,episode_title:episodeTitle};let watchedEpisodes=0;const totalSeriesEpisodes=tvDetails.number_of_episodes||0;const seasonsData=tvDetails.seasons?.filter(s=>s.season_number>0)||[];seasonsData.forEach(season=>{if(season.season_number<selectedSeason){watchedEpisodes+=season.episode_count}});watchedEpisodes+=currentEpisode;const percentage=totalSeriesEpisodes>0?(watchedEpisodes/totalSeriesEpisodes)*100:0;return{season:selectedSeason,episode:currentEpisode,progress_percentage:Math.min(100,parseFloat(percentage.toFixed(1))),episode_title:episodeTitle};}
        function setupScore(person,score){const slide=document.querySelector(`.rating-slide[data-person="${person}"]`);if(!slide)return;const display=slide.querySelector('.score-display'),slider=slide.querySelector('.score-slider');const finalScore=score===null||score===undefined?0:score;display.textContent=finalScore===0?'без оценки':formatScore(finalScore);display.classList.toggle('no-rating',finalScore===0);slider.value=finalScore;display.style.color=getScoreColor(score);}
        function setupSpecialRating(person,specialValue){const container=document.querySelector(`.rating-slide[data-person="${person}"] .special-rating-input`);if(!container)return;const specialValues=specialValue?specialValue.split(','):[];container.dataset.special=specialValue;container.querySelectorAll('.special-icon').forEach(icon=>icon.classList.toggle('selected',specialValues.includes(icon.dataset.value)))}
        function setupMedals(priority){const container=document.querySelector('.medals-input');if(!container)return;container.dataset.priority=priority;container.querySelectorAll('.medal').forEach(medal=>medal.classList.toggle('selected',medal.dataset.value==priority));}
        function toggleButtonLoading(button,isLoading,originalText='Сохранить',loadingText='Сохранение...'){if(!button)return;if(isLoading){button.disabled=true;button.textContent=loadingText;}else{button.disabled=false;button.textContent=originalText;}}
        
        function manageCooldown(button, duration, originalContent) {
            if (!button) return;
            button.disabled = true;
            let remaining = Math.ceil(duration / 1000);
            button.innerHTML = originalContent === '✨' ? '🤔' : remaining;
            
            const updateButton = () => {
                button.textContent = remaining;
            };
            if (originalContent !== '✨') updateButton();

            const interval = setInterval(() => {
                remaining--;
                if (remaining > 0) {
                     if (originalContent !== '✨') updateButton();
                } else {
                    clearInterval(interval);
                    button.disabled = false;
                    button.innerHTML = originalContent;
                }
            }, 1000);
        }

        async function performAiSearch() {
            if (Date.now() < aiSearchCooldownEnd) return;
            
            const currentQuery = document.getElementById('search-input').value.trim();
            if (!currentQuery) return;
        
            if (currentQuery.toLowerCase() !== lastAiQuery.toLowerCase()) {
                aiSearchHistory = [];
            }
            lastAiQuery = currentQuery;
        
            const aiSearchButton = document.getElementById('ai-search-button');
            const searchButton = document.getElementById('search-button');
        
            searchButton.disabled = true;
            aiSearchCooldownEnd = Date.now() + 20000;
            manageCooldown(aiSearchButton, 20000, '✨');
            
            movieGrid.innerHTML = `<p class="loading-indicator">ИИ подбирает контент...</p>`;
            isSearchMode = true;
        
            const filterSelect = document.getElementById('type-filter-search');
            const selectedOption = filterSelect.options[filterSelect.selectedIndex];
            const type = selectedOption.value, genre = selectedOption.dataset.genre, excludeGenre = selectedOption.dataset.excludeGenre;
            let typeContext = 'фильмы или сериалы';
            if (type === 'movie' && genre) { typeContext = 'полнометражные мультфильмы' } 
            else if (type === 'tv' && genre) { typeContext = 'мультсериалы' }
            else if (type === 'movie') { typeContext = 'фильмы' }
            else if (type === 'tv') { typeContext = 'сериалы' }
        
            let systemPrompt = `Ты — эксперт-кинокритик, помогающий подобрать ${typeContext} по запросу. Твоя задача — предоставить список из 5-7 РЕАЛЬНО СУЩЕСТВУЮЩИХ и ПОПУЛЯРНЫХ произведений.\n\nКлючевые правила:\n- **НЕ ВЫДУМЫВАЙ ФИЛЬМЫ.** Все названия должны быть реальными и легко находиться в базах данных типа IMDb или Кинопоиск.\n- **ВЫСОКИЕ ОЦЕНКИ:** Отдавай предпочтение известным фильмам с хорошими оценками критиков и зрителей.\n- **СТРОГИЙ ФОРМАТ:** Ответ должен быть только списком. Каждая строка в формате: "Русское название /// Original Title". Ничего лишнего: без нумерации, маркеров, вступлений или заключений.\n\nПример ответа:\nНачало /// Inception\nИнтерстеллар /// Interstellar\nЗеленая миля /// The Green Mile`;
            if (aiSearchHistory.length > 0) {
                systemPrompt += `\n\nИСКЛЮЧИ ЭТИ ФИЛЬМЫ (уже были предложены): ${aiSearchHistory.join(', ')}.`;
            }
        
            try {
                const response = await fetch(DEEPSEEK_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [ { role: "system", content: systemPrompt }, { role: "user", content: currentQuery } ]
                    })
                });
        
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `Ошибка API: ${response.status}`);
                }
        
                const aiData = await response.json();
                const titlesText = aiData.choices?.[0]?.message?.content;
                if(!titlesText){displayMovies({results:[]},true);return}
                
                const titles = titlesText.split('\n').map(line => {
                    const parts = line.split('///');
                    return parts.length === 2 ? { ru: parts[0].trim(), en: parts[1].trim() } : null;
                }).filter(Boolean);
        
                if(titles.length===0){displayMovies({results:[]},true);return}
                titles.forEach(t=>aiSearchHistory.push(t.ru, t.en));if(aiSearchHistory.length>50)aiSearchHistory.splice(0,aiSearchHistory.length-50);
        
                movieGrid.innerHTML=`<p class="loading-indicator">Ищу найденные фильмы в базе...</p>`;
        
                const searchPromises = titles.map(async (title) => {
                    const searchEn = await fetchProxiedApi(buildTmdbUrl(`/search/multi`,{query:title.en}));
                    if(searchEn?.results?.[0]) return searchEn.results[0];
                    const searchRu = await fetchProxiedApi(buildTmdbUrl(`/search/multi`,{query:title.ru}));
                    return searchRu?.results?.[0] || null;
                });
                
                let allMovies = (await Promise.all(searchPromises)).filter(Boolean);
        
                const isAnimatedFilter = !!genre, isNotAnimatedFilter = !!excludeGenre;
                
                const filteredMovies = allMovies.filter(item => {
                    if (type !== 'multi' && item.media_type !== type) return false;
                    const isItemAnimated = item.genre_ids?.includes(ANIMATION_GENRE_ID);
                    if (isAnimatedFilter && !isItemAnimated) return false;
                    if (isNotAnimatedFilter && isItemAnimated) return false;
                    return true;
                });
        
                const uniqueMovies=new Map();
                filteredMovies.forEach(movie=>{const filmId=`${movie.media_type}-${movie.id}`;if(!uniqueMovies.has(filmId))uniqueMovies.set(filmId,movie)});
                displayMovies({results:Array.from(uniqueMovies.values())},true);
        
            }catch(error){
                console.error("Ошибка при поиске через ИИ (Deepseek):",error);
                movieGrid.innerHTML=`<div class="no-results-message" style="grid-column: 1/-1; text-align: center;"><p>Произошла ошибка при ИИ-поиске. Попробуйте снова.<br><small>${error.message}</small></p></div>`
            }finally{
                searchButton.disabled=false;
            }
        }
        
        async function performSimilarAiSearch(filmId, filmName, isAnimated) {
            const [mediaType, id] = filmId.split('-');
            const sourceDescription = `${isAnimated ? 'мультфильм' : 'фильм'}${mediaType === 'tv' ? ' (сериал)' : ''}`;
            const targetDescription = `${mediaType === 'tv' ? (isAnimated ? 'мультсериалы' : 'сериалы') : (isAnimated ? 'мультфильмы' : 'фильмы')}`;
        
            const promptText = `Ты — эксперт-кинокритик, подбирающий похожие произведения.\nИсходное произведение: "${filmName}". Это ${sourceDescription}.\n\nПодбери 5-7 РЕАЛЬНО СУЩЕСТВУЮЩИХ и ПОПУЛЯРНЫХ ${targetDescription}, похожих на исходное по жанру, атмосфере, тематике или стилю. Отдавай предпочтение известным работам с хорошими оценками. НЕ выдумывай названия.\n\nТвой ответ должен быть только в формате списка, где каждая строка: "Русское название /// Original Title". Ничего лишнего: без нумерации, маркеров, вступлений или заключений.`;
            
            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [ { role: "system", content: promptText } ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Ошибка API: ${response.status}`);
            }

            const aiData = await response.json();
            const titlesText = aiData.choices?.[0]?.message?.content;
            if(!titlesText) {
                displayMovies({results:[]}, true);
                return;
            }

            const titles = titlesText.split('\n').map(line => {
                const parts = line.split('///');
                return parts.length === 2 ? { ru: parts[0].trim(), en: parts[1].trim() } : null;
            }).filter(Boolean);

            if(titles.length === 0) {
                displayMovies({results:[]}, true);
                return;
            }

            movieGrid.innerHTML = `<p class="loading-indicator">Ищу найденные фильмы в базе...</p>`;

            const searchPromises = titles.map(async (title) => {
                const searchEn = await fetchProxiedApi(buildTmdbUrl(`/search/multi`, { query: title.en }));
                if (searchEn?.results?.[0]) return searchEn.results[0];
                const searchRu = await fetchProxiedApi(buildTmdbUrl(`/search/multi`, { query: title.ru }));
                return searchRu?.results?.[0] || null;
            });

            let allMovies = (await Promise.all(searchPromises)).filter(Boolean);
            
            const filteredMovies = allMovies.filter(item => item.media_type === mediaType);

            const uniqueMovies = new Map();
            filteredMovies.forEach(movie => {
                const uniqueId = `${movie.media_type}-${movie.id}`;
                if (!uniqueMovies.has(uniqueId)) uniqueMovies.set(uniqueId, movie);
            });

            displayMovies({ results: Array.from(uniqueMovies.values()) }, true);
        }

        async function fetchSearchSuggestions(query) {
            if (query.length < 2) {
                displaySearchSuggestions([]);
                return;
            }
            const url = buildTmdbUrl('/search/multi', { query });
            const data = await fetchProxiedApi(url);
            if (data && data.results) {
                const filteredAndSorted = data.results
                    .filter(item => item.poster_path && (item.title || item.name) && ['movie', 'tv'].includes(item.media_type))
                    .sort((a, b) => {
                        const titleA = (a.title || a.name || '').toLowerCase();
                        const titleB = (b.title || b.name || '').toLowerCase();
                        const queryLower = query.toLowerCase();
                        const aStartsWith = titleA.startsWith(queryLower);
                        const bStartsWith = titleB.startsWith(queryLower);
                        if (aStartsWith && !bStartsWith) return -1;
                        if (!aStartsWith && bStartsWith) return 1;
                        return (b.popularity || 0) - (a.popularity || 0);
                    })
                    .slice(0, 5);

                filteredAndSorted.forEach(item => {
                    const filmId = `${item.media_type}-${item.id}`;
                    if (!moviesDataCache[filmId]) {
                        moviesDataCache[filmId] = item;
                    }
                });

                displaySearchSuggestions(filteredAndSorted);
            }
        }

        function displaySearchSuggestions(suggestions) {
            const container = document.getElementById('search-suggestions');
            if (suggestions.length === 0) {
                container.innerHTML = '';
                container.style.display = 'none';
                return;
            }
            container.style.display = 'block';
            container.innerHTML = suggestions.map(item => {
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').substring(0, 4);
                const filmId = `${item.media_type}-${item.id}`;
                return `
                    <div class="suggestion-item" data-id="${filmId}">
                        <img src="${getProxiedImageUrl(item.poster_path)}" class="suggestion-poster" loading="lazy">
                        <div class="suggestion-details">
                            <span class="suggestion-title">${title}</span>
                            <span class="suggestion-year">${year || ''}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        const isFilmographyMode = () => document.body.classList.contains('filmography-mode');
        
        function setupEventListeners(){
            const scrollToTopBtn=document.getElementById('scroll-to-top');
            
            const handleInfiniteScroll = () => {
                const activeView = document.querySelector('.view.active');
                if (!activeView || isLoadingMore || isFilmographyMode()) return;
            
                if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
                    if (activeView.id === 'search-view') {
                         loadMoreContent();
                    } else if (activeView.id === 'ratings-view') {
                        if ((ratedMoviesPage * ITEMS_PER_PAGE) < currentFilteredRatings.length) {
                            ratedMoviesPage++;
                            displayRatedMovies(false);
                        }
                    } else if (activeView.id === 'plans-view') {
                         if ((plansPage * ITEMS_PER_PAGE) < currentFilteredPlans.length) {
                            plansPage++;
                            displayPlans(true);
                        }
                    }
                }
            };

            window.addEventListener('scroll',()=>{ scrollToTopBtn.classList.toggle('visible',window.scrollY>300); handleInfiniteScroll(); });
            scrollToTopBtn.addEventListener('click',()=>window.scrollTo({top:0, behavior: 'smooth'}));
            
            document.querySelectorAll('.tab-button').forEach(t=>t.addEventListener('click', async e=>{
    const target = e.currentTarget;
    const id = target.dataset.tab;

    if (target.classList.contains('active')) {
        if (id === 'search-view') {
            resetSearchView();
        }
        return;
    }
    
    document.querySelectorAll('.tab-button').forEach(b=> {
        b.classList.remove('active');
        // Убираем старый цвет гирлянды
        b.removeAttribute('data-color');
    });

    // --- ДОБАВЛЕНА ЛОГИКА ГИРЛЯНДЫ ---
    if (document.body.classList.contains('new-year-theme')) {
        const colors = ['red', 'blue', 'green', 'yellow'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        target.setAttribute('data-color', randomColor);
    }
    // --- КОНЕЦ ЛОГИКИ ГИРЛЯНДЫ ---

    target.classList.add('active');
    
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    if (id === 'ratings-view') { await loadInitialData(); displayRatedMovies(true); }
    else if (id === 'plans-view') { await loadInitialData(); displayPlans(true); }
    else if (id === 'admin-view') { await loadInitialData(); displayAdminPanelContent(); }
    else if (id === 'search-view' && isFilmographyMode()) {
        resetSearchView();
    }
}));

            movieGrid.addEventListener('click',e=>{const card=e.target.closest('.movie-card');if(!card)return;if(e.target.closest('.add-to-plan-btn')){e.preventDefault(); openAddToPlanModal(card.dataset.id, false, true)}else{showMovieDetails(card.dataset.id, false)}});
            
            let longPressTimer;
            let isLongPress = false;
            
            const startLongPress = (e) => {
                const planItem = e.target.closest('.planned-movie-item');
                const commentEl = e.target.closest('.plan-block__comment');
                if (!planItem || !commentEl) return;
                
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    if (e.cancelable) e.preventDefault();
                    const filmId = planItem.dataset.id;
                    if (filmId) {
                        openAddToPlanModal(filmId, true);
                    }
                }, 800);
            };

            const cancelLongPress = () => clearTimeout(longPressTimer);
            
            async function handleListClick(e, listType) {
                if (listType === 'planned' && isLongPress) {
                    e.preventDefault();
                    isLongPress = false;
                    return;
                }

                if (e.target.tagName === 'A' && e.target.closest('.rating-block__comment, .plan-block__comment')) {
                    e.stopPropagation();
                    return;
                }
            
                const card = e.target.closest(`.${listType}-movie-item`);
                if (!card) return;
            
                const filmId = card.dataset.id;
                const target = e.target;
                const movieName = card.querySelector('h3')?.textContent || 'фильм';
            
                if (target.closest('.delete-btn')) {
                    if (await showConfirmation(`Удалить ${movieName}?`)) {
                        const deleteBtn = target.closest('.delete-btn');
                        if (deleteBtn) deleteBtn.disabled = true;
            
                        try {
                            if (listType === 'rated') {
                                await postToApi('delete_rating', { filmId });
                                logAdminAction(`🗑️ ${movieName} удален(о) из оценок.`);
                                delete ratings[filmId];
                                displayRatedMovies(true);
                                updateCardOnGrid(filmId);
                            } else {
                                await postToApi('delete_plan', { filmId });
                                logAdminAction(`🗑️ ${movieName} удален(о) из планов.`);
                                delete plans[filmId];
                                displayPlans(true);
                                const planBtnOnSearch = document.querySelector(`.movie-card[data-id="${filmId}"] .add-to-plan-btn`);
                                if (planBtnOnSearch) planBtnOnSearch.classList.remove('in-plan');
                            }
                        } catch (err) {
                            console.error(`Ошибка удаления:`, err);
                            showMessage("Произошла ошибка, попробуйте снова.", "Ошибка");
                        } finally {
                            if (deleteBtn) deleteBtn.disabled = false;
                        }
                    }
                } else if (target.closest('.comment-clickable')) {
                    const c = target.closest('.comment-clickable');
                    const isShort = c.dataset.state === 'short';

                    if (isShort) {
                        c.innerHTML = decodeURIComponent(c.dataset.full);
                        c.dataset.state = 'full';
                    } else {
                        c.innerHTML = `${decodeURIComponent(c.dataset.short)}...`;
                        c.dataset.state = 'short';
                    }
                } else if (target.closest('.edit-progress-btn')) {
                    openProgressModal(target.closest('.edit-progress-btn').dataset.id);
                } else if (target.closest('.progress-info')) {
                    const progressInfo = target.closest('.progress-info');
                    const state = progressInfo.dataset.state;
                    if (state === 'truncated') {
                        progressInfo.textContent = decodeURIComponent(progressInfo.dataset.full);
                        progressInfo.classList.add('expanded-title');
                        progressInfo.dataset.state = 'expanded';
                    } else if (state === 'expanded') {
                        progressInfo.textContent = decodeURIComponent(progressInfo.dataset.truncated);
                        progressInfo.classList.remove('expanded-title');
                        progressInfo.dataset.state = 'truncated';
                    }
                } else {
                    showMovieDetails(filmId, listType === 'rated');
                }
            }
            
            
            ratedMoviesList.addEventListener('click', (e) => handleListClick(e, 'rated'));
            plansList.addEventListener('click', (e) => handleListClick(e, 'planned'));
            plansList.addEventListener('mousedown', startLongPress);
            plansList.addEventListener('mouseup', cancelLongPress);
            plansList.addEventListener('mouseleave', cancelLongPress);
            plansList.addEventListener('touchstart', startLongPress, { passive: false });
            plansList.addEventListener('touchend', cancelLongPress);
            plansList.addEventListener('touchcancel', cancelLongPress);

            function setupClearButton(input) {
                const container = input.closest('.search-input-container, .input-container');
                if (!container) return;
                const clearBtn = container.querySelector('.input-clear-btn');
                
                const updateVisibility = () => {
                    clearBtn.style.display = input.value.length > 0 ? 'block' : 'none';
                };

                input.addEventListener('input', updateVisibility);
                clearBtn.addEventListener('click', () => {
                    input.value = '';
                    updateVisibility();
                    input.focus();
                    if (input.id === 'search-input') { 
                        if (isFilmographyMode()) {
                            displayFilteredFilmography();
                        } else {
                            loadInitialContent(); 
                        }
                        displaySearchSuggestions([]); 
                    }
                    if (input.id === 'ratings-search-input') { displayRatedMovies(true); }
                    if (input.id === 'plans-search-input') { displayPlans(true); }
                });
                updateVisibility();
            }
            document.querySelectorAll('#search-input, .list-search-input, #new-kp-key-input').forEach(setupClearButton);
            
            const searchInput = document.getElementById('search-input');
            const suggestionsContainer = document.getElementById('search-suggestions');

            document.getElementById('search-form').addEventListener('submit', e => {
    e.preventDefault();
    displaySearchSuggestions([]); // <--- Вот эта строка добавлена для сброса подсказок
    if (isFilmographyMode()) {
        displayFilteredFilmography();
    } else {
        loadInitialContent();
    }
});

            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounceTimeout);
                if (isFilmographyMode()) {
                    displaySearchSuggestions([]);
                    return;
                }
                searchDebounceTimeout = setTimeout(() => {
                    fetchSearchSuggestions(searchInput.value.trim());
                }, 300);
            });
            
            suggestionsContainer.addEventListener('click', e => {
                const item = e.target.closest('.suggestion-item');
                if (item) {
                    const filmId = item.dataset.id;
                    if (filmId) {
                        displaySearchSuggestions([]);
                        searchInput.value = '';
                        searchInput.dispatchEvent(new Event('input'));
                        showMovieDetails(filmId);
                    }
                }
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('#search-form') && !e.target.closest('#search-suggestions')) {
                    displaySearchSuggestions([]);
                }
            });

            document.getElementById('ai-search-button').addEventListener('click',() => performAiSearch());
            document.getElementById('type-filter-search').addEventListener('change',()=>loadInitialContent());
            
            document.getElementById('ratings-search-btn').addEventListener('click', () => displayRatedMovies(true));
            document.getElementById('plans-search-btn').addEventListener('click', () => displayPlans(true));
             document.getElementById('ratings-search-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    displayRatedMovies(true);
                }
            });
            document.getElementById('plans-search-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    displayPlans(true);
                }
            });

            
            async function openMediaModal(filmId) {
                const modal=document.getElementById('media-modal');
                const contentEl=document.getElementById('media-content');
                openModal(modal);
                contentEl.innerHTML=`<div class="slider-container"><p class="loading-indicator">Загрузка медиа...</p></div>`;
                const filmData=await getFullMovieData(filmId); if(!filmData){contentEl.innerHTML='Ошибка загрузки данных.';return;}
                const backdrops=filmData.images?.backdrops||[];
                const slides = backdrops.slice(0, 15).map(img => `<div class="media-slide"><img src="${getProxiedImageUrl(img.file_path, true)}" loading="lazy"></div>`);
                if (slides.length === 0) { contentEl.innerHTML = `<h4 style="position:static; transform:none; margin: 1.5rem auto;">Кадры</h4><p style="text-align:center;">Изображения не найдены.</p>`; return; }
                contentEl.innerHTML = `<h4>Кадры</h4><div class="slider-container"><div class="slider" id="media-slider">${slides.join('')}</div></div><div class="slider-nav"><button id="prev-slide" class="slider-nav-btn">‹</button><button id="next-slide" class="slider-nav-btn">›</button></div>`;
                const slider = document.getElementById('media-slider'); const prevBtn = modal.querySelector('#prev-slide'); const nextBtn = modal.querySelector('#next-slide'); let currentSlide = 0;
                const updateNav = () => { prevBtn.disabled = currentSlide === 0; nextBtn.disabled = currentSlide === slides.length - 1; };
                const showSlide = () => { slider.style.transform = `translateX(-${currentSlide * 100}%)`; updateNav(); };
                prevBtn.onclick = () => { if (currentSlide > 0) { currentSlide--; showSlide(); } };
                nextBtn.onclick = () => { if (currentSlide < slides.length - 1) { currentSlide++; showSlide(); } };
                document.querySelector('#media-modal .slider-container').addEventListener('click', (e) => {
                    if (e.target.classList.contains('slider-container')) {
                        closeModal(modal);
                    }
                });
                showSlide();
            }

            document.getElementById('modal-body').addEventListener('click', async e => {
    const boxOfficeLine = e.target.closest('.box-office-line.clickable');
    if (boxOfficeLine) {
        currentCurrency = (currentCurrency === 'USD') ? 'RUB' : 'USD';
        localStorage.setItem('userCurrency', currentCurrency);
        
        const budget = parseFloat(boxOfficeLine.dataset.budget);
        const revenue = parseFloat(boxOfficeLine.dataset.revenue);
        
        boxOfficeLine.innerHTML = getBoxOfficeInnerHtml(budget, revenue);
        return;
    }
    
    const castToggle = e.target.closest('.cast-toggle');
    if (castToggle) {
        castToggle.classList.toggle('expanded');
        castToggle.nextElementSibling.classList.toggle('expanded');
        return;
    }
    
    const actorItem = e.target.closest('.actor-item');
                if (actorItem) {
                    const personId = actorItem.dataset.personId;
                    const personName = actorItem.dataset.personName;
                    showActorFilmography(personId, personName);
                    return;
                }


                const infoWrapper = e.target.closest('.modal-info-wrapper');
                if (!infoWrapper) return;
                
                let target = e.target.closest('span, a');
                if(!target && e.target.closest('.title-actions')) { // For clicks inside the action column but not on the icon itself
                    target = e.target.closest('.title-actions').querySelector('span, a');
                }
                if (!target) return;

                const filmId = infoWrapper.querySelector('[data-id]')?.dataset.id || target.dataset.filmId;
                if (!filmId) return;
                
                if (target.classList.contains('episodes-link')) {
                    openSeasonsModal(filmId);
                } else if (target.classList.contains('collection-link')) {
                    const collectionId = target.dataset.collectionId;
                    const collectionName = target.dataset.collectionName;
                    if (!collectionId) return;
                    closeModal(document.getElementById('movie-details-modal'));
                    movieGrid.innerHTML = `<p class="loading-indicator">Загрузка коллекции...</p>`;
                    document.getElementById('type-filter-search').value = 'multi';
                    document.querySelector('.tab-button[data-tab="search-view"]').click();
                    document.getElementById('search-input').value = '';
                    document.getElementById('subtitle-text').textContent = `Коллекция: ${collectionName}`;
                    exitFilmographyMode(); 
                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    const url = buildTmdbUrl(`/collection/${collectionId}`);
                    const collectionData = await fetchProxiedApi(url);
                    if (collectionData && collectionData.parts) {
                        isSearchMode = true;
                        page = 1; totalPages = 1;
                        collectionData.parts.sort((a, b) => new Date(a.release_date || 0) - new Date(b.release_date || 0));
                        collectionData.parts.forEach(part => {
                            part.media_type = part.media_type || 'movie';
                        });
                        displayMovies({ results: collectionData.parts }, true);
                    }
                } else if (target.classList.contains('frames-link')) {
                    openMediaModal(filmId);
                } else if (target.classList.contains('plan-link')) {
                    openAddToPlanModal(filmId);
                } else if (target.classList.contains('similar-link')) {
                    if (Date.now() < similarSearchCooldownEnd) return;

                    const filmName = target.dataset.filmName;
                    const isAnimated = target.dataset.isAnimated === 'true';
                    
                    similarSearchCooldownEnd = Date.now() + 5000;
                    manageCooldown(target, 5000, '👀');
                    
                    setTimeout(() => {
                        closeModal(document.getElementById('movie-details-modal'));
                        document.querySelector('.tab-button[data-tab="search-view"]').click();
                        document.getElementById('subtitle-text').textContent = `Похожие на: ${filmName}`;
                        exitFilmographyMode(); 
                        movieGrid.innerHTML = `<p class="loading-indicator">Ищу похожее...</p>`;
                        window.scrollTo({ top: 0, behavior: 'smooth' });

                        performSimilarAiSearch(filmId, filmName, isAnimated).catch(err => {
                             console.error("Similar AI Search Error:", err);
                             movieGrid.innerHTML = `<p class="no-results-message">Не удалось найти похожие фильмы.</p>`;
                        });
                        isSearchMode = true;
                    }, 200);
                }
            });

            document.getElementById('add-to-plan-form').addEventListener('submit',async function(e){
                e.preventDefault();
                const filmId=this.dataset.filmId; if(!filmId)return;
                const fromGrid = this.dataset.fromGrid === 'true';
                const mode = this.dataset.mode || 'add';
                const submitBtn=this.querySelector('.form-submit-btn');
                const loadingText = mode === 'edit' ? 'Сохранение...' : 'Добавление...';
                const originalText = mode === 'edit' ? 'Сохранить изменения' : 'Добавить';
                toggleButtonLoading(submitBtn,true,originalText,loadingText);
                try{
                    const filmData = await getFullMovieData(filmId);
                    if(!filmData)throw new Error("Film data not available");
                    
                    const progressData = await calculateProgressAndTitle(this, filmData);
                    const planData={
                        movieData: filmData,
                        proposedBy: this.querySelector('#proposer-select').value,
                        comment: this.querySelector('#plan-comment').value.trim(),
                        priority:parseInt(this.querySelector('.medals-input').dataset.priority||0),
                        ...progressData
                    };

                    await postToApi('save_plan', { filmId, planData });
                    
                    if (mode === 'add') {
                        logAdminAction(`${planData.proposedBy === 'katya' ? '😺' : '👾'} добавил(а) "${filmData.title || filmData.name}" в планы.`);
                    } else {
                        logAdminAction(`📝 Изменен план для "${filmData.title || filmData.name}".`);
                    }
                    
                    plans[filmId] = planData;
                    
                    closeModal(document.getElementById('add-to-plan-modal'));

                    if (fromGrid) {
                        updateCardOnGrid(filmId);
                    } else if (document.getElementById('plans-view').classList.contains('active')) {
                        displayPlans(true);
                    } else {
                        showMovieDetails(filmId);
                    }
                    
                    updateCardOnGrid(filmId);

                }catch(err){
                    console.error("Ошибка при работе с планом: ",err);showMessage("Произошла ошибка, попробуйте снова.", "Ошибка");
                }finally{
                    toggleButtonLoading(submitBtn,false,originalText);
                    this.removeAttribute('data-from-grid');
                }
            });

            document.getElementById('add-to-plan-form').querySelector('.medals-input').addEventListener('click',e=>{const medal=e.target.closest('.medal');if(medal){const container=medal.parentElement,value=medal.dataset.value;const newPriority=(container.dataset.priority===value)?0:value;setupMedals(newPriority)}});
            document.getElementById('plan-progress-toggle').addEventListener('change',async e=>{const tracker=document.getElementById('plan-progress-tracker');const form=e.target.closest('form');const isVisible=e.target.checked;tracker.classList.toggle('visible',isVisible);if(isVisible&&!form.dataset.seasonsDataLoaded){await setupProgressUI(form,form.dataset.filmId);form.dataset.seasonsDataLoaded=true;}});
            document.getElementById('progress-form').addEventListener('submit',async function(e){e.preventDefault(); const form=e.target,filmId=form.dataset.filmId;const submitBtn=form.querySelector('.form-submit-btn');const filmData=plans[filmId]?.movieData;if(!filmData)return;toggleButtonLoading(submitBtn,true,'Сохранить','Сохранение...');try{const progressData=await calculateProgressAndTitle(form, filmData);if(progressData){ const planData = { ...plans[filmId], ...progressData }; await postToApi('save_plan', { filmId, planData }); Object.assign(plans[filmId], progressData); logAdminAction(`🔄 Обновлен прогресс для "${filmData.title || filmData.name}"`); }closeModal(document.getElementById('progress-modal'));displayPlans(true); }catch(err){console.error("Ошибка обновления прогресса: ",err);showMessage("Произошла ошибка, попробуйте снова.", "Ошибка");}finally{toggleButtonLoading(submitBtn,false,'Сохранить');}});
            
            async function handleClearProgress(e) {
                const clearBtn = e.target.closest('.progress-clear-btn');
                if (!clearBtn) return;
                const form = clearBtn.closest('form');
                const filmId = form.dataset.filmId;
                if (!filmId) return;

                if (form.id === 'progress-form') {
                     const plan = plans[filmId];
                     if (!plan) return;
                     const movieName = plan.movieData.title || plan.movieData.name;

                     if(await showConfirmation(`Вы уверены, что хотите сбросить прогресс для "${movieName}"?`)) {
                         const planData = { ...plan, season: null, episode: null, progress_percentage: null, episode_title: null };
                         await postToApi('save_plan', { filmId, planData });
                         
                         delete plans[filmId].season;
                         delete plans[filmId].episode;
                         delete plans[filmId].progress_percentage;
                         delete plans[filmId].episode_title;
                         
                         logAdminAction(`🔄 Сброшен прогресс для "${movieName}".`);
                         closeModal(document.getElementById('progress-modal'));
                         displayPlans(true);
                     }
                } else { 
                     const seasonSelect=form.querySelector('select[id$="season-select"]');
                     const episodeInput=form.querySelector('input[id$="episode"]');
                     episodeInput.value='';
                     if(seasonSelect.options.length>0)seasonSelect.selectedIndex=0;
                     episodeInput.value=1;
                     seasonSelect.dispatchEvent(new Event('change',{bubbles:true}));
                }
            }

            document.getElementById('add-to-plan-modal').addEventListener('click',handleClearProgress);
            document.getElementById('progress-modal').addEventListener('click',handleClearProgress);

            const enforceNumericInput = (e) => { e.target.value = e.target.value.replace(/\D/g, ''); };
            document.getElementById('plan-episode').addEventListener('input', enforceNumericInput);
            document.getElementById('progress-episode').addEventListener('input', enforceNumericInput);
            
            document.querySelectorAll('.score-slider').forEach(slider => {
                slider.addEventListener('input', e => {
                    const slide = e.target.closest('.rating-slide');
                    const display = slide.querySelector('.score-display');
                    const score = parseFloat(e.target.value);
                    display.textContent = score === 0 ? 'без оценки' : formatScore(score);
                    display.classList.toggle('no-rating', score === 0);
                    display.style.color = getScoreColor(score);
                });
            });

            const ratingForm=document.getElementById('rating-form');const personSwitcher=document.querySelector('.person-switcher');personSwitcher.addEventListener('click',e=>{const b=e.target.closest('.person-btn');if(!b||b.classList.contains('active'))return;const form = b.closest('form');personSwitcher.querySelector('.active')?.classList.remove('active');b.classList.add('active');form.classList.add('person-selected');document.querySelector('.rating-carousel-slider').style.transform=`translateX(${b.dataset.person==='maxim'?'-50%':'0'})`;const submitBtn = form.querySelector('.form-submit-btn');submitBtn.disabled = false;submitBtn.textContent = 'Сохранить оценку';const newPerson = b.dataset.person;const newSlide = document.querySelector(`.rating-slide[data-person="${newPerson}"]`);newSlide.querySelector('.score-slider').dispatchEvent(new Event('input'));});
            ratingForm.addEventListener('click',e=>{
                const t=e.target; const slide=t.closest('.rating-slide'); if(!slide)return;
                const clearBtn=t.closest('.comment-clear-btn');
                const icon=t.closest('.special-icon');
                if(clearBtn){clearBtn.previousElementSibling.value=''}
                else if(icon){
                    const container=icon.parentElement;
                    const person=slide.dataset.person;
                    const value=icon.dataset.value;
                    const exclusiveIcons=['heart','poop','cross'];
                    
                    let specialValues = (container.dataset.special || '').split(',').filter(Boolean);

                    if (value === 'rewatch') {
                        if (specialValues.includes('rewatch')) {
                            specialValues = specialValues.filter(v => v !== 'rewatch');
                        } else {
                            specialValues.push('rewatch');
                        }
                    } else if (exclusiveIcons.includes(value)) {
                        const isCurrentlySelected = specialValues.includes(value);
                        specialValues = specialValues.filter(v => !exclusiveIcons.includes(v));
                        if (!isCurrentlySelected) {
                            specialValues.push(value);
                        }
                    }
                    setupSpecialRating(person, specialValues.join(','));
                }
            });
            ratingForm.addEventListener('submit',async function(e){
                e.preventDefault();
                const filmId=this.dataset.filmId; if(!filmId)return;
                const submitBtn=this.querySelector('.form-submit-btn');
                toggleButtonLoading(submitBtn,true,'Сохранить оценку','Сохранение...');
                try {
                    const getData=p=>{const s=document.querySelector(`.rating-slide[data-person="${p}"]`);return{score:parseFloat(s.querySelector('.score-slider').value)||0,comment:s.querySelector('.comment-input').value.trim(),special:s.querySelector('.special-rating-input').dataset.special||''};};
                    const kData=getData('katya'),mData=getData('maxim');
                    const isKatyaEmpty=!kData.score&&!kData.comment&&!kData.special;
                    const isMaximEmpty=!mData.score&&!mData.comment&&!mData.special;

                    if(isKatyaEmpty && isMaximEmpty){
                        if(ratings[filmId]){
                            await postToApi('delete_rating', { filmId });
                            const movieData = ratings[filmId].movieData;
                            delete ratings[filmId];
                            logAdminAction(`🗑️ Удалена оценка для "${movieData?.title || movieData?.name}".`);
                        }
                    } else {
                        const ratingUpdate = {};
                        if(!isKatyaEmpty) ratingUpdate.katya = kData;
                        if(!isMaximEmpty) ratingUpdate.maxim = mData;

                        if (!ratings[filmId]) {
                            const movieData = await getFullMovieData(filmId);
                            if (!movieData) throw new Error("Movie data not found for new rating.");
                            ratingUpdate.movieData = movieData;
                        } else {
                            ratingUpdate.movieData = ratings[filmId].movieData;
                        }
                        
                        await postToApi('save_rating', { filmId, ratingData: ratingUpdate });

                        const movieTitle = (ratingUpdate.movieData?.title || 'фильм');
                        const logSpecialIcons = {'heart':'❤️', 'poop':'💩', 'cross':'❌', 'rewatch':'🔄'};
                        
                        const formatLog = (personData, personName) => {
                            let text = `${personName} оценил(а) "${movieTitle}"`;
                            if (personData.score > 0) text += ` на ${personData.score}`;
                            const specialIcons = (personData.special || '').split(',').filter(Boolean).map(s => logSpecialIcons[s]);
                            if (specialIcons.length > 0) text += ` (${specialIcons.join(', ')})`;
                            logAdminAction(text);
                        }

                        if (!isKatyaEmpty) formatLog(kData, '😺 Катя');
                        if (!isMaximEmpty) formatLog(mData, '👾 Максим');
                        
                        ratings[filmId] = { ...(ratings[filmId] || {}), ...ratingUpdate };
                    }
                    
                    if(plans[filmId]){
                        await postToApi('delete_plan', { filmId });
                        delete plans[filmId];
                    }
                    
                    closeModal(document.getElementById('movie-details-modal'));
                    await updateCardOnGrid(filmId);
                    
                    const activeViewId=document.querySelector('.view.active').id;
                    if(activeViewId==='ratings-view'){
                        displayRatedMovies(true);
                    } else if (activeViewId === 'plans-view') {
                        displayPlans(true);
                    }
                }catch(err){
                    console.error("Ошибка при сохранении оценки: ",err);
                    showMessage("Произошла ошибка, попробуйте снова.", "Ошибка");
                } finally {
                    toggleButtonLoading(submitBtn,false,'Сохранить оценку');
                }
            });
            document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m)}));
            document.querySelectorAll('.modal-close').forEach(b=>b.addEventListener('click',()=>closeModal(b.closest('.modal'))));
            
            function handleFilterChange(e) {
                const target = e.target.closest('select');
                if (!target) return;
                const view = target.closest('.view');
                if(target.id.includes('sort-filter-ratings')){
                    const option=target.options[target.selectedIndex];
                    if(option.value === 'rating'){
                        ratingSortDirection=ratingSortDirection === 'desc' ? 'asc' : 'desc';
                        option.textContent = `По оценке ${ratingSortDirection === 'desc'?'↓':'↑'}`
                    } else {
                        document.querySelector('#sort-filter-ratings option[value="rating"]').textContent = 'По оценке';
                    }
                }
                if (view.id === 'ratings-view') { displayRatedMovies(true); } 
                else if (view.id === 'plans-view') { displayPlans(true); }
            }

            document.getElementById('ratings-filters').addEventListener('change',handleFilterChange);
            document.getElementById('plans-filters').addEventListener('change',handleFilterChange);
            document.getElementById('filmography-filters').addEventListener('change',displayFilteredFilmography);
            
            document.getElementById('random-plan-btn').addEventListener('click', showRandomPlan);
            

            setupRandomContentListeners();

            setInterval(() => {
                const icons = document.querySelectorAll('.future-release-icon');
                icons.forEach(icon => {
                    icon.textContent = icon.textContent === '⏳' ? '⌛' : '⏳';
                });
            }, 3000);

            setupAdminPanelListeners();
        }

        function setupRandomContentListeners() {
            const randomBtn = document.getElementById('random-movie-btn');
            let longPressTimer;
            let isLongPress = false;

            const startPress = (e) => {
                if (isFilmographyMode()) return;
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    e.preventDefault();
                    openRandomSettingsModal();
                }, 700);
            };
            const cancelPress = () => {
                clearTimeout(longPressTimer);
            };
            randomBtn.addEventListener('mousedown', startPress);
            randomBtn.addEventListener('mouseup', cancelPress);
            randomBtn.addEventListener('mouseleave', cancelPress);
            randomBtn.addEventListener('touchstart', startPress, { passive: false });
            randomBtn.addEventListener('touchend', cancelPress);
            randomBtn.addEventListener('click', (e) => {
                if (isLongPress) {
                    e.preventDefault();
                } else if (isFilmographyMode()) {
                    showRandomFilmographyItem();
                } else {
                    showRandomContent();
                }
            });

            const randomSettingsForm = document.getElementById('random-settings-form');
            randomSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const durationSelect = document.getElementById('random-duration-filter').selectedOptions[0];
                const genreSelect = document.getElementById('random-genre-filter');
                const decadeSelect = document.getElementById('random-decade-filter').selectedOptions[0];
                const popularitySelect = document.getElementById('random-popularity-filter').selectedOptions[0];
                
                randomizerSettings = {
                    minRuntime: durationSelect.dataset.minRuntime,
                    maxRuntime: durationSelect.dataset.maxRuntime,
                    value: durationSelect.value,
                    genre: genreSelect.value === 'any' ? null : genreSelect.value,
                    decadeStart: decadeSelect.dataset.startYear,
                    decadeEnd: decadeSelect.dataset.endYear,
                    decadeValue: decadeSelect.value,
                    minVotes: popularitySelect.dataset.minVotes,
                    popularityValue: popularitySelect.value,
                };
                
                closeModal(document.getElementById('random-settings-modal'));
            });

            randomSettingsForm.addEventListener('reset', () => {
                randomizerSettings = {};
                randomSettingsForm.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
            });
        }

        async function populateGenreFilter(selector = '#random-genre-filter') {
            const genreSelect = document.querySelector(selector);
            if (!genreSelect || genreSelect.options.length > 1) return; 
            try {
                const data = await fetchProxiedApi(buildTmdbUrl('/genre/movie/list'));
                if (data && data.genres) {
                    data.genres.forEach(genre => {
                        const option = document.createElement('option');
                        option.value = genre.id;
                        option.textContent = genre.name;
                        genreSelect.appendChild(option);
                    });
                }
            } catch (e) { console.error("Could not populate genre filter:", e); }
        }

        async function openRandomSettingsModal() {
            await populateGenreFilter();
            const modal = document.getElementById('random-settings-modal');
            const durationSelect = document.getElementById('random-duration-filter');
            const genreSelect = document.getElementById('random-genre-filter');
            const decadeSelect = document.getElementById('random-decade-filter');
            const popularitySelect = document.getElementById('random-popularity-filter');
            
            const selectedTypeOption = document.getElementById('type-filter-search').selectedOptions[0];
            const typeValue = selectedTypeOption.value;
            const isAnimation = selectedTypeOption.dataset.genre === String(ANIMATION_GENRE_ID);
            const excludeAnimation = selectedTypeOption.dataset.excludeGenre && selectedTypeOption.dataset.excludeGenre.includes(String(ANIMATION_GENRE_ID));
            
            genreSelect.closest('.form-group').style.display = isAnimation ? 'none' : 'block';

            const animationOption = genreSelect.querySelector(`option[value="${ANIMATION_GENRE_ID}"]`);
            if (animationOption) {
                animationOption.style.display = excludeAnimation ? 'none' : 'block';
                if (excludeAnimation && genreSelect.value == ANIMATION_GENRE_ID) {
                    genreSelect.value = 'any';
                    if (randomizerSettings.genre == ANIMATION_GENRE_ID) {
                        randomizerSettings.genre = null;
                    }
                }
            }

            const isTvType = typeValue === 'tv' || (typeValue === 'multi' && Math.random() > 0.5); 
            if (isTvType) {
                durationSelect.innerHTML = `
                    <option value="any" selected>Любая</option>
                    <option value="short_series" data-max-runtime="30">Короткие (до 30 мин)</option>
                    <option value="medium_series" data-min-runtime="30" data-max-runtime="50">Средние (30-50 мин)</option>
                    <option value="long_series" data-min-runtime="50">Длинные (больше 50 мин)</option>
                `;
            } else {
                durationSelect.innerHTML = `
                    <option value="any" selected>Любая</option>
                    <option value="short" data-max-runtime="90">Меньше 1.5 часов</option>
                    <option value="medium" data-min-runtime="90" data-max-runtime="150">1.5 - 2.5 часа</option>
                    <option value="long" data-min-runtime="150">Больше 2.5 часов</option>
                `;
            }

            if(randomizerSettings.value) durationSelect.value = randomizerSettings.value;
            if(randomizerSettings.genre) genreSelect.value = randomizerSettings.genre;
            if(randomizerSettings.decadeValue) decadeSelect.value = randomizerSettings.decadeValue;
            if(randomizerSettings.popularityValue) popularitySelect.value = randomizerSettings.popularityValue;

            openModal(modal);
        }

        async function showRandomContent() {
            const button = document.getElementById('random-movie-btn');
            button.disabled = true; button.textContent = '🤔';
            try {
                const selectedOption = document.getElementById('type-filter-search').selectedOptions[0];
                const type = selectedOption.value === 'multi' ? (Math.random() < 0.65 ? 'movie' : 'tv') : selectedOption.value;
                const discoverParams = { ...randomizerSettings };
                
                discoverParams['sort_by'] = 'popularity.desc';
                if (!discoverParams.minVotes) discoverParams['vote_count.gte'] = 100;
                else {
                    discoverParams['vote_count.gte'] = discoverParams.minVotes;
                    delete discoverParams.minVotes;
                }
                
                if (!discoverParams.genre) {
                    if (selectedOption.dataset.genre) discoverParams.with_genres = selectedOption.dataset.genre;
                    if (selectedOption.dataset.excludeGenre) discoverParams.without_genres = selectedOption.dataset.excludeGenre;
                } else {
                    discoverParams.with_genres = discoverParams.genre;
                    delete discoverParams.genre;
                }

                if (discoverParams.minRuntime) { discoverParams['with_runtime.gte'] = discoverParams.minRuntime; delete discoverParams.minRuntime; }
                if (discoverParams.maxRuntime) { discoverParams['with_runtime.lte'] = discoverParams.maxRuntime; delete discoverParams.maxRuntime; }
                
                const dateKey = type === 'movie' ? 'primary_release_date' : 'first_air_date';
                if (discoverParams.decadeStart) { discoverParams[`${dateKey}.gte`] = `${discoverParams.decadeStart}-01-01`; delete discoverParams.decadeStart; }
                if (discoverParams.decadeEnd) { discoverParams[`${dateKey}.lte`] = `${discoverParams.decadeEnd}-12-31`; delete discoverParams.decadeEnd; }

                let found = false;
                for (let attempt = 0; attempt < 10; attempt++) {
                    const initialData = await fetchProxiedApi(buildTmdbUrl(`/discover/${type}`, discoverParams));
                    if (!initialData || !initialData.total_pages) continue;
                    const randomPage = Math.floor(Math.random() * Math.min(initialData.total_pages, 200)) + 1;
                    discoverParams.page = randomPage;
                    const pageData = await fetchProxiedApi(buildTmdbUrl(`/discover/${type}`, discoverParams));
                    if (!pageData || !pageData.results || pageData.results.length === 0) continue;
                    const potentialItems = pageData.results.filter(item => {
                        const filmId = `${type}-${item.id}`;
                        if (randomMoviesHistory.includes(filmId)) return false;
                        
                        if (!item.origin_country || item.origin_country.length === 0) return true;
                        const isJapanese = item.origin_country.includes('JP');
                        const isAnimeSeries = type === 'tv' && item.genre_ids?.includes(ANIMATION_GENRE_ID);
                        if (disableAnime && isJapanese && isAnimeSeries) return false;
                        if (hiddenCountries.includes('JP') && isJapanese && !isAnimeSeries) return false;
                        if (item.origin_country.some(c => c !== 'JP' && hiddenCountries.includes(c))) return false;
                        
                        return true;
                    });
                    if (potentialItems.length > 0) {
                        const randomItem = potentialItems[Math.floor(Math.random() * potentialItems.length)];
                        const filmId = `${type}-${randomItem.id}`;
                        randomMoviesHistory.push(filmId);
                        if(randomMoviesHistory.length > 100) randomMoviesHistory.shift();
                        moviesDataCache[filmId] = { ...randomItem, media_type: type };
                        showMovieDetails(filmId);
                        found = true;
                        break;
                    }
                }
                if (!found) await showMessage('Не удалось найти подходящий контент с такими фильтрами. Попробуйте смягчить их.', 'Ничего не найдено');
            } catch (e) { console.error("Error getting random content:", e); await showMessage('Произошла ошибка при поиске.', 'Ошибка'); } finally { button.disabled = false; button.textContent = '🎲'; }
        }

        function showRandomPlan() {
            if (!currentFilteredPlans || currentFilteredPlans.length === 0) {
                showMessage('Список планов пуст или фильтры не вернули результатов.', 'Нечего выбирать');
                return;
            }
            const randomIndex = Math.floor(Math.random() * currentFilteredPlans.length);
            const [filmId, planData] = currentFilteredPlans[randomIndex];
            showMovieDetails(filmId, false);
        }
        
        const slugify = text => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
        const normalizeTitle = (title) => title.toLowerCase().replace(/[^a-z0-9а-я]/g, '');

        async function getAnimeFillerInfo(animeTitle) {
            const slug = slugify(animeTitle);
            if (animeFillerCache[slug]) return animeFillerCache[slug];
            try {
                const response = await fetch(`${CORS_PROXY_URL}${ANIME_FILLER_API_URL}${slug}`);
                if (!response.ok) return null;
                const data = await response.json();
                
                const fillerTitles = new Set();
                if (data.episodes) {
                    data.episodes.forEach(ep => {
                        if (ep['filler-type'] && ep['filler-type'].toLowerCase().includes('filler') && ep['episode-title']) {
                            filler
                        }
                    });
                }
                animeFillerCache[slug] = fillerTitles;
                return fillerTitles;
            } catch (e) {
                console.error("Error fetching filler info:", e);
                return null;
            }
        }
        
        async function openSeasonsModal(filmId) {
            const modal = document.getElementById('seasons-modal');
            const titleEl = document.getElementById('seasons-title');
            const contentEl = document.getElementById('seasons-content');
            const filmData = await getFullMovieData(filmId);
        
            if (!filmData) return;
        
            titleEl.textContent = filmData.name || filmData.title;
            contentEl.innerHTML = `<p class="loading-indicator">Загрузка сезонов...</p>`;
            openModal(modal);

            const isAnime = filmData.media_type === 'tv' && filmData.genres.some(g => g.id === ANIMATION_GENRE_ID);
            
            const tmdbTvDetails = await fetchProxiedApi(buildTmdbUrl(`/tv/${filmData.id}`));
            const seasonsData = tmdbTvDetails?.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0);
        
            if (!seasonsData || seasonsData.length === 0) {
                contentEl.innerHTML = `<p>Информация о сезонах не найдена.</p>`;
                return;
            }
            
            contentEl.innerHTML = `
                <div id="seasons-header">
                    <div class="form-group">
                        <label for="season-select-list">Сезон</label>
                        <select id="season-select-list"></select>
                    </div>
                    <div id="season-rating"></div>
                    <span id="episode-search-toggle" title="Поиск по событию">⌄</span>
                </div>
                <div id="episode-search-container">
                    <div id="episode-search-controls">
                        <input type="text" id="episode-ai-search-input" placeholder="Опишите событие в серии...">
                        <button type="button" id="episode-ai-search-btn" title="Найти серию с помощью ИИ">✨</button>
                    </div>
                </div>
                <div id="episodes-list"><p class="loading-indicator">Загрузка серий...</p></div>`;
        
            const seasonSelect = document.getElementById('season-select-list');
            seasonsData.forEach(season => {
                const option = document.createElement('option');
                option.value = season.season_number;
                option.textContent = season.name || `Сезон ${season.season_number}`;
                seasonSelect.appendChild(option);
            });
            
            const fillerInfo = isAnime ? await getAnimeFillerInfo(filmData.name || filmData.title) : null;

            const searchToggle = document.getElementById('episode-search-toggle');
            const searchContainer = document.getElementById('episode-search-container');
            searchToggle.addEventListener('click', () => {
                searchToggle.classList.toggle('expanded');
                searchContainer.classList.toggle('expanded');
            });

            document.getElementById('episode-ai-search-btn').addEventListener('click', async () => {
                const seriesName = filmData.name || filmData.title;
                const query = document.getElementById('episode-ai-search-input').value;
                if (!query) return;
                await performEpisodeAiSearch(seriesName, query, filmId, fillerInfo);
            });

            seasonSelect.addEventListener('change', async () => await displaySeasonDetails(filmId, seasonSelect.value, fillerInfo));
            await displaySeasonDetails(filmId, seasonSelect.value, fillerInfo);
        }

        async function displaySeasonDetails(filmId, seasonNumber, fillerInfo) {
            const episodesListEl = document.getElementById('episodes-list');
            const seasonRatingEl = document.getElementById('season-rating');
            episodesListEl.innerHTML = `<p class="loading-indicator">Загрузка серий...</p>`;
            seasonRatingEl.innerHTML = '';

            const [type, id] = filmId.split('-');
            const seasonDetails = await fetchProxiedApi(buildTmdbUrl(`/tv/${id}/season/${seasonNumber}`));

            if (!seasonDetails || !seasonDetails.episodes) {
                episodesListEl.innerHTML = `<p>Не удалось загрузить серии.</p>`;
                return;
            }
            
            if (seasonDetails.vote_average > 0) {
                const score = seasonDetails.vote_average.toFixed(1);
                seasonRatingEl.innerHTML = `Рейтинг сезона <span style="color: ${getScoreColor(score)}">★ ${score}</span>`;
            }

            const plan = plans[filmId];
            let progressEpisodeNumber = 0;
            if (plan && plan.season == seasonNumber) {
                 progressEpisodeNumber = plan.episode;
            }
            
            let episodesHTML = '';
            for (const episode of seasonDetails.episodes) {
                const airDate = episode.air_date ? new Date(episode.air_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'нет данных';
                const score = episode.vote_average ? episode.vote_average.toFixed(1) : '-';
                const votes = episode.vote_count > 0 ? `(${episode.vote_count})` : '';
                const isFiller = fillerInfo && episode.name && fillerInfo.has(normalizeTitle(episode.name));
                const fillerBadge = isFiller ? '<span class="filler-badge">F</span>' : '';
                const watchedIndicatorClass = progressEpisodeNumber > 0 && episode.episode_number <= progressEpisodeNumber ? 'watched-indicator' : '';
                
                episodesHTML += `<div class="episode-item ${watchedIndicatorClass}" data-episode-number="${episode.episode_number}">
                    <div class="episode-number">${episode.episode_number}</div>
                    <div class="episode-details">
                        <div class="episode-title">${episode.name || `Эпизод ${episode.episode_number}`}${fillerBadge}</div>
                        <div class="episode-air-date">${airDate}</div>
                    </div>
                    <div class="episode-rating">
                        <div class="episode-rating-score" style="color: ${getScoreColor(score)}">★ ${score}</div>
                        <div class="episode-rating-votes">${votes}</div>
                    </div>
                </div>`;
            }
            episodesListEl.innerHTML = episodesHTML;
        }

        // --- FILMOGRAPHY FUNCTIONS ---
        function enterFilmographyMode() {
            document.body.classList.add('filmography-mode');
            document.getElementById('filmography-filters').style.display = 'grid';
            const searchControls = document.querySelector('.search-controls-wrapper');
            const randomBtn = document.getElementById('random-movie-btn');
            searchControls.appendChild(randomBtn);
        }

        function exitFilmographyMode() {
            document.body.classList.remove('filmography-mode');
            document.getElementById('filmography-filters').style.display = 'none';
            const topRow = document.querySelector('.search-top-row');
            const randomBtn = document.getElementById('random-movie-btn');
            topRow.appendChild(randomBtn);
            currentFilmography = [];
        }

        function resetSearchView() {
            exitFilmographyMode();
            document.getElementById('subtitle-text').textContent = initialSubtitle;
            document.getElementById('search-input').value = '';
            loadInitialContent();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        async function showActorFilmography(personId, personName) {
            closeModal(document.getElementById('movie-details-modal'));
            
            document.querySelector('.tab-button[data-tab="search-view"]').click();
            document.getElementById('subtitle-text').textContent = `Фильмография: ${personName}`;
            movieGrid.innerHTML = `<p class="loading-indicator">Загрузка работ...</p>`;
            enterFilmographyMode();
            window.scrollTo({ top: 0, behavior: 'smooth' });

            try {
                const url = buildTmdbUrl(`/person/${personId}/combined_credits`);
                const data = await fetchProxiedApi(url);
                if (data && data.cast) {
                    const excludedGenreIds = [10767, 10764, 10763]; // Talk, Reality, News
                    currentFilmography = data.cast.filter(item => {
                        if (!item.genre_ids || !item.poster_path) return false;
                        return !item.genre_ids.some(id => excludedGenreIds.includes(id));
                    });
                    
                    const typeSelect = document.getElementById('filmography-type');
                    typeSelect.innerHTML = '<option value="all">Все</option><option value="movie">Фильмы</option><option value="tv">Сериалы</option>';
                    
                    const hasAnimatedMovies = currentFilmography.some(item => item.media_type === 'movie' && item.genre_ids.includes(ANIMATION_GENRE_ID));
                    const hasAnimatedSeries = currentFilmography.some(item => item.media_type === 'tv' && item.genre_ids.includes(ANIMATION_GENRE_ID));

                    if(hasAnimatedMovies) typeSelect.insertAdjacentHTML('beforeend', '<option value="animated_movie">Мультфильмы</option>');
                    if(hasAnimatedSeries) typeSelect.insertAdjacentHTML('beforeend', '<option value="animated_tv">Мультсериалы</option>');

                    displayFilteredFilmography();
                } else {
                    movieGrid.innerHTML = `<p class="no-results-message">Не удалось загрузить фильмографию.</p>`;
                }
            } catch (e) {
                console.error("Error fetching filmography:", e);
                movieGrid.innerHTML = `<p class="no-results-message">Ошибка при загрузке.</p>`;
            }
        }

        function displayFilteredFilmography() {
            const sort = document.getElementById('filmography-sort').value;
            const type = document.getElementById('filmography-type').value;
            const genre = document.getElementById('filmography-genre').value;
            const decadeOption = document.getElementById('filmography-decade').selectedOptions[0];
            const startYear = decadeOption.dataset.startYear;
            const endYear = decadeOption.dataset.endYear;
            const query = document.getElementById('search-input').value.trim().toLowerCase();

            let filtered = [...currentFilmography];

            if (type === 'animated_movie') {
                filtered = filtered.filter(item => item.media_type === 'movie' && item.genre_ids.includes(ANIMATION_GENRE_ID));
            } else if (type === 'animated_tv') {
                filtered = filtered.filter(item => item.media_type === 'tv' && item.genre_ids.includes(ANIMATION_GENRE_ID));
            } else if (type !== 'all') {
                filtered = filtered.filter(item => item.media_type === type);
            }

            if (genre !== 'any') {
                filtered = filtered.filter(item => item.genre_ids.includes(parseInt(genre, 10)));
            }
            
            if (startYear) {
                filtered = filtered.filter(item => {
                    const year = parseInt((item.release_date || item.first_air_date || '0').substring(0, 4), 10);
                    return year >= parseInt(startYear, 10) && year <= parseInt(startYear, 10) + 9;
                });
            } else if (endYear) {
                filtered = filtered.filter(item => {
                    const year = parseInt((item.release_date || item.first_air_date || '0').substring(0, 4), 10);
                    return year <= parseInt(endYear, 10);
                });
            }

            if (query) {
                filtered = filtered.filter(item => (item.title || item.name || '').toLowerCase().includes(query) || (item.original_title || item.original_name || '').toLowerCase().includes(query));
            }

            switch (sort) {
                case 'popularity':
                    filtered.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
                    break;
                case 'newest':
                    filtered.sort((a, b) => new Date(b.release_date || b.first_air_date || 0) - new Date(a.release_date || a.first_air_date || 0));
                    break;
                case 'oldest':
                    filtered.sort((a, b) => new Date(a.release_date || a.first_air_date || 0) - new Date(b.release_date || b.first_air_date || 0));
                    break;
            }

            displayMovies({ results: filtered }, true);
        }

        function showRandomFilmographyItem() {
            const itemsOnGrid = movieGrid.querySelectorAll('.movie-card');
            if (itemsOnGrid.length === 0) {
                showMessage("Нет элементов для выбора. Попробуйте изменить фильтры.", "Упс!");
                return;
            }
            const randomItem = itemsOnGrid[Math.floor(Math.random() * itemsOnGrid.length)];
            const filmId = randomItem.dataset.id;
            if (filmId) {
                showMovieDetails(filmId);
            }
        }
        
        // --- AI EPISODE SEARCH ---
        async function performEpisodeAiSearch(seriesName, userQuery, filmId, fillerInfo) {
            if (Date.now() < episodeAiSearchCooldownEnd) return;
        
            const button = document.getElementById('episode-ai-search-btn');
            const searchInput = document.getElementById('episode-ai-search-input');
            const seasonSelect = document.getElementById('season-select-list');
        
            searchInput.disabled = true;
            episodeAiSearchCooldownEnd = Date.now() + 20000;
            manageCooldown(button, 20000, '✨');
        
            try {
                const prompt = `Скажи точный сезон и серию и ничего более: в сериале "${seriesName}" в каком сезоне и какой серии происходит: ${userQuery}`;
                const response = await fetch(DEEPSEEK_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
                    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }] })
                });
                if (!response.ok) throw new Error("AI API request failed");
        
                const data = await response.json();
                const aiResponseText = data.choices?.[0]?.message?.content || "";
        
                const match = aiResponseText.match(/сезон\s*(\d+).*сери(?:я|и)\s*(\d+)/i);
                
                if (match) {
                    const seasonNum = parseInt(match[1], 10);
                    const episodeNum = parseInt(match[2], 10);
                    
                    if (seasonSelect.value != seasonNum) {
                        if (seasonSelect.querySelector(`option[value="${seasonNum}"]`)) {
                            seasonSelect.value = seasonNum;
                            await displaySeasonDetails(filmId, seasonNum, fillerInfo);
                        } else {
                            showAiToast(`ИИ ответил: ${aiResponseText} (сезон не найден)`);
                            return;
                        }
                    }
                    setTimeout(() => highlightEpisode(episodeNum, aiResponseText), 100);
                } else {
                    showAiToast(`ИИ ответил: ${aiResponseText}`);
                }
            } catch (e) {
                console.error("Episode AI search error:", e);
                showAiToast("Ошибка при поиске серии.");
            } finally {
                searchInput.disabled = false;
            }
        }

        function highlightEpisode(episodeNum, aiResponseText) {
            const episodeItem = document.querySelector(`.episode-item[data-episode-number="${episodeNum}"]`);
            if (episodeItem) {
                episodeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                episodeItem.classList.add('highlighted');
                setTimeout(() => episodeItem.classList.remove('highlighted'), 1500);
            } else {
                showAiToast(`ИИ ответил: ${aiResponseText} (серия не найдена в сезоне)`);
            }
        }

        function showAiToast(message) {
            const modalContent = document.querySelector('#seasons-modal .modal-content');
            if (!modalContent) return;

            let toast = modalContent.querySelector('.ai-toast-notification');
            if (toast) toast.remove();

            toast = document.createElement('div');
            toast.className = 'ai-toast-notification';
            toast.textContent = message;
            modalContent.appendChild(toast);
            
            setTimeout(() => toast.classList.add('visible'), 50);
            setTimeout(() => {
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        }

        // --- ADMIN PANEL ---
        function logAdminAction(actionText) { try { let actions = JSON.parse(localStorage.getItem('adminActionsLog') || '[]'); actions.unshift({ text: actionText, time: new Date().toISOString() }); actions = actions.slice(0, 20); localStorage.setItem('adminActionsLog', JSON.stringify(actions)); } catch(e) { console.error("Error logging admin action:", e); } }
        async function openAdminPanel() { const adminPasswordPrompt = document.getElementById('admin-password-prompt'); openModal(adminPasswordPrompt); }
        
        async function displayAdminPanelContent() { 
            await loadInitialData(); 
            displayUserStats(); 
            displayKeyManagement(); 
            displayLastActions(); 
            setupAdminSettings(); 
        }

        function setupAdminSettings() {
            renderAdminCountryFilters();
            
            document.querySelectorAll('#admin-settings-content input[data-country]').forEach(checkbox => {
                checkbox.checked = hiddenCountries.includes(checkbox.dataset.country);
            });
            const disableAnimeSwitch = document.getElementById('disable-anime-switch');
            if(disableAnimeSwitch) disableAnimeSwitch.checked = disableAnime;
        }

        function renderAdminCountryFilters() {
            const mainContainer = document.getElementById('country-filters');
            const collapsibleContainer = document.querySelector('.country-filter-collapsible');
            mainContainer.innerHTML = '';
            collapsibleContainer.innerHTML = '';
            
            const countries = [
                { name: 'Великобритания', code: 'GB', emoji: '🇬🇧' },
                { name: 'Германия', code: 'DE', emoji: '🇩🇪' },
                { name: 'Индия', code: 'IN', emoji: '🇮🇳' },
                { name: 'Испания', code: 'ES', emoji: '🇪🇸' },
                { name: 'Канада', code: 'CA', emoji: '🇨🇦' },
                { name: 'Китай', code: 'CN', emoji: '🇨🇳' },
                { name: 'Корея', code: 'KR', emoji: '🇰🇷' },
                { name: 'Россия', code: 'RU', emoji: '🇷🇺' },
                { name: 'США', code: 'US', emoji: '🇺🇸' },
                { name: 'Франция', code: 'FR', emoji: '🇫🇷' },
                { name: 'Япония', code: 'JP', emoji: '🇯🇵' },
            ];

            countries.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
            const mainCountriesCodes = ['KR', 'CN', 'IN', 'JP', 'GB', 'RU'];

            countries.forEach(country => {
                const html = `<div class="switch-container"><span>${country.emoji} ${country.name}</span><label class="switch"><input type="checkbox" data-country="${country.code}"><span class="slider round"></span></label></div>`;
                if (mainCountriesCodes.includes(country.code)) {
                    mainContainer.insertAdjacentHTML('beforeend', html);
                } else {
                    collapsibleContainer.insertAdjacentHTML('beforeend', html);
                }
            });
        }


        async function updateCountryFilters() {
            hiddenCountries = Array.from(document.querySelectorAll('#admin-settings-content input[data-country]:checked')).map(cb => cb.dataset.country);
            try {
                await postToApi('save_setting', { key: 'hidden_countries', value: hiddenCountries });
                logAdminAction(`🌍 Фильтры стран обновлены: ${hiddenCountries.join(', ') || 'нет'}`);
            } catch(e) { console.error("Failed to update country filters:", e); }
        }

        function displayUserStats(){
            document.getElementById('total-rated-stat').textContent = Object.keys(ratings).length;
            document.getElementById('total-planned-stat').textContent = Object.keys(plans).length;
            const container = document.getElementById('user-stats-container');
            container.innerHTML = '';
            ['katya', 'maxim'].forEach(person => {
                const userRatings = Object.values(ratings).map(r => r[person]).filter(r => r && r.score > 0);
                let totalScore = 0;
                const scoreCounts = { low: 0, mid: 0, high: 0 };
                userRatings.forEach(r => {
                    totalScore += r.score;
                    if (r.score <= 4.5) scoreCounts.low++;
                    else if (r.score <= 7.5) scoreCounts.mid++;
                    else scoreCounts.high++;
                });
                const avgScore = userRatings.length > 0 ? (totalScore / userRatings.length).toFixed(2) : 'N/A';
                const totalNumeric = scoreCounts.low + scoreCounts.mid + scoreCounts.high;

                let statsHtml = `<div class="user-stats-card">
                                <h3>${person === 'katya' ? '😺 Катя' : '👾 Максим'}</h3>
                                <div class="stat-item"><span>Всего оценок</span><span>${userRatings.length}</span></div>
                                <div class="stat-item"><span>Средний балл</span><span>${avgScore}</span></div>
                                <div class="stats-bar-chart">
                                    <div class="bar-row">
                                        <div class="bar-label">Высокие</div>
                                        <div class="bar-container"><div class="bar-fill" style="width: ${totalNumeric > 0 ? (scoreCounts.high / totalNumeric) * 100 : 0}%; background-color: #22c55e;">${scoreCounts.high}</div></div>
                                    </div>
                                    <div class="bar-row">
                                        <div class="bar-label">Средние</div>
                                        <div class="bar-container"><div class="bar-fill" style="width: ${totalNumeric > 0 ? (scoreCounts.mid / totalNumeric) * 100 : 0}%; background-color: #facc15;">${scoreCounts.mid}</div></div>
                                    </div>
                                    <div class="bar-row">
                                        <div class="bar-label">Низкие</div>
                                        <div class="bar-container"><div class="bar-fill" style="width: ${totalNumeric > 0 ? (scoreCounts.low / totalNumeric) * 100 : 0}%; background-color: var(--danger-color);">${scoreCounts.low}</div></div>
                                    </div>
                                </div>
                             </div>`;
                container.innerHTML += statsHtml;
            });
        }
        function displayKeyManagement(){
            const tbody = document.getElementById('kp-keys-tbody');
            const header = document.getElementById('kp-keys-header');
            tbody.innerHTML = '';
            const now = Date.now();
            
            const sortedKeys = [...kpApiKeysManager.keys].sort((a, b) => {
                const aDisabled = a.disabledUntil && a.disabledUntil > now;
                const bDisabled = b.disabledUntil && b.disabledUntil > now;
                if (aDisabled !== bDisabled) return aDisabled - bDisabled;
                return (a.key || '').localeCompare(b.key || '');
            });
            
            const activeKeysCount = sortedKeys.filter(k => !k.disabledUntil || k.disabledUntil < now).length;
            header.querySelector('.key-counter').innerHTML = `(<span class="key-status-ok">${activeKeysCount}</span> / <span class="key-status-disabled">${sortedKeys.length - activeKeysCount}</span>)`;
            
            sortedKeys.forEach(k => {
                let status;
                 if (k.disabledUntil && k.disabledUntil > now) {
                    const remainingMs = k.disabledUntil - now;
                    const hours = Math.floor(remainingMs / 3600000);
                    const minutes = Math.floor((remainingMs % 3600000) / 60000);
                    status = `<span class="key-status-disabled">Отключен (~${hours}ч ${minutes}м)</span>`;
                } else {
                    status = `<span class="key-status-ok">OK</span>`;
                }
                tbody.innerHTML += `<tr><td>${k.key.substring(0,8)}...</td><td>${k.count}</td><td>${status}</td><td><button class="key-delete-btn" data-key-id="${k.id}" data-type="kp">×</button></td></tr>`;
            });
        }
        function displayLastActions() { const list = document.getElementById('last-actions-list'); list.innerHTML = ''; const actions = JSON.parse(localStorage.getItem('adminActionsLog') || '[]'); if (actions.length === 0) { list.innerHTML = '<li>Действий пока нет.</li>'; return; } actions.forEach(action => { list.innerHTML += `<li>${action.text}</li>`; }); }
        
        function setupAdminPanelListeners() {
            document.querySelector('.admin-nav').addEventListener('click', async (e) => {
                const btn = e.target.closest('.admin-nav-btn');
                if (!btn || btn.classList.contains('active')) return;

                if (btn.dataset.tab === 'admin-management' && localStorage.getItem('isAdminVerified') !== 'true') {
                    e.preventDefault();
                    await openAdminPanel();
                    return;
                }

                document.querySelector('.admin-nav-btn.active').classList.remove('active');
                document.querySelector('.admin-content.active').classList.remove('active');
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
            
            const adminPasswordPrompt = document.getElementById('admin-password-prompt');
            adminPasswordPrompt.addEventListener('click', e => {
                if (e.target === adminPasswordPrompt) {
                    closeModal(adminPasswordPrompt);
                }
            });

            document.getElementById('admin-password-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const input = document.getElementById('admin-password-input');
                if(input.value.toLowerCase() === 'panasonic') {
                    localStorage.setItem('isAdminVerified', 'true');
                    closeModal(adminPasswordPrompt);
                    document.querySelector('.admin-nav-btn[data-tab="admin-management"]').click();
                } else {
                    input.value='';
                    input.style.border='1px solid var(--danger-color)';
                    setTimeout(()=>input.style.border='1px solid #475569',1000);
                }
            });
            
            const kpKeysHeader = document.getElementById('kp-keys-header');
            const kpKeysContent = document.getElementById('kp-keys-content');
            if (kpKeysHeader && kpKeysContent) {
                if (!kpKeysHeader.querySelector('.key-counter')) {
                     kpKeysHeader.innerHTML += ' <span class="key-counter"></span>';
                }
                kpKeysHeader.addEventListener('click', () => {
                    kpKeysContent.classList.toggle('collapsed');
                    kpKeysHeader.classList.toggle('collapsed');
                });
            }

            document.getElementById('add-key-form').addEventListener('submit', async (e) => { e.preventDefault(); const input = document.getElementById('new-kp-key-input'); if (await kpApiKeysManager.addKey(input.value.trim())) { input.value = ''; input.dispatchEvent(new Event('input')); displayKeyManagement(); } else { showMessage('Неверный или дублирующийся ключ.', 'Ошибка'); } });
            
            document.getElementById('admin-management').addEventListener('click', async e => {
                const btn = e.target.closest('.key-delete-btn');
                if (btn) {
                    if (await showConfirmation(`Удалить этот ключ?`)) {
                        await kpApiKeysManager.deleteKey(btn.dataset.keyId);
                        displayKeyManagement();
                    }
                }
            });

            const countryToggle = document.querySelector('.country-filter-toggle');
            if (countryToggle) {
                countryToggle.addEventListener('click', () => {
                    const collapsible = document.querySelector('.country-filter-collapsible');
                    const wrapper = document.querySelector('.country-filter-collapsible-wrapper');
                    const isExpanded = !collapsible.classList.contains('expanded');
                    
                    collapsible.classList.toggle('expanded');
                    countryToggle.classList.toggle('expanded');
                    
                    if (isExpanded) {
                        wrapper.appendChild(countryToggle);
                    } else {
                        wrapper.insertBefore(countryToggle, collapsible);
                    }
                });
            }

            document.getElementById('admin-settings-content').addEventListener('change', e => {
                if (e.target.closest('#country-filters') || e.target.closest('.country-filter-collapsible')) {
                    updateCountryFilters();
                }
            });

            const disableAnimeSwitch = document.getElementById('disable-anime-switch');
            if (disableAnimeSwitch) {
                disableAnimeSwitch.addEventListener('change', async (e) => {
                    const isChecked = e.target.checked;
                    disableAnime = isChecked;
                    try {
                        await postToApi('save_setting', { key: 'disable_anime', value: isChecked });
                        logAdminAction(`🎌 Аниме ${isChecked ? 'отключено' : 'включено'}.`);
                    } catch(err) {
                        console.error("Failed to update anime setting:", err);
                    }
                });
            }

            document.getElementById('download-ratings-btn').addEventListener('click', () => downloadCollection('ratings'));
            document.getElementById('download-plans-btn').addEventListener('click', () => downloadCollection('plans'));
            
            document.querySelectorAll('.import-form').forEach(form => {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const table = e.target.dataset.table;
                    const fileInput = e.target.querySelector('input[type="file"]');
                    const file = fileInput.files[0];
                    const button = e.target.querySelector('button');

                    if (!file) { showMessage('Пожалуйста, выберите файл.', 'Ошибка'); return; }
                    if (!await showConfirmation(`Вы уверены, что хотите импортировать данные в '${table}'? Все существующие данные в этой таблице будут УДАЛЕНЫ.`)) return;

                    toggleButtonLoading(button, true, '', 'Импорт...');
                    
                    const formData = new FormData();
                    formData.append('jsonFile', file);
                    formData.append('table', table);

                    try {
                        const result = await postToApi(`import_${table === 'kp_api_keys' ? 'kp_keys' : 'data'}`, formData, true);
                        
                        showMessage(`Успешно! ${result.message}`, "Импорт завершен");
                        logAdminAction(`📦 Выполнен импорт в таблицу ${table}.`);
                        await loadInitialData();
                        displayAdminPanelContent();
                        if (document.getElementById(`${table}-view`)?.classList.contains('active')) {
                            table === 'ratings' ? displayRatedMovies(true) : displayPlans(true);
                        }
                    } catch (error) {
                        showMessage(`Ошибка импорта: ${error.message}`, "Ошибка");
                        console.error(error);
                    } finally {
                        toggleButtonLoading(button, false, `Импорт ${table}`);
                        fileInput.value = '';
                    }
                });
            });

            document.getElementById('clear-cache-btn').addEventListener('click', async () => { if(await showConfirmation("Вы уверены, что хотите очистить ВЕСЬ кэш сайта (включая авторизацию)? Страница будет перезагружена.")){ localStorage.clear(); sessionStorage.clear(); location.reload(); }});
            const themeSelect = document.getElementById('theme-select');
    themeSelect.value = localStorage.getItem('theme') || 'dark';
    themeSelect.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });
        }
        function downloadFile(filename, text) { const element = document.createElement('a'); element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(text)); element.setAttribute('download', filename); element.style.display = 'none'; document.body.appendChild(element); element.click(); document.body.removeChild(element); }
        function downloadCollection(name) { const data = name === 'ratings' ? ratings : plans; downloadFile(`${name}.json`, JSON.stringify(data, null, 2)); }
        
        // --- END ADMIN PANEL ---

        init();
    });