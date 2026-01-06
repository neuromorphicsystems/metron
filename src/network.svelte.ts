import { parseNoteInput, parseSpikeInput } from "./parsers";
import type { SimulatorUpdate } from "./simulator";
import { synth } from "./synth.svelte";
import type { Tool } from "./tool";

export type Node =
    | NeuronDisplay
    | SpikeSourceChannelDisplay
    | SpikeSinkChannelDisplay;

export type Link = SynapseDisplay;

export type SynapsePre = Neuron | SpikeSourceChannel;

export type SynapsePost = Neuron | SpikeSinkChannel;

export type SynapsePreDisplay = NeuronDisplay | SpikeSourceChannelDisplay;

export type SynapsePostDisplay = NeuronDisplay | SpikeSinkChannelDisplay;

export interface SpikeDisplay {
    position: number;
    pre: SynapsePreDisplay;
    post: SynapsePostDisplay;

    // cache
    x: number;
    y: number;
}

export const NEURON_RADIUS: number = 20;
export const CONTAINER_PADDING: number = 20;
export const CONTAINER_CELL_SIZE: number =
    NEURON_RADIUS * 2 + CONTAINER_PADDING * 2;
export const GLOW_DURATION: number = 60; // ticks
export const GLOW_START_RADIUS: number = NEURON_RADIUS + 2;
export const GLOW_END_RADIUS: number = NEURON_RADIUS * 2;
export const SPIKE_RADIUS: number = 6;

export function selected(
    node: Node,
    selection: Neuron | SpikeSource | SpikeSink | null,
) {
    if (selection == null) {
        return false;
    }
    switch (selection.type) {
        case "neuron": {
            return node.parent === selection;
        }
        case "sink":
        case "source": {
            return (
                node.type === selection.type && node.parent.parent === selection
            );
        }
        default:
            throw new Error("unreachable");
    }
}

export function nodeStroke(
    node: Node,
    tool: Tool,
    newSynapsePre: SynapsePreDisplay | null,
    selection: Neuron | SpikeSource | SpikeSink | null,
): [string, number] {
    if (
        tool === "add-neuron" ||
        tool === "add-spike-source" ||
        tool === "add-spike-sink"
    ) {
        return selected(node, selection) ? ["#268bd2", 3] : ["#586e75", 2];
    }
    if (node === newSynapsePre) {
        return ["#6C71C4", 3];
    }
    if (newSynapsePre != null && node.hover) {
        switch (node.type) {
            case "neuron": {
                return node.parent.parent.isNewSynapseValid(
                    newSynapsePre.parent,
                    node.parent,
                )[0]
                    ? ["#2aa198", 3]
                    : ["#dc322f", 3];
            }
            case "source": {
                return ["#dc322f", 3];
            }
            case "sink": {
                return node.parent.parent.parent.isNewSynapseValid(
                    newSynapsePre.parent,
                    node.parent,
                )[0]
                    ? ["#2aa198", 3]
                    : ["#dc322f", 3];
            }
            default: {
                throw new Error("unreachable");
            }
        }
    }
    if (node.active || selected(node, selection)) {
        return ["#268bd2", 3];
    }
    if (node.hover) {
        return ["#002b36", 3];
    }
    return ["#586e75", 2];
}

export function containerStroke(
    container: SpikeSourceDisplay | SpikeSinkDisplay,
    tool: Tool,
    selection: Neuron | SpikeSource | SpikeSink | null,
): [string, number] {
    if (
        tool === "add-neuron" ||
        tool === "add-spike-source" ||
        tool === "add-spike-sink"
    ) {
        return container.parent === selection ? ["#268bd2", 3] : ["#586e75", 2];
    }
    if (container.active || container.parent === selection) {
        return ["#268bd2", 3];
    }
    if (container.hover) {
        return ["#002b36", 3];
    }
    return ["#586e75", 2];
}

export class NeuronDisplay {
    parent: Neuron;
    type: "neuron";
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx?: number;
    fy?: number;
    index?: number;
    hover: boolean;
    active: boolean;
    translation: number;
    opacity: number;
    glowRadius: number;
    glowOpacity: number;

    // cache
    stroke: [string, number];

    constructor(parent: Neuron, x: number, y: number) {
        this.parent = parent;
        this.type = "neuron";
        this.id = parent.parent.nextId();
        this.x = x;
        this.y = y;
        this.vx = 0.0;
        this.vy = 0.0;
        this.hover = false;
        this.active = false;
        this.translation = NEURON_RADIUS * 2;
        this.opacity = 0.0;
        this.glowRadius = 0.0;
        this.glowOpacity = 0.0;
        this.stroke = ["#586e75", 2];
    }
}

export class Neuron {
    parent: Network;
    type: "neuron";
    name: string = $state.raw("");
    preSynapses: Synapse[] = $state.raw([]);
    postSynapses: Synapse[] = $state.raw([]);
    tau: number = $state.raw(0.0);
    threshold: number = $state.raw(0.0);
    subtractOnReset: boolean = $state.raw(false);
    instrument: string = $state.raw("None");
    noteInputContent: string = $state.raw("");
    chordDuration: number = $state.raw(0.0);
    notes: string[] = [];
    display: NeuronDisplay;

    constructor(
        parent: Network,
        x: number,
        y: number,
        tau: number,
        threshold: number,
        subtractOnReset: boolean,
        instrument: string,
        noteInputContent: string,
        chordDuration: number,
    ) {
        this.parent = parent;
        this.type = "neuron";
        this.name = parent.nextNeuronName();
        this.preSynapses = [];
        this.postSynapses = [];
        this.tau = tau;
        this.threshold = threshold;
        this.subtractOnReset = subtractOnReset;
        this.instrument = instrument;
        this.noteInputContent = noteInputContent;
        this.chordDuration = chordDuration;
        this.notes = parseNoteInput(this.noteInputContent, null);
        this.display = new NeuronDisplay(this, x, y);
    }
}

