/* pulse-graph — reference implementation of the frontend-dev §5 canvas/D3
 * rules: a reusable force-directed graph (SVG + d3-force) with temporal
 * replay. Copy this file into your app (`npm i d3` — types ship with v7+);
 * it is framework-free and owns no design decisions beyond the hex literals
 * below, which mirror the active design skill's data-viz palette under the
 * SVG/canvas hex exemption. Restyle by editing the constants, not the logic.
 *
 *   - degree-scaled node radii; labels only where they stay legible
 *     (organisations + the most-connected nodes; everything else on hover)
 *   - hover focuses the node's neighbourhood and fades the rest
 *   - click pins the tooltip (.op-tooltip--pinned) so its link is clickable
 *   - zoom/pan, drag, built-in legend + hint overlays
 *   - setCutoff()/dateRange — the timeline-replay contract (frontend-dev §5)
 *
 * Expects the CSS classes specced in the active design skill's Graph
 * Explorer section: .op-graph, .dot-grid, .op-canvas-overlay,
 * .op-graph-legend, .op-graph-hint, .op-tooltip, .op-tooltip--pinned. */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select,
  zoom,
  zoomIdentity,
  drag,
  type Simulation,
  type D3ZoomEvent,
  type D3DragEvent,
} from 'd3';

export type NodeType =
  | 'Person'
  | 'Repository'
  | 'Commit'
  | 'Organisation'
  | 'Institution'
  | 'PullRequest';

/** Single source of truth for node colours — values from the active design
 * skill's data-viz palette (openpulse-dark-theme §2.6). `Institution` (a
 * ROR-identified research org) reuses the amber slot — safe as long as
 * Commit and Institution nodes never co-occur in the same view. */
export const NODE_COLORS: Record<NodeType, string> = {
  Person: '#4ade80',
  Repository: '#60a5fa',
  Commit: '#fbbf24',
  Organisation: '#a78bfa',
  Institution: '#fbbf24',
  PullRequest: '#f472b6',
};

const LINK_COLOR = '#5561a6'; // --op-blue
const RING_COLOR = '#8a94c9'; // --op-blue-light
const LABEL_COLOR = '#c0c0dc'; // --op-text-2
// SVG <text> doesn't inherit CSS — match the design skill's --op-font-body.
const FONT = "'Switzer', system-ui, sans-serif";

export interface PulseGraphNode {
  id: string;
  type: NodeType;
  name: string;
  /** Optional weight (e.g. contribution count) — scales the radius. */
  weight?: number;
  /** Extra lines for the tooltip. */
  meta?: string[];
  /** ISO date this node first appears. Absent means "date unknown" — while a
   * timeline cutoff is active the node stays hidden, only joining when the
   * cutoff is cleared (scrubbed to the end / full graph). */
  firstSeen?: string;
}

export interface PulseGraphEdge {
  source: string;
  target: string;
  type?: string;
  /** ISO date this edge first appears. Absent means the edge simply follows
   * its endpoints' visibility. */
  firstSeen?: string;
}

export interface PulseGraphOptions {
  nodes: PulseGraphNode[];
  edges: PulseGraphEdge[];
  height?: number;
  /** Called with the node on click (e.g. to fill a detail panel). */
  onSelect?: (node: PulseGraphNode | null) => void;
  /** Show the type legend overlay (default true). */
  legend?: boolean;
}

interface SimNode extends PulseGraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  degree: number;
  r: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  type?: string;
  firstSeen?: string;
}

export interface PulseGraph {
  destroy: () => void;
  /** Show only nodes/edges first seen on or before this ISO date (fades the
   * rest out in place — the simulation keeps running so nothing jumps).
   * Nodes with no `firstSeen` are hidden while a cutoff is active. Pass
   * `null` to show everything, undated nodes included. */
  setCutoff: (date: string | null) => void;
  /** Earliest/latest `firstSeen` across the graph's nodes, or `null` if none
   * carry a date — the range a timeline control should scrub across. */
  dateRange: { min: string; max: string } | null;
}

