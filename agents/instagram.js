const { Router } = require('express');
const { supabase, apify } = require('../lib/clients');

const router = Router();

// ============================================================
// Actor IDs do Apify
// Verifique em https://apify.com/store se os IDs mudaram.
// ============================================================
const ACTOR_PROFILE = 'apify/instagram-profile-scraper';
const ACTOR_REELS   = 'apify/instagram-reel-scraper';

// ============================================================
// scrapeInstagram(username) → { scraped_at, username, profile, reels }
// Roda Profile Scraper + Reel Scraper em paralelo.
// ============================================================
async function scrapeInstagram(username) {
    const handle = username.replace(/^@/, '').trim();

    console.log(`[Instagram] Rodando Profile Scraper + Reel Scraper para @${handle}...`);

    const [profileRun, reelsRun] = await Promise.all([
        apify.actor(ACTOR_PROFILE).call({
            usernames: [handle],
            resultsLimit: 12
        }),
        apify.actor(ACTOR_REELS).call({
            username: [handle],
            resultsLimit: 30,
            commentsPerReel: 10
        })
    ]);

    const [profileDataset, reelsDataset] = await Promise.all([
        apify.dataset(profileRun.defaultDatasetId).listItems(),
        apify.dataset(reelsRun.defaultDatasetId).listItems()
    ]);

    return {
        scraped_at: new Date().toISOString(),
        username: handle,
        profile: profileDataset.items[0] || null,   // objeto único com biography, latestPosts[], etc.
        reels:   reelsDataset.items || []            // array de até 30 reels com transcript + comments
    };
}

// ============================================================
// POST /scrape-instagram
// Body: { submission_id }
// Roda o scraping e salva instagram_scrape_json no banco.
// ============================================================
router.post('/scrape-instagram', async (req, res) => {
    const { submission_id } = req.body;

    if (!submission_id) {
        return res.status(400).json({ error: 'submission_id é obrigatório.' });
    }

    try {
        // Busca o handle de instagram da submissão
        const { data: submission, error: fetchError } = await supabase
            .from('form_submissions')
            .select('id, instagram')
            .eq('id', submission_id)
            .single();

        if (fetchError || !submission) {
            return res.status(404).json({ error: 'Submissão não encontrada.' });
        }

        if (!submission.instagram) {
            return res.status(400).json({ error: 'Esta submissão não tem Instagram cadastrado.' });
        }

        const scraped = await scrapeInstagram(submission.instagram);

        const { error: updateError } = await supabase
            .from('form_submissions')
            .update({ instagram_scrape_json: JSON.stringify(scraped) })
            .eq('id', submission_id);

        if (updateError) throw updateError;

        console.log(`[Instagram] Scraping salvo para @${submission.instagram}.`);
        res.json({ ok: true, data: scraped });
    } catch (e) {
        console.error('[Instagram] Erro no scraping:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// GET /scrape-instagram/:submission_id
// Retorna o scraping já salvo no banco (sem chamar o Apify).
// ============================================================
router.get('/scrape-instagram/:submission_id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('form_submissions')
            .select('instagram_scrape_json')
            .eq('id', req.params.submission_id)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Não encontrado.' });

        const parsed = data.instagram_scrape_json
            ? JSON.parse(data.instagram_scrape_json)
            : null;

        res.json({ data: parsed });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// scrapeAndSave(submission_id, instagram_handle)
// Usado por outros agentes para disparar scraping em background.
// ============================================================
async function scrapeAndSave(submission_id, instagram) {
    if (!instagram) return;
    const scraped = await scrapeInstagram(instagram);
    const { error } = await supabase
        .from('form_submissions')
        .update({ instagram_scrape_json: JSON.stringify(scraped) })
        .eq('id', submission_id);
    if (error) throw error;
    console.log(`[Instagram] Scraping salvo para submission ${submission_id}.`);
}

module.exports = { router, scrapeAndSave };