export class SynapseDisplay {
    parent: Synapse;
    source: SynapsePreDisplay;
    target: SynapsePostDisplay;
    id: number;
    spikes: number[];

    constructor(
        parent: Synapse,
        source: SynapsePreDisplay,
        target: SynapsePostDisplay,
    ) {
        this.parent = parent;
        this.source = source;
        this.target = target;
        this.id = (
            parent.pre.type === "neuron"
                ? parent.pre.parent
                : parent.pre.parent.parent
        ).nextId();
        this.spikes = [];
    }
}

export class Synapse {
    pre: SynapsePre;
    post: SynapsePost;
    delay: number = $state.raw(0.0);
    weight: number = $state.raw(0.0);
    tau: number = $state.raw(0.0);
    display: SynapseDisplay;

    constructor(
        pre: SynapsePre,
        post: SynapsePost,
        delay: number,
        weight: number,
        tau: number,
    ) {
        this.pre = pre;
        this.post = post;
        this.delay = delay;
        this.weight = weight;
        this.tau = tau;
        this.display = new SynapseDisplay(
            this,
            this.pre.display,
            this.post.display,
        );
    }

    preName(): string {
        switch (this.pre.type) {
            case "neuron":
                return `neuron ${this.pre.name}`;
            case "source":
                return `source ${this.pre.parent.name}`;
            default:
                throw new Error("unreachable");
        }
    }

    postName(): string {
        switch (this.post.type) {
            case "neuron":
                return `neuron ${this.post.name}`;
            case "sink":
                return `sink ${this.post.parent.name}`;
            default:
                throw new Error("unreachable");
        }
    }

    network(): Network {
        let preNetwork: Network | null = null;
        switch (this.pre.type) {
            case "neuron":
                preNetwork = this.pre.parent;
                break;
            case "source":
                preNetwork = this.pre.parent.parent;
                break;
            default:
                throw new Error("unreachable");
        }
        let postNetwork: Network | null = null;
        switch (this.post.type) {
            case "neuron":
                postNetwork = this.post.parent;
                break;
            case "sink":
                postNetwork = this.post.parent.parent;
                break;
            default:
                throw new Error("unreachable");
        }
        if (preNetwork !== postNetwork) {
            throw new Error("pre and post from different networks");
        }
        return preNetwork as Network;
    }
}

export type ContainerStyle =
    | "vertical"
    | "horizontal"
    | "vertical-rectangle"
    | "horizontal-rectangle";

export function largestFactorLessThanSquareRoot(integer: number): number {
    for (let divisor = Math.ceil(Math.sqrt(integer)); divisor > 1; --divisor) {
        if (integer % divisor === 0) {
            return divisor;
        }
    }
    return 1;
}

function updateDisplay(container: SpikeSource | SpikeSink, type: number) {
    const centerX = container.display.x + container.display.width / 2;
    const centerY = container.display.y + container.display.height / 2;
    if (container.channels.length === 0) {
        container.display.x = centerX - NEURON_RADIUS;
        container.display.y = centerY - NEURON_RADIUS;
        container.display.width = NEURON_RADIUS * 2;
        container.display.height = NEURON_RADIUS * 2;
        container.display.shape[0] = 0;
        container.display.shape[1] = 0;
    } else {
        let width: number = 1;
        let height: number = 1;
        switch (container.style) {
            case "vertical": {
                width = 1;
                height = container.channels.length;
                break;
            }
            case "horizontal": {
                width = container.channels.length;
                height = 1;
                break;
            }
            case "vertical-rectangle": {
                width = largestFactorLessThanSquareRoot(
                    container.channels.length,
                );
                height = container.channels.length / width;
                break;
            }
            case "horizontal-rectangle": {
                height = largestFactorLessThanSquareRoot(
                    container.channels.length,
                );
                width = container.channels.length / height;
                break;
            }
            default:
                throw new Error("unreachable");
        }
        container.display.x = centerX - (width * CONTAINER_CELL_SIZE) / 2;
        container.display.y = centerY - (height * CONTAINER_CELL_SIZE) / 2;
        container.display.width = width * CONTAINER_CELL_SIZE;
        container.display.height = height * CONTAINER_CELL_SIZE;
        container.display.shape[0] = width;
        container.display.shape[1] = height;
        const offsetX = centerX - ((width - 1) * CONTAINER_CELL_SIZE) / 2;
        const offsetY = centerY - ((height - 1) * CONTAINER_CELL_SIZE) / 2;
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                const index = x + y * width;
                const channel = container.channels[index];
                channel.name = index.toString();
                channel.display.x = offsetX + x * CONTAINER_CELL_SIZE;
                channel.display.y = offsetY + y * CONTAINER_CELL_SIZE;
                channel.display.fx = channel.display.x;
                channel.display.fy = channel.display.y;
            }
        }
    }
    container.parent.dispatch(type);
}

export class SpikeSourceChannelDisplay {
    parent: SpikeSourceChannel;
    type: "source";
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx?: number;
    fy?: number;
    index?: number;
    hover: boolean;
    active: boolean;
    glowRadius: number;
    glowOpacity: number;

    // cache
    stroke: [string, number];

    constructor(parent: SpikeSourceChannel, x: number, y: number) {
        this.parent = parent;
        this.type = "source";
        this.id = parent.parent.parent.nextId();
        this.x = x;
        this.y = y;
        this.vx = 0.0;
        this.vy = 0.0;
        this.fx = x;
        this.fy = y;
        this.hover = false;
        this.active = false;
        this.glowRadius = 0.0;
        this.glowOpacity = 0.0;
        this.stroke = ["#586e75", 2];
    }
}

