<script lang="ts">
import * as d3 from "d3";
import { onMount } from "svelte";

import type {
    Link,
    Network,
    Neuron,
    NeuronDisplay,
    Node,
    SpikeDisplay,
    SpikeSink,
    SpikeSinkDisplay,
    SpikeSource,
    SpikeSourceDisplay,
    SynapsePreDisplay,
} from "./network.svelte.ts";
import {
    CONTAINER_CELL_SIZE,
    containerStroke,
    NEURON_RADIUS,
    nodeStroke,
    SPIKE_RADIUS,
    SubscriptionType,
} from "./network.svelte.ts";
import {
    DEFAULT_CHORD_DURATION,
    DEFAULT_INSTRUMENT,
    synth,
} from "./synth.svelte";
import type { Tool } from "./tool";

type LinkSelection = d3.Selection<SVGGElement, Link, SVGGElement, undefined>;
type NodeSelection = d3.Selection<SVGGElement, Node, SVGGElement, undefined>;
type SpikeSourceSelection = d3.Selection<
    SVGGElement,
    SpikeSourceDisplay,
    SVGGElement,
    undefined
>;
type SpikeSinkSelection = d3.Selection<
    SVGGElement,
    SpikeSinkDisplay,
    SVGGElement,
    undefined
>;
type ContainerSelection = d3.Selection<
    SVGGElement,
    SpikeSourceDisplay | SpikeSinkDisplay,
    SVGGElement,
    undefined
>;

let {
    tool,
    network,
    selection = $bindable(),
}: {
    tool: Tool;
    network: Network;
    selection: Neuron | SpikeSource | SpikeSink | null;
} = $props();

let d3Container: HTMLDivElement;
let drawContext: DrawContext;

$effect(() => {
    selection;
    if (drawContext) {
        drawContext.requestDraw();
    }
});

const TRIANGLE_SIZE: number = 10;

interface Triangle {
    points: string;
}

function triangle(
    x: number,
    y: number,
    orientation: "top" | "bottom" | "left" | "right",
): Triangle {
    switch (orientation) {
        case "top":
            return {
                points: `${x + TRIANGLE_SIZE / 2},${y} ${x + TRIANGLE_SIZE},${y + TRIANGLE_SIZE} ${x},${y + TRIANGLE_SIZE}`,
            };
        case "bottom":
            return {
                points: `${x + TRIANGLE_SIZE / 2},${y + TRIANGLE_SIZE} ${x},${y} ${x + TRIANGLE_SIZE},${y}`,
            };
        case "left":
            return {
                points: `${x},${y + TRIANGLE_SIZE / 2} ${x + TRIANGLE_SIZE},${y} ${x + TRIANGLE_SIZE},${y + TRIANGLE_SIZE}`,
            };
        case "right":
            return {
                points: `${x + TRIANGLE_SIZE},${y + TRIANGLE_SIZE / 2} ${x},${y + TRIANGLE_SIZE} ${x},${y}`,
            };
        default:
            throw new Error("unreachable");
    }
}

class NetworkSelection {
    linkGroup: LinkSelection;
    linkLine: d3.Selection<SVGLineElement, Link, SVGGElement, Link>;
    spikeSourceGroup: SpikeSourceSelection;
    spikeSourceRect: d3.Selection<
        SVGRectElement,
        SpikeSourceDisplay,
        SVGGElement,
        SpikeSourceDisplay
    >;
    spikeSinkGroup: SpikeSinkSelection;
    spikeSinkRect: d3.Selection<
        SVGRectElement,
        SpikeSinkDisplay,
        SVGGElement,
        SpikeSinkDisplay
    >;
    nodeGroup: NodeSelection;
    nodeCircle: d3.Selection<SVGCircleElement, Node, SVGGElement, Node>;
    nodeFillGroup: d3.Selection<
        SVGGElement,
        NeuronDisplay,
        SVGGElement,
        NeuronDisplay
    >;
    nodeFillCircle: d3.Selection<
        SVGCircleElement,
        NeuronDisplay,
        SVGGElement,
        NeuronDisplay
    >;
    nodeGlowCircle: d3.Selection<
        SVGCircleElement,
        SynapsePreDisplay,
        SVGGElement,
        undefined
    >;
    // @ts-expect-error
    spikeCircle: d3.Selection<
        SVGCircleElement,
        SpikeDisplay,
        SVGGElement,
        undefined
    >;

