<script lang="ts">
import Ajv from "ajv";

import fileFormat from "../fileFormat.json";
import type { SynapsePost, SynapsePre } from "./network.svelte.ts";
import { Network } from "./network.svelte.ts";

let {
    network,
    onChange,
}: {
    network: Network;
    onChange: (newNetwork: Network) => void;
} = $props();

const ajv = new Ajv();
const validate = ajv.compile(fileFormat);

function load(json: string): Network {
    const data = JSON.parse(json);
    if (!validate(data)) {
        throw validate.errors;
    }
    const newNetwork = new Network();
    const idToPre: Map<number, SynapsePre> = new Map();
    const idToPost: Map<number, SynapsePost> = new Map();
    for (const neuron of data.neurons as any[]) {
        newNetwork.addNeuron(
            neuron.x,
            neuron.y,
            neuron.lockPosition,
            neuron.tau,
            neuron.threshold,
            neuron.subtractOnReset,
            neuron.instrument,
            neuron.notes,
            neuron.chordDuration,
            false,
        );
        const neuronObject = newNetwork.neurons[newNetwork.neurons.length - 1];
        if (idToPre.has(neuron.id)) {
            throw new Error(`Duplicated id "${neuron.id}"`);
        }
        idToPre.set(neuron.id, neuronObject);
        idToPost.set(neuron.id, neuronObject);
    }
    for (const spikeSource of data.spikeSources as any[]) {
        newNetwork.addSpikeSource(
            spikeSource.x,
            spikeSource.y,
            spikeSource.style,
            [spikeSource.periodic, spikeSource.period],
            spikeSource.spikes,
            spikeSource.channels.map((channel: any) => [
                channel.instrument,
                channel.notes,
                channel.chordDuration,
            ]),
            false,
        );
        for (let index = 0; index < spikeSource.channels.length; ++index) {
            const channel: any = spikeSource.channels[index];
            const channelObject =
                newNetwork.spikeSources[newNetwork.spikeSources.length - 1]
                    .channels[index];
            if (idToPre.has(channel.id)) {
                throw new Error(`Duplicated id "${channel.id}"`);
            }
            idToPre.set(channel.id, channelObject);
        }
    }
    for (const spikeSink of data.spikeSinks as any[]) {
        newNetwork.addSpikeSink(
            spikeSink.x,
            spikeSink.y,
            spikeSink.style,
            spikeSink.channels.length,
            false,
        );
        for (let index = 0; index < spikeSink.channels.length; ++index) {
            const channel: any = spikeSink.channels[index];
            const channelObject =
                newNetwork.spikeSinks[newNetwork.spikeSinks.length - 1]
                    .channels[index];
            if (idToPost.has(channel.id)) {
                throw new Error(`Duplicated id "${channel.id}"`);
            }
            idToPost.set(channel.id, channelObject);
        }
    }
    for (const synapse of data.synapses as any[]) {
        const pre = idToPre.get(synapse.pre);
        if (pre == null) {
            throw new Error(
                `No neuron or spike source channel found for the synapse pre "${synapse.pre}"`,
            );
        }
        const post = idToPost.get(synapse.post);
        if (post == null) {
            throw new Error(
                `No neuron or spike source channel found for the synapse pre "${synapse.pre}"`,
            );
        }
        newNetwork.addSynapse(
            pre,
            post,
            synapse.delay,
            synapse.weight,
            synapse.tau,
            false,
        );
    }
    return newNetwork;
}
</script>

