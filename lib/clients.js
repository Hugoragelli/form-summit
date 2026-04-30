const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const { ApifyClient } = require('apify-client');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1'
});

const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

// ============================================================
// callDeepSeekR1 — usa deepseek-reasoner (R1) com thinking.
// O modelo não suporta response_format nem temperature,
// então extraímos o JSON do texto de saída manualmente.
// ============================================================
async function callDeepSeekR1(messages, logPrefix) {
    const response = await deepseek.chat.completions.create({
        model: 'deepseek-reasoner',
        messages
    });

    const thinking = response.choices[0].message.reasoning_content;
    if (thinking) {
        console.log(`[${logPrefix}] R1 thinking: ${thinking.length} chars`);
    }

    const raw = response.choices[0].message.content || '';
    // Remove markdown code fences se presentes
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/s);
    return JSON.parse(match ? match[1].trim() : raw.trim());
}

module.exports = { supabase, openai, deepseek, apify, callDeepSeekR1 };
