import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  source: string;
}

/**
 * Read-only markdown renderer styled with Tailwind. GFM adds table
 * + strikethrough + autolink support. We deliberately don't support
 * raw HTML — content is admin-trusted but better safe than sorry.
 */
export function MarkdownView({ source }: Props) {
  return (
    <div className="prose-fk flex flex-col gap-4 text-ink-primary [&_a]:text-brand-400 [&_a:hover]:text-brand-300 [&_a]:underline [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-700 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-600 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:text-ink-primary [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_p]:leading-relaxed [&_blockquote]:border-l-4 [&_blockquote]:border-brand-600 [&_blockquote]:pl-3 [&_blockquote]:text-ink-secondary">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