    constructor(
        drawContext: DrawContext,
        nodes: Node[],
        links: Link[],
        spikeSources: SpikeSourceDisplay[],
        spikeSinks: SpikeSinkDisplay[],
        spikes: SpikeDisplay[],
        forceSimulation: d3.Simulation<Node, Link>,
    ) {
        // create new synapses
        this.linkGroup = drawContext.linksContainer
            .selectChildren<SVGGElement, Link>("g")
            .data(links, (link: Link) => link.id)
            .join(enter => {
                const linkGroup = enter.append("g");
                // configuring "marker-end" after insertion (in draw) does not work in Safari.
                linkGroup.append("line").attr("marker-end", "url(#arrow-head)");
                return linkGroup;
            });
        this.linkLine = this.linkGroup.selectChildren("line");

        // create new spike sources
        this.spikeSourceGroup = <SpikeSourceSelection>(
            drawContext.spikeSourceContainer
                .selectChildren<SVGGElement, SpikeSourceDisplay>("g")
                .data(spikeSources, spikeSource => spikeSource.id)
                .join(enter => {
                    for (const spikeSourceDisplay of enter.data()) {
                        spikeSourceDisplay.currentShape[0] = -1;
                        spikeSourceDisplay.currentShape[1] = -1;
                    }
                    const spikeSourceGroup = enter.append("g");
                    spikeSourceGroup
                        .append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("rx", 6)
                        .attr("ry", 6)
                        .attr("fill", "#eee8d5");
                    return spikeSourceGroup;
                })
        );
        this.spikeSourceRect = this.spikeSourceGroup.selectChildren("rect");

        // create new spike sinks
        this.spikeSinkGroup = drawContext.spikeSinkContainer
            .selectChildren<SVGGElement, SpikeSinkDisplay>("g")
            .data(spikeSinks, spikeSink => spikeSink.id)
            .join(enter => {
                for (const spikeSinkGroup of enter.data()) {
                    spikeSinkGroup.currentShape[0] = -1;
                    spikeSinkGroup.currentShape[1] = -1;
                }
                const spikeSinkGroup = enter.append("g");
                spikeSinkGroup
                    .append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("rx", 6)
                    .attr("ry", 6)
                    .attr("fill", "#eee8d5");
                return spikeSinkGroup;
            });
        this.spikeSinkRect = this.spikeSinkGroup.selectChildren("rect");

        // draw triangles
        for (const { containerGroup, flip } of [
            { containerGroup: this.spikeSourceGroup, flip: false },
            { containerGroup: this.spikeSinkGroup, flip: true },
        ]) {
            const [top, bottom, left, right]: (
                | "top"
                | "bottom"
                | "left"
                | "right"
            )[] = flip
                ? ["bottom", "top", "right", "left"]
                : ["top", "bottom", "left", "right"];
            // containerGroup has type SpikeSourceSelection | SpikeSinkSelection
            // but the option messses with the type checker
            const selection = (containerGroup as SpikeSourceSelection).filter(
                container =>
                    container.shape[0] !== container.currentShape[0] ||
                    container.shape[1] !== container.currentShape[1],
            );
            selection
                .selectChildren("polygon")
                .data((container: SpikeSourceDisplay | SpikeSinkDisplay) => {
                    container.currentShape[0] = container.shape[0];
                    container.currentShape[1] = container.shape[1];
                    const [width, height] = container.shape;
                    if (width === 0 || height === 0) {
                        return [
                            triangle(
                                NEURON_RADIUS - TRIANGLE_SIZE / 2,
                                NEURON_RADIUS - (TRIANGLE_SIZE * 3) / 2,
                                top,
                            ),
                            triangle(
                                NEURON_RADIUS - TRIANGLE_SIZE / 2,
                                NEURON_RADIUS + TRIANGLE_SIZE / 2,
                                bottom,
                            ),
                            triangle(
                                NEURON_RADIUS - (TRIANGLE_SIZE * 3) / 2,
                                NEURON_RADIUS - TRIANGLE_SIZE / 2,
                                left,
                            ),
                            triangle(
                                NEURON_RADIUS + TRIANGLE_SIZE / 2,
                                NEURON_RADIUS - TRIANGLE_SIZE / 2,
                                right,
                            ),
                        ];
                    }
                    const triangles: Triangle[] = [];
                    for (let x = 0; x < width; ++x) {
                        triangles.push(
                            triangle(
                                CONTAINER_CELL_SIZE * x +
                                    CONTAINER_CELL_SIZE / 2 -
                                    TRIANGLE_SIZE / 2,
                                CONTAINER_CELL_SIZE / 4 -
                                    NEURON_RADIUS / 2 -
                                    TRIANGLE_SIZE / 2,
                                top,
                            ),
                        );
                        triangles.push(
                            triangle(
                                CONTAINER_CELL_SIZE * x +
                                    CONTAINER_CELL_SIZE / 2 -
                                    TRIANGLE_SIZE / 2,
                                CONTAINER_CELL_SIZE * height -
                                    CONTAINER_CELL_SIZE / 4 +
                                    NEURON_RADIUS / 2 -
                                    TRIANGLE_SIZE / 2,
                                bottom,
                            ),
                        );
                    }
                    for (let y = 0; y < height; ++y) {
                        triangles.push(
                            triangle(
                                CONTAINER_CELL_SIZE / 4 -
                                    NEURON_RADIUS / 2 -
                                    TRIANGLE_SIZE / 2,
                                CONTAINER_CELL_SIZE * y +
                                    CONTAINER_CELL_SIZE / 2 -
                                    TRIANGLE_SIZE / 2,
                                left,
                            ),
                        );
                        triangles.push(
                            triangle(
                                CONTAINER_CELL_SIZE * width -
                                    CONTAINER_CELL_SIZE / 4 +
                                    NEURON_RADIUS / 2 -
                                    TRIANGLE_SIZE / 2,
                                CONTAINER_CELL_SIZE * y +
                                    CONTAINER_CELL_SIZE / 2 -
                                    TRIANGLE_SIZE / 2,
                                right,
                            ),
                        );
                    }
                    return triangles;
                })
                .join(enter => enter.append("polygon"))
                .attr("points", triangle => triangle.points)
                .attr("stroke", "none")
                .attr("fill", "#C1C5BB");
        }

        // create new nodes (neurons and handles in spike sources and sinks)
        this.nodeGroup = drawContext.nodesContainer
            .selectChildren<SVGGElement, Node>("g")
            .data(nodes, node => node.id)
            .join(enter => {
                const nodeGroup = enter.append("g");
                nodeGroup
                    .filter(node => node.type === "neuron")
                    .append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", NEURON_RADIUS)
                    .attr("fill", "#FDF6E3");
                nodeGroup
                    .filter(node => node.type === "neuron")
                    .append("g")
                    .attr("clip-path", "url(#neuron-clip-path)")
                    .append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", NEURON_RADIUS)
                    .attr("fill", "#586e75");
                nodeGroup
                    .append("circle")
                    .attr("class", "stroke")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("fill", node =>
                        node.type === "neuron" ? "none" : "#FDF6E3",
                    );
                return nodeGroup;
            });
        this.nodeCircle = this.nodeGroup.selectChildren("circle.stroke");
        this.nodeFillGroup = this.nodeGroup.selectChildren("g");
        this.nodeFillCircle = this.nodeFillGroup.selectChildren("circle");

        // create new nodes glow
        this.nodeGlowCircle = drawContext.nodesGlowContainer
            .selectChildren<SVGCircleElement, SynapsePreDisplay>("circle")
            .data(
                nodes.filter(
                    node => node.type === "neuron" || node.type === "source",
                ),
                node => node.id,
            )
            .join(enter => {
                const circle = enter.append("circle");
                circle
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", 0)
                    .attr("fill", "#6C71C4");
                return circle;
            });

        // create new spikes
        this.updateSpikes(drawContext, spikes);

        // attach drag, click, and hover behaviours to containers (sources and sinks)
        for (const rect of [this.spikeSourceGroup, this.spikeSinkGroup]) {
            const containerSelection = rect as unknown as ContainerSelection;
            containerSelection.call(
                d3
                    .drag<SVGGElement, SpikeSourceDisplay | SpikeSinkDisplay>()
                    .clickDistance(1)
                    .on("start", (_, container) => {
                        if (tool === "select") {
                            container.active = true;
                            for (const channel of container.parent.channels) {
                                channel.display.active = true;
                            }
                            forceSimulation.alphaTarget(0.5).alpha(1).restart();
                            drawContext.requestDraw();
                        }
                    })
                    .on("drag", (event, container) => {
                        if (tool === "select") {
                            const dx = event.x - container.x;
                            const dy = event.y - container.y;
                            for (const channel of container.parent.channels) {
                                channel.display.x += dx;
                                channel.display.y += dy;
                                channel.display.fx = channel.display.x;
                                channel.display.fy = channel.display.y;
                            }
                            container.x += dx;
                            container.y += dy;
                            drawContext.requestDraw();
                        }
                    })
                    .on("end", (_, container) => {
                        if (tool === "select") {
                            container.active = false;
                            for (const channel of container.parent.channels) {
                                channel.display.active = false;
                            }
                            forceSimulation.alphaTarget(0);
                            drawContext.requestDraw();
                        }
                    }),
            );
            containerSelection.on("click", (event, container) => {
                if (tool === "select") {
                    event.stopPropagation();
                    if (selection === container.parent) {
                        selection = null;
                    } else {
                        selection = container.parent;
                    }
                }
            });
            containerSelection.on("mouseenter", (_, container) => {
                if (tool === "select") {
                    container.hover = true;
                    for (const channel of container.parent.channels) {
                        channel.display.hover = true;
                    }
                    drawContext.requestDraw();
                }
            });
            containerSelection.on("mouseleave", (_, container) => {
                if (tool === "select") {
                    container.hover = false;
                    for (const channel of container.parent.channels) {
                        channel.display.hover = false;
                    }
                    drawContext.requestDraw();
                }
            });
        }

        // attach drag behavioue to neurons
        // this includes synapse creation
        this.nodeGroup.call(
            d3
                .drag<SVGGElement, Node>()
                .clickDistance(1)
                .on("start", (event, node) => {
                    if (tool === "select") {
                        if (node.type === "neuron") {
                            node.active = true;
                        } else {
                            node.parent.parent.display.active = true;
                            for (const channel of node.parent.parent.channels) {
                                channel.display.active = true;
                            }
                        }
                        forceSimulation.alphaTarget(0.5).alpha(1).restart();
                        drawContext.requestDraw();
                    } else if (tool === "add-synapse") {
                        if (node.type === "neuron" || node.type === "source") {
                            drawContext.newSynapsePre = node;
                            drawContext.newSynapseLine
                                .attr("display", "inline")
                                .attr("x1", node.x)
                                .attr("y1", node.y)
                                .attr("x2", event.x)
                                .attr("y2", event.y);
                            forceSimulation.stop();
                            drawContext.requestDraw();
                        }
                    }
                })
                .on("drag", (event, node) => {
                    if (tool === "select") {
                        if (node.type === "neuron") {
                            node.x = event.x;
                            node.y = event.y;
                            node.fx = event.x;
                            node.fy = event.y;
                        } else {
                            const dx = event.x - node.x;
                            const dy = event.y - node.y;
                            for (const channel of node.parent.parent.channels) {
                                channel.display.x += dx;
                                channel.display.y += dy;
                                channel.display.fx = channel.display.x;
                                channel.display.fy = channel.display.y;
                            }
                            node.parent.parent.display.x += dx;
                            node.parent.parent.display.y += dy;
                        }
                        drawContext.requestDraw();
                    } else if (tool === "add-synapse") {
                        drawContext.newSynapseLine
                            .attr("x2", event.x)
                            .attr("y2", event.y);
                    }
                })
                .on("end", (_, node) => {
                    if (tool === "select") {
                        if (node.type === "neuron") {
                            node.active = false;
                            node.fx = undefined;
                            node.fy = undefined;
                        } else {
                            node.parent.parent.display.active = false;
                            for (const channel of node.parent.parent.channels) {
                                channel.display.active = false;
                            }
                        }
                        forceSimulation.alphaTarget(0);
                        drawContext.requestDraw();
                    } else if (tool === "add-synapse") {
                        let post: Node | null = null;
                        for (const hoverNode of forceSimulation.nodes()) {
                            if (
                                hoverNode.hover &&
                                hoverNode !== drawContext.newSynapsePre
                            ) {
                                post = hoverNode;
                                break;
                            }
                        }
                        if (
                            post != null &&
                            (post.type === "neuron" || post.type === "sink") &&
                            drawContext.newSynapsePre != null
                        ) {
                            try {
                                network.addSynapse(
                                    drawContext.newSynapsePre.parent,
                                    post.parent,
                                    60,
                                    0.5,
                                    0.0,
                                    true,
                                );
                            } catch (error) {
                                console.error(error);
                            }
                        }
                        drawContext.newSynapsePre = null;
                        drawContext.newSynapseLine.attr("display", "none");
                        drawContext.requestDraw();
                    }
                }),
        );

        // attach click and hover behaviour to neurons
        this.nodeGroup.on("click", (event, node) => {
            if (tool === "select") {
                event.stopPropagation();
                if (node.type === "neuron") {
                    if (selection === node.parent) {
                        selection = null;
                    } else {
                        selection = node.parent;
                    }
                } else {
                    if (selection === node.parent.parent) {
                        selection = null;
                    } else {
                        selection = node.parent.parent;
                    }
                }
            }
        });
        this.nodeGroup.on("mouseenter", (_, node) => {
            if (node.type === "neuron" || tool !== "select") {
                node.hover = true;
            } else {
                node.parent.parent.display.hover = true;
                for (const channel of node.parent.parent.channels) {
                    channel.display.hover = true;
                }
            }
            drawContext.requestDraw();
        });
        this.nodeGroup.on("mouseleave", (_, node) => {
            if (node.type === "neuron" || tool !== "select") {
                node.hover = false;
            } else {
                node.parent.parent.display.hover = false;
                for (const channel of node.parent.parent.channels) {
                    channel.display.hover = false;
                }
            }
            drawContext.requestDraw();
        });
    }

