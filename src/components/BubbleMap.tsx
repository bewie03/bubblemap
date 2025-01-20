import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface TokenHolder {
  address: string;
  quantity: number;
}

interface BubbleMapProps {
  holders: TokenHolder[];
}

interface HierarchyData {
  children: TokenHolder[];
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

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create bubble layout
    const bubble = d3.pack<TokenHolder>()
      .size([width, height])
      .padding(1);

    // Process data for bubble layout
    const hierarchyRoot = d3.hierarchy<HierarchyData>({ children: holders })
      .sum(d => {
        const node = d as unknown as TokenHolder;
        return node.quantity || 0;
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create bubble nodes
    const nodes = bubble(hierarchyRoot as unknown as d3.HierarchyNode<TokenHolder>)
      .descendants()
      .slice(1) as HierarchyDatum[]; // slice(1) removes the root node

    // Create group elements for each bubble
    const bubbles = svg.selectAll('.bubble')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'bubble')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Create circles
    bubbles.append('circle')
      .attr('r', d => d.r)
      .style('fill', (_, i) => d3.interpolateViridis(i / nodes.length))
      .style('opacity', 0.7)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .style('opacity', 1)
          .style('stroke', '#fff')
          .style('stroke-width', 2);

        // Show tooltip
        const tooltip = d3.select('#tooltip');
        tooltip.style('opacity', 1)
          .html(`
            Address: ${d.data.address.slice(0, 10)}...
            <br/>
            Quantity: ${d.data.quantity.toLocaleString()}
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
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0);
    }

  }, [holders]);

  return (
    <svg 
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#f5f5f5',
        borderRadius: '8px'
      }}
    />
  );
};

export default BubbleMap;
