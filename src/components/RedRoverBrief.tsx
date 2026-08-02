import { Fragment, type ReactNode } from "react";

/** Minimal markdown renderer for the Engagement Brief (headings, bold, lists). */
function renderInline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-900">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>
    ),
  );
}

export function MarkdownBrief({ md }: { md: string }) {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 ml-5 list-disc space-y-1 text-sm text-slate-700">
          {list}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flush();
      out.push(<h4 key={idx} className="mt-4 mb-1 text-sm font-semibold text-slate-800">{renderInline(line.replace(/^###\s+/, ""), `h4-${idx}`)}</h4>);
    } else if (/^##\s+/.test(line)) {
      flush();
      out.push(<h3 key={idx} className="mt-5 mb-1 text-base font-bold text-slate-900">{renderInline(line.replace(/^##\s+/, ""), `h3-${idx}`)}</h3>);
    } else if (/^#\s+/.test(line)) {
      flush();
      out.push(<h2 key={idx} className="mt-2 mb-2 text-lg font-bold text-slate-900">{renderInline(line.replace(/^#\s+/, ""), `h2-${idx}`)}</h2>);
    } else if (/^[-*]\s+/.test(line)) {
      list.push(<li key={idx}>{renderInline(line.replace(/^[-*]\s+/, ""), `li-${idx}`)}</li>);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(<p key={idx} className="my-1 text-sm text-slate-700">{renderInline(line, `p-${idx}`)}</p>);
    }
  });
  flush();
  return <div className="max-w-none">{out}</div>;
}
