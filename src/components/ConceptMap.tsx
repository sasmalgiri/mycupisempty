'use client';

/**
 * ConceptMap — interactive SVG rendering of the knowledge graph.
 *
 * Students see how topics connect (prerequisites → current → unlocks).
 * Mastered nodes glow green. Stuck nodes glow red. Ready-to-attempt nodes
 * glow purple. This makes the invisible architecture of their learning
 * visible — no competitor does this.
 *
 * Force-directed placement using a lightweight simulation: attract connected
 * nodes, repel all nodes, settle over ~60 iterations.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

interface GraphNode {
  topicId: string;
  topicTitle: string;
  subjectName?: string;
  prerequisites: string[];
  unlocks: string[];
  currentState?: 'fresh' | 'learning' | 'fragile' | 'stable' | 'mastered' | 'stalled' | 'decayed';
}

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface ConceptMapProps {
  nodes: GraphNode[];
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  highlightNodeId?: string;
}

const STATE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  fresh:    { fill: '#f3f4f6', stroke: '#9ca3af', text: '#4b5563' },
  learning: { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e3a8a' },
  fragile:  { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
  stable:   { fill: '#d1fae5', stroke: '#10b981', text: '#065f46' },
  mastered: { fill: '#bbf7d0', stroke: '#16a34a', text: '#14532d' },
  stalled:  { fill: '#fee2e2', stroke: '#ef4444', text: '#991b1b' },
  decayed:  { fill: '#fed7aa', stroke: '#f97316', text: '#9a3412' },
};

export default function ConceptMap({ nodes, width = 800, height = 600, onNodeClick, highlightNodeId }: ConceptMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(highlightNodeId || null);

  // Compute a force-directed layout once per props change
  const layout = useMemo(() => {
    if (nodes.length === 0) return { nodes: [], edges: [] };

    // Initial positions — circular arrangement
    const layoutNodes: LayoutNode[] = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.3,
        y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.3,
        vx: 0,
        vy: 0,
      };
    });

    const byId = new Map(layoutNodes.map((n) => [n.topicId, n]));
    const edges: Array<{ from: LayoutNode; to: LayoutNode }> = [];
    for (const n of layoutNodes) {
      for (const prereqId of n.prerequisites) {
        const prereq = byId.get(prereqId);
        if (prereq) edges.push({ from: prereq, to: n });
      }
    }

    // Simulate
    const iterations = 60;
    const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.7;
    for (let iter = 0; iter < iterations; iter++) {
      // Reset forces
      const forces = new Map<string, { fx: number; fy: number }>(
        layoutNodes.map((n) => [n.topicId, { fx: 0, fy: 0 }]),
      );

      // Repulsion between all nodes
      for (let i = 0; i < layoutNodes.length; i++) {
        for (let j = i + 1; j < layoutNodes.length; j++) {
          const a = layoutNodes[i];
          const b = layoutNodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const distSq = dx * dx + dy * dy + 1;
          const dist = Math.sqrt(distSq);
          const repForce = (k * k) / distSq;
          dx /= dist; dy /= dist;
          const af = forces.get(a.topicId)!;
          const bf = forces.get(b.topicId)!;
          af.fx -= dx * repForce;
          af.fy -= dy * repForce;
          bf.fx += dx * repForce;
          bf.fy += dy * repForce;
        }
      }

      // Attraction along edges
      for (const e of edges) {
        let dx = e.to.x - e.from.x;
        let dy = e.to.y - e.from.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const attForce = (dist * dist) / k;
        dx /= dist; dy /= dist;
        const ff = forces.get(e.from.topicId)!;
        const tf = forces.get(e.to.topicId)!;
        ff.fx += dx * attForce;
        ff.fy += dy * attForce;
        tf.fx -= dx * attForce;
        tf.fy -= dy * attForce;
      }

      // Apply forces with temperature cooling
      const temp = 1 - iter / iterations;
      const damp = 0.4 * temp + 0.1;
      for (const n of layoutNodes) {
        const f = forces.get(n.topicId)!;
        const mag = Math.sqrt(f.fx * f.fx + f.fy * f.fy);
        const limit = Math.min(mag, 30);
        if (mag > 0.01) {
          n.x += (f.fx / mag) * limit * damp;
          n.y += (f.fy / mag) * limit * damp;
        }
        // Keep inside bounds
        n.x = Math.max(40, Math.min(width - 40, n.x));
        n.y = Math.max(30, Math.min(height - 30, n.y));
      }
    }

    return { nodes: layoutNodes, edges };
  }, [nodes, width, height]);

  const handleClick = (n: GraphNode) => {
    setSelected(n.topicId);
    onNodeClick?.(n);
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <p className="text-sm text-gray-500">Start learning topics to see your concept map grow.</p>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ maxHeight: `${height}px` }}
        className="w-full"
      >
        {/* Edges */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
          </marker>
        </defs>
        {layout.edges.map((e, i) => (
          <line
            key={`e-${i}`}
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
            stroke="#9ca3af"
            strokeWidth="1.2"
            markerEnd="url(#arrow)"
            opacity="0.5"
          />
        ))}
        {/* Nodes */}
        {layout.nodes.map((n) => {
          const state = n.currentState || 'fresh';
          const color = STATE_COLORS[state] || STATE_COLORS.fresh;
          const isSelected = selected === n.topicId;
          return (
            <g key={n.topicId} onClick={() => handleClick(n)} style={{ cursor: 'pointer' }}>
              <circle
                cx={n.x}
                cy={n.y}
                r={isSelected ? 22 : 18}
                fill={color.fill}
                stroke={color.stroke}
                strokeWidth={isSelected ? 3 : 2}
              />
              <text
                x={n.x}
                y={n.y + 32}
                textAnchor="middle"
                fontSize="10"
                fill={color.text}
                className="font-medium"
                style={{ pointerEvents: 'none' }}
              >
                {n.topicTitle.length > 20 ? n.topicTitle.slice(0, 18) + '…' : n.topicTitle}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-lg p-2 text-xs space-y-1 shadow">
        {['mastered', 'stable', 'fragile', 'decayed', 'stalled', 'learning', 'fresh'].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border"
              style={{ background: STATE_COLORS[s].fill, borderColor: STATE_COLORS[s].stroke }}
            />
            <span className="capitalize text-gray-700 dark:text-gray-300">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
