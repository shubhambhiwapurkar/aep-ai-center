const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./Adobe Experience Platform.postman_collection.json', 'utf8'));

console.log('=== AEP API Categories ===\n');

function extractAPIs(items, depth = 0) {
    const indent = '  '.repeat(depth);
    items.forEach(item => {
        if (item.item) {
            console.log(`${indent}📁 ${item.name}`);
            if (depth < 2) {
                extractAPIs(item.item, depth + 1);
            } else {
                console.log(`${indent}  └── (${item.item.length} endpoints)`);
            }
        } else if (item.request) {
            // This is an actual endpoint
        }
    });
}

// Get top-level categories
data.item.forEach((category, index) => {
    const endpointCount = countEndpoints(category);
    console.log(`${index + 1}. ${category.name} (${endpointCount} endpoints)`);
});

function countEndpoints(item) {
    if (!item.item) return 1;
    return item.item.reduce((sum, child) => sum + countEndpoints(child), 0);
}