export class SpikeSourceChannel {
    parent: SpikeSource;
    type: "source";
    name: string = $state.raw("");
    postSynapses: Synapse[] = $state.raw([]);
    instrument: string = $state.raw("None");
    noteInputContent: string = $state.raw("");
    chordDuration: number = $state.raw(0.0);
    notes: string[] = [];
    display: SpikeSourceChannelDisplay;

    constructor(
        parent: SpikeSource,
        name: string,
        x: number,
        y: number,
        instrument: string,
        noteInputContent: string,
        chordDuration: number,
    ) {
        this.parent = parent;
        this.type = "source";
        this.name = name;
        this.postSynapses = [];
        this.instrument = instrument;
        this.noteInputContent = noteInputContent;
        this.notes = parseNoteInput(this.noteInputContent, null);
        this.chordDuration = chordDuration;
        this.display = new SpikeSourceChannelDisplay(this, x, y);
    }
}

export class SpikeSourceDisplay {
    parent: SpikeSource;
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    hover: boolean;
    active: boolean;

    // cache
    stroke: [string, number];
    currentShape: [number, number];
    shape: [number, number];

    constructor(
        parent: SpikeSource,
        x: number,
        y: number,
        width: number,
        height: number,
    ) {
        this.parent = parent;
        this.id = parent.parent.nextId();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.hover = false;
        this.active = false;
        this.stroke = ["#586e75", 2];
        this.currentShape = [-1, -1];
        this.shape = [0, 0];
    }
}

export class SpikeSource {
    parent: Network;
    type: "source";
    name: string = $state.raw("");
    channels: SpikeSourceChannel[] = $state.raw([]);
    style: ContainerStyle = $state.raw("vertical");
    spikeInputContent: string = $state.raw("");
    period: [boolean, number] = $state.raw([false, 0]);
    spikesTimeAndChannel: [number, number][] = [];
    display: SpikeSourceDisplay;

    constructor(
        parent: Network,
        x: number,
        y: number,
        style: ContainerStyle,
        period: [boolean, number],
        spikeInputContent: string,
    ) {
        this.parent = parent;
        this.type = "source";
        this.name = parent.nextSourceName();
        this.channels = [];
        this.style = style;
        this.spikeInputContent = spikeInputContent;
        this.period = period;
        this.spikesTimeAndChannel = parseSpikeInput(
            this.spikeInputContent,
            this.channels.length,
            null,
        );
        this.display = new SpikeSourceDisplay(
            this,
            x - NEURON_RADIUS,
            y - NEURON_RADIUS,
            NEURON_RADIUS * 2,
            NEURON_RADIUS * 2,
        );
    }

    addChannels(
        channelChords: [string, string, number][],
        saveAction: boolean,
    ) {
        for (const [
            instrument,
            noteInputContent,
            chordDuration,
        ] of channelChords) {
            this.addChannelObject(
                new SpikeSourceChannel(
                    this,
                    this.channels.length.toString(),
                    this.display.x,
                    this.display.y,
                    instrument,
                    noteInputContent,
                    chordDuration,
                ),
                saveAction,
                false,
                this.channels.length,
            );
        }
        this.spikesTimeAndChannel = parseSpikeInput(
            this.spikeInputContent,
            this.channels.length,
            null,
        );
        updateDisplay(this, SubscriptionType.Topology);
    }

    addChannelObject(
        spikeSourceChannel: SpikeSourceChannel,
        saveAction: boolean,
        update: boolean,
        index: number,
    ) {
        if (spikeSourceChannel.parent !== this) {
            throw new Error("the channel is from another spike source");
        }
        this.channels = this.channels
            .slice(0, index)
            .concat([spikeSourceChannel])
            .concat(this.channels.slice(index));
        if (saveAction) {
            this.parent.addAction([
                "addSpikeSourceChannel",
                spikeSourceChannel,
            ]);
        }
        if (update) {
            this.spikesTimeAndChannel = parseSpikeInput(
                this.spikeInputContent,
                this.channels.length,
                null,
            );
            updateDisplay(this, SubscriptionType.Topology);
        }
    }

    removeChannels(count: number, saveAction: boolean) {
        const remove = Math.min(count, this.channels.length);
        for (let index = 0; index < remove; ++index) {
            this.removeChannelObject(
                this.channels[this.channels.length - 1],
                saveAction,
                false,
            );
        }
        updateDisplay(this, SubscriptionType.Topology);
    }

    removeChannelObject(
        spikeSourceChannel: SpikeSourceChannel,
        saveAction: boolean,
        update: boolean,
    ) {
        if (spikeSourceChannel.parent !== this) {
            throw new Error("the channel is from another spike source");
        }
        const channelIndex = this.channels.indexOf(spikeSourceChannel);
        if (channelIndex === -1) {
            throw new Error("the channel is not in the spike source");
        }
        for (const synapse of spikeSourceChannel.postSynapses) {
            this.parent.removeSynapse(synapse, saveAction, false);
        }
        this.spikesTimeAndChannel = this.spikesTimeAndChannel.filter(
            timeAndChannel => timeAndChannel[1] !== channelIndex,
        );
        this.channels = this.channels
            .slice(0, channelIndex)
            .concat(this.channels.slice(channelIndex + 1));
        spikeSourceChannel.display.glowRadius = 0.0;
        spikeSourceChannel.display.glowOpacity = 0.0;
        if (saveAction) {
            this.parent.addAction([
                "removeSpikeSourceChannel",
                spikeSourceChannel,
                channelIndex,
            ]);
        }
        if (update) {
            updateDisplay(this, SubscriptionType.Topology);
        }
    }

    setStyle(style: ContainerStyle) {
        this.style = style;
        updateDisplay(this, SubscriptionType.Display);
    }
}

export class SpikeSinkChannelDisplay {
    parent: SpikeSinkChannel;
    type: "sink";
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx?: number;
    fy?: number;
    index?: number;
    hover: boolean;
    active: boolean;
    glowRadius: 0.0;
    glowOpacity: 0.0;

