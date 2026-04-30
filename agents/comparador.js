const { Router } = require('express');
const { supabase, openai, deepseek, callDeepSeekR1 } = require('../lib/clients');

const router = Router();

// ============================================================
// Prompt seed
// ============================================================
const SEED_COMPARADOR_PROMPT = `Você é o Comparador da Bússola do Perfil. Recebe dois inputs:
1. MCS (Modelo de Comunicação Sugerido) — o ideal de como o nutricionista deveria se comunicar
2. Análise do Instagram — como ele realmente se comunica hoje

Seu trabalho: cruzar os dois e gerar um diagnóstico estruturado JSON para a Bússola do Perfil.

# Inputs

## 1. MCS (ideal)
{{mcs_json}}

## 2. Análise do Instagram (atual)
{{analise_json}}

# Como classificar cada dimensão

- **destaque** — atual está acima do ideal ou é um ponto de força real
- **alinhado** — gap pequeno (≤20 pontos de distância no eixo principal); não precisa de ação urgente
- **parcial** — gap médio (20–50); vale ajustar nas próximas semanas
- **critico** — gap grande (>50) ou ausência total de um elemento essencial; ação urgente

# Dimensões

## 01 — Promessa & Diferencial
Compare: MCS.nucleo_identitario (tagline, promessa_central, diferencial_observavel) vs analise.identidade.posicionamento_atual.
Pergunta: o posicionamento atual comunica pro público certo com a promessa certa?

## 02 — Bio & Links
Compare: MCS.identidade_sugerida (bio_sugerida, links_externos_priorizados, autoridade_a_enfatizar) vs analise.identidade (bio inferida dos dados disponíveis, links_bio).
Gere 3–4 scorecards (A/B/C) avaliando: foto de perfil implícita, estrutura bio, links, destaques.

## 03 — Pilares & Intenção de Conteúdo
Compare: MCS.pilares_intencao_sugeridos.distribuicao_por_intencao_funil_NSF_sugerida vs conteúdo real do Instagram.
ESTIMATIVA: A partir dos temas_recorrentes e comunicacao da analise, estime a distribuição real entre os 5 pilares NSF. Documente metodologia em nota_metodologica.
Os 5 pilares: conexao, quebra_objecao, autoridade, prova_social, educacao_aplicada. Soma = 100 em ambas.

## 04 — Audiência Real vs PPI Alvo
Compare: PPI embutido no MCS (nucleo_identitario.pra_quem_fala_idealmente) vs analise.audiencia (perfil_comentadores, perguntas_frequentes).
Análise qualitativa do match — sem inventar percentuais de faixa etária.

## 05 — Cadência e Formato
Compare: MCS.cadencia_formato_sugerida vs analise.performance (frequencia_semanal, mix_formatos, dias_mais_ativos).
Os campos dias_ativos devem somar ao total de posts: distribua proporcionalmente se necessário.

## 06 — CTA & Resposta
Compare: MCS.cta_resposta_sugeridos vs analise.comunicacao.ctas_recorrentes + analise.performance.taxa_resposta_nutri_pct.
ESTIMATIVA: Estime % dos posts sem CTA e por tipo. Documente em nota_metodologica.
ctas_atuais_estimados + ctas_ideais somam 100 cada.

## 07 — Tom & Narrativa
Compare: MCS.tom_narrativa_sugerida (voice_attributes, registro, pessoa_do_verbo, uso_jargao_tecnico) vs analise.comunicacao (estilo_predominante, vocabulario_recorrente).
Gere 3–4 scorecards avaliando os sub-atributos.

## 08 — O que funciona e o que não funciona
Base: analise.performance.top_reels e bottom_reels. Identifique padrão nos top e anti-padrão nos bottom. Avalie como destaque se há dados, parcial se inconclusivo.

# Radar — 5 eixos sumários (escala 1–5)
Mapeamento dos eixos:
- Promessa → media das dim 01 + 02
- Conteúdo → dim 03
- Audiência → dim 04
- CTA → dim 06
- Identidade → dim 02 (isolado)

Escala: destaque=5, alinhado=4, parcial=2.5, critico=1.5

# Plano de ação
Agrupe as ações concretas dos campos sugestao de cada dimensão em 3 níveis:
- critico: ações das dim com status=critico
- medio: ações das dim com status=parcial
- polimento: ações das dim com status=alinhado ou destaque

# Output

Devolva **um único JSON**, sem texto antes ou depois:

{
  "gerado_em": "ISO datetime",
  "username": "string ou null",
  "instagram_disponivel": true,
  "resumo_executivo": {
    "score": {
      "criticos": number,
      "parciais": number,
      "alinhados": number,
      "destaques": number
    },
    "pontos_principais": ["string x 3-5 — insights mais importantes, diretos, sem floreio"],
    "radar_atual": [number, number, number, number, number],
    "pontuacao_global": number
  },
  "dimensao_01_promessa": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string — frase diagnóstica ativa, pode ter <em>palavra</em> em max 1 ponto crítico",
    "atual": "string — o que o perfil comunica hoje",
    "sugerido": "string — o que o MCS define como ideal",
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "dimensao_02_bio": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string",
    "scorecards": [
      { "letra": "A|B|C", "texto": "string" }
    ],
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "dimensao_03_pilares": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string",
    "distribuicao_atual": { "conexao": number, "quebra_objecao": number, "autoridade": number, "prova_social": number, "educacao_aplicada": number },
    "distribuicao_ideal": { "conexao": number, "quebra_objecao": number, "autoridade": number, "prova_social": number, "educacao_aplicada": number },
    "nota_metodologica": "string",
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "dimensao_04_audiencia": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string",
    "match_descricao": "string — análise qualitativa do match audiência real vs PPI ideal",
    "quote": "string ou null — frase real dos comentários",
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "dimensao_05_cadencia": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string",
    "frequencia_atual": number,
    "frequencia_ideal": number,
    "dias_ativos": { "domingo": number, "segunda": number, "terca": number, "quarta": number, "quinta": number, "sexta": number, "sabado": number },
    "mix_formatos_atual": { "reel": "string%", "carrossel": "string%", "foto": "string%" },
    "mix_formatos_ideal": { "reel": "string%", "carrossel": "string%", "foto": "string%" },
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "dimensao_06_cta": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string",
    "ctas_atuais_estimados": { "sem_cta": number, "salve": number, "comente": number, "dm": number, "link_bio": number, "agendar": number },
    "ctas_ideais": { "salve": number, "comente": number, "dm": number, "link_bio": number, "agendar": number },
    "taxa_resposta_atual": number,
    "taxa_resposta_ideal": 100,
    "nota_metodologica": "string",
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "dimensao_07_tom": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string",
    "scorecards": [
      { "letra": "A|B|C", "texto": "string" }
    ],
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "dimensao_08_performance": {
    "status": "critico|parcial|alinhado|destaque",
    "headline": "string",
    "top_reels_resumo": "string — padrão identificado nos top reels",
    "bottom_reels_resumo": "string — anti-padrão dos bottom reels",
    "sugestao": { "label": "string", "texto": "string", "exemplo": "string ou null" }
  },
  "plano_de_acao": {
    "critico": [{ "titulo": "string", "motivo": "string" }],
    "medio": [{ "titulo": "string", "motivo": "string" }],
    "polimento": [{ "titulo": "string", "motivo": "string" }]
  },
  "lacunas_conhecidas": ["string"]
}

Regras:
- score.criticos + score.parciais + score.alinhados + score.destaques = 8
- radar_atual tem exatamente 5 números entre 1 e 5
- Todas as distribuições de % somam 100
- Se instagram_disponivel = false, preencha dimensoes 3–8 com base apenas no MCS vs ausência de dados; status máximo = parcial nessas dimensões
- Tudo em PT-BR. Direto ao ponto.
- Lista negra: "resultado mensurável", "holístico", "estratégico", "alavancar", "potencializar", "robusto"`;

