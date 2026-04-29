// ============================================================
// instagram-metrics.js
// Helpers determinísticos — separam fato calculado (aritmética)
// de inferência (LLM). Rodam ANTES do prompt do Analisador.
// ============================================================

const INSTAGRAM_ER_BENCHMARK = 1.22; // média de mercado
const GAP_THRESHOLD_DAYS     = 5;
const WINDOW_DAYS            = 90;
const TOP_N_DEFAULT          = 3;

// ============================================================
// calculate_metrics
// ============================================================

function likesOf(p) { return Math.max(p.likesCount || 0, 0); }
function commentsOf(p) { return Math.max(p.commentsCount || 0, 0); }

/**
 * ER público: (likes + comments) / followers × 100
 * Referência macro — compara conta com benchmark de mercado.
 */
function engagementRatePublico(pecas, followersCount) {
    if (!followersCount || followersCount === 0 || pecas.length === 0) return null;
    const likes    = pecas.reduce((s, p) => s + likesOf(p), 0);
    const comments = pecas.reduce((s, p) => s + commentsOf(p), 0);
    return ((likes + comments) / followersCount) * 100;
}

/**
 * ER por view: média de (likes + comments) / plays × 100 por reel.
 * Mais preciso para contas com muitos seguidores inativos.
 */
function engagementRateViewBased(reels) {
    const valid = reels.filter(r => r.videoPlayCount > 0);
    if (valid.length === 0) return null;
    const rates = valid.map(r =>
        (likesOf(r) + commentsOf(r)) / r.videoPlayCount * 100
    );
    return rates.reduce((s, r) => s + r, 0) / rates.length;
}

/**
 * Top N reels por engajamento (likes + comments).
 */
function topNReels(reels, n = TOP_N_DEFAULT) {
    return [...reels]
        .sort((a, b) =>
            (likesOf(b) + commentsOf(b)) -
            (likesOf(a) + commentsOf(a))
        )
        .slice(0, n)
        .map(r => ({
            caption_resumo: (r.caption || '').slice(0, 120),
            likes: likesOf(r),
            comments: commentsOf(r),
            plays: r.videoPlayCount || 0,
            timestamp: r.timestamp || null,
            uses_original_audio: r.musicInfo?.uses_original_audio ?? null
        }));
}

/**
 * Bottom N reels por engajamento — conteúdo que menos ressoou.
 */
function bottomNReels(reels, n = TOP_N_DEFAULT) {
    return [...reels]
        .sort((a, b) =>
            (likesOf(a) + commentsOf(a)) -
            (likesOf(b) + commentsOf(b))
        )
        .slice(0, n)
        .map(r => ({
            caption_resumo: (r.caption || '').slice(0, 120),
            likes: likesOf(r),
            comments: commentsOf(r),
            plays: r.videoPlayCount || 0,
            timestamp: r.timestamp || null
        }));
}

/**
 * Formato com maior ER médio entre os disponíveis.
 */
function formatoMaisEngajado(pecas) {
    const grupos = {};
    for (const p of pecas) {
        const tipo = p.productType || p.type || 'desconhecido';
        if (!grupos[tipo]) grupos[tipo] = [];
        grupos[tipo].push(p);
    }
    let melhor = null, melhorER = -1;
    for (const [tipo, items] of Object.entries(grupos)) {
        const erMedio = items.reduce((s, p) => {
            const plays = p.videoPlayCount || 1;
            return s + (likesOf(p) + commentsOf(p)) / plays * 100;
        }, 0) / items.length;
        if (erMedio > melhorER) { melhorER = erMedio; melhor = tipo; }
    }
    return { formato: melhor, er_medio: melhorER !== -1 ? +melhorER.toFixed(4) : null };
}

/**
 * Excelente >6 / Bom 3-6 / Médio 1-3 / Ruim <1
 */
function classificarEngagement(er) {
    if (er === null || er === undefined) return 'insuficiente';
    if (er > 6) return 'excelente';
    if (er > 3) return 'bom';
    if (er > 1) return 'medio';
    return 'ruim';
}

// ============================================================
// calculate_cadence
// ============================================================

/**
 * Publicações por semana na janela de WINDOW_DAYS dias.
 */
function frequenciaMediaPorSemana(pecas, janela = WINDOW_DAYS) {
    const agora  = new Date();
    const inicio = new Date(agora.getTime() - janela * 24 * 60 * 60 * 1000);
    const naJanela = pecas.filter(p => p.timestamp && new Date(p.timestamp) >= inicio);
    return naJanela.length / (janela / 7);
}

/**
 * % de cada tipo (reel/carousel/foto/igtv) no total de peças.
 */
function mixFormatos(pecas) {
    const total = pecas.length;
    if (total === 0) return {};
    const contagem = {};
    for (const p of pecas) {
        const tipo = p.productType || p.type || 'desconhecido';
        contagem[tipo] = (contagem[tipo] || 0) + 1;
    }
    const mix = {};
    for (const [tipo, count] of Object.entries(contagem)) {
        mix[tipo] = `${((count / total) * 100).toFixed(1)}%`;
    }
    return mix;
}

/**
 * Períodos sem publicar acima de GAP_THRESHOLD_DAYS nos últimos WINDOW_DAYS.
 */
function gapsRecentes(pecas, threshold = GAP_THRESHOLD_DAYS, janela = WINDOW_DAYS) {
    const agora  = new Date();
    const inicio = new Date(agora.getTime() - janela * 24 * 60 * 60 * 1000);
    const naJanela = pecas
        .filter(p => p.timestamp && new Date(p.timestamp) >= inicio)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const gaps = [];
    for (let i = 1; i < naJanela.length; i++) {
        const diffDias = (new Date(naJanela[i].timestamp) - new Date(naJanela[i - 1].timestamp))
            / (1000 * 60 * 60 * 24);
        if (diffDias > threshold) {
            gaps.push({
                de:   naJanela[i - 1].timestamp,
                ate:  naJanela[i].timestamp,
                dias: Math.round(diffDias)
            });
        }
    }
    return gaps;
}