    // cache
    stroke: [string, number];

    constructor(parent: SpikeSinkChannel, x: number, y: number) {
        this.parent = parent;
        this.type = "sink";
        this.id = parent.parent.parent.nextId();
        this.x = x;
        this.y = y;
        this.vx = 0.0;
        this.vy = 0.0;
        this.fx = x;
        this.fy = y;
        this.hover = false;
        this.active = false;
        this.glowRadius = 0.0;
        this.glowOpacity = 0.0;
        this.stroke = ["#586e75", 2];
    }
}

export class SpikeSinkChannel {
    parent: SpikeSink;
    type: "sink";
    name: string = $state.raw("");
    preSynapses: Synapse[] = $state.raw([]);
    display: SpikeSinkChannelDisplay;

    constructor(parent: SpikeSink, name: string, x: number, y: number) {
        this.parent = parent;
        this.type = "sink";
        this.name = name;
        this.preSynapses = [];
        this.display = new SpikeSinkChannelDisplay(this, x, y);
    }
}

export class SpikeSinkDisplay {
    parent: SpikeSink;
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    hover: boolean;
    active: boolean;

    // cache
    stroke: [string, number];
    currentShape: [number, number];
    shape: [number, number];

    constructor(
        parent: SpikeSink,
        x: number,
        y: number,
        width: number,
        height: number,
    ) {
        this.parent = parent;
        this.id = parent.parent.nextId();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.hover = false;
        this.active = false;
        this.stroke = ["#586e75", 2];
        this.currentShape = [-1, -1];
        this.shape = [0, 0];
    }
}

export class SpikeSink {
    parent: Network;
    type: "sink";
    name: string = $state.raw("");
    channels: SpikeSinkChannel[] = $state.raw([]);
    style: ContainerStyle;
    display: SpikeSinkDisplay;

    constructor(parent: Network, x: number, y: number, style: ContainerStyle) {
        this.parent = parent;
        this.type = "sink";
        this.name = parent.nextSinkName();
        this.channels = [];
        this.style = style;
        this.display = new SpikeSinkDisplay(
            this,
            x - NEURON_RADIUS,
            y - NEURON_RADIUS,
            NEURON_RADIUS * 2,
            NEURON_RADIUS * 2,
        );
    }

    addChannels(count: number, saveAction: boolean) {
        for (let index = 0; index < count; ++index) {
            this.addChannelObject(
                new SpikeSinkChannel(
                    this,
                    this.channels.length.toString(),
                    this.display.x,
                    this.display.y,
                ),
                saveAction,
                false,
                this.channels.length,
            );
        }
        updateDisplay(this, SubscriptionType.Topology);
    }

    addChannelObject(
        spikeSinkChannel: SpikeSinkChannel,
        saveAction: boolean,
        update: boolean,
        index: number,
    ) {
        if (spikeSinkChannel.parent !== this) {
            throw new Error("the channel is from another spike sink");
        }
        this.channels = this.channels
            .slice(0, index)
            .concat([spikeSinkChannel])
            .concat(this.channels.slice(index));
        if (saveAction) {
            this.parent.addAction(["addSpikeSinkChannel", spikeSinkChannel]);
        }
        if (update) {
            updateDisplay(this, SubscriptionType.Topology);
        }
    }

    removeChannels(count: number, saveAction: boolean) {
        const remove = Math.min(count, this.channels.length);
        for (let index = 0; index < remove; ++index) {
            this.removeChannelObject(
                this.channels[this.channels.length - 1],
                saveAction,
                false,
            );
        }
        updateDisplay(this, SubscriptionType.Topology);
    }

    removeChannelObject(
        spikeSinkChannel: SpikeSinkChannel,
        saveAction: boolean,
        update: boolean,
    ) {
        if (spikeSinkChannel.parent !== this) {
            throw new Error("the channel is from another spike sink");
        }
        const channelIndex = this.channels.indexOf(spikeSinkChannel);
        if (channelIndex === -1) {
            throw new Error("the channel is not in the spike sink");
        }
        for (const synapse of spikeSinkChannel.preSynapses) {
            this.parent.removeSynapse(synapse, saveAction, false);
        }
        this.channels = this.channels
            .slice(0, channelIndex)
            .concat(this.channels.slice(channelIndex + 1));
        if (saveAction) {
            this.parent.addAction([
                "removeSpikeSinkChannel",
                spikeSinkChannel,
                channelIndex,
            ]);
        }
        if (update) {
            updateDisplay(this, SubscriptionType.Topology);
        }
    }

    setStyle(style: ContainerStyle) {
        this.style = style;
        updateDisplay(this, SubscriptionType.Topology);
    }
}

function indexToLetters(index: number): string {
    const digits: number[] = [];
    while (index > 0) {
        digits.push(index % 26);
        index = Math.floor(index / 26);
    }
    if (digits.length === 0) {
        digits.push(0);
    }
    digits.reverse();
    if (digits.length > 1) {
        digits[0] -= 1;
    }
    return digits.map(digit => String.fromCharCode(65 + digit)).join("");
}

type Action =
    | ["addNeuron", Neuron]
    | ["removeNeuron", Neuron]
    | ["addSynapse", Synapse]
    | ["removeSynapse", Synapse]
    | ["addSpikeSource", SpikeSource]
    | ["removeSpikeSource", SpikeSource]
    | ["addSpikeSink", SpikeSink]
    | ["removeSpikeSink", SpikeSink]
    | ["addSpikeSourceChannel", SpikeSourceChannel]
    | ["removeSpikeSourceChannel", SpikeSourceChannel, number]
    | ["addSpikeSinkChannel", SpikeSinkChannel]
    | ["removeSpikeSinkChannel", SpikeSinkChannel, number];

