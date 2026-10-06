import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// LLM output is rendered without raw HTML (react-markdown's default) so a reply can never inject markup.
const components = {
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
};

export default function Markdown({ children }) {
    return (
        <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children || ''}</ReactMarkdown>
        </div>
    );
}
