import type { ReactNode } from 'react';

/** Renderizador mínimo y seguro de Markdown: construye elementos React, nunca inserta HTML crudo. */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

function inline(text: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={index} className="rounded bg-card-3 px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{link[1]}</a> : <span key={index}>{link[1]}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  const flushList = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`} className="list-disc space-y-0.5 pl-5">{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>);
    list = [];
  };
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={`p${blocks.length}`}>{inline(paragraph.join(' '))}</p>);
    paragraph = [];
  };
  source.split(/\r?\n/).forEach((line) => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushList(); flushParagraph();
      blocks.push(<h3 key={`h${blocks.length}`} className={`font-label-bold ${heading[1].length === 1 ? 'text-lg' : 'text-base'}`}>{inline(heading[2])}</h3>);
    } else if (bullet) {
      flushParagraph(); list.push(bullet[1]);
    } else if (!line.trim()) {
      flushList(); flushParagraph();
    } else {
      flushList(); paragraph.push(line.trim());
    }
  });
  flushList(); flushParagraph();
  return <div className={`space-y-2 text-on-surface-variant ${className}`}>{blocks}</div>;
}
