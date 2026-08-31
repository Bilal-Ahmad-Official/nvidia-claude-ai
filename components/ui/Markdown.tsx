"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import CopyButton from "./CopyButton";

function extractText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  const n = node as { props?: { children?: unknown } };
  return n?.props ? extractText(n.props.children) : "";
}

function extractLang(node: unknown): string {
  if (Array.isArray(node)) {
    for (const c of node) {
      const l = extractLang(c);
      if (l) return l;
    }
    return "";
  }
  const n = node as { props?: { className?: string; children?: unknown } };
  const m = n?.props?.className?.match(/language-([\w+-]+)/);
  if (m) return m[1];
  return n?.props ? extractLang(n.props.children) : "";
}

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre({ children }) {
          const code = extractText(children).replace(/\n$/, "");
          const lang = extractLang(children);
          return (
            <div className="my-3 overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="flex items-center justify-between bg-[var(--hover)] px-4 py-1.5 text-xs text-[var(--muted)]">
                <span>{lang || "code"}</span>
                <CopyButton text={code} className="text-[var(--muted)]" />
              </div>
              <pre className="overflow-x-auto bg-[var(--code-bg)] p-4 text-[13px] leading-6 text-[var(--text)]">
                {children}
              </pre>
            </div>
          );
        },
        code({ className, children, ...props }) {
          const inline = !/language-/.test(className ?? "");
          if (inline) {
            return (
              <code
                className="rounded bg-[var(--inline-code-bg)] px-1.5 py-0.5 text-[13px] text-[var(--inline-code-text)]"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={`${className ?? ""} hljs`} {...props}>
              {children}
            </code>
          );
        },
        a: (props) => (
          <a
            {...props}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] underline underline-offset-2"
          />
        ),
        p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
        ul: (props) => <ul className="my-2 list-disc space-y-1 pl-6" {...props} />,
        ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-6" {...props} />,
        h1: (props) => <h1 className="mb-2 mt-4 text-xl font-bold" {...props} />,
        h2: (props) => <h2 className="mb-2 mt-4 text-lg font-bold" {...props} />,
        h3: (props) => <h3 className="mb-1 mt-3 text-base font-semibold" {...props} />,
        blockquote: (props) => (
          <blockquote
            className="my-3 border-l-2 border-[var(--accent)] pl-3 italic text-[var(--text)]"
            {...props}
          />
        ),
        table: (props) => (
          <div className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm" {...props} />
          </div>
        ),
        th: (props) => (
          <th
            className="border border-[var(--border)] bg-[var(--hover)] px-3 py-1.5 text-left"
            {...props}
          />
        ),
        td: (props) => (
          <td className="border border-[var(--border)] px-3 py-1.5" {...props} />
        ),
        hr: () => <hr className="my-4 border-[var(--border)]" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}