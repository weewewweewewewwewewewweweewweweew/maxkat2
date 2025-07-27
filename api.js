import * as config from './config.js';
import * as utils from './utils.js';

async function fetchViaProxy(url, options = {}) {
    const fullUrl = `${config.API_PROXY}${encodeURIComponent(url)}`;
    try {
        const response = await fetch(fullUrl, options);
        if (!response.ok) throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
        return await response.json();
    } catch (e) {
        console.error(`Fetch failed with proxy:`, e);
        throw e;
    }
}

export async function postToApi(action, body, isFormData = false) {
    const headers = {};
    let finalBody = body;

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
        finalBody = JSON.stringify({ ...body, password: config.SECRET_PASSWORD });
    } else {
        finalBody.append('password', config.SECRET_PASSWORD);
    }

    const response = await fetch(`${config.MYSQL_API_URL}?action=${action}`, {
        method: 'POST',
        headers: headers,
        body: finalBody
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown API error' }));
        throw new Error(error.error || 'API request failed');
    }
    return response.json();
}

export function buildTmdbUrl(path, params = {}) {
    const baseUrl = `https://api.themoviedb.org/3${path}`;
    const url = new URL(baseUrl);
    url.searchParams.append('api_key', config.TMDB_API_KEY);
    const finalParams = { language: 'ru-RU', ...params };
    for (const key in finalParams) {
        url.searchParams.set(key, finalParams[key]);
    }
    return url.toString();
}

export async function fetchProxiedApi(url, options = {}) {
    try {
        return await fetchViaProxy(url, options);
    } catch (e) {
        return null;
    }
}

export async function fetchKinopoiskApi(url, kpApiKeysManager) {
    const keyData = kpApiKeysManager.getKey();
    if (!keyData) {
        console.error("All Kinopoisk API keys are currently unavailable.");
        return null;
    }
    try {
        const response = await fetch(url, { headers: { 'X-API-KEY': keyData.key } });
        if (response.status === 402) {
            await kpApiKeysManager.disableKey(keyData.key);
            return fetchKinopoiskApi(url, kpApiKeysManager);
        }
        if (response.ok) return await response.json();
        if (response.status === 404) return null;
    } catch (error) {
        console.warn(`KP API request failed with key ${keyData.key.substring(0, 4)}...:`, error);
    }
    return null;
}

export async function getKinopoiskId(filmId, moviesDataCache, kpApiKeysManager) {
    const filmData = moviesDataCache[filmId];
    if (!filmData) return null;
    if (filmData.kinopoiskId) return filmData.kinopoiskId;

    const [mediaType, tmdbId] = filmId.split('-');
    let kinopoiskId = null;

    try {
        const externalIdsData = await fetchProxiedApi(buildTmdbUrl(`/${mediaType}/${tmdbId}/external_ids`));
        const imdbId = externalIdsData?.imdb_id;
        if (imdbId) {
            const kpSearchData = await fetchKinopoiskApi(`${config.KINOPOISK_BASE_URL}/v2.2/films?imdbId=${imdbId}`, kpApiKeysManager);
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
                const searchUrl = `${config.KINOPOISK_BASE_URL}/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(title)}`;
                const kpSearchByTitle = await fetchKinopoiskApi(searchUrl, kpApiKeysManager);

                if (kpSearchByTitle?.films && kpSearchByTitle.films.length > 0) {
                    let bestMatch = null;
                    if (year) {
                        bestMatch = kpSearchByTitle.films.find(item => item.year == year);
                    }
                    kinopoiskId = bestMatch?.filmId || kpSearchByTitle.films[0]?.filmId;
                }
            }
        } catch (e) {
            console.warn(`KP search by title failed for "${filmData.title || filmData.name}":`, e);
        }
    }

    if (kinopoiskId) {
        moviesDataCache[filmId].kinopoiskId = kinopoiskId;
        return kinopoiskId;
    }

    return null;
}

export async function getFullMovieData(filmId, moviesDataCache, kpApiKeysManager) {
    if (moviesDataCache[filmId]?.credits) return moviesDataCache[filmId];
    let [type, id] = filmId.split('-');
    const url = buildTmdbUrl(`/${type}/${id}`, { append_to_response: 'keywords,external_ids,images,credits', include_image_language: 'ru,null' });
    const data = await fetchProxiedApi(url);
    if (!data) return null;
    let hasPostCreditsScene = false;
    const keywordsList = data.keywords?.keywords || data.keywords?.results;
    if (keywordsList) {
        hasPostCreditsScene = keywordsList.some(kw => [179431, 203445].includes(kw.id));
    }
    const fullData = { ...moviesDataCache[filmId], ...data, media_type: type, postCreditsScene: hasPostCreditsScene };
    moviesDataCache[filmId] = fullData;

    await getKinopoiskId(filmId, moviesDataCache, kpApiKeysManager);
    return fullData;
}

export async function fetchEpisodeTitle(filmId, seasonNumber, episodeNumber, moviesDataCache, kpApiKeysManager) {
    const [type, id] = filmId.split('-');
    const tmdbEpisodeData = await fetchProxiedApi(buildTmdbUrl(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`));
    if (tmdbEpisodeData && utils.isValidTitle(tmdbEpisodeData.name)) {
        return tmdbEpisodeData.name;
    }
    const kinopoiskId = await getKinopoiskId(filmId, moviesDataCache, kpApiKeysManager);
    if (kinopoiskId) {
        const kpSeasonsData = await fetchKinopoiskApi(`${config.KINOPOISK_BASE_URL}/v2.2/films/${kinopoiskId}/seasons`, kpApiKeysManager);
        const kpSeason = kpSeasonsData?.items?.find(s => s.number == seasonNumber);
        const kpEpisode = kpSeason?.episodes?.find(ep => ep.episodeNumber == episodeNumber);
        const title = kpEpisode?.nameRu || kpEpisode?.nameEn;
        if (utils.isValidTitle(title)) return title;
    }
    return null;
}

export async function fetchExchangeRate() {
    try {
        const response = await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/rub.json');
        const data = await response.json();
        return data.rub;
    } catch (e) {
        console.error("Failed to fetch exchange rate:", e);
        return 90; // Fallback
    }
}

export async function getAnimeFillerInfo(animeTitle, animeFillerCache) {
    const slug = utils.slugify(animeTitle);
    if (animeFillerCache[slug]) return animeFillerCache[slug];
    try {
        const response = await fetch(`${config.CORS_PROXY_URL}${config.ANIME_FILLER_API_URL}${slug}`);
        if (!response.ok) return null;
        const data = await response.json();

        const fillerTitles = new Set();
        if (data.episodes) {
            data.episodes.forEach(ep => {
                if (ep['filler-type'] && ep['filler-type'].toLowerCase().includes('filler') && ep['episode-title']) {
                    fillerTitles.add(utils.normalizeTitle(ep['episode-title']));
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