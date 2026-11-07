/**
 * Query Service SQL linter. Catches the patterns that make AEP Query Service queries slow,
 * expensive or wrong. Runs locally - the SQL never leaves the browser.
 *
 * Based on Adobe's Query Service best-practice guidance (experienceleague.adobe.com →
 * Query Service → Best practices / Troubleshooting).
 *
 * Returns [{ id, severity: 'error'|'warning'|'info', title, detail, fix }].
 */

/** Remove comments and string literal contents so rules don't fire on text inside them. */
export function stripSql(sql) {
    return String(sql || '')
        .replace(/--[^\n]*/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/'(?:[^']|'')*'/g, "''");
}

const TIME_COLS = /\b(timestamp|_acp_system_metadata\.ingesttime|ingesttime|eventtime|event_time|date|day|_acp_system_metadata)\b/i;

export function lintSql(sql) {
    const raw = String(sql || '');
    const s = stripSql(raw);
    const flat = s.replace(/\s+/g, ' ').trim();
    const issues = [];
    const add = (id, severity, title, detail, fix) => issues.push({ id, severity, title, detail, fix });
    if (!flat) return issues;

    const isSelect = /^\s*(with\b[\s\S]*?\)\s*)?select\b/i.test(flat) || /^\s*select\b/i.test(flat);
    const isCtas = /\bcreate\s+table\b[\s\S]*\bas\b/i.test(flat);
    const isInsert = /^\s*insert\s+into\b/i.test(flat);
    const hasFrom = /\bfrom\b/i.test(flat);
    const where = flat.match(/\bwhere\b([\s\S]*?)(\bgroup\s+by\b|\border\s+by\b|\blimit\b|\bunion\b|\)\s*$|$)/i)?.[1] || '';
    const hasAgg = /\b(count|sum|avg|min|max|approx_count_distinct|percentile\w*)\s*\(/i.test(flat) || /\bgroup\s+by\b/i.test(flat);
    const hasLimit = /\blimit\s+\d+/i.test(flat);

    if (/\bselect\s+(distinct\s+)?\*/i.test(flat)) {
        add('select-star', 'warning', 'SELECT *',
            'XDM rows are wide and deeply nested. SELECT * reads every column, which is slow and can exceed result size limits.',
            'List only the fields you need, e.g. SELECT timestamp, web.webPageDetails.name.');
    }

    // Profile snapshot / attribute tables are not time-partitioned
    const snapshotOnly = /\bfrom\s+[\w."]*\w*(profile_snapshot|profile_attribute|_snapshot)\w*/i.test(flat);
    if (hasFrom && (isSelect || isCtas || isInsert) && !snapshotOnly && !TIME_COLS.test(where)) {
        add('no-time-filter', 'warning', 'No time filter',
            'Experience Event datasets are partitioned by time. Without a time range the query scans the whole dataset.',
            "Add a range on the partition column: WHERE timestamp >= now() - INTERVAL '7' DAY.");
    }

    if (/\bwhere\b[\s\S]*\b(date|to_date|date_format|year|month|day|cast)\s*\(\s*timestamp\b/i.test(flat)) {
        add('fn-on-timestamp', 'warning', 'Function wrapped around timestamp in WHERE',
            'Wrapping the partition column in a function prevents partition pruning, so every partition is read.',
            "Compare the raw column to a range: timestamp >= TIMESTAMP '2026-01-01' AND timestamp < TIMESTAMP '2026-02-01'.");
    }

    if (isSelect && !isCtas && !isInsert && !hasAgg && !hasLimit) {
        add('no-limit', 'info', 'No LIMIT on an exploratory query',
            'Interactive queries return at most 50,000 rows and time out after 10 minutes. Large result sets are slow to fetch.',
            'Add LIMIT 100 while exploring, or write results to a dataset with CREATE TABLE AS SELECT.');
    }

    if (/\border\s+by\b/i.test(flat) && !hasLimit && !isCtas && !isInsert) {
        add('order-no-limit', 'warning', 'ORDER BY without LIMIT',
            'A global sort over a large dataset is one of the most expensive operations in Query Service.',
            'Add a LIMIT, or drop the ORDER BY if the consumer does not need sorted rows.');
    }

    if (/\bcount\s*\(\s*distinct\b/i.test(flat)) {
        add('count-distinct', 'info', 'COUNT(DISTINCT …) on large data',
            'Exact distinct counts shuffle every value. On billions of events this is slow.',
            'Use approx_count_distinct(col) when an estimate within ~2% is acceptable.');
    }

    if (/\bfrom\s+[\w."]+\s*(\w+\s*)?,\s*[\w."]+/i.test(flat) && !/\bwhere\b/i.test(flat)) {
        add('cartesian', 'error', 'Comma join without a condition',
            'Listing tables with commas and no WHERE clause produces a cartesian product.',
            'Use an explicit JOIN … ON a.key = b.key.');
    }

    if (/\bjoin\b/i.test(flat) && !/\b(on|using)\b/i.test(flat) && !/\bcross\s+join\b/i.test(flat)) {
        add('join-no-on', 'error', 'JOIN without ON',
            'A JOIN with no join condition multiplies every row of one side by every row of the other.',
            'Add ON a.key = b.key (or write CROSS JOIN if that is really intended).');
    }

    if (/identitymap\s*\[\s*''\s*\](?!\s*\[)/i.test(flat)) {
        add('identitymap-array', 'info', 'identityMap entry used without an index',
            'identityMap values are arrays of identity objects, not scalars.',
            "Read one identity with identityMap['Email'][0].id, or explode(identityMap['Email']) for all of them.");
    }

    if (/\blike\s+''/i.test(flat) && /like\s+'%/i.test(raw)) {
        add('leading-wildcard', 'info', "LIKE with a leading '%'",
            'A leading wildcard cannot use any data skipping and forces a full scan of the column.',
            'Filter on a prefix, or narrow the time range first.');
    }

    if (isCtas && !/\bwith\s*\(\s*schema\s*=/i.test(flat)) {
        add('ctas-no-schema', 'info', 'CREATE TABLE AS without a target schema',
            'Without WITH (schema=…) Query Service creates an ad-hoc schema, which cannot be enabled for Profile or reused.',
            "Add WITH (schema='your_schema_title') to write into an existing XDM schema.");
    }

    if (/\bdelete\s+from\b|\bdrop\s+table\b|\btruncate\b/i.test(flat)) {
        add('destructive', 'error', 'Destructive statement',
            'DROP / DELETE / TRUNCATE remove data or datasets and cannot be undone from Query Service.',
            'Run it in a development sandbox first and double-check the target.');
    }

    if (/(^|[\s,(])_[a-z0-9]+(\.[a-z0-9_]+)*\.[a-z0-9_]*[a-z]-[a-z]/i.test(flat.replace(/"[^"]*"/g, '""'))) {
        add('unquoted-hyphen', 'warning', 'Field path with a hyphen',
            'Field names containing "-" must be quoted, otherwise they are parsed as subtraction.',
            'Wrap the path segment in double quotes: _tenant."loyalty-tier".');
    }

    return issues;
}
