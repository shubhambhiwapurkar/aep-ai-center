const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./Adobe Experience Platform.postman_collection.json', 'utf8'));

const apiCatalog = {
    categories: [],
    totalEndpoints: 0,
    allApis: []
};

function extractAPIs(items, categoryPath = []) {
    const apis = [];

    items.forEach(item => {
        if (item.item) {
            // This is a folder
            const newPath = [...categoryPath, item.name];
            apis.push(...extractAPIs(item.item, newPath));
        } else if (item.request) {
            // This is an actual API endpoint
            const url = item.request.url;
            let rawUrl = '';

            if (typeof url === 'string') {
                rawUrl = url;
            } else if (url && url.raw) {
                rawUrl = url.raw;
            }

            const api = {
                name: item.name,
                method: item.request.method,
                url: rawUrl,
                category: categoryPath.join(' > '),
                description: item.request.description || '',
                headers: (item.request.header || []).filter(h => !h.key.startsWith('x-') && h.key !== 'Authorization' && h.key !== 'Accept' && h.key !== 'Content-Type'),
                queryParams: url && url.query ? url.query.map(q => q.key) : [],
                pathParams: url && url.variable ? url.variable.map(v => v.key) : []
            };

            apis.push(api);
        }
    });

    return apis;
}

// Extract all APIs
data.item.forEach(category => {
    const apis = extractAPIs(category.item || [], [category.name]);
    const categoryInfo = {
        name: category.name,
        description: category.description || '',
        endpointCount: apis.length,
        subcategories: []
    };

    // Get unique subcategories
    const subCats = new Set();
    apis.forEach(api => {
        const parts = api.category.split(' > ');
        if (parts.length > 1) {
            subCats.add(parts[1]);
        }
    });
    categoryInfo.subcategories = Array.from(subCats);

    apiCatalog.categories.push(categoryInfo);
    apiCatalog.allApis.push(...apis);
    apiCatalog.totalEndpoints += apis.length;
});

// Generate detailed analysis
console.log('='.repeat(80));
console.log('ADOBE EXPERIENCE PLATFORM API ANALYSIS');
console.log('='.repeat(80));
console.log(`\nTotal Categories: ${apiCatalog.categories.length}`);
console.log(`Total Endpoints: ${apiCatalog.totalEndpoints}\n`);

// Group by use case for monitoring system
const monitoringApis = {
    'Batch Ingestion Monitoring': [],
    'Schema Management': [],
    'Identity Management': [],
    'Dataset Management': [],
    'Query Service': [],
    'Profile Management': [],
    'Segmentation': [],
    'Data Access': [],
    'Observability': [],
    'Flow/Pipeline': [],
    'Sandbox Management': [],
    'Other': []
};

apiCatalog.allApis.forEach(api => {
    const cat = api.category.toLowerCase();
    const name = api.name.toLowerCase();

    if (cat.includes('batch') || name.includes('batch') || cat.includes('ingestion')) {
        monitoringApis['Batch Ingestion Monitoring'].push(api);
    } else if (cat.includes('schema')) {
        monitoringApis['Schema Management'].push(api);
    } else if (cat.includes('identity')) {
        monitoringApis['Identity Management'].push(api);
    } else if (cat.includes('dataset') || (cat.includes('catalog') && name.includes('dataset'))) {
        monitoringApis['Dataset Management'].push(api);
    } else if (cat.includes('query')) {
        monitoringApis['Query Service'].push(api);
    } else if (cat.includes('profile')) {
        monitoringApis['Profile Management'].push(api);
    } else if (cat.includes('segment')) {
        monitoringApis['Segmentation'].push(api);
    } else if (cat.includes('data access')) {
        monitoringApis['Data Access'].push(api);
    } else if (cat.includes('observability')) {
        monitoringApis['Observability'].push(api);
    } else if (cat.includes('flow') || cat.includes('pipeline')) {
        monitoringApis['Flow/Pipeline'].push(api);
    } else if (cat.includes('sandbox')) {
        monitoringApis['Sandbox Management'].push(api);
    } else {
        monitoringApis['Other'].push(api);
    }
});

console.log('\n' + '='.repeat(80));
console.log('MONITORING SYSTEM RELEVANT APIs');
console.log('='.repeat(80));

Object.entries(monitoringApis).forEach(([group, apis]) => {
    if (apis.length > 0) {
        console.log(`\n### ${group} (${apis.length} endpoints)`);
        apis.forEach(api => {
            console.log(`  ${api.method.padEnd(6)} ${api.name}`);
            if (api.description) {
                console.log(`         └─ ${api.description.substring(0, 100)}...`);
            }
        });
    }
});

// Save detailed JSON for further processing
fs.writeFileSync('./api-catalog.json', JSON.stringify(apiCatalog, null, 2));
console.log('\n\nDetailed API catalog saved to api-catalog.json');

// Key APIs for monitoring dashboard
console.log('\n' + '='.repeat(80));
console.log('KEY APIs FOR MONITORING DASHBOARD');
console.log('='.repeat(80));

const keyApis = [
    { name: 'List Batches', purpose: 'Monitor batch ingestion status, success/failure rates', url: '/data/foundation/catalog/batches' },
    { name: 'Batch Details', purpose: 'Get detailed batch metrics including record counts', url: '/data/foundation/catalog/batches/:BATCH_ID' },
    { name: 'List Datasets', purpose: 'Count and monitor datasets in sandbox', url: '/data/foundation/catalog/dataSets' },
    { name: 'List Schemas', purpose: 'Count and extract schemas for AI context', url: '/data/foundation/schemaregistry/...' },
    { name: 'Union Schemas', purpose: 'Extract complete union schema for profiles', url: '/data/foundation/schemaregistry/tenant/unions' },
    { name: 'List Identities', purpose: 'Monitor identity namespaces and counts', url: '/data/core/idnamespace/identities' },
    { name: 'Query Status', purpose: 'Monitor query execution and performance', url: '/data/foundation/query/queries' },
    { name: 'List Sandboxes', purpose: 'Get available sandboxes for connection', url: '/data/foundation/sandbox-management/sandboxes' },
    { name: 'Observability', purpose: 'Get platform metrics and health', url: '/data/infrastructure/observability/insights/metrics' }
];

keyApis.forEach(api => {
    console.log(`\n${api.name}`);
    console.log(`  Purpose: ${api.purpose}`);
    console.log(`  Endpoint: ${api.url}`);
});
