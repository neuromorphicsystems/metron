<script lang="ts">
import type {
    Neuron,
    SpikeSink,
    SpikeSinkChannel,
    SpikeSource,
    SpikeSourceChannel,
    Synapse,
} from "./network.svelte.ts";
import { SubscriptionType } from "./network.svelte.ts";
import NumberInput from "./numberInput.svelte";

let {
    synapses,
    end,
    selection = $bindable(),
    tooltip,
}: {
    synapses: Synapse[];
    end: "pre" | "post";
    selection: Neuron | SpikeSource | SpikeSink | null;
    tooltip?: [(element: HTMLElement, message: string) => void, () => void];
} = $props();

function target(
    synapse: Synapse,
): Neuron | SpikeSourceChannel | SpikeSinkChannel {
    return end === "pre" ? synapse.pre : synapse.post;
}
</script>

<div class="synapses">
    {#each synapses as synapse, index}
        {@const synapseTarget = target(synapse)}
        <div class="synapse">
            <div class="target">
                    <div class="left">
                    {#if end === "pre"}
                        <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                            <path fill-rule="evenodd" d="M17,7 C19.7614237,7 22,9.23857625 22,12 C22,14.7614237 19.7614237,17 17,17 C14.2385763,17 12,14.7614237 12,12 C12,9.23857625 14.2385763,7 17,7 Z M7,9 L12,12 L7,15 L7,13 L2,13 L2,11 L7,11 L7,9 Z"/>
                        </svg>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                            <path fill-rule="evenodd" d="M7,7 C9.4188915,7 11.4366008,8.71766536 11.8999437,10.999812 L17,11 L17,9 L22,12 L17,15 L17,13 L11.8997409,13.0011864 C11.4360122,15.2828356 9.41853874,17 7,17 C4.23857625,17 2,14.7614237 2,12 C2,9.23857625 4.23857625,7 7,7 Z"/>
                        </svg>
                    {/if}
                    <div class="text">
                        {#if end === "pre"}
                            <div class="prefix">From</div>
                        {:else}
                            <div class="prefix">To</div>
                        {/if}
                        <button class="name" aria-label={index.toString()} onclick={() => {
                            switch (synapseTarget.type) {
                                case "neuron":
                                    selection = synapseTarget;
                                    break;
                                case "source":
                                case "sink":
                                    selection = synapseTarget.parent;
                                    break;
                                default:
                                    throw new Error("unreachable");
                            }
                        }}>{end === "pre" ? synapse.preName() : synapse.postName()}</button>
                        {#if synapseTarget.type !== "neuron"}
                            <div class="suffix">(channel {synapseTarget.name})</div>
                        {/if}
                    </div>
                </div>
                <div class="right">
                    <button class="delete" aria-label="Delete" onclick={() => {
                        synapse.network().removeSynapse(synapse, true, true);
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19,9 L19,19 C19,20.6568542 17.6568542,22 16,22 L8,22 C6.34314575,22 5,20.6568542 5,19 L5,9 L19,9 Z M14.8284271,10.7573593 L12,13.5857864 L9.17157288,10.7573593 L7.75735931,12.1715729 L10.5857864,15 L7.75735931,17.8284271 L9.17157288,19.2426407 L12,16.4142136 L14.8284271,19.2426407 L16.2426407,17.8284271 L13.4149207,14.9992929 L16.2426407,12.1715729 L14.8284271,10.7573593 Z M20,6 C20.5522847,6 21,6.44771525 21,7 C21,7.55228475 20.5522847,8 20,8 L4,8 C3.44771525,8 3,7.55228475 3,7 C3,6.44771525 3.44771525,6 4,6 L20,6 Z M14,2.0005414 C15.6568542,2.0005414 17,3.34368715 17,5.0005414 L17,6 L15,6.0002707 L15,5.0002707 C15,4.44798595 14.5522847,4.0002707 14,4.0002707 L10,4.0002707 C9.44771525,4.0002707 9,4.44798595 9,5.0002707 L9,6.0002707 L7,6 L7,5.0005414 C7,3.34368715 8.34314575,2.0005414 10,2.0005414 L14,2.0005414 Z"/></svg>
                    </button>
                </div>
            </div>
            <div class="fields">
                <NumberInput title="<mi>&#x3B4;</mi>" mathTitle={true} help="<strong>Synaptic delay in ticks</strong>&mdash;<em>non-zero positive integer</em><br>The minimum delay (1) indicates that spikes are received one tick after being generated" integer={true} minimum={1} bind:value={synapse.delay} {tooltip} onchange={() => {
                    synapse.network().dispatch(SubscriptionType.Parameters);
                }}></NumberInput>
                <NumberInput title="<mi>w</mi>" mathTitle={true} help="<strong>Synaptic weight</strong>&mdash;<em>signed float</em><br>Negative values represent inhibitory connections whereas positive values represent excitatory ones" integer={false} minimum={null} bind:value={synapse.weight} {tooltip} onchange={() => {
                    synapse.network().dispatch(SubscriptionType.Parameters);
                }}></NumberInput>
                <NumberInput title="<msub><mi>&#x3C4;</mi><mi>s</mi></msub>" mathTitle={true} help="<strong>Synaptic current decay in ticks</strong>&mdash;<em>positive float or zero</em><br>A zero decay creates a first-order LIF neuron, a positive decay creates a second-order LIF neuron" integer={false} minimum={0} bind:value={synapse.tau} {tooltip} onchange={() => {
                    synapse.network().dispatch(SubscriptionType.Parameters);
                }}></NumberInput>
            </div>
        </div>
    {/each}
</div>

<style>
    .synapse {
        margin-top: 5px;
        border-top: 1px solid var(--base2);
        padding-top: 5px;
    }

    .target {
        display: flex;
        align-items: center;
        gap: 5px;
        justify-content: space-between;
    }

    .left {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .target svg path {
        fill: var(--base01);
    }

    .target .text {
        display: flex;
        align-items: baseline;
        gap: 5px;
    }

    .target .text .prefix {
        color: var(--base03);
    }

    .target .text button.name {
        font-size: 14px;
        background: transparent;
        border: none;
        color: var(--base03);
        text-align: left;
        cursor: pointer;
        padding: 0;
        outline: none;
        text-decoration: underline;
    }

    .target .text button.name:hover, .target .text button.name:active {
        color: var(--base01);
    }

    .target .text .suffix {
        color: var(--base03);
    }

    .fields {
        padding-top: 5px;
        display: flex;
        gap: 10px;
    }

    .right {
        height: 24px;
    }

    button.delete {
        height: 24px;
        background: transparent;
        border: none;
        color: var(--base01);
        text-align: left;
        cursor: pointer;
        padding: 0;
    }

    button.delete svg path {
        fill: var(--base01);
    }

    button.delete:hover svg path {
        fill: var(--base03);
    }
</style>