    updateSpikes(drawContext: DrawContext, spikes: SpikeDisplay[]) {
        this.spikeCircle = drawContext.spikesContainer
            .selectChildren<SVGCircleElement, SynapsePreDisplay>("circle")
            .data(spikes)
            .join("circle")
            .attr("r", SPIKE_RADIUS)
            .attr("fill", "#586e75");
    }

    unmount() {
        this.nodeGroup.on("mouseleave", null);
        this.nodeGroup.on("mouseenter", null);
        this.nodeGroup.on(".drag", null);
    }
}

class DrawContext {
    svg: d3.Selection<SVGSVGElement, undefined, null, undefined>;
    graphContainer: d3.Selection<SVGGElement, undefined, null, undefined>;
    linksContainer: d3.Selection<SVGGElement, undefined, null, undefined>;
    spikesContainer: d3.Selection<SVGGElement, undefined, null, undefined>;
    spikeSourceContainer: d3.Selection<SVGGElement, undefined, null, undefined>;
    spikeSinkContainer: d3.Selection<SVGGElement, undefined, null, undefined>;
    nodesGlowContainer: d3.Selection<SVGGElement, undefined, null, undefined>;
    newSynapseLine: d3.Selection<SVGLineElement, undefined, null, undefined>;
    nodesContainer: d3.Selection<SVGGElement, undefined, null, undefined>;
    networkSelection: NetworkSelection;
    newSynapsePre: SynapsePreDisplay | null;
    drawRequested: boolean;
    requestAnimationFrameHandle: number | null;