<div class="filesystem">
    <button class="delete-selection" aria-label="Load" onclick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.addEventListener("change", async () => {
            await new Promise<void>(resolve => {
                if (input.files != null && input.files.length > 0) {
                    const reader = new FileReader();
                    reader.addEventListener("load", () => {
                        try {
                            onChange(load(reader.result as string));
                        } catch (error) {
                            console.error(error);
                        }
                    });
                    reader.addEventListener("error", error => {
                        console.error(error);
                    });
                    reader.addEventListener("loadend", () => {
                        resolve();
                    })
                    reader.readAsText(input.files[0]);
                } else {
                    resolve();
                }
            })
            document.body.removeChild(input);
        });
        input.style.position = "absolute";
        input.style.top = "0";
        input.style.left = "0";
        input.style.visibility = "hidden";
        document.body.appendChild(input);
        input.click();
    }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4.52807537,18.6678447 L2.0917299,11.7904955 L2.0917299,11.7904955 C1.70844371,10.4702869 2.56501383,9.32869049 3.93958211,9.32869049 L4.23769836,9.32869049 L4.23769836,6.36640158 C4.23769836,5.05941472 5.29718324,4 6.60431901,4 L11.3411545,4 C11.8809278,4 12.4743473,4.34309839 12.7414746,4.81057079 L13.3402036,5.85834676 C13.3959571,5.95591538 13.5967315,6.07226852 13.7083338,6.07226852 L19.6297091,6.07226852 C20.9379212,6.07226852 22,7.13318031 22,8.4391716 L22,18 C22,19.1045695 21.1045695,20 20,20 L6.41327654,20 C5.56616915,20 4.81094346,19.4663286 4.52807537,18.6678447 Z M5.4218518,9.32869049 L16.9694258,9.32869049 C18.2128757,9.32869049 19.4602262,10.2656389 19.8070754,11.4603416 L20.8158466,14.9349975 L20.8158466,8.4391716 C20.8158466,7.7874618 20.2842226,7.25642197 19.6297091,7.25642197 L13.7083338,7.25642197 C13.1720603,7.25642197 12.5787888,6.91260805 12.3120703,6.44585117 L11.7133413,5.3980752 C11.6574064,5.30018923 11.4567119,5.18415344 11.3411545,5.18415344 L6.60431901,5.18415344 C5.95115566,5.18415344 5.4218518,5.71342207 5.4218518,6.36640158 L5.4218518,9.32869049 Z" transform="matrix(-1 0 0 1 24 0)"/></svg>
        <span class="label">
            Load network
        </span>
    </button>
    <button class="delete-selection" aria-label="Save" onclick={() => {
        const data = {
            version: "1.0",
            neurons: network.neurons.map(neuron => ({
                id: neuron.display.id,
                name: neuron.name,
                tau: neuron.tau,
                threshold: neuron.threshold,
                subtractOnReset: neuron.subtractOnReset,
                instrument: neuron.instrument,
                notes: neuron.noteInputContent,
                chordDuration: neuron.chordDuration,
                x: neuron.display.x,
                y: neuron.display.y,
                lockPosition: neuron.lockPosition,
            })),
            spikeSources: network.spikeSources.map(spikeSource => ({
                name: spikeSource.name,
                style: spikeSource.style,
                spikes: spikeSource.spikeInputContent.endsWith("\n")
                    ? spikeSource.spikeInputContent.slice(0, -1)
                    : spikeSource.spikeInputContent,
                periodic: spikeSource.period[0],
                period: spikeSource.period[1],
                channels: spikeSource.channels.map(channel => ({
                    id: channel.display.id,
                    instrument: channel.instrument,
                    notes: channel.noteInputContent,
                    chordDuration: channel.chordDuration,
                })),
                x: spikeSource.display.x + spikeSource.display.width / 2,
                y: spikeSource.display.y + spikeSource.display.height / 2,
            })),
            spikeSinks: network.spikeSinks.map(spikeSink => ({
                name: spikeSink.name,
                style: spikeSink.style,
                channels: spikeSink.channels.map(channel => ({
                    id: channel.display.id,
                })),
                x: spikeSink.display.x + spikeSink.display.width / 2,
                y: spikeSink.display.y + spikeSink.display.height / 2,
            })),
            synapses: network.synapses.map(synapse => ({
                pre: synapse.pre.display.id,
                post: synapse.post.display.id,
                delay: synapse.delay,
                weight: synapse.weight,
                tau: synapse.tau,
            })),
        };
        const a = document.createElement("a");
        a.href =  URL.createObjectURL(new Blob([JSON.stringify(data, null, 4)], {type: "application/json"}));
        a.download = "metron.json";
        a.style.position = "absolute";
        a.style.top = "0";
        a.style.left = "0";
        a.style.visibility = "hidden";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M15.7573593,3 C16.5530088,3 17.3160705,3.31607052 17.8786797,3.87867966 L20.1213203,6.12132034 C20.6839295,6.68392948 21,7.44699122 21,8.24264069 L21,18 C21,19.6568542 19.6568542,21 18,21 L6,21 C4.34314575,21 3,19.6568542 3,18 L3,6 C3,4.34314575 4.34314575,3 6,3 L15.7573593,3 Z M16,13 L8,13 C7.44771525,13 7,13.4477153 7,14 L7,19 L8,19 L8,17 C8,16.4477153 8.44771525,16 9,16 L15,16 C15.5522847,16 16,16.4477153 16,17 L16,19 L17,19 L17,14 C17,13.4477153 16.5522847,13 16,13 Z M15,5 L7,5 L7,8 C7,8.55228475 7.44771525,9 8,9 L14,9 C14.5522847,9 15,8.55228475 15,8 L15,5 Z"/></svg>
        <span class="label">
            Save network
        </span>
    </button>
</div>

<style>
    .filesystem {
        padding: 10px;
        display: flex;
        gap: 10px;
        justify-content: space-evenly;
        border-bottom: 1px solid var(--base0);
    }

    button {
        display: flex;
        align-items: center;
        border: 1px solid var(--base0);
        color: var(--base03);
        text-align: left;
        cursor: pointer;
        padding: 5px;
        border-radius: 4px;
        font-size: 14px;
        background-color: var(--base3);
        gap: 5px;
    }

    button:hover, button:active {
        background-color: var(--base2);
    }

    button svg path {
        fill: var(--base01);
    }

    button:hover svg path, button:active svg path {
        fill: var(--base03);
    }
</style>
