const { Router } = require('express');
const { supabase, openai, deepseek } = require('../lib/clients');
const { calculateAll } = require('../lib/instagram-metrics');

const router = Router();

// ============================================================
// Prompt seed — inserido no banco na primeira inicialização.
// ============================================================
const SEED_ANALISE_INSTAGRAM_PROMPT = `Você é um analista estratégico de Instagram para nutricionistas. Recebe o resultado bruto de scraping (perfil + reels) e devolve uma análise estruturada em JSON.

# O que você analisa

## Identidade do perfil
- Posicionamento atual (o que o nutri comunica sobre si)
- Nível de profissionalização da conta (isBusinessAccount, businessCategoryName, bio, externalUrls)
- Maturidade digital (followers, posts, frequência de publicação inferida)
- Múltiplos links na bio e para onde apontam (ofertas, agendamento, site)

## Conteúdo e temas
- Temas recorrentes extraídos das captions dos reels
- Formatos predominantes (áudio original vs trending, solo vs collab)
- Padrões de hashtag (nicho, alcance, posicionamento)
- Menções e parcerias recorrentes (taggedUsers[], mentions[])
- Posts fixados (isPinned) — o que o nutri escolheu destacar

## Performance e engajamento
- Top 3 reels por videoPlayCount
- Top 3 reels por likesCount
- Média de plays, likes, comments nos últimos 30 reels
- Taxa de engajamento estimada: (likes + comments) / plays × 100
- Padrão de reels com áudio original vs músicas em trend

## Audiência (via comentários)
- Sentimento predominante dos comentários (positivo, neutro, negativo)
- Perguntas frequentes nos comentários — sinal de interesse do público
- Perfil dos comentadores verificados (is_verified)
- Temas que geram mais interação

## Tom e comunicação
- Estilo de linguagem das captions (educativo, persuasivo, inspiracional, pessoal, vendedor)
- Vocabulário recorrente — palavras e expressões que o nutri usa com frequência
- Chamadas para ação (CTAs) recorrentes nas captions

## Lacunas conhecidas
- O que NÃO foi possível analisar (stories, estética visual, capas, destaques, DMs)
- Se o perfil é privado ou sem reels, registrar como limitação

# Input

Você recebe **dois blocos de contexto**:

## 1. Métricas pré-calculadas (metricas_pre_calculadas)
Calculadas deterministicamente em Node.js — aritmética exata. **Use esses números diretamente** no output; não recalcule.
Campos disponíveis: metricas (ER, médias, top/bottom reels, formato mais engajado), cadencia (frequência semanal, mix de formatos, gaps, dias ativos), resposta (taxa e tempo de resposta do nutri), audio (% original vs trend).

## 2. Dados brutos do scraping (scraped_data)
Perfil + reels condensados para análise qualitativa.

# Método

1. Leia o perfil completo. Identifique posicionamento, maturidade, links de oferta.
2. Leia todas as captions dos reels. Extraia temas recorrentes — agrupe por padrão, não liste um a um.
3. Use os números de metricas_pre_calculadas para a seção "performance" — não recalcule médias ou taxas.
4. Leia os comentários disponíveis. Identifique padrões de sentimento e perguntas frequentes.
5. Identifique o vocabulário e estilo recorrente nas captions.
6. Liste lacunas com honestidade — não suponha o que não está nos dados.

# Output

Devolva **um único JSON**, sem texto antes ou depois:

{
  "scraped_at": "string — ISO datetime do scraping",
  "username": "string",
  "identidade": {
    "posicionamento_atual": "string — 1-2 frases descrevendo como o nutri se posiciona",
    "tipo_conta": "pessoal | profissional | criador",
    "categoria": "string ou null",
    "maturidade_digital": "iniciante | em_crescimento | consolidado | autoridade",
    "seguidores": number,
    "posts_total": number,
    "links_bio": ["string — descrição curta de cada link"]
  },
  "conteudo": {
    "temas_recorrentes": ["string", "string", "string"],
    "formatos_predominantes": "string — 1-2 frases sobre uso de áudio original vs trend, solo vs collab",
    "hashtag_strategy": "string — nicho, alcance, padrão observado",
    "parcerias_recorrentes": ["string — @handle: descrição"],
    "posts_fixados": ["string — resumo do que está fixado, ou 'nenhum'"]
  },
  "performance": {
    "reels_analisados": "number — de metricas_pre_calculadas.metricas.reels_analisados",
    "media_plays": "number — de metricas_pre_calculadas.metricas.media_plays",
    "media_likes": "number — de metricas_pre_calculadas.metricas.media_likes",
    "media_comments": "number — de metricas_pre_calculadas.metricas.media_comments",
    "engagement_rate_publico": "number — de metricas_pre_calculadas.metricas.engagement_rate_publico",
    "engagement_rate_view_based": "number — de metricas_pre_calculadas.metricas.engagement_rate_view_based",
    "classificacao_er": "string — de metricas_pre_calculadas.metricas.classificacao_er_publico",
    "vs_benchmark_mercado": "string — de metricas_pre_calculadas.metricas.vs_benchmark_mercado",
    "top_reels": "array — de metricas_pre_calculadas.metricas.top_reels_por_engajamento",
    "bottom_reels": "array — de metricas_pre_calculadas.metricas.bottom_reels_por_engajamento",
    "frequencia_semanal": "number — de metricas_pre_calculadas.cadencia.frequencia_media_por_semana",
    "mix_formatos": "object — de metricas_pre_calculadas.cadencia.mix_formatos",
    "gaps_recentes": "array — de metricas_pre_calculadas.cadencia.gaps_recentes",
    "dias_mais_ativos": "array — 2-3 dias com mais publicações, de metricas_pre_calculadas.cadencia.dias_da_semana_ativos",
    "pct_audio_original": "number — de metricas_pre_calculadas.audio.pct_audio_original",
    "taxa_resposta_nutri_pct": "number ou null — de metricas_pre_calculadas.resposta.taxa_resposta_nutri_pct"
  },
  "audiencia": {
    "sentimento_predominante": "positivo | neutro | misto | insuficiente",
    "perguntas_frequentes": ["string"],
    "temas_que_geram_interacao": ["string"],
    "perfil_comentadores": "string — observação sobre quem comenta (peers, pacientes, outros profissionais)"
  },
  "comunicacao": {
    "estilo_predominante": "string — 2-3 adjetivos separados por ·",
    "vocabulario_recorrente": ["string", "string", "string", "string", "string"],
    "ctas_recorrentes": ["string"]
  },
  "lacunas_conhecidas": ["string"]
}

Regras:
- Para a seção "performance": copie os valores de metricas_pre_calculadas — não recalcule.
- Não invente métricas. Se não há dados suficientes, use null ou "insuficiente".
- Se o perfil é privado, preencha apenas identidade e lacunas.
- Tudo em PT-BR. Direto ao ponto.
- Lista negra: "resultado mensurável", "holístico", "estratégico", "robusto", "potencializar", "alavancar".

---

Métricas pré-calculadas:

{{metricas_pre_calculadas}}

---

Dados do scraping:

{{scraped_json}}

Agora gere o JSON da análise.`;

