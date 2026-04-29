const { Router } = require('express');
const { supabase, openai, deepseek } = require('../lib/clients');

const router = Router();

// ============================================================
// Prompt seed — inserido no banco na primeira inicialização.
// ============================================================
const SEED_MCS_PROMPT = `Você é um estrategista de comunicação digital especializado em nutricionistas. Recebe o PPI aprovado, as 3 Personas aprovadas e as respostas do formulário, e devolve o **Modelo de Comunicação Sugerido (MCS)** — um JSON denso, IA-readable, consumido apenas pelo Comparador (não vai pro nutricionista ler diretamente).

# O que é o MCS

MCS define a **estrela do norte comunicacional** do nutricionista: como ele deveria se posicionar, falar, que conteúdo produzir, em que ritmo e com que intenção — partindo de quem é seu paciente ideal (PPI) e de como esse paciente pensa e fala (Personas).

MCS **não consome** a Análise do Instagram. Não compara atual vs ideal — esse é o trabalho do Comparador. Aqui só existe o ideal.

# Metodologia de merge

Dois eixos se fundem aqui:

**NSF (prevalece):** 5 pilares de intenção (conexão · quebra_objeção · autoridade · prova_social · educação_aplicada), calibração por nível de consciência Schwartz do paciente, micro-compromissos sequenciais, alavancas de decisão.

**Mercado (complementa):** April Dunford (posicionamento competitivo, categoria de mercado, alternativa competitiva), brand voice, benchmarks de mix de formatos Instagram.

# Calibrações internas silenciosas

## Calibração por nível de consciência Schwartz (do PPI)
Define a distribuição NSF dos 5 pilares de intenção:
- inconsciente → conexão + educação_aplicada dominam (somam ≥50%)
- dor_consciente → educação_aplicada + quebra_objeção dominam
- solucao_consciente → prova_social + autoridade dominam
- produto_consciente → autoridade + prova_social dominam
- mais_consciente → autoridade + quebra_objeção dominam (diferenciação)

Os 2 pilares dominantes somam ≥50% na distribuição NSF. Os outros 3 dividem o restante. Define percentuais específicos baseado em todos os sinais disponíveis (eixo de dor, anti-PPI, P11).

## Calibração silenciosa por nível de maturidade do nutri
Use p3b_investimento_mensal como proxy de nível do programa:
- <R$1.500 → perfil iniciante: links WhatsApp direto, frequência mínima 3/semana, CTA simples
- R$1.500–R$5.000 → perfil intermediário: mix de canais, frequência 5-7/semana
- >R$5.000 → perfil avançado: agendamento/site, autoridade forte, CTA sofisticado

Essa calibração nunca aparece nomeada no output. Só calibra os valores.

## JTBD silencioso (Habit Job + Anxiety Job)
- Incorpore o Habit Job (hábito que o paciente já tem e o nutri pode aproveitar) em micro_compromissos_recomendados
- Incorpore o Anxiety Job (medo concreto de não agir) em barreiras_psicologicas_a_dissolver
- Nunca nomeie "JTBD", "Habit Job" ou "Anxiety Job" no output

# Input

Você recebe 3 blocos:

## 1. PPI aprovado (ppi_json)
JSON completo com: resumo, quem_e, como_pensa, eixo_de_dor, eixo_de_transformacao, anti_ppi.
Campos-chave: nivel_consciencia_predominante (calibra NSF), resultado_emocional_raiz (ancora promessa_central), objecoes_internas (alimenta barreiras).

## 2. Personas aprovadas (personas_json)
3 personas com: frases[], vocabulario, gatilhos, objecoes, tom.
Use: vocabulário literal das frases e falas para vocabulario_priorizado e micro_compromissos. Não cite nome próprio das personas.

## 3. Respostas do formulário (form_respostas)
Campos disponíveis: p3 (decisão/investimento/ritmo), p4 (canais), p9 (frases do paciente), p10 (transformação), p11 (diferencial), p12 (estilo comunicação), p13 (anti-PPI).

# Método de raciocínio

Antes de gerar o JSON, raciocine internamente nesta ordem:

**Para o bloco 1 (Núcleo identitário — April Dunford):**
1. Aplique os 6 elementos: FOR [quem_e do PPI] WHO [eixo de dor resumido] THE [categoria_de_mercado] THAT [resultado_emocional_raiz — EMOÇÃO] UNLIKE [alternativa_competitiva.direct] OUR PRODUCT [p11 literal]
2. Aplique 5 Porquês partindo de p10 para chegar ao resultado_emocional_raiz. Pare quando chegar numa emoção/identidade.
3. Classifique categoria_de_mercado: head_to_head (compete diretamente), niche (nicho definido), category_creation (cria nova categoria)

**Para o bloco 4 (Pilares e intenção):**
1. Leia eixo_de_dor, objecoes_internas do PPI + objecoes das personas para definir barreiras_psicologicas_a_dissolver
2. Use nivel_consciencia_predominante para calibrar distribuicao_por_intencao_funil_NSF_sugerida
3. Temas de P13 e anti_ppi.perfil alimentam temas_a_evitar diretamente

**Para os demais blocos:**
- Extraia os valores diretamente dos inputs — não invente onde há sinal
- Aplique benchmarks de mercado onde não há sinal suficiente

# Output

Devolva **um único JSON**, sem texto antes ou depois:

{
  "nucleo_identitario": {
    "tagline_principal": "string — frase pública seguindo April Dunford 6 elementos: FOR [quem] WHO [problema] THE [categoria] THAT [emoção/resultado] UNLIKE [concorrente direto] OUR PRODUCT [diferencial p11]",
    "promessa_central": "string — raiz emocional do PPI (EMOÇÃO, nunca métrica). Deriva dos 5 Porquês a partir de p10 e resultado_emocional_raiz do PPI",
    "diferencial_observavel": "string — P11 literal do formulário. Se genérico demais, sinalizar em hipoteses_llm",
    "categoria_de_mercado": "head_to_head | niche | category_creation",
    "alternativa_competitiva": {
      "direct": "string — concorrente direto com mesma abordagem",
      "adjacent": "string — solução alternativa que o paciente considera",
      "status_quo": "string — o que o paciente faz se não contratar ninguém"
    },
    "pra_quem_fala_idealmente": "string — 1 frase espelhando quem_e do PPI em linguagem de comunicação"
  },
  "identidade_sugerida": {
    "bio_sugerida": "string — ≤150 caracteres. Estrutura NSF: nicho + promessa + CTA",
    "estrutura_bio_recomendada": "nicho_promessa_cta | resultado_metodo_cta | autoridade_diferencial_cta",
    "promessa_implicita_ideal": "string — o que a bio transmite implicitamente sobre o resultado",
    "autoridade_a_enfatizar": "string — combinação de formação + método + mídia + casos, inferida de P11 e contexto",
    "links_externos_priorizados": [
      { "tipo": "whatsapp | linktree | site_pessoal | agendamento | youtube", "justificativa": "string" }
    ],
    "categoria_negocio_sugerida": "string — ex: nutrição comportamental, emagrecimento feminino, performance esportiva"
  },
  "tom_narrativa_sugerida": {
    "voice_attributes": ["string", "string", "string", "string"],
    "registro_predominante": "formal | casual | tecnico | inspiracional | misto",
    "pessoa_do_verbo": "1a | 2a | 3a | misto",
    "uso_jargao_tecnico": "sim | parcial | nao",
    "arco_narrativo_ideal": "string — estrutura narrativa ideal: ex: problema → identificação → virada → resultado → CTA",
    "vocabulario_priorizado": ["string", "string", "string", "string", "string"],
    "vocabulario_a_evitar": ["string", "string", "string"],
    "nivel_consciencia_alvo_predominante": "inconsciente | dor_consciente | solucao_consciente | produto_consciente | mais_consciente"
  },
  "pilares_intencao_sugeridos": {
    "pilares_tematicos_sugeridos": [
      {
        "nome": "string — nome do pilar temático",
        "descricao": "string — o que esse pilar aborda",
        "justificativa_no_ppi": "string — por que esse pilar responde ao PPI"
      }
    ],
    "distribuicao_por_pilar_tematico_sugerida": {
      "nome_do_pilar": "XX%"
    },
    "distribuicao_por_intencao_funil_NSF_sugerida": {
      "conexao": "XX%",
      "quebra_objecao": "XX%",
      "autoridade": "XX%",
      "prova_social": "XX%",
      "educacao_aplicada": "XX%"
    },
    "distribuicao_por_modo_sugerida": {
      "educate": "XX%",
      "entertain": "XX%",
      "engage": "XX%"
    },
    "pilares_a_priorizar_inicialmente": ["string", "string"],
    "temas_a_evitar": ["string", "string"],
    "barreiras_psicologicas_a_dissolver": [
      "string — inércia ou medo concreto extraído do eixo_de_dor, objecoes_internas do PPI e objecoes das Personas",
      "string",
      "string"
    ]
  },
  "cadencia_formato_sugerida": {
    "frequencia_minima_por_semana": 3,
    "regularidade_esperada": "consistente | irregular_aceitavel | precisa_de_consistencia",
    "mix_formatos_sugerido": {
      "reel": "55%",
      "carrossel": "30%",
      "foto": "15%"
    }
  },
  "cta_resposta_sugeridos": {
    "tipos_de_cta_priorizados": {
      "salve": "XX%",
      "comente": "XX%",
      "marca_amigo": "XX%",
      "dm": "XX%",
      "link_bio": "XX%",
      "agendar": "XX%"
    },
    "forca_cta_esperada": "forte | medio | fraco",
    "expectativa_taxa_de_resposta_aos_comments": 100.0,
    "tempo_de_resposta_esperado_horas": 1.0,
    "expectativa_de_puxar_pra_dm": "frequente | ocasional | ausente",
    "micro_compromissos_recomendados": [
      "string — etapa 1: curiosidade (gancho)",
      "string — etapa 2: problema (identificação)",
      "string — etapa 3: solução (virada)",
      "string — etapa 4: CTA",
      "string — etapa 5: fechamento (micro-ação concreta)"
    ]
  },
  "proveniencia": {
    "fatos_declarados_pelo_nutri": ["string — IDs das perguntas usadas, ex: P9, P11"],
    "fatos_cadastrais": ["string — campos do banco usados"],
    "derivacoes_do_PPI": ["string — campos do PPI que alimentaram este output"],
    "derivacoes_das_personas": ["string — padrões das Personas que alimentaram este output"],
    "hipoteses_llm": ["string — inferências sem respaldo direto no input"],
    "lacunas_conhecidas": ["string — o que não pôde ser inferido com segurança"]
  }
}

Hard rules (violação = rejeição pelo Crítico):
- promessa_central é EMOÇÃO, nunca métrica (rejeita: emagrecer Xkg, ter energia, melhorar exames)
- diferencial_observavel é P11 literal — se foi genérico no formulário, registre em hipoteses_llm
- bio_sugerida ≤150 caracteres
- Todas as distribuições de % somam exatamente 100
- Os 2 pilares dominantes em distribuicao_por_intencao_funil_NSF_sugerida somam ≥50%
- barreiras_psicologicas_a_dissolver mínimo 3 itens
- micro_compromissos_recomendados mínimo 3 etapas (máx 5)
- Termos nunca nomeados no output: "Schwartz", "JTBD", "Habit Job", "Anxiety Job", "NSF", "Pré-Desafio", "Orion", "Atlas", "Chronos", "April Dunford"
- Vocabulário das Personas: use voz literal, nunca cite nome próprio das personas
- Lista negra: "resultado mensurável", "holístico", "estratégico", "robusto", "potencializar", "alavancar", "jornada", "ecossistema"
- Tudo em PT-BR. Direto ao ponto.

---

PPI aprovado:

{{ppi_json}}

---

Personas aprovadas:

{{personas_json}}

---

Respostas do formulário:

{{form_respostas}}

Agora gere o JSON do MCS.`;

