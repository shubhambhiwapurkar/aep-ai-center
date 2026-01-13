
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';

async function testEndpoint(name, url) {
    console.log(`Testing ${name} (${url})...`);
    try {
        const start = Date.now();
        const res = await fetch(url);
        const duration = Date.now() - start;

        if (res.ok) {
            const json = await res.json();
            console.log(`✅ ${name}: 200 OK (${duration}ms)`);
            // Basic structure check
            if (name === 'Orphans' && !json.sql) console.warn('⚠️ Warning: Orphans response missing SQL field');
            if (name === 'Dictionary' && !json.dictionaries) console.warn('⚠️ Warning: Dictionary response missing dictionaries array');
            return true;
        } else {
            console.error(`❌ ${name}: ${res.status} ${res.statusText}`);
            try {
                const text = await res.text();
                console.error(text);
            } catch (e) { }
            return false;
        }
    } catch (e) {
        console.error(`❌ ${name}: Network Error - ${e.message}`);
        return false;
    }
}

async function run() {
    console.log('--- Verifying Phase E API Endpoints ---');

    // 1. Test Orphans
    const orphansPass = await testEndpoint('Orphans', `${BASE_URL}/profiles/orphans?months=3`);

    // 2. Test Dictionary
    const dictPass = await testEndpoint('Dictionary', `${BASE_URL}/schemas/dictionary`);

    if (orphansPass && dictPass) {
        console.log('\n✅ All API endpoints verified successfully.');
        process.exit(0);
    } else {
        console.error('\n❌ API Verification Failed.');
        process.exit(1);
    }
}

run();
