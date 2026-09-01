import { Fragment } from "react";

/**
 * Renders the written pages.
 *
 * A deliberately tiny reader rather than a markdown library: the owner writes
 * these in the settings table, and the only structure they need is headings,
 * bullets and paragraphs. Anything richer would be a dependency carried on
 * every page load for two screens nobody visits twice.
 *
 * It reads line by line rather than splitting on blank lines, because a heading
 * followed immediately by its paragraph is the way people actually type — and
 * a parser that only works when the author leaves a blank line in the right
 * place is a parser that will be wrong the first time somebody edits the text.
 *
 * The copy is the shop's own, never a customer's, and it is rendered as text
 * nodes — never as HTML.
 */

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of source.split("\n")) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flush();
  return blocks;
}

export function LegalText({ text }: { text: string }) {
  const blocks = parse(text);

  return (
    <article className="rounded-3xl border border-line bg-surface p-5">
      {blocks.map((block, index) => (
        <Fragment key={index}>
          {block.kind === "heading" && (
            <h2 className="pb-0.5 pt-6 text-sm font-bold leading-[1.7] text-fg first:pt-0">
              {block.text}
            </h2>
          )}

          {block.kind === "paragraph" && (
            <p className="pt-2 text-sm leading-[1.9] text-muted">{block.text}</p>
          )}

          {block.kind === "list" && (
            <ul className="space-y-2 pt-2.5">
              {block.items.map((item, position) => (
                <li key={position} className="flex gap-2.5 text-sm leading-[1.9] text-muted">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </article>
  );
}