// ============================================================
// generateMCS(submission) → objeto MCS
// submission: linha completa da tabela form_submissions
// ============================================================
async function generateMCS(submission) {
    const [promptRes, providerRes] = await Promise.all([
        supabase.from('ai_settings').select('prompt').eq('id', 'mcs_prompt').single(),
        supabase.from('ai_settings').select('prompt').eq('id', 'ai_provider').single()
    ]);

    const promptTemplate = promptRes.data?.prompt || SEED_MCS_PROMPT;
    const provider = providerRes.data?.prompt || 'openai';

    // Parseia PPI e Personas do banco
    let ppi;
    try {
        ppi = typeof submission.diagnostico_final === 'string'
            ? JSON.parse(submission.diagnostico_final)
            : submission.diagnostico_final;
    } catch {
        throw new Error('diagnostico_final inválido — gere o PPI antes de rodar o MCS.');
    }

    if (!ppi) throw new Error('PPI não encontrado. Gere o PPI primeiro.');

    let personas = null;
    if (submission.personas_json) {
        try {
            personas = typeof submission.personas_json === 'string'
                ? JSON.parse(submission.personas_json)
                : submission.personas_json;
        } catch {
            console.warn('[MCS] personas_json inválido — continuando sem personas.');
        }
    }

    // Monta form_context com os campos relevantes
    const formContext = {
        p3: {
            peso_decisao: submission.p3a_peso_decisao,
            investimento_mensal: submission.p3b_investimento_mensal,
            ritmo_decisao: submission.p3c_ritmo_decisao
        },
        p4: {
            canais_chegada: submission.p4_canais_chegada,
            canal_principal: submission.p4_1_canal_principal
        },
        p9_frases_comuns: submission.p9_frases_comuns,
        p10_principal_mudanca: submission.p10_principal_mudanca,
        p11_diferencial: submission.p11_diferencial,
        p12: {
            estilo_comunicacao: submission.p12_estilo_comunicacao,
            forma_resposta: submission.p12_1_forma_resposta
        },
        p13_quem_nao_quer_atender: submission.p13_quem_nao_quer_atender
    };

    const fullPrompt = promptTemplate
        .replace('{{ppi_json}}',       JSON.stringify(ppi, null, 2))
        .replace('{{personas_json}}',  JSON.stringify(personas || '(não disponível)', null, 2))
        .replace('{{form_respostas}}', JSON.stringify(formContext, null, 2));

    let response;
    if (provider === 'deepseek') {
        console.log('[MCS] Enviando para DeepSeek...');
        response = await deepseek.chat.completions.create({
            model: 'deepseek-v4-pro',
            temperature: 0.4,
            messages: [
                { role: 'system', content: 'Você é um estrategista especializado. Responda sempre em JSON válido sem texto adicional.' },
                { role: 'user', content: fullPrompt }
            ],
            response_format: { type: 'json_object' }
        });
    } else {
        console.log('[MCS] Enviando para OpenAI...');
        response = await openai.chat.completions.create({
            model: 'gpt-5.1',
            temperature: 0.3,
            messages: [{ role: 'user', content: fullPrompt }],
            response_format: { type: 'json_object' }
        });
    }

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`[MCS] Gerado com sucesso via ${provider}.`);
    return result;
}