export enum SubscriptionType {
    Topology = 0b1,
    State = 0b10,
    Parameters = 0b100,
    Display = 0b1000,
}

function timeSinceLastSpikeToGlow(
    timeSinceLastSpike: number,
): [number, number] {
    if (timeSinceLastSpike < 0 || timeSinceLastSpike >= GLOW_DURATION) {
        return [0.0, 0.0];
    }
    const lambda = (timeSinceLastSpike / GLOW_DURATION) ** 0.5;
    return [
        GLOW_START_RADIUS * (1.0 - lambda) + GLOW_END_RADIUS * lambda,
        1.0 - lambda,
    ];
}

export class Network {
    neurons: Neuron[];
    synapses: Synapse[];
    spikeSources: SpikeSource[];
    spikeSinks: SpikeSink[];
    subscriberIdToSubscription: {
        [key: number]: [number, (network: Network) => void];
    };
    nextSubscriberId: number;
    currentId: number;
    currentNeuronNameId: number;
    currentSourceNameId: number;
    currentSinkNameId: number;
    actions: Action[];
    undoneActions: Action[];
    soundTick: number | null = null;

    constructor() {
        this.neurons = [];
        this.synapses = [];
        this.spikeSources = [];
        this.spikeSinks = [];
        this.subscriberIdToSubscription = {};
        this.nextSubscriberId = 0;
        this.currentId = -1;
        this.currentNeuronNameId = -1;
        this.currentSourceNameId = -1;
        this.currentSinkNameId = -1;
        this.actions = [];
        this.undoneActions = [];
        this.soundTick = null;
    }

    nextId(): number {
        ++this.currentId;
        return this.currentId;
    }

    nextNeuronName(): string {
        ++this.currentNeuronNameId;
        return this.currentNeuronNameId.toString();
    }

    nextSourceName(): string {
        ++this.currentSourceNameId;
        return indexToLetters(this.currentSourceNameId);
    }

    nextSinkName(): string {
        ++this.currentSinkNameId;
        return indexToLetters(this.currentSinkNameId);
    }

    subscribe(
        type: number,
        subscription: (network: Network) => void,
    ): () => void {
        const subscriberId = this.nextSubscriberId;
        ++this.nextSubscriberId;
        this.subscriberIdToSubscription[subscriberId] = [type, subscription];
        return () => {
            delete this.subscriberIdToSubscription[subscriberId];
        };
    }

    nodes(): Node[] {
        const nodes: Node[] = this.neurons.map(neuron => neuron.display);
        for (const spikeSource of this.spikeSources) {
            nodes.push(...spikeSource.channels.map(channel => channel.display));
        }
        for (const spikeSink of this.spikeSinks) {
            nodes.push(...spikeSink.channels.map(channel => channel.display));
        }
        return nodes;
    }

    links(): Link[] {
        return this.synapses.map(synapse => synapse.display);
    }

    addAction(action: Action) {
        this.actions.push(action);
        this.undoneActions.length = 0;
    }

    addNeuron(
        x: number,
        y: number,
        tau: number,
        threshold: number,
        subtractOnReset: boolean,
        instrument: string,
        noteInputContent: string,
        chordDuration: number,
        saveAction: boolean,
    ) {
        this.addNeuronObject(
            new Neuron(
                this,
                x,
                y,
                tau,
                threshold,
                subtractOnReset,
                instrument,
                noteInputContent,
                chordDuration,
            ),
            saveAction,
        );
    }

    addNeuronObject(neuron: Neuron, saveAction: boolean) {
        if (neuron.parent !== this) {
            throw new Error("the neuron is from another network");
        }
        this.neurons.push(neuron);
        if (saveAction) {
            this.addAction(["addNeuron", neuron]);
        }
        this.dispatch(SubscriptionType.Topology);
    }

    removeNeuron(neuron: Neuron, saveAction: boolean) {
        if (neuron.parent !== this) {
            throw new Error("the neuron is from another network");
        }
        const neuronIndex = this.neurons.indexOf(neuron);
        if (neuronIndex === -1) {
            throw new Error("the neuron is not in the network");
        }
        for (const synapse of neuron.postSynapses.concat(neuron.preSynapses)) {
            this.removeSynapse(synapse, saveAction, false);
        }
        neuron.display.translation = 0.0;
        neuron.display.glowRadius = 0.0;
        neuron.display.glowOpacity = 0.0;
        this.neurons.splice(neuronIndex, 1);
        if (saveAction) {
            this.addAction(["removeNeuron", neuron]);
        }
        this.dispatch(SubscriptionType.Topology);
    }

    isNewSynapseValid(
        pre: SynapsePre,
        post: SynapsePost,
    ): [false, string] | [true, null] {
        if (pre.type === "source") {
            if (
                this.spikeSources.every(spikeSource =>
                    spikeSource.channels.every(channel => channel !== pre),
                )
            ) {
                return [false, "the pre (spike source) is not in the network"];
            }
        } else {
            if (this.neurons.every(neuron => neuron !== pre)) {
                return [false, "the pre (neuron) is not in the network"];
            }
        }
        if (post.type === "sink") {
            if (
                this.spikeSinks.every(spikeSink =>
                    spikeSink.channels.every(channel => channel !== post),
                )
            ) {
                return [false, "the post (spike sink) is not in the network"];
            }
        } else {
            if (this.neurons.every(neuron => neuron !== post)) {
                return [false, "the post (neuron) is not in the network"];
            }
        }
        // @TODO: remove this constraint and add a way to visualize multiple synapses with the same pre and post
        for (const synapse of this.synapses) {
            if (pre === synapse.pre && post === synapse.post) {
                return [
                    false,
                    "a synpase with the same pre and post is already in the network",
                ];
            }
        }
        return [true, null];
    }

