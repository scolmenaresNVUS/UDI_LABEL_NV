import React, { useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Line, Group, Transformer } from 'react-konva';
import Konva from 'konva';
import type { LabelElement, LabelTemplate } from '../../types/template.types';

const SCALE = 4; // 4 pixels per mm

interface Props {
  template: LabelTemplate;
  elements: LabelElement[];
  selectedId: string | null;
  zoom: number;
  showGrid: boolean;
  onSelect: (id: string | null) => void;
  onElementMove: (id: string, x_mm: number, y_mm: number) => void;
}

export default function DesignerCanvas({
  template, elements, selectedId, zoom, showGrid,
  onSelect, onElementMove,
}: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const selectedRef = useRef<Konva.Node>(null);

  const s = SCALE * zoom;
  const w = template.widthMm * s;
  const h = template.heightMm * s;
  const margin = (template.marginMm || 1) * s;

  useEffect(() => {
    if (trRef.current && selectedRef.current) {
      trRef.current.nodes([selectedRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  const snapToGrid = useCallback((val: number) => {
    if (!showGrid) return val;
    const gridMm = 0.5;
    return Math.round(val / gridMm) * gridMm;
  }, [showGrid]);

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const x_mm = snapToGrid(node.x() / s);
    const y_mm = snapToGrid(node.y() / s);
    onElementMove(id, x_mm, y_mm);
  };

  const renderElement = (el: LabelElement) => {
    const x = el.x_mm * s;
    const y = el.y_mm * s;
    const isSelected = el.id === selectedId;
    const commonProps = {
      x, y,
      draggable: !el.locked,
      onClick: () => onSelect(el.id),
      onTap: () => onSelect(el.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el.id, e),
      ref: isSelected ? (selectedRef as React.RefObject<Konva.Node>) : undefined,
    };

    switch (el.type) {
      case 'datamatrix': {
        const dmSize = (el.moduleSize || 4) * 24 / SCALE * s / 4;
        return (
          <Group key={el.id} {...(commonProps as any)}>
            <Rect width={dmSize} height={dmSize} fill="#f0f0f0" stroke="#999" strokeWidth={1} dash={[3, 3]} />
            <Text text="DM" x={dmSize / 2 - 8} y={dmSize / 2 - 5} fontSize={10} fill="#666" />
          </Group>
        );
      }
      case 'hri_text': {
        const fs = Math.max(8, el.fontSize * s / 4);
        const lines = ['(01) GTIN...', '(10) LOT...', '(11) DATE...'];
        return (
          <Group key={el.id} {...(commonProps as any)}>
            {lines.map((line, i) => (
              <Text key={i} text={line} y={i * (fs + el.lineSpacing * s)} fontSize={fs} fontFamily="monospace" fill="#333" />
            ))}
          </Group>
        );
      }
      case 'static_text': {
        const fs = Math.max(8, el.fontSize * s / 4);
        return (
          <Text key={el.id} {...(commonProps as any)} text={el.text || 'Text'} fontSize={fs}
            fontStyle={el.bold ? 'bold' : 'normal'} fill="#333" />
        );
      }
      case 'line': {
        const points = [0, 0, (el.endX_mm - el.x_mm) * s, (el.endY_mm - el.y_mm) * s];
        return <Line key={el.id} {...(commonProps as any)} points={points} stroke="#333" strokeWidth={el.thickness} />;
      }
      case 'rectangle': {
        return (
          <Rect key={el.id} {...(commonProps as any)} width={el.width_mm * s} height={el.height_mm * s}
            stroke="#333" strokeWidth={el.borderThickness} fill={el.filled ? '#ddd' : 'transparent'} />
        );
      }
    }
  };

  // Grid lines
  const gridLines: React.JSX.Element[] = [];
  if (showGrid) {
    const gridMm = 0.5;
    for (let x = 0; x <= template.widthMm; x += gridMm) {
      gridLines.push(
        <Line key={`gv${x}`} points={[x * s, 0, x * s, h]} stroke="#e5e5e5" strokeWidth={0.5} opacity={0.3} />
      );
    }
    for (let y = 0; y <= template.heightMm; y += gridMm) {
      gridLines.push(
        <Line key={`gh${y}`} points={[0, y * s, w, y * s]} stroke="#e5e5e5" strokeWidth={0.5} opacity={0.3} />
      );
    }
  }

  return (
    <div className="flex justify-center p-4 bg-gray-100 rounded-lg overflow-auto" style={{ minHeight: 300 }}>
      <Stage width={w + 20} height={h + 20} onClick={(e) => {
        if (e.target === e.target.getStage()) onSelect(null);
      }}>
        <Layer>
          {/* Shadow */}
          <Rect x={12} y={12} width={w} height={h} fill="#ccc" cornerRadius={1} />
          {/* Label surface */}
          <Rect x={0} y={0} width={w} height={h} fill="white" stroke="#aaa" strokeWidth={1} />
          {/* Grid */}
          {gridLines}
          {/* Margin safe zone */}
          <Rect x={margin} y={margin} width={w - margin * 2} height={h - margin * 2}
            stroke="#3b82f6" strokeWidth={1} dash={[4, 4]} opacity={0.4} />
          {/* Elements */}
          {elements.map(renderElement)}
          {/* Transformer */}
          <Transformer ref={trRef as any} rotateEnabled={false} borderStroke="#3b82f6" anchorFill="#3b82f6" />
        </Layer>
      </Stage>
    </div>
  );
}
