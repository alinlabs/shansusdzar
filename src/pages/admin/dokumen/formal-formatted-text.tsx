import { parseFormalTextBlocks } from '../../../lib/formal-list-format';

interface FormalFormattedTextProps {
  text: string;
  className?: string;
}

export function FormalFormattedText({ text, className = '' }: FormalFormattedTextProps) {
  const blocks = parseFormalTextBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-1.5 text-xs sm:text-sm text-[#222222] leading-relaxed ${className}`}>
      {blocks.map((block, index) => {
        if (block.kind === 'list') {
          const indentClass = block.level === 1 ? 'pl-8' : 'pl-4';
          return (
            <div key={index} className={`${indentClass} flex items-start gap-2`}>
              <span className="shrink-0 min-w-[1.25rem] tabular-nums select-none">
                {block.marker}
              </span>
              <p className="flex-1 text-justify">{block.body}</p>
            </div>
          );
        }

        return (
          <p key={index} className="text-justify">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