    constructor(
        nodes: Node[],
        links: Link[],
        spikeSources: SpikeSourceDisplay[],
        spikeSinks: SpikeSinkDisplay[],
        spikes: SpikeDisplay[],
        forceSimulation: d3.Simulation<Node, Link>,
    ) {
        this.svg = d3.create("svg");
        this.updateSvgSize();
        const defs = this.svg.append("defs");
        defs.append("marker")
            .attr("id", "arrow-head")
            .attr("viewBox", "0 -4 8 8")
            .attr("refX", NEURON_RADIUS + 6)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 4)
            .attr("markerHeight", 4)
            .append("path")
            .attr("d", "M0,-4 L8,0 L0,4 Z")
            .attr("fill", "#586e75");
        defs.append("marker")
            .attr("id", "arrow-head-no-offset")
            .attr("viewBox", "0 -4 8 8")
            .attr("refX", 6)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 4)
            .attr("markerHeight", 4)
            .append("path")
            .attr("d", "M0,-4 L8,0 L0,4 Z")
            .attr("fill", "#586e75");
        defs.append("clipPath")
            .attr("id", "neuron-clip-path")
            .append("rect")
            .attr("x", -NEURON_RADIUS)
            .attr("y", -NEURON_RADIUS)
            .attr("width", NEURON_RADIUS * 2)
            .attr("height", NEURON_RADIUS * 2);

        this.graphContainer = this.svg.append("g");
        this.svg.call(
            d3.zoom<SVGSVGElement, undefined>().on("zoom", event => {
                this.graphContainer.attr("transform", event.transform);
            }),
        );
        this.svg.on("dblclick.zoom", null);
        this.spikeSourceContainer = this.graphContainer
            .append("g")
            .attr("id", "spike-sources");
        this.spikeSinkContainer = this.graphContainer
            .append("g")
            .attr("id", "spike-sinks");
        this.nodesGlowContainer = this.graphContainer
            .append("g")
            .attr("id", "nodes-glow");
        this.linksContainer = this.graphContainer
            .append("g")
            .attr("id", "links");
        this.spikesContainer = this.graphContainer
            .append("g")
            .attr("id", "spikes");
        this.newSynapseLine = this.graphContainer
            .append("line")
            .attr("display", "none")
            .attr("stroke", "#586e75")
            .attr("stroke-width", 2)
            .attr("marker-end", "url(#arrow-head-no-offset)");
        this.nodesContainer = this.graphContainer
            .append("g")
            .attr("id", "nodes");
        this.networkSelection = new NetworkSelection(
            this,
            nodes,
            links,
            spikeSources,
            spikeSinks,
            spikes,
            forceSimulation,
        );
        this.newSynapsePre = null;
        this.drawRequested = false;
        this.requestAnimationFrameHandle = null;
        d3Container.append(<SVGSVGElement>this.svg.node());
        this.tick();
    }

    updateNetworkSelection(
        nodes: Node[],
        links: Link[],
        spikeSources: SpikeSourceDisplay[],
        spikeSinks: SpikeSinkDisplay[],
        spikes: SpikeDisplay[],
        forceSimulation: d3.Simulation<Node, Link>,
    ) {
        this.networkSelection.unmount();
        this.networkSelection = new NetworkSelection(
            this,
            nodes,
            links,
            spikeSources,
            spikeSinks,
            spikes,
            forceSimulation,
        );
    }

    draw() {
        this.networkSelection.nodeGroup.attr(
            "transform",
            node => `translate(${node.x},${node.y})`,
        );
        this.networkSelection.nodeGlowCircle
            .attr("transform", node => `translate(${node.x},${node.y})`)
            .attr("r", node => node.glowRadius)
            .attr("opacity", node => node.glowOpacity);
        this.networkSelection.linkLine
            .attr("stroke", "#586e75")
            .attr("stroke-width", 2)
            .attr("x1", link => link.source.x)
            .attr("y1", link => link.source.y)
            .attr("x2", link => link.target.x)
            .attr("y2", link => link.target.y);

        for (const spike of this.networkSelection.spikeCircle.data()) {
            const x0 = spike.pre.x;
            const y0 = spike.pre.y;
            const x1 = spike.post.x;
            const y1 = spike.post.y;
            const distance = Math.hypot(x1 - x0, y1 - y0);
            if (distance === 0.0) {
                spike.x = x0;
                spike.y = y0;
            } else {
                const correction =
                    (NEURON_RADIUS / distance) * (1.0 - 2.0 * spike.position);
                spike.x =
                    x1 * (spike.position + correction) +
                    x0 * (1.0 - spike.position - correction);
                spike.y =
                    y1 * (spike.position + correction) +
                    y0 * (1.0 - spike.position - correction);
            }
        }
        this.networkSelection.spikeCircle
            .attr("cx", spike => spike.x)
            .attr("cy", spike => spike.y);
        for (const node of this.networkSelection.nodeCircle.data()) {
            node.stroke = nodeStroke(node, tool, this.newSynapsePre, selection);
        }
        this.networkSelection.nodeCircle
            .attr("r", node => NEURON_RADIUS - node.stroke[1] / 2)
            .attr("stroke", node => node.stroke[0])
            .attr("stroke-width", node => node.stroke[1]);
        this.networkSelection.nodeFillGroup.attr(
            "transform",
            node => `translate(0,${node.translation})`,
        );
        this.networkSelection.nodeFillCircle
            .attr("cy", node => -node.translation)
            .attr("opacity", node => node.opacity);
        for (const spikeSourceDisplay of this.networkSelection.spikeSourceRect.data()) {
            spikeSourceDisplay.stroke = containerStroke(
                spikeSourceDisplay,
                tool,
                selection,
            );
        }
        this.networkSelection.spikeSourceGroup.attr(
            "transform",
            spikeSource => `translate(${spikeSource.x},${spikeSource.y})`,
        );
        this.networkSelection.spikeSourceRect
            .attr("width", spikeSource => spikeSource.width)
            .attr("height", spikeSource => spikeSource.height)
            .attr("stroke", spikeSource => spikeSource.stroke[0])
            .attr("stroke-width", spikeSource => spikeSource.stroke[1]);
        for (const spikeSingDisplay of this.networkSelection.spikeSinkRect.data()) {
            spikeSingDisplay.stroke = containerStroke(
                spikeSingDisplay,
                tool,
                selection,
            );
        }
        this.networkSelection.spikeSinkGroup.attr(
            "transform",
            spikeSink => `translate(${spikeSink.x},${spikeSink.y})`,
        );
        this.networkSelection.spikeSinkRect
            .attr("width", spikeSink => spikeSink.width)
            .attr("height", spikeSink => spikeSink.height)
            .attr("stroke", spikeSink => spikeSink.stroke[0])
            .attr("stroke-width", spikeSink => spikeSink.stroke[1]);
    }

    updateSvgSize() {
        this.svg
            .attr("width", d3Container.clientWidth)
            .attr("height", d3Container.clientHeight)
            .attr("viewBox", [
                -d3Container.clientWidth / 2,
                -d3Container.clientHeight / 2,
                d3Container.clientWidth,
                d3Container.clientHeight,
            ]);
    }

    requestDraw() {
        this.drawRequested = true;
    }

    tick() {
        if (this.drawRequested) {
            this.drawRequested = false;
            this.draw();
        }
        this.requestAnimationFrameHandle = window.requestAnimationFrame(() => {
            this.tick();
        });
    }

    unmount() {
        if (this.requestAnimationFrameHandle != null) {
            window.cancelAnimationFrame(this.requestAnimationFrameHandle);
            this.requestAnimationFrameHandle = null;
        }
        this.networkSelection.unmount();
        this.svg.on(".zoom", null);
    }
}