/**
 * Distribuição de publicações por dia da semana.
 */
function diasDaSemanaAtivos(pecas) {
    const nomes = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const contagem = Object.fromEntries(nomes.map(n => [n, 0]));
    for (const p of pecas) {
        if (p.timestamp) contagem[nomes[new Date(p.timestamp).getDay()]]++;
    }
    return contagem;
}

// ============================================================
// calculate_response
// ============================================================

/**
 * % de comentários que receberam resposta do dono da conta.
 */
function taxaRespostaNutri(reels, ownerUsername) {
    const handle = ownerUsername?.toLowerCase();
    let totalComments = 0, totalReplies = 0;
    for (const reel of reels) {
        for (const comment of (reel.latestComments || [])) {
            totalComments++;
            const temResposta = (comment.replies || []).some(
                r => r.ownerUsername?.toLowerCase() === handle
            );
            if (temResposta) totalReplies++;
        }
    }
    if (totalComments === 0) return null;
    return +((totalReplies / totalComments) * 100).toFixed(1);
}

/**
 * Tempo médio (em horas) entre comentário e resposta do dono.
 */
function tempoMedioRespostaHoras(reels, ownerUsername) {
    const handle = ownerUsername?.toLowerCase();
    const tempos = [];
    for (const reel of reels) {
        for (const comment of (reel.latestComments || [])) {
            const replies = (comment.replies || []).filter(
                r => r.ownerUsername?.toLowerCase() === handle
                    && r.timestamp && comment.timestamp
            );
            for (const reply of replies) {
                const diff = (new Date(reply.timestamp) - new Date(comment.timestamp))
                    / (1000 * 60 * 60);
                if (diff >= 0) tempos.push(diff);
            }
        }
    }
    if (tempos.length === 0) return null;
    return +(tempos.reduce((s, t) => s + t, 0) / tempos.length).toFixed(1);
}

// ============================================================
// calculate_audio
// ============================================================

/**
 * % de reels com áudio original (vs trending/music).
 */
function pctAudioOriginal(reels) {
    if (reels.length === 0) return null;
    const original = reels.filter(r => r.musicInfo?.uses_original_audio === true).length;
    return +((original / reels.length) * 100).toFixed(1);
}

// ============================================================
// calculateAll — entry point chamado pelo agente
// Retorna JSON de métricas pré-calculadas injetado no prompt LLM.
// ============================================================
function calculateAll(scrapedData) {
    const { profile, reels = [], username } = scrapedData;
    const followersCount = profile?.followersCount || 0;

    const erPublico   = engagementRatePublico(reels, followersCount);
    const erViewBased = engagementRateViewBased(reels);
    const pctOriginal = pctAudioOriginal(reels);

    return {
        constants_used: {
            ER_BENCHMARK_MERCADO: INSTAGRAM_ER_BENCHMARK,
            GAP_THRESHOLD_DAYS,
            WINDOW_DAYS,
            TOP_N_DEFAULT
        },
        metricas: {
            reels_analisados: reels.length,
            media_plays:    reels.length ? +((reels.reduce((s, r) => s + (r.videoPlayCount || 0), 0)) / reels.length).toFixed(0) : null,
            media_likes:    reels.length ? +((reels.reduce((s, r) => s + likesOf(r),    0)) / reels.length).toFixed(1) : null,
            media_comments: reels.length ? +((reels.reduce((s, r) => s + commentsOf(r), 0)) / reels.length).toFixed(1) : null,
            engagement_rate_publico:    erPublico   !== null ? +erPublico.toFixed(4)   : null,
            engagement_rate_view_based: erViewBased !== null ? +erViewBased.toFixed(4) : null,
            classificacao_er_publico: classificarEngagement(erPublico),
            classificacao_er_view:    classificarEngagement(erViewBased),
            vs_benchmark_mercado: erPublico !== null
                ? (erPublico > INSTAGRAM_ER_BENCHMARK ? 'acima' : 'abaixo')
                : 'insuficiente',
            top_reels_por_engajamento:    topNReels(reels),
            bottom_reels_por_engajamento: bottomNReels(reels),
            formato_mais_engajado: formatoMaisEngajado(reels)
        },
        cadencia: {
            frequencia_media_por_semana: +frequenciaMediaPorSemana(reels).toFixed(2),
            mix_formatos:         mixFormatos(reels),
            gaps_recentes:        gapsRecentes(reels),
            dias_da_semana_ativos: diasDaSemanaAtivos(reels)
        },
        resposta: {
            taxa_resposta_nutri_pct:     taxaRespostaNutri(reels, username),
            tempo_medio_resposta_horas:  tempoMedioRespostaHoras(reels, username)
        },
        audio: {
            pct_audio_original: pctOriginal,
            pct_audio_trend:    pctOriginal !== null ? +(100 - pctOriginal).toFixed(1) : null
        }
    };
}

module.exports = {
    calculateAll,
    // Exporta individualmente para testes unitários
    engagementRatePublico,
    engagementRateViewBased,
    topNReels,
    bottomNReels,
    formatoMaisEngajado,
    classificarEngagement,
    frequenciaMediaPorSemana,
    mixFormatos,
    gapsRecentes,
    diasDaSemanaAtivos,
    taxaRespostaNutri,
    tempoMedioRespostaHoras,
    pctAudioOriginal,
    INSTAGRAM_ER_BENCHMARK,
    GAP_THRESHOLD_DAYS,
    WINDOW_DAYS,
    TOP_N_DEFAULT
};