// ============================================================
// generateComparador(mcs, analise) → objeto bussola
// ============================================================
async function generateComparador(mcs, analise) {
    const [promptRes, providerRes] = await Promise.all([
        supabase.from('ai_settings').select('prompt').eq('id', 'comparador_prompt').single(),
        supabase.from('ai_settings').select('prompt').eq('id', 'ai_provider').single()
    ]);

    const promptTemplate = promptRes.data?.prompt || SEED_COMPARADOR_PROMPT;
    const provider = providerRes.data?.prompt || 'openai';

    const analiseParaPrompt = analise || { instagram_disponivel: false };

    const fullPrompt = promptTemplate
        .replace('{{mcs_json}}',    JSON.stringify(mcs, null, 2))
        .replace('{{analise_json}}', JSON.stringify(analiseParaPrompt, null, 2));

    let result;
    if (provider === 'deepseek-r1') {
        console.log('[Comparador] Enviando para DeepSeek R1 (thinking)...');
        result = await callDeepSeekR1([
            { role: 'system', content: 'Você é um analista especializado. Responda sempre em JSON válido sem texto adicional.' },
            { role: 'user', content: fullPrompt }
        ], 'Comparador');
    } else {
        let response;
        if (provider === 'deepseek') {
            console.log('[Comparador] Enviando para DeepSeek...');
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
            console.log('[Comparador] Enviando para OpenAI...');
            response = await openai.chat.completions.create({
                model: 'gpt-5.1',
                temperature: 0.3,
                messages: [{ role: 'user', content: fullPrompt }],
                response_format: { type: 'json_object' }
            });
        }
        result = JSON.parse(response.choices[0].message.content);
    }
    console.log(`[Comparador] Gerado com sucesso via ${provider}. Score: ${JSON.stringify(result.resumo_executivo?.score)}`);
    return result;
}