    addSynapse(
        pre: SynapsePre,
        post: SynapsePost,
        delay: number,
        weight: number,
        tau: number,
        saveAction: boolean,
    ) {
        this.addSynapseObject(
            new Synapse(pre, post, Math.round(delay), weight, tau),
            saveAction,
        );
    }

    addSynapseObject(synapse: Synapse, saveAction: boolean) {
        if (synapse.network() !== this) {
            throw new Error("the synapse is from another network");
        }
        const [valid, reason] = this.isNewSynapseValid(
            synapse.pre,
            synapse.post,
        );
        if (!valid) {
            throw new Error(reason);
        }
        if (
            this.synapses.length > 0 &&
            synapse.display.id <=
                this.synapses[this.synapses.length - 1].display.id
        ) {
            throw new Error(
                `synapse ids must be strictly monotonic (trying to push id ${synapse.display.id} but the previous id ${this.synapses[this.synapses.length - 1].display.id})`,
            );
        }
        this.synapses.push(synapse);
        synapse.pre.postSynapses = synapse.pre.postSynapses
            .concat([synapse])
            .sort((a: Synapse, b: Synapse) =>
                b.preName().localeCompare(a.preName()),
            );
        synapse.post.preSynapses = synapse.post.preSynapses
            .concat([synapse])
            .sort((a: Synapse, b: Synapse) =>
                b.postName().localeCompare(a.postName()),
            );
        if (saveAction) {
            this.addAction(["addSynapse", synapse]);
        }
        this.dispatch(SubscriptionType.Topology);
    }

    removeSynapse(synapse: Synapse, saveAction: boolean, dispatch: boolean) {
        if (synapse.network() !== this) {
            throw new Error("the synapse is from another network");
        }
        const synapseIndex = this.synapses.indexOf(synapse);
        if (synapseIndex === -1) {
            throw new Error("the synapse is not in the network");
        }
        const preIndex = synapse.pre.postSynapses.indexOf(synapse);
        if (preIndex === -1) {
            throw new Error("synapse not found in synapse.pre.postSynapses");
        }
        const postIndex = synapse.post.preSynapses.indexOf(synapse);
        if (postIndex === -1) {
            throw new Error("synapse not found in synapse.post.preSynapses");
        }
        synapse.pre.postSynapses = synapse.pre.postSynapses
            .slice(0, preIndex)
            .concat(synapse.pre.postSynapses.slice(preIndex + 1))
            .sort((a: Synapse, b: Synapse) =>
                b.preName().localeCompare(a.preName()),
            );
        synapse.post.preSynapses = synapse.post.preSynapses
            .slice(0, postIndex)
            .concat(synapse.post.preSynapses.slice(postIndex + 1))
            .sort((a: Synapse, b: Synapse) =>
                b.postName().localeCompare(a.postName()),
            );
        synapse.display.spikes.length = 0;
        this.synapses.splice(synapseIndex, 1);
        if (saveAction) {
            this.addAction(["removeSynapse", synapse]);
        }
        if (dispatch) {
            this.dispatch(SubscriptionType.Topology);
        }
    }

    addSpikeSource(
        x: number,
        y: number,
        style: ContainerStyle,
        period: [boolean, number],
        spikeInputContent: string,
        channelChords: [string, string, number][],
        saveAction: boolean,
    ) {
        const spikeSource = new SpikeSource(
            this,
            x,
            y,
            style,
            period,
            spikeInputContent,
        );
        this.addSpikeSourceObject(spikeSource, saveAction);
        spikeSource.addChannels(channelChords, true);
    }

    addSpikeSourceObject(spikeSource: SpikeSource, saveAction: boolean) {
        if (spikeSource.parent !== this) {
            throw new Error("the spike source is from another network");
        }
        this.spikeSources.push(spikeSource);
        if (saveAction) {
            this.addAction(["addSpikeSource", spikeSource]);
        }
        this.dispatch(SubscriptionType.Topology);
    }

    removeSpikeSource(spikeSource: SpikeSource, saveAction: boolean) {
        if (spikeSource.parent !== this) {
            throw new Error("the spike source is from another network");
        }
        const spikeSourceIndex = this.spikeSources.indexOf(spikeSource);
        if (spikeSourceIndex === -1) {
            throw new Error("the spike source is not in the network");
        }
        spikeSource.removeChannels(spikeSource.channels.length, saveAction);
        this.spikeSources.splice(spikeSourceIndex, 1);
        if (saveAction) {
            this.addAction(["removeSpikeSource", spikeSource]);
        }
        this.dispatch(SubscriptionType.Topology);
    }

    addSpikeSink(
        x: number,
        y: number,
        style: ContainerStyle,
        channels: number,
        saveAction: boolean,
    ) {
        const spikeSink = new SpikeSink(this, x, y, style);
        this.addSpikeSinkObject(spikeSink, saveAction);
        spikeSink.addChannels(channels, true);
    }

    addSpikeSinkObject(spikeSink: SpikeSink, saveAction: boolean) {
        if (spikeSink.parent !== this) {
            throw new Error("the spike sink is from another network");
        }
        this.spikeSinks.push(spikeSink);
        if (saveAction) {
            this.addAction(["addSpikeSink", spikeSink]);
        }
        this.dispatch(SubscriptionType.Topology);
    }

    removeSpikeSink(spikeSink: SpikeSink, saveAction: boolean) {
        if (spikeSink.parent !== this) {
            throw new Error("the spike sink is from another network");
        }
        const spikeSinkIndex = this.spikeSinks.indexOf(spikeSink);
        if (spikeSinkIndex === -1) {
            throw new Error("the spike sink is not in the network");
        }
        spikeSink.removeChannels(spikeSink.channels.length, saveAction);
        this.spikeSinks.splice(spikeSinkIndex, 1);
        if (saveAction) {
            this.addAction(["removeSpikeSink", spikeSink]);
        }
        this.dispatch(SubscriptionType.Topology);
    }

