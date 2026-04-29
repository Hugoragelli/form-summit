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

module.exports = { supabase, openai, deepseek, apify };
