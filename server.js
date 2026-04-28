require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Prompt de emergência — usado APENAS se o banco estiver inacessível.
// A fonte de verdade é a tabela ai_settings (id = 'ppi_prompt').
const EMERGENCY_PROMPT = `Você é um gerador de Perfil de Paciente Ideal (PPI). Retorne um JSON com os campos: resumo, quem_e, como_pensa, eixo_de_dor, eixo_de_transformacao, anti_ppi. Form: {{form_respostas}}`;

// ============================================================
// BOOTSTRAP — sobe o prompt padrão no banco se ainda não existir
// ============================================================
const SEED_PROMPT = `Você é um gerador de **Perfil de Paciente Ideal (PPI)** descritivo. Recebe o formulário de 13 perguntas que um nutricionista respondeu sobre o paciente que ele atende e quer atender, e devolve um único PPI em JSON estruturado.

# 1. O que é PPI (e o que não é)

PPI é o **perfil-alvo único, descritivo**, do paciente que o nutri quer atender — demografia, psicografia, eixo de dor, eixo de transformação, anti-perfil. Os atributos que o PPI define são **compartilhados pelas 3 personas** que serão geradas depois — aqui mora o que é igual entre elas. PPI é **retrato do paciente**, não plano de ação do nutri.

Distinções que importam:
- **PPI ≠ Persona.** Persona é humanização contextual dentro do mesmo PPI (vocabulário, profissão específica, rotina, falas). Aqui não.
- **PPI ≠ Público-Alvo.** Público-Alvo é macro de mercado. PPI é o paciente concreto que o nutri quer atender.
- **PPI ≠ paciente atual.** O paciente que o nutri atende hoje (P1) é insumo, não destino. Se P2 = "Não", o PPI é o de P2.1 (aspiracional), não o de P1 — use P1 só como referência negativa.
- **PPI fala do paciente, não do nutri.** "O que o nutri faz" (P11) e implicações de negócio (formato, ticket, canais, cadência) NÃO entram no PPI — são insumo pra outros agentes.

# 2. Input

Você recebe form_respostas com as 13 perguntas (P1-P13) e seus sub-itens. Resumo:

- **P1** — descrição do paciente atual (idade, profissão, contexto familiar)
- **P2/P2.1** — esse é o paciente que o nutri quer atrair? Se não, quem ele quer (aspiracional)
- **P3** — como o paciente decide (preço vs valor, faixa de investimento, ritmo de decisão)
- **P4/P4.1** — por onde o paciente chega (canais)
- **P5** — rotina alimentar do paciente
- **P6/P6.1/P6.2/P6.3** — adesão ao plano, em que situações quebra, barreiras
- **P7/P7.1** — o que fez o paciente procurar ajuda agora
- **P8** — o que ele já tentou que não funcionou
- **P9** — frases reais que o paciente diz
- **P10** — principal mudança que ele percebe ao trabalhar com o nutri
- **P11** — o que o nutri faz que outros não fazem (diferencial observável)
- **P12/P12.1** — como o paciente se comunica e como o nutri responde
- **P13** — quem o nutri NÃO quer mais atender (opcional, pode estar vazio)

Nem toda pergunta alimenta o PPI descritivo. P4, P11 e P12 servem mais pra outros agentes — use apenas como contexto.

# 3. Método de inferência

## 3.0. Abstração estrutural — princípio transversal

PPI é o **perfil-alvo estrutural**, não a foto de um indivíduo. Use:

- **Faixas** em vez de valores exatos ("30-45 anos", não "38 anos").
- **Plurais e categorias amplas** ("profissionais em cargo de gestão corporativa", não "gerente de marketing em multinacional").
- **Padrões de núcleo familiar** ("casados com 1-2 filhos OU sem filhos por escolha", não "casado com dois filhos pequenos").

Detalhes individuais ficam pra **Persona**, não PPI. Mesmo quando P2 = "Sim", abstraia o P1 antes de descrever o PPI.

**Predominância + variação:** use o padrão "Predominantemente X, com variações em Y".

**Preservar tensão e contradição:** PPI deve manter as **fricções e contradições** que o form revela — não suavizar pra parecer coerente.

## 3.1. Níveis de consciência (Schwartz) — para nivel_consciencia_predominante

Enum fechado, escolha exatamente um:

- inconsciente — não percebe que tem o problema.
- dor_consciente — sente o desconforto, ainda tenta paliativos por conta.
- solucao_consciente — entende que precisa de profissional/método.
- produto_consciente — sabe que precisa de nutri. Compara profissionais e abordagens.
- mais_consciente — decisão tomada por abordagem ou pessoa específica.
- insuficiente — formulário não dá sinal suficiente pra classificar.

## 3.2. Método dos 5 Porquês — para resultado_emocional_raiz

Parta da resposta P10. Pergunte "por quê?" descendo 4-5 camadas. Pare quando chegar numa palavra de **emoção, identidade ou dignidade** — não numa métrica.

**Hard rule:** resultado_emocional_raiz é **EMOÇÃO**, nunca métrica.
- Aceita: liberdade, presença, confiança, pertencimento, dignidade, controle, autoestima, leveza, segurança, reconhecimento.
- Rejeita: emagrecer X kg, ter energia, ser saudável, melhorar exames.

**Teste de profundidade:** se sua resposta for "voltar a sentir [X]", desça mais uma camada. A raiz costuma estar no medo de perder identidade.

## 3.3. Customer Language Mirror — para frase_eixo, manifestações e objecoes_internas

Use o vocabulário literal das respostas P5/P6/P9 do nutri sobre o paciente. Não traduza pra termo técnico.

**Teste de aspas:** qualquer trecho que poderia estar entre aspas DEVE preservar a forma literal.

**Voz da frase_eixo:** descrição em **3ª pessoa**. manifestacoes_concretas e objecoes_internas admitem 1ª pessoa do paciente.

## 3.4. Manifestações concretas

São **comportamentos observáveis que apontam pra dor ou alimentam o padrão problemático**. Não conceitos abstratos. Não rotina neutra.

## 3.5. Anti-PPI

Não é "paciente difícil em geral". É quem **drena tempo, não gera resultado, não renova contrato e não indica**.

**Hard rule — mentalidade > comportamento:** descreva **mentalidade/perfil estrutural oposto**, não comportamento ruim transversal.

**Hard rule:** anti_ppi.caracteristicas mínimo 3 itens, nunca vazio.

## 3.6. Princípio de não-invenção

Onde o formulário não fornecer sinal suficiente, prefira ser **conservador** a inventar detalhe específico.

## 3.7. Objeções internas — para objecoes_internas

São **dúvidas e medos que o paciente tem sobre se vale a pena ou se vai dar certo** — narrativa interna dele, não objeção comercial. Devolva 2 a 4 itens em forma de fala literal.

# 4. Procedimento de raciocínio

Antes de gerar o JSON, raciocine internamente nesta ordem:

1. Releia o formulário completo. Anote sinais úteis por pergunta.
2. Resolva o conflito P1 vs P2.1: se P2 = "Não", o PPI é o aspiracional de P2.1.
3. Abstraia o indivíduo em perfil estrutural — faixas, plurais, categorias amplas. Preserve contradições.
4. Classifique nivel_consciencia_predominante (Schwartz).
5. Aplique 5 Porquês ao P10 → resultado_emocional_raiz. Desça até identidade/medo.
6. Extraia objecoes_internas de P6.1, P7, P8, P9 — vocabulário literal.
7. Identifique manifestações que apontam pra dor em P5/P6/P9 — filtre rotina neutra.
8. Cruze P3.b + P3.c → disposicao_investir.
9. Construa Anti-PPI a partir de P13. Verifique mentalidade oposta.
10. Só então gere o JSON final.

# 5. Output

Devolva **um único JSON**, sem texto antes ou depois, com esta estrutura exata:

{
  "resumo": "string — prosa única, ~20 palavras",
  "quem_e": {
    "faixa_etaria": "string",
    "genero_predominante": "string",
    "localizacao_macro": "string",
    "estrato_e_profissao": "string",
    "estado_familiar_tipico": "string"
  },
  "como_pensa": {
    "crencas_sobre_saude": "string",
    "valores_centrais": "string",
    "nivel_consciencia_predominante": "inconsciente | dor_consciente | solucao_consciente | produto_consciente | mais_consciente | insuficiente",
    "disposicao_investir": "string",
    "objecoes_internas": ["string", "..."]
  },
  "eixo_de_dor": {
    "frase_eixo": "string — síntese em 1 frase, 3ª pessoa, vocabulário literal",
    "manifestacoes_concretas": ["string", "..."]
  },
  "eixo_de_transformacao": {
    "resultado_emocional_raiz": "string — emoção raiz, nunca métrica",
    "resultados_funcionais": ["string", "..."],
    "prazo_esperado": "string"
  },
  "anti_ppi": {
    "caracteristicas": ["string", "..."],
    "razao_por_tras": "string",
    "frase_de_recusa_recomendada": "string"
  }
}

Tudo em PT-BR. Vocabulário direto, sem floreio. Sem mencionar metodologia ou conceitos por nome no output.

Lista negra de clichês — não use: "resultado mensurável", "método estruturado", "autonomia com suporte técnico", "valor percebido acima do preço", "abordagem holística", "estratégico", "robusto", "elevar a outro patamar", "transformação verdadeira", "potencializar", "alavancar".

---

Form do nutri:

{{form_respostas}}

Agora gere o JSON do PPI.`;

