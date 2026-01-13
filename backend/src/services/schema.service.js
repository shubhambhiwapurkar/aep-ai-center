import fetch from 'node-fetch';
import { config } from '../config/config.js';
import { getAccessToken } from './auth.service.js';

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
