import { useState } from 'react';

/**
 * JSONViewer - Displays data with toggle between formatted and raw JSON views
 * 
 * Props:
 * - data: The data to display
 * - title: Optional title for the section
 * - defaultView: 'formatted' or 'json' (default: 'formatted')
 * - formattedContent: React node for the formatted view
 * - maxHeight: Max height for scrollable content
 */
export function JSONViewer({
    data,
    title,
    defaultView = 'formatted',
    formattedContent,
    maxHeight = '400px'
}) {
    const [viewMode, setViewMode] = useState(defaultView);
    const [copied, setCopied] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expanded, setExpanded] = useState(true);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const jsonString = JSON.stringify(data, null, 2);
    const highlightedJson = searchTerm
        ? jsonString.replace(
            new RegExp(`(${searchTerm})`, 'gi'),
            '<mark style="background: var(--accent-yellow); color: black;">$1</mark>'
        )
        : jsonString;

    return (
        <div className="json-viewer">
            {/* Header */}
            <div className="json-viewer-header">
                <div className="json-viewer-title">
                    {title && <span>{title}</span>}
                </div>
                <div className="json-viewer-actions">
                    {/* View Toggle */}
                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'formatted' ? 'active' : ''}`}
                            onClick={() => setViewMode('formatted')}
                            title="Formatted View"
                        >
                            ≡
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'json' ? 'active' : ''}`}
                            onClick={() => setViewMode('json')}
                            title="JSON View"
                        >
                            {'{ }'}
                        </button>
                    </div>

                    {/* Copy Button */}
                    <button
                        className="copy-btn"
                        onClick={copyToClipboard}
                        title="Copy JSON"
                    >
                        {copied ? '✓ Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Search (JSON mode only) */}
            {viewMode === 'json' && (
                <div className="json-search">
                    <input
                        type="text"
                        placeholder="Search in JSON..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')}>✕</button>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="json-viewer-content" style={{ maxHeight }}>
                {viewMode === 'formatted' && formattedContent ? (
                    formattedContent
                ) : (
                    <pre
                        className="json-code"
                        dangerouslySetInnerHTML={{ __html: highlightedJson }}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * CopyButton - Click to copy text with feedback
 */
export function CopyButton({ text, label = 'Copy' }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            className="copy-btn"
            onClick={handleCopy}
            title="Copy to clipboard"
        >
            {copied ? '✓' : label}
        </button>
    );
}

/**
 * TabPanel - Reusable tab navigation component
 */
export function TabPanel({ tabs, activeTab, onTabChange, children }) {
    return (
        <div className="tab-panel">
            <div className="tab-header">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className="tab-count">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>
            <div className="tab-content">
                {children}
            </div>
        </div>
    );
}

/**
 * DetailField - Display a labeled field with optional copy
 */
export function DetailField({ label, value, mono = false, copyable = false }) {
    return (
        <div className="detail-field">
            <div className="detail-field-label">{label}</div>
            <div className={`detail-field-value ${mono ? 'mono' : ''}`}>
                {value || 'N/A'}
                {copyable && value && <CopyButton text={String(value)} label="📋" />}
            </div>
        </div>
    );
}

/**
 * StatusBadge - Colored status indicator
 */
export function StatusBadge({ status, size = 'normal' }) {
    const getClass = () => {
        const s = String(status).toLowerCase();
        if (['success', 'active', 'enabled', 'completed', 'succeeded'].includes(s)) return 'success';
        if (['failed', 'error', 'disabled', 'failure'].includes(s)) return 'error';
        if (['pending', 'processing', 'running', 'loading', 'draft'].includes(s)) return 'warning';
        return 'info';
    };

    return (
        <span className={`status-badge ${getClass()} ${size}`}>
            {status || 'Unknown'}
        </span>
    );
}

/**
 * LoadingSpinner - Centered loading indicator
 */
export function LoadingSpinner({ text = 'Loading...' }) {
    return (
        <div className="loading">
            <div className="spinner"></div>
            {text && <span style={{ marginTop: '12px', color: 'var(--text-muted)' }}>{text}</span>}
        </div>
    );
}

/**
 * EmptyState - Display when no data available
 */
export function EmptyState({ message = 'No data found', icon = '📭' }) {
    return (
        <div className="empty-state">
            <span className="empty-icon">{icon}</span>
            <span className="empty-message">{message}</span>
        </div>
    );
}

/**
 * Modal - Reusable modal dialog
 */
export function Modal({ isOpen, onClose, title, children, width = '700px' }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                style={{ width, maxWidth: '90vw' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * ClickableId - ID that can be clicked to navigate and copied
 */
export function ClickableId({ id, onClick, maxLength = 25 }) {
    const displayId = id?.length > maxLength ? `${id.substring(0, maxLength)}...` : id;

    return (
        <span className="clickable-id">
            <span
                className="id-text"
                onClick={onClick}
                title={id}
            >
                {displayId}
            </span>
            <CopyButton text={id} label="📋" />
        </span>
    );
}