onMount(() => {
    const nodes = network.nodes();
    const links = network.links();
    const forceSimulation = d3
        .forceSimulation(nodes)
        .alphaDecay(1 - 0.001 ** (1 / 1000))
        .force("collision", d3.forceCollide().radius(NEURON_RADIUS))
        .force("repulsion", d3.forceManyBody().strength(-100).distanceMax(400))
        .force("link", d3.forceLink().distance(200).links(links));
    drawContext = new DrawContext(
        nodes,
        links,
        network.spikeSources.map(spikeSource => spikeSource.display),
        network.spikeSinks.map(spikeSink => spikeSink.display),
        network.spikeDisplays(),
        forceSimulation,
    );
    forceSimulation.on("tick", () => {
        drawContext.requestDraw();
    });
    const networkUnsubscribe = network.subscribe(
        SubscriptionType.Topology | SubscriptionType.Display,
        network => {
            const nodes = network.nodes();
            const links = network.links();
            forceSimulation.nodes(nodes);
            (<d3.ForceLink<Node, Link>>forceSimulation.force("link")).links(
                links,
            );
            forceSimulation.alpha(1).restart();
            drawContext.updateNetworkSelection(
                nodes,
                links,
                network.spikeSources.map(spikeSource => spikeSource.display),
                network.spikeSinks.map(spikeSink => spikeSink.display),
                network.spikeDisplays(),
                forceSimulation,
            );
            drawContext.requestDraw();
        },
    );
    const networkStateUnsubscribe = network.subscribe(
        SubscriptionType.State,
        _ => {
            drawContext.networkSelection.updateSpikes(
                drawContext,
                network.spikeDisplays(),
            );
            drawContext.requestDraw();
        },
    );
    return () => {
        networkStateUnsubscribe();
        networkUnsubscribe();
        drawContext.unmount();
        forceSimulation.stop();
    };
});
</script>

