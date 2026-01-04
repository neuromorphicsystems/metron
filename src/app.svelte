<script lang="ts">
import { onMount } from "svelte";

import Detail from "./detail.svelte";
import Graph from "./graph.svelte";
import type { Neuron, SpikeSink, SpikeSource } from "./network.svelte.ts";
import { Network, SubscriptionType } from "./network.svelte.ts";
import Playbar from "./playbar.svelte";
import type { FromSimulator, ToSimulator } from "./simulator";
// @ts-expect-error
import Simulator from "./simulator.worker.js";
import type { Tool } from "./tool";
import Toolbar from "./toolbar.svelte";

let tool: Tool = $state("select");
let network: Network = $state.raw(new Network());
let selection: Neuron | SpikeSource | SpikeSink | null = $state.raw(null);
let playing: boolean = $state(false);
let tickRate: number = $state(60);
let tick: number = $state(0);

const simulator = new Simulator();
simulator.onmessage = (event: MessageEvent<FromSimulator>) => {
    switch (event.data.type) {
        case "reset-acknowledge":
            network.reset();
            break;
        case "simulator-update":
            playing = event.data.playing;
            tick = event.data.tick;
            tickRate = event.data.tickRate;
            network.simulatorUpdate(event.data);
            simulator.postMessage(
                {
                    type: "buffer",
                    buffer: event.data.buffer,
                },
                [event.data.buffer],
            );
            break;
        default:
            throw new Error("unreachable");
    }
};
function simulatorPost(message: ToSimulator) {
    simulator.postMessage(message);
}
onMount(() => {
    return network.subscribe(
        SubscriptionType.Topology | SubscriptionType.Parameters,
        network => {
            simulatorPost({
                type: "network",
                data: network.simulatorData(),
            });
        },
    );
});

/*
onMount(() => {
    network.addNeuron(0.0, 0.0, 60.0, 1.0, false, "piano", "A3", 15.0, true);
    for (let index = 0; index < 20; ++index) {
        network.addNeuron(
            index * 20,
            0.0,
            60.0,
            1.0,
            false,
            "piano",
            "A3",
            15.0,
            true,
        );
        network.addSynapse(
            network.neurons[0],
            network.neurons[network.neurons.length - 1],
            60,
            0.5,
            0.0,
            true,
        );
    }
});
*/
</script>

<svelte:window onkeydown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
            network.redo(selection, () => {
                selection = null;
            });
        } else {
            network.undo(selection, () => {
                selection = null;
            });
        }
    }
}}></svelte:window>

<main>
    <Detail bind:selection></Detail>
    <div class="graph-wrapper">
        <Toolbar bind:tool></Toolbar>
        <Graph {tool} {network} bind:selection></Graph>
        <Playbar
            {playing}
            tickRate={tickRate}
            tick={tick}
            onplay={() => {
                simulatorPost({
                    type: "play",
                });
            }}
            onpause={() => {
                simulatorPost({
                    type: "pause",
                });
            }}
            onnext={() => {
                simulatorPost({
                    type: "next",
                });
            }}
            onreset={() => {
                simulatorPost({
                    type: "reset",
                });
            }}
            ontickratechange={tickRate => {
                simulatorPost({
                    type: "tickRate",
                    value: tickRate,
                });
            }}
        ></Playbar>
    </div>
</main>

<style>
    :root {
        --base03: #002b36;
        --base02: #073642;
        --base01: #586e75;
        --base00: #657b83;
        --base0: #839496;
        --base1: #93a1a1;
        --base2: #eee8d5;
        --base3: #fdf6e3;
        --yellow: #b58900;
        --orange: #CB4B16;
        --red: #dc322f;
        --magenta: #d33682;
        --violet: #6c71c4;
        --blue: #268bd2;
        --cyan: #2aa198;
        --green: #859900;
    }

    main {
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        align-items: stretch;
    }

    .graph-wrapper {
        flex-shrink: 1;
        flex-grow: 1;
        overflow: hidden;
    }
</style>
