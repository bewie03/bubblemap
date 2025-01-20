import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface TokenHolder {
  address: string;
  quantity: number;
}

interface BubbleMapProps {
  holders: TokenHolder[];
}

type HierarchyDatum = d3.HierarchyNode<TokenHolder> & {
  value: number;
  x: number;
  y: number;
  r: number;
};

const BubbleMap: React.FC<BubbleMapProps> = ({ holders }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!holders.length || !svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Setup dimensions
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Add gradient definitions
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'bubble-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#FF6B6B');

    gradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#4ECDC4');

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#45B7D1');

    // Create bubble layout
    const bubble = d3.pack<TokenHolder>()
      .size([innerWidth, innerHeight])
      .padding(3);

    // Process data for bubble layout
    const hierarchyRoot = d3.hierarchy<{ children: TokenHolder[] }>({ children: holders })
      .sum(d => {
        const node = d as unknown as TokenHolder;
        return node.quantity || 0;
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create bubble nodes
    const nodes = bubble(hierarchyRoot as unknown as d3.HierarchyNode<TokenHolder>)
      .descendants()
      .slice(1) as HierarchyDatum[]; // slice(1) removes the root node

    // Create container for bubbles
    const container = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create group elements for each bubble
    const bubbles = container.selectAll('.bubble')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'bubble')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Create circles
    bubbles.append('circle')
      .attr('r', d => d.r)
      .style('fill', 'url(#bubble-gradient)')
      .style('opacity', 0.7)
      .style('transition', 'all 0.3s ease')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .style('opacity', 1)
          .style('stroke', '#fff')
          .style('stroke-width', 2);

        // Show tooltip
        const tooltip = d3.select('#tooltip');
        const formattedQuantity = d.data.quantity.toLocaleString();
        tooltip.style('opacity', 1)
          .html(`
            <div style="font-weight: bold; margin-bottom: 5px;">Wallet Address:</div>
            <div style="font-family: monospace; margin-bottom: 10px;">${d.data.address.slice(0, 15)}...</div>
            <div style="font-weight: bold; margin-bottom: 5px;">Token Amount:</div>
            <div style="font-family: monospace;">${formattedQuantity}</div>
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .style('opacity', 0.7)
          .style('stroke', 'none');
        
        // Hide tooltip
        d3.select('#tooltip').style('opacity', 0);
      });

    // Add tooltip div if it doesn't exist
    if (!document.getElementById('tooltip')) {
      d3.select('body').append('div')
        .attr('id', 'tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(33, 33, 33, 0.9)')
        .style('color', 'white')
        .style('padding', '12px')
        .style('border-radius', '6px')
        .style('font-size', '14px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.2)')
        .style('max-width', '300px')
        .style('word-wrap', 'break-word');
    }

  }, [holders]);

  return (
    <svg 
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf2 100%)',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    />
  );
};

export default BubbleMap;