// ============================================================
// bootstrapDatabase — executa uma vez ao iniciar o servidor.
// Insere o prompt padrão se a linha ppi_prompt não existir.
// NÃO sobrescreve caso o usuário já tenha editado via interface.
// ============================================================
async function bootstrapDatabase() {
    try {
        const { data, error } = await supabase
            .from('ai_settings')
            .select('id')
            .eq('id', 'ppi_prompt')
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = "0 rows" (tabela existe mas não tem o registro)
            // Qualquer outro erro = tabela provavelmente não existe ainda
            console.warn('[DB] Tabela ai_settings não encontrada. Execute supabase_schema.sql no dashboard Supabase.');
            console.warn('[DB] Enquanto isso, o prompt embutido de emergência será usado.');
            return;
        }

        if (!data) {
            // Tabela existe mas sem o registro — insere o seed
            const { error: insertError } = await supabase
                .from('ai_settings')
                .insert({ id: 'ppi_prompt', prompt: SEED_PROMPT });

            if (insertError) {
                console.warn('[DB] Falha ao inserir prompt seed:', insertError.message);
            } else {
                console.log('[DB] Prompt PPI seed inserido com sucesso.');
            }
        } else {
            console.log('[DB] Prompt PPI encontrado no banco — OK.');
        }
    } catch (err) {
        console.warn('[DB] Erro no bootstrap:', err.message);
    }
}

