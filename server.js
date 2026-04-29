require('dotenv').config();
const express = require('express');
const path = require('path');
const { supabase } = require('./lib/clients');
const { router: ppiRouter, SEED_PROMPT } = require('./agents/ppi');
const { router: personasRouter, SEED_PERSONAS_PROMPT } = require('./agents/personas');
const { router: instagramRouter } = require('./agents/instagram');
const { router: analiseInstagramRouter, SEED_ANALISE_INSTAGRAM_PROMPT } = require('./agents/analise-instagram');
const { router: mcsRouter, SEED_MCS_PROMPT } = require('./agents/mcs');
const { router: comparadorRouter, SEED_COMPARADOR_PROMPT } = require('./agents/comparador');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rotas dos agentes
app.use(ppiRouter);
app.use(personasRouter);
app.use(instagramRouter);
app.use(analiseInstagramRouter);
app.use(mcsRouter);
app.use(comparadorRouter);

// ============================================================
// GET /clients � lista todas as submissoes
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

// Fallback SPA
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

// ============================================================
// bootstrapDatabase � garante registros padrao no banco
// Executa uma unica vez ao iniciar. Nao sobrescreve edicoes.
// ============================================================
async function bootstrapDatabase() {
    try {
        // PPI prompt
        const { data: ppiData, error: ppiError } = await supabase
            .from('ai_settings').select('id').eq('id', 'ppi_prompt').single();

        if (ppiError && ppiError.code !== 'PGRST116') {
            console.warn('[DB] Tabela ai_settings nao encontrada. Execute supabase_schema.sql no dashboard Supabase.');
            return;
        }
        if (!ppiData) {
            const { error } = await supabase.from('ai_settings').insert({ id: 'ppi_prompt', prompt: SEED_PROMPT });
            error ? console.warn('[DB] Falha ao inserir prompt PPI:', error.message)
                  : console.log('[DB] Prompt PPI seed inserido.');
        } else {
            console.log('[DB] Prompt PPI OK.');
        }

        // Provider padrao
        const { data: providerData } = await supabase
            .from('ai_settings').select('id').eq('id', 'ai_provider').single();
        if (!providerData) {
            await supabase.from('ai_settings').insert({ id: 'ai_provider', prompt: 'openai' });
            console.log('[DB] Provider padrao (openai) inserido.');
        }

        // Personas prompt
        const { data: personasData } = await supabase
            .from('ai_settings').select('id').eq('id', 'personas_prompt').single();
        if (!personasData) {
            const { error } = await supabase.from('ai_settings').insert({ id: 'personas_prompt', prompt: SEED_PERSONAS_PROMPT });
            error ? console.warn('[DB] Falha ao inserir prompt Personas:', error.message)
                  : console.log('[DB] Prompt Personas seed inserido.');
        } else {
            console.log('[DB] Prompt Personas OK.');
        }
        // Analise Instagram prompt
        const { data: analiseData } = await supabase
            .from('ai_settings').select('id').eq('id', 'analise_instagram_prompt').single();
        if (!analiseData) {
            const { error } = await supabase.from('ai_settings').insert({ id: 'analise_instagram_prompt', prompt: SEED_ANALISE_INSTAGRAM_PROMPT });
            error ? console.warn('[DB] Falha ao inserir prompt Analise Instagram:', error.message)
                  : console.log('[DB] Prompt Analise Instagram seed inserido.');
        } else {
            console.log('[DB] Prompt Analise Instagram OK.');
        }

        // MCS prompt
        const { data: mcsData } = await supabase
            .from('ai_settings').select('id').eq('id', 'mcs_prompt').single();
        if (!mcsData) {
            const { error } = await supabase.from('ai_settings').insert({ id: 'mcs_prompt', prompt: SEED_MCS_PROMPT });
            error ? console.warn('[DB] Falha ao inserir prompt MCS:', error.message)
                  : console.log('[DB] Prompt MCS seed inserido.');
        } else {
            console.log('[DB] Prompt MCS OK.');
        }

        // Comparador prompt
        const { data: comparadorData } = await supabase
            .from('ai_settings').select('id').eq('id', 'comparador_prompt').single();
        if (!comparadorData) {
            const { error } = await supabase.from('ai_settings').insert({ id: 'comparador_prompt', prompt: SEED_COMPARADOR_PROMPT });
            error ? console.warn('[DB] Falha ao inserir prompt Comparador:', error.message)
                  : console.log('[DB] Prompt Comparador seed inserido.');
        } else {
            console.log('[DB] Prompt Comparador OK.');
        }
    } catch (err) {
        console.warn('[DB] Erro no bootstrap:', err.message);
    }
}

// ============================================================
// START
// ============================================================
app.listen(PORT, async () => {
    console.log(`\nServidor rodando em http://localhost:${PORT}`);
    console.log('[DB] Verificando banco de dados...');
    await bootstrapDatabase();
});
