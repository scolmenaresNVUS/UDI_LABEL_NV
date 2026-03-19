interface Props {
  lines: string[];
  fontSize?: number;
}

export default function HriTextPreview({ lines, fontSize = 11 }: Props) {
  return (
    <div className="font-mono text-gray-900" style={{ fontSize, lineHeight: 1.5 }}>
      {lines.map((line, i) => (
        <p key={i} className={`truncate ${i === 0 ? 'font-bold' : ''}`}>
          {line}
        </p>
      ))}
    </div>
  );
}
