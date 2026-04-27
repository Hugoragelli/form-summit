require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração segura do Supabase (lida do .env)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Middleware para entender JSON e servir arquivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rota principal - serve o formulário explicitamente
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

// Rota para receber os dados do formulário
app.post('/submit', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .insert([req.body]);

        if (error) throw error;
        res.status(200).json({ message: 'Sucesso!' });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: 'Erro ao salvar os dados.' });
    }
});

// Outras rotas (fallback)
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