    undo(
        selection: Neuron | SpikeSource | SpikeSink | null,
        clearSelection: () => void,
    ) {
        const action = this.actions.pop();
        if (action != null) {
            switch (action[0]) {
                case "addNeuron":
                    if (selection === action[1]) {
                        clearSelection();
                    }
                    this.removeNeuron(action[1], false);
                    break;
                case "removeNeuron":
                    this.addNeuronObject(action[1], false);
                    break;
                case "addSynapse":
                    this.removeSynapse(action[1], false, true);
                    break;
                case "removeSynapse":
                    // request a new id to ensure that id numbers are ordered
                    // this is required for synapses (and only for synapses)
                    // because the simulator only sends spikes for active synapses
                    // this creates an ambiguity between removed synapses and inactive synapses
                    // that would require the creation of a map
                    // by keeping the ids sorted, we can remove the ambiguity with a fast dual-index algorithm
                    //
                    // neurons and spike sources do not suffer from the issue because the simulator
                    // sends data (last spike and potential) for every entry
                    //
                    // spike sinks are not affected either because their apperance is not impacted by the simulation states
                    action[1].display.id = this.nextId();
                    this.addSynapseObject(action[1], false);
                    break;
                case "addSpikeSource":
                    if (selection === action[1]) {
                        clearSelection();
                    }
                    this.removeSpikeSource(action[1], false);
                    break;
                case "removeSpikeSource":
                    this.addSpikeSourceObject(action[1], false);
                    break;
                case "addSpikeSink":
                    if (selection === action[1]) {
                        clearSelection();
                    }
                    this.removeSpikeSink(action[1], false);
                    break;
                case "removeSpikeSink":
                    this.addSpikeSinkObject(action[1], false);
                    break;
                case "addSpikeSourceChannel":
                    action[1].parent.removeChannelObject(
                        action[1],
                        false,
                        true,
                    );
                    break;
                case "removeSpikeSourceChannel":
                    action[1].parent.addChannelObject(
                        action[1],
                        false,
                        true,
                        action[2],
                    );
                    break;
                case "addSpikeSinkChannel":
                    action[1].parent.removeChannelObject(
                        action[1],
                        false,
                        true,
                    );
                    break;
                case "removeSpikeSinkChannel":
                    action[1].parent.addChannelObject(
                        action[1],
                        false,
                        true,
                        action[2],
                    );
                    break;
                default:
                    throw new Error("unreachable");
            }
            this.undoneActions.push(action);
        }
    }

    redo(
        selection: Neuron | SpikeSource | SpikeSink | null,
        clearSelection: () => void,
    ) {
        const action = this.undoneActions.pop();
        if (action != null) {
            switch (action[0]) {
                case "addNeuron":
                    this.addNeuronObject(action[1], false);
                    break;
                case "removeNeuron":
                    if (selection === action[1]) {
                        clearSelection();
                    }
                    this.removeNeuron(action[1], false);
                    break;
                case "addSynapse":
                    this.addSynapseObject(action[1], false);
                    break;
                case "removeSynapse":
                    this.removeSynapse(action[1], false, true);
                    break;
                case "addSpikeSource":
                    this.addSpikeSourceObject(action[1], false);
                    break;
                case "removeSpikeSource":
                    if (selection === action[1]) {
                        clearSelection();
                    }
                    this.removeSpikeSource(action[1], false);
                    break;
                case "addSpikeSink":
                    this.addSpikeSinkObject(action[1], false);
                    break;
                case "removeSpikeSink":
                    if (selection === action[1]) {
                        clearSelection();
                    }
                    this.removeSpikeSink(action[1], false);
                    break;
                case "addSpikeSourceChannel":
                    action[1].parent.addChannelObject(
                        action[1],
                        false,
                        true,
                        action[1].parent.channels.length,
                    );
                    break;
                case "removeSpikeSourceChannel":
                    action[1].parent.removeChannelObject(
                        action[1],
                        false,
                        true,
                    );
                    break;
                case "addSpikeSinkChannel":
                    action[1].parent.addChannelObject(
                        action[1],
                        false,
                        true,
                        action[1].parent.channels.length,
                    );
                    break;
                case "removeSpikeSinkChannel":
                    action[1].parent.removeChannelObject(
                        action[1],
                        false,
                        true,
                    );
                    break;
                default:
                    throw new Error("unreachable");
            }
            this.actions.push(action);
        }
    }

    dispatch(type: SubscriptionType) {
        for (const [subscriptionType, subscription] of Object.values(
            this.subscriberIdToSubscription,
        )) {
            if ((type & subscriptionType) > 0) {
                subscription(this);
            }
        }
    }

    parametersChanged() {
        this.dispatch(SubscriptionType.Parameters);
    }

    simulatorData(): {
        neurons: [number, number, number, boolean][];
        spikeSources: [number, number[], [number, number][], number | null][];
        spikeSinks: [number, number[]][];
        synapses: [number, number, number, number, number, number][];
    } {
        return {
            neurons: this.neurons.map(neuron => [
                neuron.display.id,
                neuron.tau,
                neuron.threshold,
                neuron.subtractOnReset,
            ]),
            spikeSources: this.spikeSources.map(spikeSource => [
                spikeSource.display.id,
                spikeSource.channels.map(channel => channel.display.id),
                spikeSource.spikesTimeAndChannel,
                spikeSource.period[0] ? spikeSource.period[1] : null,
            ]),
            spikeSinks: this.spikeSinks.map(spikeSink => [
                spikeSink.display.id,
                spikeSink.channels.map(channel => channel.display.id),
            ]),
            synapses: this.synapses.map(synapse => [
                synapse.display.id,
                synapse.pre.display.id,
                synapse.post.display.id,
                synapse.delay,
                synapse.weight,
                synapse.tau,
            ]),
        };
    }

