require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração segura (lida do .env)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware para entender JSON e servir arquivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rota para listar clientes
app.get('/clients', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .select('nome, email, created_at, diagnostico_final')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rotas para Configurações de IA
app.get('/ai-config', async (req, res) => {
    try {
        const { data, error } = await supabase.from('ai_settings').select('*');
        if (error) throw error;
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/ai-config', async (req, res) => {
    try {
        const { prompts } = req.body;
        for (const item of prompts) {
            await supabase.from('ai_settings').upsert({ id: item.id, prompt: item.prompt });
        }
        res.status(200).json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Função que orquestra os 3 agentes com prompts dinâmicos
async function runAgentWorkflow(formData) {
    // Buscar prompts dinâmicos do banco
    const { data: configs } = await supabase.from('ai_settings').select('*');
    const promptsMap = {};
    configs?.forEach(c => promptsMap[c.id] = c.prompt);

    // Agente 1: Analiza perfil do paciente
    const agent1Prompt = `${promptsMap.agente1 || 'Analise o paciente:'} ${JSON.stringify({
        paciente: formData.p1_paciente_recente,
        rotina: formData.p5_rotina_alimentar,
        barreiras: formData.p6_3_barreiras
    })}`;

    // Agente 2: Analiza o diferencial do nutricionista
    const agent2Prompt = `${promptsMap.agente2 || 'Analise o profissional:'} ${JSON.stringify({
        diferencial: formData.p11_diferencial,
        comunicacao: formData.p12_estilo_comunicacao
    })}`;

    const [res1, res2] = await Promise.all([
        openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Você é um psicólogo do consumidor." }, { role: "user", content: agent1Prompt }] }),
        openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Você é um consultor de marketing." }, { role: "user", content: agent2Prompt }] })
    ]);

    const analisePaciente = res1.choices[0].message.content;
    const analiseProfissional = res2.choices[0].message.content;

    // Agente 3: Consolida e gera estratégia
    const agent3Prompt = `${promptsMap.agente3 || 'Gere o diagnóstico final:'}
    Análise do Paciente: ${analisePaciente}
    Análise do Profissional: ${analiseProfissional}`;

    const res3 = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "Você é um estrategista de negócios." }, { role: "user", content: agent3Prompt }]
    });

    return {
        analisePaciente,
        analiseProfissional,
        diagnosticoFinal: res3.choices[0].message.content
    };
}

// Rota para receber os dados do formulário
app.post('/submit', async (req, res) => {
    try {
        // 1. Rodar Workflow de IA primeiro
        const aiResults = await runAgentWorkflow(req.body);

        // 2. Consolidar os dados do formulário com os resultados da IA
        const fullData = {
            ...req.body,
            analise_paciente: aiResults.analisePaciente,
            analise_profissional: aiResults.analiseProfissional,
            diagnostico_final: aiResults.diagnosticoFinal
        };

        // 3. Salvar tudo em uma única tabela
        const { error } = await supabase
            .from('form_submissions')
            .insert([fullData]);

        if (error) throw error;

        // 4. Retornar o resultado para o frontend
        res.status(200).json({ 
            message: 'Sucesso!',
            diagnostico: aiResults.diagnosticoFinal 
        });

    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: 'Erro ao processar o diagnóstico.' });
    }
});

// Outras rotas (fallback)
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