// ============================================================
// generateAnaliseInstagram(scrapedData) → objeto de análise
// ============================================================
async function generateAnaliseInstagram(scrapedData) {
    // 1. Pré-calcula métricas deterministicamente (sem LLM, sem tokens)
    const metricasPre = calculateAll(scrapedData);
    console.log(`[AnaliseInstagram] Pré-cálculo: ER público=${metricasPre.metricas.engagement_rate_publico}, classificação=${metricasPre.metricas.classificacao_er_publico}, reels=${metricasPre.metricas.reels_analisados}`);

    const [promptRes, providerRes] = await Promise.all([
        supabase.from('ai_settings').select('prompt').eq('id', 'analise_instagram_prompt').single(),
        supabase.from('ai_settings').select('prompt').eq('id', 'ai_provider').single()
    ]);

    const promptTemplate = promptRes.data?.prompt || SEED_ANALISE_INSTAGRAM_PROMPT;
    const provider = providerRes.data?.prompt || 'openai';

    // Condensa os reels para não estourar o contexto:
    // mantém campos relevantes, descarta URLs longas de imagem/vídeo
    const reelsCondensed = (scrapedData.reels || []).map(r => ({
        caption: r.caption,
        hashtags: r.hashtags,
        mentions: r.mentions,
        taggedUsers: (r.taggedUsers || []).map(u => u.username),
        musicInfo: r.musicInfo,
        likesCount: r.likesCount,
        commentsCount: r.commentsCount,
        videoPlayCount: r.videoPlayCount,
        videoViewCount: r.videoViewCount,
        isPinned: r.isPinned,
        timestamp: r.timestamp,
        latestComments: (r.latestComments || []).map(c => ({ text: c.text, is_verified: c.ownerIsVerified }))
    }));

    const condensed = {
        scraped_at: scrapedData.scraped_at,
        username: scrapedData.username,
        profile: scrapedData.profile,
        reels: reelsCondensed
    };

    const fullPrompt = promptTemplate
        .replace('{{metricas_pre_calculadas}}', JSON.stringify(metricasPre, null, 2))
        .replace('{{scraped_json}}', JSON.stringify(condensed, null, 2));

    let response;
    if (provider === 'deepseek') {
        console.log('[AnaliseInstagram] Enviando para DeepSeek...');
        response = await deepseek.chat.completions.create({
            model: 'deepseek-v4-pro',
            temperature: 0.3,
            messages: [
                { role: 'system', content: 'Você é um analista especializado. Responda sempre em JSON válido sem texto adicional.' },
                { role: 'user', content: fullPrompt }
            ],
            response_format: { type: 'json_object' }
        });
    } else {
        console.log('[AnaliseInstagram] Enviando para OpenAI...');
        response = await openai.chat.completions.create({
            model: 'gpt-5.1',
            temperature: 0.3,
            messages: [{ role: 'user', content: fullPrompt }],
            response_format: { type: 'json_object' }
        });
    }

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`[AnaliseInstagram] Gerada com sucesso via ${provider}.`);
    return result;
}

