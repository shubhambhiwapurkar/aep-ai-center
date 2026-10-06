// Simple 18px workflow-style icons (stroke = currentColor).
const PATHS = {
    home: 'M3 8.5 9 3l6 5.5V15a1 1 0 0 1-1 1h-3.5v-4.5h-3V16H4a1 1 0 0 1-1-1z',
    journey: 'M4 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM14 11.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM4 6.5V10a3 3 0 0 0 3 3h5.5M14 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5.5 5h7',
    designer: 'M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM12.5 10v5M10 12.5h5',
    chat: 'M3 4h12v8H8l-3.5 3v-3H3z',
    context: 'M9 2.5c3.3 0 6 1 6 2.5S12.3 7.5 9 7.5 3 6.5 3 5s2.7-2.5 6-2.5zM3 5v8c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M3 9c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5',
    settings: 'M9 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4',
    refresh: 'M15 9a6 6 0 1 1-1.8-4.3M15 3v3.5h-3.5',
    expand: 'M10.5 3H15v4.5M15 3l-5.5 5.5M7.5 15H3v-4.5M3 15l5.5-5.5',
    alert: 'M9 2.5 16 15H2zM9 7v4M9 12.8v.2',
    check: 'M3.5 9.5 7 13l7.5-8',
    sparkle: 'M9 2v4M9 12v4M2 9h4M12 9h4M4.5 4.5l2 2M11.5 11.5l2 2M4.5 13.5l2-2M11.5 6.5l2-2',
    back: 'M11 4 6 9l5 5',
    plus: 'M9 3v12M3 9h12',
    upload: 'M9 12V3M5.5 6.5 9 3l3.5 3.5M3 12v3h12v-3',
    template: 'M3 3h12v4H3zM3 9h5v6H3zM10 9h5v6h-5z'
};

export default function Icon({ name, size = 18, className = '' }) {
    return (
        <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 18 18" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={PATHS[name] || ''} />
        </svg>
    );
}
