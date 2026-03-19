import { useRef, useEffect, useState } from 'react';
import bwipjs from 'bwip-js';

interface Props {
  gs1String: string;
  size?: number;
}

export default function DataMatrixPreview({ gs1String, size = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !gs1String) return;

    const timer = setTimeout(() => {
      try {
        (bwipjs.toCanvas as Function)(canvasRef.current, {
          bcid: 'gs1datamatrix',
          text: gs1String,
          scale: 3,
          padding: 2,
          parsefnc: true,
        });
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Barcode error');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [gs1String]);

  if (!gs1String) {
    return (
      <div
        className="bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-400 text-xs"
        style={{ width: size, height: size }}
      >
        Enter data
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-red-900/20 border border-red-700/30 rounded flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-red-400 text-xs text-center px-2">{error}</span>
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ maxWidth: size, maxHeight: size, width: 'auto', height: 'auto' }} />;
}