// ============================================================
// GET /analise-instagram-config
// ============================================================
router.get('/analise-instagram-config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_settings').select('prompt').eq('id', 'analise_instagram_prompt').single();
        if (error) throw error;
        res.json({ prompt: data.prompt, source: 'database' });
    } catch (e) {
        res.json({ prompt: SEED_ANALISE_INSTAGRAM_PROMPT, source: 'fallback' });
    }
});

// ============================================================
// POST /analise-instagram-config
// ============================================================
router.post('/analise-instagram-config', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt vazio.' });
        const { error } = await supabase.from('ai_settings').upsert({
            id: 'analise_instagram_prompt',
            prompt: prompt.trim(),
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
        res.json({ message: 'OK' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// POST /analise-instagram/:submission_id
// Lê instagram_scrape_json do banco, gera análise e salva.
// ============================================================
router.post('/analise-instagram/:submission_id', async (req, res) => {
    const { submission_id } = req.params;
    try {
        const { data: submission, error: fetchError } = await supabase
            .from('form_submissions')
            .select('id, instagram_scrape_json')
            .eq('id', submission_id)
            .single();

        if (fetchError || !submission) {
            return res.status(404).json({ error: 'Submissão não encontrada.' });
        }

        if (!submission.instagram_scrape_json) {
            return res.status(400).json({ error: 'Scraping de Instagram não disponível. Rode POST /scrape-instagram primeiro.' });
        }

        const scrapedData = JSON.parse(submission.instagram_scrape_json);
        const analise = await generateAnaliseInstagram(scrapedData);

        const { error: updateError } = await supabase
            .from('form_submissions')
            .update({ analise_instagram_json: JSON.stringify(analise) })
            .eq('id', submission_id);

        if (updateError) throw updateError;

        console.log(`[AnaliseInstagram] Análise salva para submission ${submission_id}.`);
        res.json({ analise });
    } catch (e) {
        console.error('[AnaliseInstagram] Erro:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// GET /analise-instagram/:submission_id
// Retorna análise já salva no banco.
// ============================================================
router.get('/analise-instagram/:submission_id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .select('analise_instagram_json')
            .eq('id', req.params.submission_id)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Não encontrado.' });

        const parsed = data.analise_instagram_json
            ? JSON.parse(data.analise_instagram_json)
            : null;

        res.json({ data: parsed });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = { router, SEED_ANALISE_INSTAGRAM_PROMPT, generateAnaliseInstagram };
