import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/config.js';
import { getAccessToken } from './auth.service.js';

// Get directory path for cache file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE_PATH = path.join(__dirname, '../../data/schema_dictionary_cache.json');
async function aepFetch(endpoint, options = {}) {
    const token = await getAccessToken();

    const headers = {
        'Authorization': `Bearer ${token}`,
        'x-api-key': config.apiKey,
        'x-gw-ims-org-id': config.imsOrg,
        'x-sandbox-name': config.sandboxName,
        'Accept': options.accept || 'application/json',
        ...options.headers
    };

    const response = await fetch(`${config.platformUrl}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * Get Schema Registry stats
 */
export async function getRegistryStats() {
    return aepFetch('/data/foundation/schemaregistry/stats');
}

/**
 * List schemas with pagination
 */
export async function listSchemas(container = 'tenant', filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.orderby) params.append('orderby', filters.orderby);
    if (filters.property) params.append('property', filters.property);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/schemaregistry/${container}/schemas?${params}`, {
        accept: 'application/vnd.adobe.xed-id+json'
    });
}

/**
 * Fetch ALL schemas with pagination (follows _page.next links)
 */
export async function listAllSchemas(container = 'tenant') {
    let allSchemas = [];
    let start = null;
    const limit = 100; // Max allowed by API

    do {
        const filters = { limit };
        if (start) filters.start = start;

        const response = await listSchemas(container, filters);
        const results = response?.results || [];
        allSchemas = allSchemas.concat(results);

        // Check for next page
        start = response?._page?.next || null;

        console.log(`[listAllSchemas] ${container}: fetched ${results.length}, total ${allSchemas.length}`);
    } while (start && allSchemas.length < 1000); // Safety limit

    return allSchemas;
}

/**
 * Get schema details with full expansion
 */
export async function getSchemaDetails(schemaId, container = 'tenant') {
    const encodedId = encodeURIComponent(schemaId);
    return aepFetch(`/data/foundation/schemaregistry/${container}/schemas/${encodedId}`, {
        accept: 'application/vnd.adobe.xed-full+json; version=1'
    });
}

/**
 * Get schema sample data
 */
export async function getSchemaSampleData(schemaId, container = 'tenant') {
    const encodedId = encodeURIComponent(schemaId);
    return aepFetch(`/data/foundation/schemaregistry/${container}/schemas/${encodedId}/sample`, {
        accept: 'application/vnd.adobe.xed+json; version=1'
    });
}

/**
 * List all union schemas
 */
export async function listUnionSchemas() {
    return aepFetch('/data/foundation/schemaregistry/tenant/unions', {
        accept: 'application/vnd.adobe.xed-id+json'
    });
}

/**
 * Get union schema details
 */
export async function getUnionSchemaDetails(unionId) {
    const encodedId = encodeURIComponent(unionId);
    return aepFetch(`/data/foundation/schemaregistry/tenant/unions/${encodedId}`, {
        accept: 'application/vnd.adobe.xed-full+json; version=1'
    });
}

/**
 * List field groups with pagination
 */
export async function listFieldGroups(container = 'tenant', filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/schemaregistry/${container}/fieldgroups?${params}`, {
        accept: 'application/vnd.adobe.xed-id+json'
    });
}

/**
 * Get field group details
 */
export async function getFieldGroupDetails(fieldGroupId, container = 'tenant') {
    const encodedId = encodeURIComponent(fieldGroupId);
    return aepFetch(`/data/foundation/schemaregistry/${container}/fieldgroups/${encodedId}`, {
        accept: 'application/vnd.adobe.xed-full+json; version=1'
    });
}

/**
 * List classes
 */
export async function listClasses(container = 'tenant', filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/schemaregistry/${container}/classes?${params}`, {
        accept: 'application/vnd.adobe.xed-id+json'
    });
}

/**
 * Get class details
 */
export async function getClassDetails(classId, container = 'tenant') {
    const encodedId = encodeURIComponent(classId);
    return aepFetch(`/data/foundation/schemaregistry/${container}/classes/${encodedId}`, {
        accept: 'application/vnd.adobe.xed-full+json; version=1'
    });
}

/**
 * List data types
 */
