const { Router } = require('express');
const { supabase, openai, deepseek } = require('../lib/clients');

const router = Router();

// ============================================================
// Prompt seed — inserido no banco na primeira inicialização.
// ============================================================
const SEED_PERSONAS_PROMPT = `Você é um gerador de **3 Personas** humanizadas para nutricionistas. Recebe o PPI (Perfil de Paciente Ideal) já estruturado e devolve exatamente 3 personas distintas em JSON.

# O que é Persona

Persona é a humanização contextual do PPI. Cada persona compartilha os mesmos atributos estruturais (faixa etária, eixo de dor, resultado emocional raiz) mas se diferencia em profissão específica, contexto de vida, vocabulário, gatilhos e objeções.

Persona NÃO inventa um novo PPI — ela personifica o mesmo PPI em 3 contextos de vida distintos, plausíveis e contrastantes entre si.

# Input

Você recebe o JSON completo do PPI com os campos: resumo, quem_e, como_pensa, eixo_de_dor, eixo_de_transformacao, anti_ppi.

# Método

1. Identifique os atributos invariantes do PPI: faixa etária, gênero, eixo de dor, resultado emocional raiz.
2. Crie 3 contextos de vida distintos dentro do mesmo PPI — profissões diferentes, momentos de vida diferentes, composições familiares diferentes e contrastantes.
3. Para cada persona, extraia frases literais do vocabulário presente no eixo_de_dor e como_pensa do PPI.
4. Gatilhos: eventos concretos e próximos que ativam a dor agora — não abstratos.
5. Objeções: dúvidas e medos internos ao contexto específico dela — não objeções genéricas.
6. As 3 personas devem ser claramente distintas entre si.

# Output

Devolva **um único JSON**, sem texto antes ou depois:

{
  "personas": [
    {
      "numero": 1,
      "iniciais": "XX",
      "nome": "string — nome brasileiro",
      "arquetipo": "string — frase de 1 linha descrevendo quem ela é",
      "frase_marcante": "string — em 1ª pessoa, vocabulário literal do paciente",
      "contexto": {
        "profissao": "string",
        "estado_familiar": "string",
        "rotina_tipica": "string",
        "momento_de_vida": "string"
      },
      "frases": ["string", "string", "string"],
      "tom": "string — 2-3 adjetivos separados por · descrevendo como ela se comunica",
      "gatilhos": ["string", "string", "string"],
      "objecoes": ["string", "string", "string"],
      "canal_preferido": "string",
      "tipo_post": "string — 2 formatos de conteúdo que ressoam com ela, separados por ·"
    },
    { "numero": 2, "..." },
    { "numero": 3, "..." }
  ]
}

Regras:
- Frases sempre em 1ª pessoa, vocabulário coloquial, sem termos técnicos
- Gatilhos são eventos concretos e próximos (foto, evento, data comemorativa)
- Tudo em PT-BR. Vocabulário direto, sem floreio.
- Lista negra: "resultado mensurável", "método estruturado", "autonomia", "holístico", "estratégico", "robusto", "potencializar", "alavancar".

---

PPI:

{{ppi_json}}

Agora gere o JSON das 3 personas.`;

// ============================================================
// generatePersonas
// ============================================================
async function generatePersonas(ppi) {
    const [promptRes, providerRes] = await Promise.all([
        supabase.from('ai_settings').select('prompt').eq('id', 'personas_prompt').single(),
        supabase.from('ai_settings').select('prompt').eq('id', 'ai_provider').single()
    ]);

    const promptTemplate = promptRes.data?.prompt || SEED_PERSONAS_PROMPT;
    const provider = providerRes.data?.prompt || 'openai';
    const fullPrompt = promptTemplate.replace('{{ppi_json}}', JSON.stringify(ppi, null, 2));

    let response;
    if (provider === 'deepseek') {
        console.log('[Personas] Enviando para DeepSeek...');
        response = await deepseek.chat.completions.create({
            model: 'deepseek-v4-pro',
            temperature: 0.6,
            messages: [
                { role: 'system', content: 'Você é um assistente especializado. Responda sempre em JSON válido sem texto adicional.' },
                { role: 'user', content: fullPrompt }
            ],
            response_format: { type: 'json_object' }
        });
    } else {
        console.log('[Personas] Enviando para OpenAI...');
        response = await openai.chat.completions.create({
            model: 'gpt-5.1',
            temperature: 0.6,
            messages: [{ role: 'user', content: fullPrompt }],
            response_format: { type: 'json_object' }
        });
    }

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`[Personas] Geradas com sucesso via ${provider}.`);
    return result;
}

// ============================================================
// GET /personas-config — retorna prompt de personas do banco
// ============================================================
router.get('/personas-config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_settings')
            .select('prompt')
            .eq('id', 'personas_prompt')
            .single();
        if (error) throw error;
        res.json({ prompt: data.prompt, source: 'database' });
    } catch (e) {
        res.json({ prompt: SEED_PERSONAS_PROMPT, source: 'fallback' });
    }
});

// ============================================================
// POST /personas-config — salva prompt de personas no banco
// ============================================================
router.post('/personas-config', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt vazio.' });
        const { error } = await supabase
            .from('ai_settings')
            .upsert({ id: 'personas_prompt', prompt: prompt.trim(), updated_at: new Date().toISOString() });
        if (error) throw error;
        console.log('[Personas] Prompt atualizado.');
        res.json({ message: 'OK' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// POST /generate-personas — recebe PPI e devolve 3 personas
// ============================================================
router.post('/generate-personas', async (req, res) => {
    try {
        const { ppi, submission_id } = req.body;
        if (!ppi || typeof ppi !== 'object') {
            return res.status(400).json({ error: 'Campo ppi ausente ou inválido.' });
        }

        const result = await generatePersonas(ppi);

        if (submission_id) {
            const { error: updateError } = await supabase
                .from('form_submissions')
                .update({ personas_json: JSON.stringify(result) })
                .eq('id', submission_id);
            if (updateError) console.warn('[Personas] Aviso ao salvar no banco:', updateError.message);
        }

        res.json({ personas: result.personas });
    } catch (err) {
        console.error('[Personas] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = { router, SEED_PERSONAS_PROMPT };
