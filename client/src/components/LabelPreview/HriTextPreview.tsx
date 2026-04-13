interface Props {
  lines: string[];
  fontSize?: number;
  fontFamily?: string;
}

const FONT_FAMILIES: Record<string, string> = {
  monospace: '"Courier New", Courier, monospace',
  verdana: 'Verdana, Geneva, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
};

export function getFontCss(fontFamily?: string): string {
  return FONT_FAMILIES[fontFamily || 'monospace'] || FONT_FAMILIES.monospace;
}

export default function HriTextPreview({ lines, fontSize = 11, fontFamily }: Props) {
  return (
    <div className="text-gray-900" style={{ fontSize, lineHeight: 1.5, fontFamily: getFontCss(fontFamily) }}>
      {lines.map((line, i) => (
        <p key={i} className={`truncate ${i === 0 ? 'font-bold' : ''}`}>
          {line}
        </p>
      ))}
    </div>
  );
}