    simulatorUpdate(data: SimulatorUpdate) {
        const sound = data.tick !== this.soundTick;
        this.soundTick = data.tick;
        const view = new Float64Array(data.buffer);
        if (this.neurons.length > 0) {
            let localIndex = 0;
            let neuron = this.neurons[localIndex];
            let display = neuron.display;
            for (let index = 0; index < data.neuronCount; ++index) {
                const id = view.at(index * 3) as number;
                if (display.id === id) {
                    const potential = view.at(index * 3 + 1) as number;
                    display.translation =
                        (1.0 - potential) * (NEURON_RADIUS * 2);
                    display.opacity = potential;
                    const timeSinceLastSpike = view.at(index * 3 + 2) as number;
                    if (sound && timeSinceLastSpike === 0) {
                        synth.trigger(
                            neuron.instrument,
                            neuron.notes,
                            neuron.chordDuration,
                        );
                    }
                    const [glowRadius, glowOpacity] =
                        timeSinceLastSpikeToGlow(timeSinceLastSpike);
                    display.glowRadius = glowRadius;
                    display.glowOpacity = glowOpacity;
                    ++localIndex;
                    if (localIndex >= this.neurons.length) {
                        break;
                    }
                    neuron = this.neurons[localIndex];
                    display = neuron.display;
                }
            }
        }
        if (this.spikeSources.length > 0) {
            let localSpikeSourceIndex = 0;
            let localSpikeSource = this.spikeSources[localSpikeSourceIndex];
            let offset = data.neuronCount * 3;
            while (offset < view.length) {
                const spikeSourceId = view.at(offset) as number;
                const channelCount = view.at(offset + 1) as number;
                if (spikeSourceId === localSpikeSource.display.id) {
                    let fallback = true;
                    if (localSpikeSource.channels.length === channelCount) {
                        fallback = false;
                        for (
                            let channelIndex = 0;
                            channelIndex < channelCount;
                            ++channelIndex
                        ) {
                            const channelId = view.at(
                                offset + 2 + channelIndex * 2,
                            ) as number;
                            const channel =
                                localSpikeSource.channels[channelIndex];
                            const display = channel.display;
                            if (channelId === display.id) {
                                const timeSinceLastSpike = view.at(
                                    offset + 2 + channelIndex * 2 + 1,
                                ) as number;
                                if (sound && timeSinceLastSpike === 0) {
                                    synth.trigger(
                                        channel.instrument,
                                        channel.notes,
                                        channel.chordDuration,
                                    );
                                }
                                const [glowRadius, glowOpacity] =
                                    timeSinceLastSpikeToGlow(
                                        timeSinceLastSpike,
                                    );
                                display.glowRadius = glowRadius;
                                display.glowOpacity = glowOpacity;
                            } else {
                                fallback = true;
                                break;
                            }
                        }
                    }
                    if (fallback) {
                        const idToChannel = new Map(
                            localSpikeSource.channels.map(channel => [
                                channel.display.id,
                                channel,
                            ]),
                        );
                        for (
                            let channelIndex = 0;
                            channelIndex < channelCount;
                            ++channelIndex
                        ) {
                            const channelId = view.at(
                                offset + 2 + channelIndex * 2,
                            ) as number;
                            const channel = idToChannel.get(channelId);
                            if (channel != null) {
                                const display = channel.display;
                                const timeSinceLastSpike = view.at(
                                    offset + 2 + channelIndex * 2 + 1,
                                ) as number;
                                if (sound && timeSinceLastSpike === 0) {
                                    synth.trigger(
                                        channel.instrument,
                                        channel.notes,
                                        channel.chordDuration,
                                    );
                                }
                                const [glowRadius, glowOpacity] =
                                    timeSinceLastSpikeToGlow(
                                        timeSinceLastSpike,
                                    );
                                display.glowRadius = glowRadius;
                                display.glowOpacity = glowOpacity;
                            }
                        }
                    }
                    ++localSpikeSourceIndex;
                    if (localSpikeSourceIndex > this.spikeSources.length) {
                        break;
                    }
                    localSpikeSource = this.spikeSources[localSpikeSourceIndex];
                }
                offset += 2 + channelCount * 2;
            }
        }
        if (this.synapses.length > 0 && data.spikes.length > 0) {
            let localIndex = 0;
            let display = this.synapses[localIndex].display;
            let index = 0;
            let [id, spikes] = data.spikes[index];
            for (;;) {
                if (id === display.id) {
                    display.spikes = spikes;
                    ++localIndex;
                    ++index;
                    if (
                        localIndex >= this.synapses.length ||
                        index >= data.spikes.length
                    ) {
                        break;
                    }
                    display = this.synapses[localIndex].display;
                    [id, spikes] = data.spikes[index];
                } else if (id < display.id) {
                    ++index;
                    if (index >= data.spikes.length) {
                        break;
                    }
                    [id, spikes] = data.spikes[index];
                } else {
                    display.spikes.length = 0;
                    ++localIndex;
                    if (localIndex >= this.synapses.length) {
                        break;
                    }
                    display = this.synapses[localIndex].display;
                }
            }
            for (const synapse of this.synapses.slice(localIndex)) {
                synapse.display.spikes.length = 0;
            }
        } else if (data.spikes.length === 0) {
            for (const synapse of this.synapses) {
                synapse.display.spikes.length = 0;
            }
        }
        this.dispatch(SubscriptionType.State);
    }

    spikeDisplays(): SpikeDisplay[] {
        const displays: SpikeDisplay[] = [];
        for (const synapse of this.synapses) {
            for (const spike of synapse.display.spikes) {
                displays.push({
                    position: spike,
                    pre: synapse.pre.display,
                    post: synapse.post.display,
                    x: 0.0,
                    y: 0.0,
                });
            }
        }
        return displays;
    }

    reset() {
        this.soundTick = null;
    }
}
