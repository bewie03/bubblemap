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
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG with zoom support
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create color scale
    const maxQuantity = d3.max(holders, d => d.quantity) || 0;
    const colorScale = d3.scaleSequential()
      .domain([0, maxQuantity])
      .interpolator(d3.interpolateRgb('#1E40AF', '#60A5FA'));

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Create container for bubbles
    const container = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

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
      .slice(1) as HierarchyDatum[];

    // Create group elements for each bubble
    const bubbles = container.selectAll('.bubble')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'bubble')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Create circles with gradient fill
    bubbles.append('circle')
      .attr('r', d => d.r)
      .style('fill', d => colorScale(d.data.quantity))
      .style('opacity', 0.7)
      .style('transition', 'all 0.3s ease')
      .style('stroke', '#2D3748')
      .style('stroke-width', 1)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .style('opacity', 1)
          .style('stroke', '#60A5FA')
          .style('stroke-width', 2);

        // Show tooltip
        const tooltip = d3.select('#tooltip');
        const percentage = ((d.data.quantity / maxQuantity) * 100).toFixed(2);
        const formattedQuantity = d.data.quantity.toLocaleString();
        tooltip.style('opacity', 1)
          .html(`
            <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid #374151; padding: 16px; border-radius: 8px;">
              <div style="color: #60A5FA; font-weight: bold; margin-bottom: 8px;">Wallet Address</div>
              <div style="color: #E5E7EB; font-family: monospace; margin-bottom: 12px; word-break: break-all; font-size: 12px;">
                ${d.data.address}
              </div>
              <div style="color: #60A5FA; font-weight: bold; margin-bottom: 8px;">Token Amount</div>
              <div style="color: #E5E7EB; font-family: monospace; margin-bottom: 8px;">
                ${formattedQuantity}
              </div>
              <div style="color: #9CA3AF; font-size: 12px;">
                ${percentage}% of largest holder
              </div>
            </div>
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .style('opacity', 0.7)
          .style('stroke', '#2D3748')
          .style('stroke-width', 1);
        
        d3.select('#tooltip').style('opacity', 0);
      });

    // Add labels for larger bubbles
    bubbles.filter(d => d.r > 30)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .style('font-size', d => Math.min(d.r / 3, 14) + 'px')
      .style('fill', '#E5E7EB')
      .style('pointer-events', 'none')
      .text(d => {
        const amount = d.data.quantity;
        if (amount >= 1e6) return (amount / 1e6).toFixed(1) + 'M';
        if (amount >= 1e3) return (amount / 1e3).toFixed(1) + 'K';
        return amount.toString();
      });

    // Add legend
    const legendData = [0.25, 0.5, 0.75, 1].map(p => maxQuantity * p);
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 150}, 20)`);

    const legendItems = legend.selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`);

    legendItems.append('circle')
      .attr('r', 6)
      .style('fill', d => colorScale(d))
      .style('opacity', 0.7)
      .style('stroke', '#2D3748')
      .style('stroke-width', 1);

    legendItems.append('text')
      .attr('x', 15)
      .attr('y', 5)
      .style('font-size', '12px')
      .style('fill', '#9CA3AF')
      .text(d => {
        if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
        if (d >= 1e3) return (d / 1e3).toFixed(1) + 'K';
        return d.toString();
      });

    // Add tooltip div if it doesn't exist
    if (!document.getElementById('tooltip')) {
      d3.select('body').append('div')
        .attr('id', 'tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', '1000');
    }

  }, [holders]);

  return (
    <svg 
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #1A1D23 0%, #14171A 100%)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    />
  );
};

export default BubbleMap;
