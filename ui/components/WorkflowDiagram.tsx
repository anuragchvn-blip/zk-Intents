'use client';

import { useEffect, useRef } from 'react';

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'user' | 'sequencer' | 'prover' | 'l1';
  pulse: number;
}

export default function WorkflowDiagram() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handler
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = 400;
    };
    window.addEventListener('resize', resize);
    resize();

    // Configuration
    const colors = {
      sea: '#4DA2FF',
      aqua: '#C0E6FF',
      purple: '#A78BFA',
      green: '#34D399',
      bg: '#030F1C',
    };

    // Nodes
    const nodes: Node[] = [
      { id: 'user', x: 0.1, y: 0.5, label: 'User Intent', type: 'user', pulse: 0 },
      { id: 'seq', x: 0.35, y: 0.5, label: 'Sequencer', type: 'sequencer', pulse: 0 },
      { id: 'p1', x: 0.6, y: 0.25, label: 'Prover 1', type: 'prover', pulse: 0 },
      { id: 'p2', x: 0.6, y: 0.5, label: 'Prover 2', type: 'prover', pulse: 0 },
      { id: 'p3', x: 0.6, y: 0.75, label: 'Prover 3', type: 'prover', pulse: 0 },
      { id: 'l1', x: 0.9, y: 0.5, label: 'L1 Settlement', type: 'l1', pulse: 0 },
    ];

    const packets: Array<{ from: number; to: number; progress: number; speed: number; color: string }> = [];
    let frame = 0;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const w = canvas.width;
      const h = canvas.height;

      // Update Node Positions
      const absNodes = nodes.map(n => ({
        ...n,
        x: n.x * w,
        y: n.y * h,
      }));

      // Draw Connections
      ctx.lineWidth = 2;
      
      const drawConnection = (start: typeof absNodes[0], end: typeof absNodes[0], color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.1;
        
        const cp1x = start.x + (end.x - start.x) * 0.5;
        const cp1y = start.y;
        const cp2x = start.x + (end.x - start.x) * 0.5;
        const cp2y = end.y;

        ctx.moveTo(start.x, start.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end.x, end.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      };

      // Draw all connections
      drawConnection(absNodes[0], absNodes[1], colors.sea);
      drawConnection(absNodes[1], absNodes[2], colors.purple);
      drawConnection(absNodes[1], absNodes[3], colors.purple);
      drawConnection(absNodes[1], absNodes[4], colors.purple);
      drawConnection(absNodes[2], absNodes[5], colors.green);
      drawConnection(absNodes[3], absNodes[5], colors.green);
      drawConnection(absNodes[4], absNodes[5], colors.green);

      // Spawn Packets
      if (frame % 120 === 0) {
        packets.push({ from: 0, to: 1, progress: 0, speed: 0.015, color: colors.sea });
      }

      // Update & Draw Packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.progress += p.speed;

        const start = absNodes[p.from];
        const end = absNodes[p.to];

        // Bezier calculation
        const t = p.progress;
        const cp1x = start.x + (end.x - start.x) * 0.5;
        const cp1y = start.y;
        const cp2x = start.x + (end.x - start.x) * 0.5;
        const cp2y = end.y;

        const cx = 3 * (cp1x - start.x);
        const bx = 3 * (cp2x - cp1x) - cx;
        const ax = end.x - start.x - cx - bx;
        const x = (ax * Math.pow(t, 3)) + (bx * Math.pow(t, 2)) + (cx * t) + start.x;

        const cy = 3 * (cp1y - start.y);
        const by = 3 * (cp2y - cp1y) - cy;
        const ay = end.y - start.y - cy - by;
        const y = (ay * Math.pow(t, 3)) + (by * Math.pow(t, 2)) + (cy * t) + start.y;

        // Draw Packet
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Arrival Logic
        if (p.progress >= 1) {
          packets.splice(i, 1);
          nodes[p.to].pulse = 1;

          if (p.to === 1) {
            packets.push({ from: 1, to: 2, progress: 0, speed: 0.01, color: colors.purple });
            packets.push({ from: 1, to: 3, progress: 0, speed: 0.01, color: colors.purple });
            packets.push({ from: 1, to: 4, progress: 0, speed: 0.01, color: colors.purple });
          } else if (p.to >= 2 && p.to <= 4) {
            packets.push({ from: p.to, to: 5, progress: 0, speed: 0.01, color: colors.green });
          }
        }
      }

      // Draw Nodes
      absNodes.forEach((node, idx) => {
        if (nodes[idx].pulse > 0) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 20 + (nodes[idx].pulse * 20), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${nodes[idx].pulse})`;
          ctx.stroke();
          nodes[idx].pulse -= 0.05;
        }

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 24, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = idx === 0 ? colors.sea : idx === 1 ? colors.aqua : idx === 5 ? colors.green : colors.purple;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.type.toUpperCase().slice(0, 3), node.x, node.y);

        ctx.fillStyle = '#8490A5';
        ctx.font = '12px Inter';
        ctx.fillText(node.label, node.x, node.y + 40);
      });

      requestAnimationFrame(draw);
    };

    const animationId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[400px] bg-sui-deep/50 rounded-3xl overflow-hidden relative">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute bottom-4 right-4 flex gap-4 text-xs font-mono text-sui-steel">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4DA2FF]"></div> Intent
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#A78BFA]"></div> Proof
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#34D399]"></div> State
        </div>
      </div>
    </div>
  );
}