<svelte:window on:resize={() => {
    drawContext.updateSvgSize();
}}/>

<div bind:this={d3Container} class="graph" class:active-containers={tool === "select"} class:active-neurons={tool === "select" || tool === "add-synapse"} onclick={event => {
    if (tool === "add-neuron" || tool === "add-spike-source" || tool === "add-spike-sink") {
        const boundingClientRect = d3Container.getBoundingClientRect();
        const transform = d3.zoomTransform(<SVGSVGElement>drawContext.svg.node());
        const [x, y] = transform.invert([
            event.x - boundingClientRect.x - boundingClientRect.width / 2,
            event.y - boundingClientRect.y - boundingClientRect.height / 2,
        ]);
        switch (tool) {
            case"add-neuron": {
                network.addNeuron(x, y, 60.0, 1.0, false, DEFAULT_INSTRUMENT, synth.nextNote(), DEFAULT_CHORD_DURATION, true);
                selection = network.neurons[network.neurons.length - 1];
                drawContext.requestDraw();
                break;
            }
            case "add-spike-source": {
                network.addSpikeSource(
                    x,
                    y,
                    "vertical",
                    [false, 0],
                    "0:20 1:40 2:60\n",
                    new Array(3).fill(null).map(() => [DEFAULT_INSTRUMENT, synth.nextNote(), DEFAULT_CHORD_DURATION]),
                    true,
                );
                selection = network.spikeSources[network.spikeSources.length - 1];
                drawContext.requestDraw();
                break;
            }
            case "add-spike-sink": {
                network.addSpikeSink(x, y, "vertical", 3, true);
                selection = network.spikeSinks[network.spikeSinks.length - 1];
                drawContext.requestDraw();
                break;
            }
            default: {
                throw new Error("unreachable")
            }
        }
    } else if (tool === "select") {
        selection = null;
        drawContext.requestDraw();
    }
}} role="none"></div>

<style>
    .graph {
        width: 100%;
        height: calc(100% - 100px);
        overflow: hidden;
    }

    :global(.graph.active-neurons svg g#nodes circle) {
        cursor: pointer;
    }

    :global(.graph.active-containers svg rect) {
        cursor: pointer;
    }
</style>