// ============================================================
// Orquestrador: garante MCS + AnaliseInstagram antes de comparar
// ============================================================
async function orchestrateBussola(submissionId) {
    // Carrega submissão completa
    const { data: submission, error } = await supabase
        .from('form_submissions')
        .select([
            'id', 'instagram',
            'diagnostico_final', 'personas_json',
            'mcs_json', 'analise_instagram_json', 'instagram_scrape_json',
            'p3a_peso_decisao', 'p3b_investimento_mensal', 'p3c_ritmo_decisao',
            'p4_canais_chegada', 'p4_1_canal_principal',
            'p9_frases_comuns', 'p10_principal_mudanca', 'p11_diferencial',
            'p12_estilo_comunicacao', 'p12_1_forma_resposta', 'p13_quem_nao_quer_atender'
        ].join(', '))
        .eq('id', submissionId)
        .single();

    if (error || !submission) throw new Error('Submissão não encontrada.');
    if (!submission.diagnostico_final) throw new Error('PPI não disponível. Gere o PPI primeiro.');

    // ── Importações lazy para evitar circular dependency ──
    const { generateMCS } = require('./mcs');
    const { generateAnaliseInstagram } = require('./analise-instagram');
    const { scrapeAndSave } = require('./instagram');

    // ── Passo 1: Garantir MCS ──
    let mcs;
    if (submission.mcs_json) {
        console.log('[Bússola] MCS já existe no banco.');
        mcs = JSON.parse(submission.mcs_json);
    } else {
        console.log('[Bússola] Gerando MCS...');
        mcs = await generateMCS(submission);
        await supabase.from('form_submissions')
            .update({ mcs_json: JSON.stringify(mcs) })
            .eq('id', submissionId);
    }

    // ── Passo 2: Garantir Análise do Instagram ──
    let analise = null;
    if (submission.analise_instagram_json) {
        console.log('[Bússola] Análise do Instagram já existe no banco.');
        analise = JSON.parse(submission.analise_instagram_json);
    } else if (submission.instagram_scrape_json) {
        console.log('[Bússola] Gerando análise do Instagram (scraping já feito)...');
        const scrapedData = JSON.parse(submission.instagram_scrape_json);
        analise = await generateAnaliseInstagram(scrapedData);
        await supabase.from('form_submissions')
            .update({ analise_instagram_json: JSON.stringify(analise) })
            .eq('id', submissionId);
    } else if (submission.instagram) {
        console.log('[Bússola] Scraping + análise do Instagram...');
        try {
            await scrapeAndSave(submissionId, submission.instagram);
            // Recarrega o scrape recém-salvo
            const { data: refreshed } = await supabase
                .from('form_submissions')
                .select('instagram_scrape_json')
                .eq('id', submissionId)
                .single();
            if (refreshed?.instagram_scrape_json) {
                const scrapedData = JSON.parse(refreshed.instagram_scrape_json);
                analise = await generateAnaliseInstagram(scrapedData);
                await supabase.from('form_submissions')
                    .update({ analise_instagram_json: JSON.stringify(analise) })
                    .eq('id', submissionId);
            }
        } catch (e) {
            console.warn('[Bússola] Scraping falhou, bússola seguirá sem Instagram:', e.message);
        }
    } else {
        console.log('[Bússola] Sem handle Instagram — bússola sem análise do perfil.');
    }

    // ── Passo 3: Gerar Comparador ──
    console.log('[Bússola] Gerando Comparador...');
    const bussola = await generateComparador(mcs, analise);

    // Adiciona metadados
    bussola.gerado_em = bussola.gerado_em || new Date().toISOString();
    bussola.username = analise?.username || null;
    bussola.instagram_disponivel = analise !== null;

    // ── Passo 4: Salvar ──
    await supabase.from('form_submissions')
        .update({ bussola_json: JSON.stringify(bussola) })
        .eq('id', submissionId);

    console.log(`[Bússola] Salva para submission ${submissionId}.`);
    return bussola;
}

// ============================================================
// GET /comparador-config
// ============================================================
router.get('/comparador-config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_settings').select('prompt').eq('id', 'comparador_prompt').single();
        if (error) throw error;
        res.json({ prompt: data.prompt, source: 'database' });
    } catch {
        res.json({ prompt: SEED_COMPARADOR_PROMPT, source: 'fallback' });
    }
});

// ============================================================
// POST /comparador-config
// ============================================================
router.post('/comparador-config', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt vazio.' });
        const { error } = await supabase.from('ai_settings').upsert({
            id: 'comparador_prompt',
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
// POST /bussola/:submission_id
// Orquestra MCS + scraping + análise + comparador e salva.
// ============================================================
router.post('/bussola/:submission_id', async (req, res) => {
    const { submission_id } = req.params;
    try {
        const bussola = await orchestrateBussola(submission_id);
        res.json(bussola);
    } catch (err) {
        console.error('[Bússola] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// GET /bussola/:submission_id — retorna bussola salva
// ============================================================
router.get('/bussola/:submission_id', async (req, res) => {
    const { submission_id } = req.params;
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .select('bussola_json')
            .eq('id', submission_id)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Não encontrado.' });
        if (!data.bussola_json) return res.status(404).json({ error: 'Bússola ainda não gerada.' });

        res.json(JSON.parse(data.bussola_json));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = { router, SEED_COMPARADOR_PROMPT };
