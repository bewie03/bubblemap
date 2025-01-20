import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface TokenHolder {
  address: string;
  quantity: string;
  relatedAddresses?: string[];
}

interface BubbleMapProps {
  holders: TokenHolder[];
  totalSupply: number;
}

type BubbleData = {
  id: string;
  name: string;
  value: number;
  displayValue: string;
  relatedIds?: string[];
};

type SimulationNode = d3.SimulationNodeDatum & BubbleData;
type SimulationLink = d3.SimulationLinkDatum<SimulationNode>;

const BubbleMap: React.FC<BubbleMapProps> = ({ holders, totalSupply }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!holders.length || !svgRef.current) return;

    // Convert holders to nodes for force simulation
    const nodes: SimulationNode[] = holders.map(holder => ({
      id: holder.address,
      name: holder.address,
      value: parseFloat(holder.quantity),
      displayValue: holder.quantity,
      relatedIds: holder.relatedAddresses,
    }));

    // Create links between related nodes
    const links: SimulationLink[] = [];
    nodes.forEach(node => {
      if (node.relatedIds) {
        node.relatedIds.forEach(targetId => {
          if (nodes.some(n => n.id === targetId)) {
            links.push({
              source: node.id,
              target: targetId
            });
          }
        });
      }
    });

    // Clear previous visualization
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 800;

    // Create force simulation
    const simulation = d3.forceSimulation<SimulationNode>(nodes)
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => {
        const bubbleNode = d as SimulationNode;
        return Math.sqrt(bubbleNode.value) * 2;
      }))
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links)
        .id(d => d.id)
        .distance(100)
      );

    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create color scales
    const nodeColor = d3.scaleSequential()
      .domain([0, d3.max(nodes, d => d.value) || 1])
      .interpolator(d3.interpolateRgb('#1E40AF', '#60A5FA'));

    // Add links first so they appear behind nodes
    const links_g = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#2C5282")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1);

    // Add nodes
    const node_g = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g");

    // Add circles
    const circles = node_g.append("circle")
      .attr("r", d => Math.sqrt(d.value) * 2)
      .style("fill", d => nodeColor(d.value))
      .style("opacity", "0.7")
      .style("stroke", "white")
      .style("stroke-width", "2")
      .call(d3.drag<any, SimulationNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    // Add labels
    const labels = node_g.append("text")
      .attr("dy", ".3em")
      .style("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", d => Math.min(Math.sqrt(d.value), 14))
      .text(d => d.displayValue);

    // Add tooltips
    node_g.on("mouseover", function(event, d: SimulationNode) {
      const percentage = ((d.value / totalSupply) * 100).toFixed(2);
      
      // Highlight related nodes
      circles.style("opacity", 0.1);
      labels.style("opacity", 0.1);
      links_g.style("opacity", 0.1);

      const relatedNodes = new Set([d.id, ...(d.relatedIds || [])]);
      circles.filter(n => relatedNodes.has(n.id))
        .style("opacity", 0.9)
        .style("stroke", "#60A5FA")
        .style("stroke-width", "3");
      
      labels.filter(n => relatedNodes.has(n.id))
        .style("opacity", 1);
      
      links_g.filter(l => 
        relatedNodes.has((l.source as SimulationNode).id) && 
        relatedNodes.has((l.target as SimulationNode).id)
      )
        .style("opacity", 1)
        .style("stroke", "#60A5FA")
        .style("stroke-width", "2");

      if (tooltipRef.current) {
        tooltipRef.current.style.visibility = "visible";
        tooltipRef.current.style.left = `${event.pageX + 10}px`;
        tooltipRef.current.style.top = `${event.pageY - 10}px`;
        tooltipRef.current.innerHTML = `
          <div style="background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 4px;">
            <div style="color: #64B5F6; margin-bottom: 5px;">Wallet Address</div>
            <div style="color: white; word-break: break-all; margin-bottom: 10px; font-size: 12px;">
              ${d.name}
            </div>
            <div style="color: #64B5F6; margin-bottom: 5px;">Token Amount</div>
            <div style="color: white; font-size: 14px;">
              ${d.displayValue}
            </div>
            <div style="color: #64B5F6; margin-top: 5px;">Percentage</div>
            <div style="color: white; font-size: 14px;">
              ${percentage}% of total supply
            </div>
            ${d.relatedIds?.length ? `
              <div style="color: #64B5F6; margin-top: 5px;">Related Wallets</div>
              <div style="color: white; font-size: 12px;">
                ${d.relatedIds.length} connected addresses
              </div>
            ` : ''}
          </div>
        `;
      }
    })
    .on("mouseout", function() {
      // Reset styles
      circles.style("opacity", 0.7)
        .style("stroke", "white")
        .style("stroke-width", "2");
      labels.style("opacity", 1);
      links_g.style("stroke", "#2C5282")
        .style("opacity", 0.2)
        .style("stroke-width", 1);

      if (tooltipRef.current) {
        tooltipRef.current.style.visibility = "hidden";
      }
    });

    // Create tooltip div if it doesn't exist
    if (!tooltipRef.current) {
      const tooltip = document.createElement('div');
      tooltip.style.position = 'absolute';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.visibility = 'hidden';
      tooltip.style.zIndex = '1000';
      document.body.appendChild(tooltip);
      tooltipRef.current = tooltip;
    }

    // Update force simulation
    simulation.on("tick", () => {
      links_g
        .attr("x1", d => (d.source as SimulationNode).x || 0)
        .attr("y1", d => (d.source as SimulationNode).y || 0)
        .attr("x2", d => (d.target as SimulationNode).x || 0)
        .attr("y2", d => (d.target as SimulationNode).y || 0);

      node_g
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: SimulationNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: SimulationNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: SimulationNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

  }, [holders, totalSupply]);

  return (
    <svg 
      ref={svgRef}
      style={{
        width: '100%',
        height: '800px',
        background: '#0A0B0D'
      }}
    />
  );
};

export default BubbleMap;