// ============================================================
// ROTA: GET /clients
// ============================================================
app.get('/clients', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .select('id, nome, email, created_at, diagnostico_final')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// ROTA: GET /ai-config  — retorna prompt do banco
// ============================================================
app.get('/ai-config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_settings')
            .select('prompt')
            .eq('id', 'ppi_prompt')
            .single();

        if (error) throw error;
        res.json({ prompt: data.prompt, source: 'database' });
    } catch (e) {
        console.warn('[ai-config GET] Banco indisponível, retornando prompt de emergência:', e.message);
        res.json({ prompt: EMERGENCY_PROMPT, source: 'fallback' });
    }
});

// ============================================================
// ROTA: POST /ai-config  — salva prompt editado no banco
// ============================================================
app.post('/ai-config', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt vazio.' });

        const { error } = await supabase
            .from('ai_settings')
            .upsert({ id: 'ppi_prompt', prompt: prompt.trim(), updated_at: new Date().toISOString() });

        if (error) throw error;
        console.log('[ai-config POST] Prompt atualizado no banco.');
        res.json({ message: 'OK' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// generatePPI — lê prompt do banco, jamais do código
// ============================================================
async function generatePPI(formData) {
    // 1. Busca o prompt no banco (fonte primária)
    const { data, error } = await supabase
        .from('ai_settings')
        .select('prompt')
        .eq('id', 'ppi_prompt')
        .single();

    if (error || !data?.prompt) {
        console.warn('[generatePPI] Prompt não encontrado no banco. Verifique a tabela ai_settings.');
        throw new Error('Prompt do agente PPI não configurado no banco. Execute supabase_schema.sql e reinicie o servidor.');
    }

    const fullPrompt = data.prompt.replace('{{form_respostas}}', JSON.stringify(formData, null, 2));
    console.log('[generatePPI] Prompt lido do banco — enviando para OpenAI...');

    const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        temperature: 0.4,
        messages: [{ role: 'user', content: fullPrompt }],
        response_format: { type: 'json_object' }
    });

    const ppi = JSON.parse(response.choices[0].message.content);
    console.log('[generatePPI] PPI gerado com sucesso.');
    return ppi;
}

// ============================================================
// ROTA: POST /submit
// ============================================================
app.post('/submit', async (req, res) => {
    try {
        const ppiJson = await generatePPI(req.body);

        const { data: inserted, error } = await supabase
            .from('form_submissions')
            .insert([{
                ...req.body,
                diagnostico_final: JSON.stringify(ppiJson)
            }])
            .select('id')
            .single();

        if (error) console.warn('[submit] Supabase insert warning:', error.message);

        res.json({ message: 'OK', ppi: ppiJson, id: inserted?.id });
    } catch (err) {
        console.error('[submit] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// ROTA: GET /latest-submission
// Retorna o id da submissão mais recente no banco
// ============================================================
app.get('/latest-submission', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .select('id, nome, created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Nenhuma submissão encontrada.' });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// ROTA: POST /regenerate/:id
// Busca os dados do formulário já salvo e gera um novo PPI
// ============================================================
app.post('/regenerate/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: submission, error: fetchError } = await supabase
            .from('form_submissions')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !submission) {
            return res.status(404).json({ error: 'Submissão não encontrada.' });
        }

        // Extrai apenas os campos do formulário, exclui metadados e saídas de IA
        const { id: _id, created_at, diagnostico_final, analise_paciente, analise_profissional, ...formData } = submission;

        const ppiJson = await generatePPI(formData);

        const { error: updateError } = await supabase
            .from('form_submissions')
            .update({ diagnostico_final: JSON.stringify(ppiJson) })
            .eq('id', id);

        if (updateError) console.warn('[regenerate] Supabase update warning:', updateError.message);

        console.log('[regenerate] PPI regenerado para id:', id);
        res.json({ ppi: ppiJson });
    } catch (err) {
        console.error('[regenerate] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Fallback SPA
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, async () => {
    console.log(`\nServidor rodando em http://localhost:${PORT}`);
    console.log('[DB] Verificando banco de dados...');
    await bootstrapDatabase();
});