export async function listDataTypes(container = 'tenant', filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/schemaregistry/${container}/datatypes?${params}`, {
        accept: 'application/vnd.adobe.xed-id+json'
    });
}

/**
 * Get data type details
 */
export async function getDataTypeDetails(dataTypeId, container = 'tenant') {
    const encodedId = encodeURIComponent(dataTypeId);
    return aepFetch(`/data/foundation/schemaregistry/${container}/datatypes/${encodedId}`, {
        accept: 'application/vnd.adobe.xed-full+json; version=1'
    });
}

/**
 * List descriptors
 */
export async function listDescriptors(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.schemaId) params.append('xdm:sourceSchema', filters.schemaId);

    return aepFetch(`/data/foundation/schemaregistry/tenant/descriptors?${params}`, {
        accept: 'application/vnd.adobe.xed-id+json'
    });
}

/**
 * List behaviors
 */
export async function listBehaviors() {
    return aepFetch('/data/foundation/schemaregistry/global/behaviors', {
        accept: 'application/vnd.adobe.xed-id+json'
    });
}

/**
 * Export schema as JSON
 */
export async function exportSchema(schemaId) {
    const encodedId = encodeURIComponent(schemaId);
    return aepFetch(`/data/foundation/schemaregistry/rpc/export/${encodedId}`, {
        accept: 'application/vnd.adobe.xed-full+json; version=1'
    });
}

/**
 * Get schema stats for dashboard
 */
export async function getSchemaStats() {
    try {
        const [registryStats, tenantSchemas, globalSchemas, unions, fieldGroups, classes, dataTypes] = await Promise.all([
            getRegistryStats().catch(() => null),
            listSchemas('tenant', { limit: '100' }).catch(() => ({ results: [] })),
            listSchemas('global', { limit: '100' }).catch(() => ({ results: [] })),
            listUnionSchemas().catch(() => ({ results: [] })),
            listFieldGroups('tenant', { limit: '100' }).catch(() => ({ results: [] })),
            listClasses('tenant', { limit: '50' }).catch(() => ({ results: [] })),
            listDataTypes('tenant', { limit: '50' }).catch(() => ({ results: [] }))
        ]);

        return {
            tenantId: registryStats?.tenantId || null,
            tenantSchemas: tenantSchemas.results?.length || 0,
            globalSchemas: globalSchemas.results?.length || 0,
            totalSchemas: (tenantSchemas.results?.length || 0) + (globalSchemas.results?.length || 0),
            unions: unions.results?.length || 0,
            fieldGroups: fieldGroups.results?.length || 0,
            classes: classes.results?.length || 0,
            dataTypes: dataTypes.results?.length || 0
        };
    } catch (error) {
        console.error('Error getting schema stats:', error);
        return {
            tenantSchemas: 0,
            globalSchemas: 0,
            totalSchemas: 0,
            unions: 0,
            fieldGroups: 0,
            classes: 0,
            dataTypes: 0,
            error: error.message
        };
    }
}

/**
 * Extract union schema for AI context
 */
export async function extractUnionSchemaForAI() {
    try {
        const unions = await listUnionSchemas();
        const extractedSchemas = [];

        for (const union of (unions.results || [])) {
            try {
                const details = await getUnionSchemaDetails(union['meta:altId'] || union.$id);
                extractedSchemas.push({
                    id: details.$id,
                    title: details.title,
                    description: details.description,
                    type: details.type,
                    properties: extractProperties(details.properties || {}),
                    required: details.required || []
                });
            } catch (err) {
                console.error(`Error extracting union ${union.$id}:`, err.message);
            }
        }

        return {
            extractedAt: new Date().toISOString(),
            sandbox: config.sandboxName,
            schemas: extractedSchemas
        };
    } catch (error) {
        throw new Error(`Failed to extract union schemas: ${error.message}`);
    }
}

// Cache for Union Profile Schema (for PQL queries)
const UNION_CACHE_FILE_PATH = path.join(__dirname, '../../data/union_profile_cache.json');
let unionProfileCache = null;
let unionProfileCacheTime = null;

/**
 * Load union profile cache from file
 */
function loadUnionCacheFromFile() {
    try {
        if (fs.existsSync(UNION_CACHE_FILE_PATH)) {
            const data = JSON.parse(fs.readFileSync(UNION_CACHE_FILE_PATH, 'utf8'));
            if (data.timestamp && Date.now() - data.timestamp < CACHE_TTL_MS) {
                console.log('[Union] Loaded union profile cache from file');
                unionProfileCache = data.profileSchema;
                unionProfileCacheTime = data.timestamp;
                return true;
            }
        }
    } catch (e) {
        console.error('[Union] Failed to load cache:', e.message);
    }
    return false;
}

/**
 * Extract Union Profile Schema with flattened field paths - CACHED
 * This is specifically for PQL queries which need profile store attributes
 */
export async function getUnionProfileSchemaForPQL(forceRefresh = false) {
    // Check in-memory cache
    if (!forceRefresh && unionProfileCache && unionProfileCacheTime) {
        const age = Date.now() - unionProfileCacheTime;
        if (age < CACHE_TTL_MS) {
            console.log(`[Union] Returning cached profile schema (${Math.round(age / 1000)}s old)`);
            return unionProfileCache;
        }
    }

    // Try file cache
    if (!forceRefresh && loadUnionCacheFromFile()) {
        return unionProfileCache;
    }

    console.log('[Union] Extracting union profile schema for PQL...');

    try {
        const unionData = await extractUnionSchemaForAI();
        const profileFields = [];

        // Find the XDM Individual Profile union (the main profile store)
        const profileUnion = unionData.schemas?.find(s =>
            s.title?.toLowerCase().includes('profile') ||
            s.id?.includes('profile')
        ) || unionData.schemas?.[0];

        if (profileUnion) {
            // Flatten the profile properties into field paths
            const flattenForPQL = (props, prefix = '') => {
                if (!props || typeof props !== 'object') return;

                for (const [key, value] of Object.entries(props)) {
                    if (key.startsWith('$') || key.startsWith('meta:')) continue;

                    const fieldPath = prefix ? `${prefix}.${key}` : key;

                    profileFields.push({
                        path: fieldPath,
                        pqlPath: fieldPath, // PQL uses dot notation
                        type: value.type || 'string',
                        title: value.title || key,
                        description: value.description
                    });

                    if (value.properties) {
                        flattenForPQL(value.properties, fieldPath);
                    }
                }
            };

            flattenForPQL(profileUnion.properties || {});
        }

        const result = {
            extractedAt: new Date().toISOString(),
            sandbox: config.sandboxName,
            profileTitle: profileUnion?.title || 'XDM Individual Profile',
            totalFields: profileFields.length,
            fields: profileFields,
            // Common profile attributes for quick access
            commonAttributes: profileFields.filter(f =>
                ['email', 'firstName', 'lastName', 'birthDate', 'gender', 'phone', 'address', 'loyalty', 'tier']
                    .some(attr => f.path.toLowerCase().includes(attr))
            ).slice(0, 20)
        };

        // Cache to memory and file
        unionProfileCache = result;
        unionProfileCacheTime = Date.now();

        try {
            const dir = path.dirname(UNION_CACHE_FILE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(UNION_CACHE_FILE_PATH, JSON.stringify({
                timestamp: Date.now(),
                profileSchema: result
            }));
            console.log(`[Union] Cached ${profileFields.length} profile fields for PQL`);
        } catch (e) {
            console.error('[Union] Failed to save cache:', e.message);
        }

        return result;

    } catch (error) {
        console.error('[Union] Error extracting profile schema:', error);
        return { fields: [], commonAttributes: [], error: error.message };
    }
}

/**
 * Recursively extract properties for AI context
 */
function extractProperties(properties, depth = 0) {
    if (depth > 5) return {};

    const extracted = {};

    for (const [key, value] of Object.entries(properties)) {
        extracted[key] = {
            type: value.type,
            title: value.title,
            description: value.description
        };

        if (value.properties) {
            extracted[key].properties = extractProperties(value.properties, depth + 1);
        }

        if (value.items) {
            extracted[key].items = value.items.type || 'object';
        }
    }
    return extracted;
}

// In-memory cache
let dictionaryCache = null;
let dictionaryCacheTime = null;
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Load cache from file (persistent across restarts)
 */
function loadCacheFromFile() {
    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const data = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
            if (data.timestamp && Date.now() - data.timestamp < CACHE_TTL_MS) {
                console.log('[Dictionary] Loaded cache from file');
                dictionaryCache = data.dictionary;
                dictionaryCacheTime = data.timestamp;
                return true;
            }
        }
    } catch (e) {
        console.error('[Dictionary] Failed to load cache file:', e.message);
    }
    return false;
}

/**
 * Save cache to file (persists across restarts)
 */
function saveCacheToFile(dictionary) {
    try {
        const dir = path.dirname(CACHE_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify({
            timestamp: Date.now(),
            dictionary: dictionary
        }));
        console.log('[Dictionary] Cache saved to file');
    } catch (e) {
        console.error('[Dictionary] Failed to save cache file:', e.message);
    }
}

// Try to load cache on module init
loadCacheFromFile();

/**
 * Process a batch of schemas and extract fields
 */
async function processSchemasBatch(schemas, allFields, processedSchemas) {
    const flattenProps = (props, prefix, schemaName) => {
        if (!props || typeof props !== 'object') return;

        for (const [key, value] of Object.entries(props)) {
            if (key.startsWith('$') || key.startsWith('meta:') || key.startsWith('xdm:')) continue;

            const fieldPath = prefix ? `${prefix}.${key}` : key;

            allFields.push({
                path: fieldPath,
                type: value.type || (value.properties ? 'object' : 'string'),
                title: value.title || key,
                description: value.description || null,
                schema: schemaName,
                enum: value.enum || null
            });

            if (value.properties) flattenProps(value.properties, fieldPath, schemaName);
            if (value.allOf) value.allOf.forEach(item => {
                if (item.properties) flattenProps(item.properties, fieldPath, schemaName);
            });
        }
    };

    const results = await Promise.all(schemas.map(async (schema) => {
        try {
            const schemaId = schema['meta:altId'] || schema.$id;
            if (!schemaId) return null;

            const container = schema._container || 'tenant';
            const details = await getSchemaDetails(schemaId, container).catch(() => null);
            return details ? { schema, details } : null;
        } catch {
            return null;
        }
    }));

    for (const result of results) {
        if (!result) continue;
        const { details } = result;

        const schemaTitle = details.title || 'Unknown Schema';
        processedSchemas.push(schemaTitle);

        if (details.properties) flattenProps(details.properties, '', schemaTitle);
        if (details.allOf) details.allOf.forEach(item => {
            if (item.properties) flattenProps(item.properties, '', schemaTitle);
        });
    }
}

/**
 * Generate a flattened Data Dictionary for the API
 * OPTIMIZED: Stream processing, file-based cache, parallel batches
 * Results are cached for 3 days and persist across server restarts
 */
export async function generateDataDictionary(forceRefresh = false) {
    // 1. Check in-memory cache first
    if (!forceRefresh && dictionaryCache && dictionaryCacheTime) {
        const age = Date.now() - dictionaryCacheTime;
        if (age < CACHE_TTL_MS) {
            console.log(`[Dictionary] Returning cached data (${Math.round(age / 1000)}s old)`);
            return { ...dictionaryCache, cached: true };
        }
    }

    // 2. Try to load from file cache
    if (!forceRefresh && loadCacheFromFile()) {
        return { ...dictionaryCache, cached: true };
    }

    console.log(`[Dictionary] Building fresh dictionary with stream processing...`);
    const startTime = Date.now();

    try {
        const allFields = [];
        const processedSchemas = [];
        const BATCH_SIZE = 20;

        // 3. STREAM PROCESSING: Start tenant and global fetches concurrently
        // Process tenant schemas AS THEY ARRIVE while global continues fetching
        const tenantPromise = listAllSchemas('tenant').catch(() => []);
        const globalPromise = listAllSchemas('global').catch(() => []);

        // Start processing tenant schemas immediately
        console.log('[Dictionary] Fetching tenant schemas...');
        const tenantSchemas = (await tenantPromise).map(s => ({ ...s, _container: 'tenant' }));
        console.log(`[Dictionary] Processing ${tenantSchemas.length} tenant schemas while global fetches...`);

        // Process tenant in parallel batches
        for (let i = 0; i < tenantSchemas.length; i += BATCH_SIZE) {
            const batch = tenantSchemas.slice(i, i + BATCH_SIZE);
            console.log(`[Dictionary] Tenant batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tenantSchemas.length / BATCH_SIZE)}`);
            await processSchemasBatch(batch, allFields, processedSchemas);
        }

        console.log(`[Dictionary] Tenant done (${processedSchemas.length} schemas, ${allFields.length} fields). Now processing global...`);

        // Now process global schemas (should be ready or nearly ready by now)
        const globalSchemas = (await globalPromise).map(s => ({ ...s, _container: 'global' }));
        console.log(`[Dictionary] Processing ${globalSchemas.length} global schemas...`);

        for (let i = 0; i < globalSchemas.length; i += BATCH_SIZE) {
            const batch = globalSchemas.slice(i, i + BATCH_SIZE);
            console.log(`[Dictionary] Global batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(globalSchemas.length / BATCH_SIZE)}`);
            await processSchemasBatch(batch, allFields, processedSchemas);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Dictionary] Complete! ${allFields.length} fields from ${processedSchemas.length} schemas in ${elapsed}s`);

        // 4. Cache the result (both in-memory and file)
        const result = {
            generatedAt: new Date().toISOString(),
            totalSchemas: processedSchemas.length,
            schemas: processedSchemas,
            fields: allFields,
            processingTime: `${elapsed}s`,
            cached: false
        };

        dictionaryCache = result;
        dictionaryCacheTime = Date.now();
        saveCacheToFile(result);

        return result;

    } catch (error) {
        console.error('[Dictionary] Error generating dictionary:', error);
        return {
            generatedAt: new Date().toISOString(),
            totalSchemas: 0,
            schemas: [],
            fields: [],
            error: error.message
        };
    }
}
