require('dotenv').config();
const { ApifyClient } = require('apify-client');

const ACTOR_PROFILE = 'apify/instagram-profile-scraper';
const ACTOR_REELS   = 'apify/instagram-reel-scraper';
const USERNAME = 'samirbayde';

async function main() {
    const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

    console.log(`[TEST] Rodando Profile + Reel Scraper para @${USERNAME}...`);
    console.log('[TEST] Isso pode levar 30-60s...\n');

    const [profileRun, reelsRun] = await Promise.all([
        apify.actor(ACTOR_PROFILE).call({ usernames: [USERNAME], resultsLimit: 12 }),
        apify.actor(ACTOR_REELS).call({ username: [USERNAME], resultsLimit: 30, commentsPerReel: 10 })
    ]);

    const [profileDataset, reelsDataset] = await Promise.all([
        apify.dataset(profileRun.defaultDatasetId).listItems(),
        apify.dataset(reelsRun.defaultDatasetId).listItems()
    ]);

    const profile = profileDataset.items[0] || null;
    const reels   = reelsDataset.items || [];

    console.log('=== PROFILE ===');
    console.log('Nome:', profile?.fullName);
    console.log('Bio:', profile?.biography);
    console.log('Seguidores:', profile?.followersCount);
    console.log('Posts:', profile?.postsCount);
    console.log('Categoria:', profile?.businessCategoryName);
    console.log('Links externos:', profile?.externalUrls);
    console.log('Posts capturados:', profile?.latestPosts?.length);

    console.log('\n=== REELS ===');
    console.log('Reels capturados:', reels.length);
    if (reels[0]) {
        console.log('\nPrimeiro Reel:');
        console.log('  Caption:', reels[0].caption?.slice(0, 120));
        console.log('  Plays:', reels[0].videoPlayCount);
        console.log('  Views:', reels[0].videoViewCount);
        console.log('  Likes:', reels[0].likesCount);
        console.log('  Comments:', reels[0].commentsCount);
        console.log('  Áudio original:', reels[0].musicInfo?.uses_original_audio);
        console.log('  Música:', reels[0].musicInfo?.song_name);
        console.log('  Hashtags:', reels[0].hashtags);
        console.log('  Pinado:', reels[0].isPinned);
    }

    const output = { scraped_at: new Date().toISOString(), username: USERNAME, profile, reels };
    const fs = require('fs');
    fs.writeFileSync('test-instagram-output.json', JSON.stringify(output, null, 2));
    console.log('\n[TEST] JSON completo salvo em test-instagram-output.json');
}

main().catch(e => {
    console.error('[TEST] Erro:', e.message);
    process.exit(1);
});