export function createPulseGraph(
  container: HTMLElement,
  opts: PulseGraphOptions,
): PulseGraph {
  const height = opts.height ?? 560;
  container.classList.add('dot-grid', 'op-graph');
  container.style.position = 'relative';
  container.style.height = `${height}px`;

  const width = container.clientWidth || 960;

  const degree = new Map<string, number>();
  for (const e of opts.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const maxWeight = Math.max(1, ...opts.nodes.map((n) => n.weight ?? 0));
  const nodes: SimNode[] = opts.nodes.map((n) => {
    const d = degree.get(n.id) ?? 0;
    const w = (n.weight ?? 0) / maxWeight;
    return {
      ...n,
      degree: d,
      r:
        n.type === 'Organisation'
          ? 14 + Math.min(8, d * 0.4)
          : 5 + Math.min(9, Math.sqrt(d) * 1.6 + w * 4),
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: SimEdge[] = opts.edges
    .filter((e) => byId.has(e.source) && byId.has(e.target))
    .map((e) => ({
      source: byId.get(e.source)!,
      target: byId.get(e.target)!,
      type: e.type,
      firstSeen: e.firstSeen,
    }));

  const dateRange = ((): { min: string; max: string } | null => {
    const dates = nodes.map((n) => n.firstSeen).filter((d): d is string => Boolean(d)).sort();
    return dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null;
  })();
  let cutoff: string | null = null;
  /** Undated nodes are "date unknown", not "always there": while a cutoff is
   * active they stay hidden, only joining once the timeline reaches the end
   * (cutoff cleared to `null`). */
  const isNodeVisible = (n: { firstSeen?: string }): boolean =>
    !cutoff || (n.firstSeen ? n.firstSeen <= cutoff : false);
  /** An edge needs both endpoints on screen, plus its own date (if any) to
   * have passed. */
  const isEdgeVisible = (e: SimEdge): boolean =>
    isNodeVisible(e.source) &&
    isNodeVisible(e.target) &&
    (!cutoff || !e.firstSeen || e.firstSeen <= cutoff);
  /** Which nodes are currently in the live simulation — as opposed to just
   * faded out. Tracked so `refreshActiveSet` only reheats the layout when
   * the cutoff actually crosses a node's `firstSeen`, not on every slider
   * tick. */
  let activeNodeIds = new Set(nodes.filter((n) => isNodeVisible(n)).map((n) => n.id));

  const adjacency = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adjacency.has(e.source.id)) adjacency.set(e.source.id, new Set());
    if (!adjacency.has(e.target.id)) adjacency.set(e.target.id, new Set());
    adjacency.get(e.source.id)!.add(e.target.id);
    adjacency.get(e.target.id)!.add(e.source.id);
  }

  // Labels stay on for organisations and the most-connected nodes only.
  const labelBudget = new Set(
    nodes
      .filter((n) => n.type === 'Organisation')
      .concat(
        nodes
          .filter((n) => n.type !== 'Organisation')
          .sort((a, b) => b.degree - a.degree)
          .slice(0, 12),
      )
      .map((n) => n.id),
  );

  const svg = select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Collaboration graph');

  const root = svg.append('g');

  const linkSel = root
    .append('g')
    .selectAll('line')
    .data(edges)
    .join('line')
    .attr('stroke', LINK_COLOR)
    .attr('stroke-opacity', 0.35)
    .attr('stroke-width', 1);

  const nodeSel = root
    .append('g')
    .selectAll<SVGCircleElement, SimNode>('circle')
    .data(nodes)
    .join('circle')
    .attr('r', (d) => d.r)
    .attr('fill', (d) => NODE_COLORS[d.type])
    .attr('fill-opacity', 0.9)
    .attr('stroke', '#0c0c12')
    .attr('stroke-width', 1.25)
    .style('cursor', 'pointer');

  const labelSel = root
    .append('g')
    .selectAll('text')
    .data(nodes.filter((n) => labelBudget.has(n.id)))
    .join('text')
    .text((d) => d.name)
    .attr('font-family', FONT)
    .attr('font-size', (d) => (d.type === 'Organisation' ? 13 : 11))
    .attr('font-weight', (d) => (d.type === 'Organisation' ? 600 : 400))
    .attr('fill', LABEL_COLOR)
    .attr('paint-order', 'stroke')
    .attr('stroke', '#0c0c12')
    .attr('stroke-width', 3)
    .attr('pointer-events', 'none');

  const tooltip = document.createElement('div');
  tooltip.className = 'op-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  let selected: SimNode | null = null;
  let currentTransform = zoomIdentity;

  /** Full detail for a node — used for both the hover tooltip and the
   * click-pinned one (clicking just keeps this same tooltip on screen and
   * makes its link clickable, instead of opening a separate side panel). */
  function tooltipHtml(d: SimNode): string {
    const link = d.id.startsWith('http')
      ? `<div class="small" style="margin-top:6px"><a href="${d.id}" target="_blank" rel="noopener" class="mono">${d.id.replace('https://', '')}</a></div>`
      : '';
    return (
      `<strong>${d.name}</strong>` +
      `<div class="muted">${d.type} · ${d.degree} connection${d.degree === 1 ? '' : 's'}</div>` +
      (d.meta ?? []).map((m) => `<div class="muted">${m}</div>`).join('') +
      link
    );
  }

  /** Re-anchor the pinned tooltip to its node's live position — called on
   * every tick so it tracks the node while the simulation is still settling,
   * instead of freezing wherever the mouse last was. */
  function positionPinnedTooltip(): void {
    if (!selected) return;
    const [x, y] = currentTransform.apply([selected.x!, selected.y!]);
    const rect = container.getBoundingClientRect();
    tooltip.style.left = `${Math.min(rect.left + x + 14, window.innerWidth - 340)}px`;
    tooltip.style.top = `${rect.top + y + 14}px`;
  }

  /** Show the pinned tooltip for `selected`, or hide it if nothing's pinned —
   * called after every click and whenever hover ends. */
  function renderPinnedTooltip(): void {
    if (!selected) {
      tooltip.style.display = 'none';
      tooltip.classList.remove('op-tooltip--pinned');
      return;
    }
    tooltip.innerHTML = tooltipHtml(selected);
    tooltip.classList.add('op-tooltip--pinned');
    tooltip.style.display = 'block';
    positionPinnedTooltip();
  }

  /* Opacity is the product of two independent concerns: the timeline cutoff
   * (is this node/edge born yet?) and hover/click focus (is it in the
   * selected neighbourhood?). Folding both into one pass keeps them from
   * fighting when the slider moves while a node is focused. */
  function nodeOpacity(d: SimNode, focus: SimNode | null): number {
    if (!isNodeVisible(d)) return 0;
    if (!focus) return 0.9;
    const near = adjacency.get(focus.id) ?? new Set<string>();
    return d.id === focus.id || near.has(d.id) ? 1 : 0.15;
  }
  function linkOpacity(e: SimEdge, focus: SimNode | null): number {
    if (!isEdgeVisible(e)) return 0;
    if (!focus) return 0.35;
    return e.source.id === focus.id || e.target.id === focus.id ? 0.85 : 0.08;
  }
  function labelOpacity(d: SimNode, focus: SimNode | null): number {
    if (!isNodeVisible(d)) return 0;
    if (!focus) return 1;
    const near = adjacency.get(focus.id) ?? new Set<string>();
    return d.id === focus.id || near.has(d.id) ? 1 : 0.2;
  }
  /** The circle's outline is painted independently of its fill, so it has to
   * be faded out too — fill-opacity 0 alone leaves an empty ring behind. */
  const nodeStrokeOpacity = (d: SimNode): number => (isNodeVisible(d) ? 1 : 0);

  function applyFocus(focus: SimNode | null): void {
    nodeSel
      .attr('fill-opacity', (d) => nodeOpacity(d, focus))
      .attr('stroke-opacity', nodeStrokeOpacity)
      .attr('stroke', (d) => (focus && d.id === focus.id ? RING_COLOR : '#0c0c12'));
    linkSel
      .attr('stroke-opacity', (e) => linkOpacity(e, focus))
      .attr('stroke-width', (e) =>
        focus && (e.source.id === focus.id || e.target.id === focus.id) ? 1.6 : 1,
      );
    labelSel.attr('opacity', (d) => labelOpacity(d, focus));
  }

  function setCutoff(next: string | null): void {
    cutoff = next;
    nodeSel.style('pointer-events', (d) => (isNodeVisible(d) ? 'auto' : 'none'));
    if (selected && !isNodeVisible(selected)) {
      selected = null;
      renderPinnedTooltip();
      opts.onSelect?.(null);
    }
    nodeSel
      .transition()
      .duration(150)
      .attr('fill-opacity', (d) => nodeOpacity(d, selected))
      .attr('stroke-opacity', nodeStrokeOpacity);
    linkSel.transition().duration(150).attr('stroke-opacity', (e) => linkOpacity(e, selected));
    labelSel.transition().duration(150).attr('opacity', (d) => labelOpacity(d, selected));
    refreshActiveSet();
  }

  /** Keep the force simulation itself scoped to whatever is visible at the
   * current cutoff — not just faded. Nodes/edges not yet "born" are dropped
   * from `sim.nodes()`/the link force entirely, so charge/collide/link
   * forces only act among what's actually on screen; the layout settles
   * around that subset and reflows as nodes join or leave it, instead of
   * every node holding the position it would have in the full, final graph. */
  function refreshActiveSet(): void {
    const nextActive = nodes.filter((n) => isNodeVisible(n));
    const nextIds = new Set(nextActive.map((n) => n.id));
    if (nextIds.size === activeNodeIds.size && [...nextIds].every((id) => activeNodeIds.has(id))) return;
    activeNodeIds = nextIds;
    const activeEdges = edges.filter((e) => isEdgeVisible(e));
    sim.nodes(nextActive);
    linkForce.links(activeEdges);
    sim.alpha(0.4).restart();
  }

  nodeSel
    .on('mouseenter', (event: MouseEvent, d) => {
      if (!isNodeVisible(d)) return;
      applyFocus(d);
      tooltip.classList.remove('op-tooltip--pinned');
      tooltip.innerHTML = tooltipHtml(d);
      tooltip.style.display = 'block';
      positionTooltip(event);
    })
    .on('mousemove', (event: MouseEvent) => {
      if (!tooltip.classList.contains('op-tooltip--pinned')) positionTooltip(event);
    })
    .on('mouseleave', () => {
      applyFocus(selected);
      renderPinnedTooltip(); // keeps a click-pinned tooltip on screen; hides otherwise
    })
    .on('click', (_event: MouseEvent, d) => {
      selected = selected?.id === d.id ? null : d;
      applyFocus(selected);
      renderPinnedTooltip();
      opts.onSelect?.(selected);
    });

  function positionTooltip(event: MouseEvent): void {
    tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 340)}px`;
    tooltip.style.top = `${event.clientY + 14}px`;
  }

  const linkForce = forceLink<SimNode, SimEdge>(edges)
    .id((d) => d.id)
    .distance((e) =>
      e.source.type === 'Organisation' || e.target.type === 'Organisation' ? 90 : 46,
    )
    .strength(0.4);

  const sim: Simulation<SimNode, SimEdge> = forceSimulation(nodes)
    .force('link', linkForce)
    .force('charge', forceManyBody().strength(-120))
    .force('center', forceCenter(width / 2, height / 2))
    .force('x', forceX(width / 2).strength(0.05))
    .force('y', forceY(height / 2).strength(0.07))
    .force(
      'collide',
      forceCollide<SimNode>().radius((d) => d.r + 2),
    )
    .on('tick', () => {
      linkSel
        .attr('x1', (e) => e.source.x!)
        .attr('y1', (e) => e.source.y!)
        .attr('x2', (e) => e.target.x!)
        .attr('y2', (e) => e.target.y!);
      nodeSel.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
      labelSel
        .attr('x', (d) => d.x! + d.r + 4)
        .attr('y', (d) => d.y! + 4);
      positionPinnedTooltip();
    });

  nodeSel.call(
    drag<SVGCircleElement, SimNode>()
      .on('start', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        if (!event.active) sim.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }),
  );

  const zoomBehaviour = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 5])
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      currentTransform = event.transform;
      root.attr('transform', event.transform.toString());
      positionPinnedTooltip();
    });
  svg.call(zoomBehaviour).call(zoomBehaviour.transform, zoomIdentity);
  svg.on('dblclick.zoom', null);

  if (opts.legend !== false) {
    const present = [...new Set(nodes.map((n) => n.type))];
    const legend = document.createElement('div');
    legend.className = 'op-canvas-overlay op-graph-legend';
    legend.innerHTML = present
      .map(
        (t) =>
          `<span><i style="background:${NODE_COLORS[t]}"></i>${t}</span>`,
      )
      .join('');
    container.appendChild(legend);
  }

  const hint = document.createElement('div');
  hint.className = 'op-canvas-overlay op-graph-hint';
  hint.textContent = 'Scroll to zoom · drag nodes · click a node to pin its details';
  container.appendChild(hint);

  return {
    destroy() {
      sim.stop();
      tooltip.remove();
      container.replaceChildren();
    },
    setCutoff,
    dateRange,
  };
}