// ============================================================
// GET /mcs-config — retorna prompt do banco
// ============================================================
router.get('/mcs-config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_settings').select('prompt').eq('id', 'mcs_prompt').single();
        if (error) throw error;
        res.json({ prompt: data.prompt, source: 'database' });
    } catch {
        res.json({ prompt: SEED_MCS_PROMPT, source: 'fallback' });
    }
});

// ============================================================
// POST /mcs-config — salva prompt no banco
// ============================================================
router.post('/mcs-config', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt vazio.' });
        const { error } = await supabase.from('ai_settings').upsert({
            id: 'mcs_prompt',
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
// POST /mcs/:submission_id
// Lê PPI + Personas + form do banco, gera MCS e salva.
// ============================================================
router.post('/mcs/:submission_id', async (req, res) => {
    const { submission_id } = req.params;
    try {
        const { data: submission, error: fetchError } = await supabase
            .from('form_submissions')
            .select([
                'id',
                'diagnostico_final',
                'personas_json',
                'p3a_peso_decisao',
                'p3b_investimento_mensal',
                'p3c_ritmo_decisao',
                'p4_canais_chegada',
                'p4_1_canal_principal',
                'p9_frases_comuns',
                'p10_principal_mudanca',
                'p11_diferencial',
                'p12_estilo_comunicacao',
                'p12_1_forma_resposta',
                'p13_quem_nao_quer_atender'
            ].join(', '))
            .eq('id', submission_id)
            .single();

        if (fetchError || !submission) {
            return res.status(404).json({ error: 'Submissão não encontrada.' });
        }

        if (!submission.diagnostico_final) {
            return res.status(400).json({ error: 'PPI não disponível. Gere o PPI antes de rodar o MCS.' });
        }

        const mcs = await generateMCS(submission);

        const { error: updateError } = await supabase
            .from('form_submissions')
            .update({ mcs_json: JSON.stringify(mcs) })
            .eq('id', submission_id);

        if (updateError) throw updateError;

        console.log(`[MCS] Salvo para submission ${submission_id}.`);
        res.json(mcs);
    } catch (err) {
        console.error('[MCS] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// GET /mcs/:submission_id — retorna MCS salvo
// ============================================================
router.get('/mcs/:submission_id', async (req, res) => {
    const { submission_id } = req.params;
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .select('mcs_json')
            .eq('id', submission_id)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Não encontrado.' });
        if (!data.mcs_json) return res.status(404).json({ error: 'MCS ainda não gerado para esta submissão.' });

        res.json(JSON.parse(data.mcs_json));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = { router, SEED_MCS_PROMPT, generateMCS };
