<script lang="ts">
import BooleanInput from "./booleanInput.svelte";
import ColorInput from "./colorInput.svelte";
import { nextColor } from "./colormap.ts";
import Dropdown from "./dropdown.svelte";
import type {
    ContainerStyle,
    Neuron,
    SpikeSink,
    SpikeSinkChannel,
    SpikeSource,
    SpikeSourceChannel,
} from "./network.svelte.ts";
import { SubscriptionType } from "./network.svelte.ts";
import NoteInput from "./noteInput.svelte";
import NumberInput from "./numberInput.svelte";
import SpikeInput from "./spikeInput.svelte";
import SynapseList from "./synapseList.svelte";
import { synth } from "./synth.svelte";

let {
    selection = $bindable(),
}: {
    selection: Neuron | SpikeSource | SpikeSink | null;
} = $props();

let tooltipElement: HTMLDivElement | null = null;

function typeToName(type: "neuron" | "source" | "sink"): string {
    switch (type) {
        case "neuron":
            return "Neuron";
        case "source":
            return "Spike source";
        case "sink":
            return "Spike sink";
        default:
            throw new Error("unreachable");
    }
}

function showTooltip(element: HTMLElement, message: string) {
    if (tooltipElement != null) {
        const boundingClientRect = element.getBoundingClientRect();
        tooltipElement.style.left = `${boundingClientRect.x}px`;
        tooltipElement.style.top = `${boundingClientRect.y + 20}px`;
        tooltipElement.innerHTML = message;
        tooltipElement.classList.add("show");
    }
}

function hideTooltip() {
    if (tooltipElement != null) {
        tooltipElement.classList.remove("show");
    }
}

const tooltip: [(element: HTMLElement, message: string) => void, () => void] = [
    showTooltip,
    hideTooltip,
];
</script>

<div class="detail" onscroll={() => {
    hideTooltip();
}}>
    {#if selection == null}
        <div class="placeholder">Select a neuron, spike source, or spike sink to display and configure its properties.</div>
    {:else}
        <div class="name-container">
            <div class="type">{typeToName(selection.type)}</div>
            <input
                type="text"
                bind:value={selection.name}
                class="name-input"
            />
        </div>

        <div class="categories">
            {#if selection.type === "neuron"}
                <div class="category">
                    <div class="fields">
                        <NumberInput title="<msub><mi>&#x3C4;</mi><mi>m</mi></msub>" mathTitle={true} help="<strong>Membrane potential decay in ticks</strong>&mdash;<em>positive float or zero</em><br>A zero decay creates a neuron whose potential decays instantly" integer={false} minimum={0} bind:value={selection.tau} {tooltip} onchange={() => {
                            (selection as Neuron).parent.dispatch(SubscriptionType.Parameters);
                        }}></NumberInput>
                        <NumberInput title="<mi>&#x3D1;</mi>" mathTitle={true} help="<strong>Membrane potential threshold</strong>&mdash;<em>positive float or zero</em><br>A zero threshold creates a neuron that spikes at every tick" integer={false} minimum={0} bind:value={selection.threshold} {tooltip} onchange={() => {
                            (selection as Neuron).parent.dispatch(SubscriptionType.Parameters);
                        }}></NumberInput>
                        <BooleanInput title="Subtract" mathTitle={false} help="<strong>Reset mechanism</strong><br>If unticked, reset the potential to zero when this neuron emits a spike</br>If ticked, subtract the threshold from the potential when this neuron emits a spike" bind:value={selection.subtractOnReset} {tooltip} onchange={() => {
                            (selection as Neuron).parent.dispatch(SubscriptionType.Parameters);
                        }}></BooleanInput>
                    </div>
                </div>
                <div class="category">
                    <div class="fields with-space">
                        <div class="title" onmouseenter={event => {
                            showTooltip(event.target as HTMLElement, "<strong>Instrument played by the neuron</strong><br>Sounds are not enabled by default (tick the checkbox in the bottom control bar to activate them)");
                        }} onmouseleave={() => {
                            hideTooltip();
                        }} role={null}>Instrument</div>
                        <Dropdown width={200} options={synth.dropdownOptions()} bind:value={selection.instrument}></Dropdown>
                    </div>
                    <div class="fields with-space">
                        <NumberInput title="Chord" mathTitle={false} help="<strong>Chord duration in seconds and notes</strong>&mdash;<em>positive float or zero, note1 note2...</em><br>The chord duration of sampled instruments (anything but Synth) is limited by the samples' duration<br>The note(s) use the scientific pitch notation and are played when the neuron spikes" integer={false} minimum={0} bind:value={selection.chordDuration} {tooltip}></NumberInput>
                        <NoteInput bind:content={selection.noteInputContent} onchange={notes => {
                            (selection as Neuron).notes = notes;
                        }}></NoteInput>
                    </div>
                    <div class="fields" class:with-space={!selection.updateColorWithSpikes}>
                        <BooleanInput title="Update color with spikes" mathTitle={false} help="<strong>Reset mechanism</strong><br>If unticked, the neuron uses the color provided by the user</br>If ticked, the neuron's color is calculated from incoming spikes" bind:value={selection.updateColorWithSpikes} {tooltip} onchange={() => {
                            (selection as Neuron).parent.dispatch(SubscriptionType.Parameters);
                        }}></BooleanInput>
                    </div>
                    {#if !selection.updateColorWithSpikes}
                        <ColorInput
                            title="Color"
                            help="<strong>Neuron spike color</strong>"
                            bind:value={selection.color}
                            {tooltip}
                            onchange={() => {
                                (selection as Neuron).parent.dispatch(SubscriptionType.Parameters);
                            }}
                        ></ColorInput>
                    {/if}
                </div>
                <div class="category">
                    <div class="fields" class:with-space={selection.lockPosition}>
                        <BooleanInput
                            title="Lock position"
                            mathTitle={false}
                            help="<strong>Manually position the neuron</strong><br>If ticked, the neuron's position is not updated by graph forces (but it can still be moved manually)"
                            bind:value={selection.lockPosition}
                            {tooltip}
                            onchange={() => {
                                const neuron = (selection as Neuron);
                                if (neuron.lockPosition) {
                                    neuron.display.fx = neuron.display.x;
                                    neuron.display.fy = neuron.display.y;
                                } else {
                                    neuron.display.fx = null;
                                    neuron.display.fy = null;
                                }
                                neuron.parent.dispatch(SubscriptionType.Display);
                            }}
                        ></BooleanInput>
                    </div>
                    {#if selection.lockPosition}
                        <div class="fields">
                            <NumberInput
                                title="<mi>x</mi>"
                                mathTitle={true}
                                help={`<strong>Horizontal coordinate of the spike ${selection.type} display</strong>&mdash;<em>signed float</em>`}
                                integer={false}
                                minimum={null}
                                value={selection.display.fx == null ? 0.0 : Math.round(selection.display.fx * 100) / 100}
                                {tooltip}
                                onchange={x => {
                                    const neuron = (selection as Neuron);
                                    neuron.display.x = x;
                                    neuron.display.fx = x;
                                    neuron.parent.dispatch(SubscriptionType.Display);
                                }}>
                            </NumberInput>
                            <NumberInput
                                title="<mi>y</mi>"
                                mathTitle={true}
                                help={`<strong>Vertical coordinate of the spike ${selection.type} display</strong>&mdash;<em>signed float</em>`}
                                integer={false}
                                minimum={null}
                                value={selection.display.fy == null ? 0.0 : Math.round(selection.display.fy * 100) / 100}
                                {tooltip}
                                onchange={y => {
                                    const neuron = (selection as Neuron);
                                    neuron.display.y = y;
                                    neuron.display.fy = y;
                                    neuron.parent.dispatch(SubscriptionType.Display);
                                }}>
                            </NumberInput>
                        </div>
                    {/if}
                </div>
                <button class="delete-selection" aria-label="Delete" onclick={() => {
                    const neuron = selection as Neuron;
                    neuron.parent.removeNeuron(neuron, true);
                    selection = null;
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19,9 L19,19 C19,20.6568542 17.6568542,22 16,22 L8,22 C6.34314575,22 5,20.6568542 5,19 L5,9 L19,9 Z M14.8284271,10.7573593 L12,13.5857864 L9.17157288,10.7573593 L7.75735931,12.1715729 L10.5857864,15 L7.75735931,17.8284271 L9.17157288,19.2426407 L12,16.4142136 L14.8284271,19.2426407 L16.2426407,17.8284271 L13.4149207,14.9992929 L16.2426407,12.1715729 L14.8284271,10.7573593 Z M20,6 C20.5522847,6 21,6.44771525 21,7 C21,7.55228475 20.5522847,8 20,8 L4,8 C3.44771525,8 3,7.55228475 3,7 C3,6.44771525 3.44771525,6 4,6 L20,6 Z M14,2.0005414 C15.6568542,2.0005414 17,3.34368715 17,5.0005414 L17,6 L15,6.0002707 L15,5.0002707 C15,4.44798595 14.5522847,4.0002707 14,4.0002707 L10,4.0002707 C9.44771525,4.0002707 9,4.44798595 9,5.0002707 L9,6.0002707 L7,6 L7,5.0005414 C7,3.34368715 8.34314575,2.0005414 10,2.0005414 L14,2.0005414 Z"/></svg>
                    <span class="label">
                        Delete neuron
                    </span>
                </button>
                <div class="category">
                    <div class="title">Pre-synapses</div>
                    <SynapseList synapses={selection.preSynapses} end="pre" bind:selection {tooltip}></SynapseList>
                </div>
                <div class="category">
                    <div class="title">Post-synapses</div>
                    <SynapseList synapses={selection.postSynapses} end="post" bind:selection {tooltip}></SynapseList>
                </div>
            {:else if selection.type === "source" || selection.type === "sink"}
                <div class="category">
                    <div class="fields">
                        <NumberInput title="Channels" mathTitle={false} help="<strong>Number of channels</strong>&mdash;<em>positive integer or zero</em><br>A channel may have multiple synapses" integer={true} minimum={0} value={selection.channels.length} onchange={value => {
                            const spikeSource = selection as SpikeSource;
                            if (value > spikeSource.channels.length) {
                                let instrument = "synth";
                                let chordDuration = 5.0;
                                if (spikeSource.channels.length > 0) {
                                    instrument = spikeSource.channels[spikeSource.channels.length - 1].instrument;
                                    chordDuration = spikeSource.channels[spikeSource.channels.length - 1].chordDuration;
                                }
                                spikeSource.addChannels(
                                    new Array(value - spikeSource.channels.length)
                                        .fill(null)
                                        .map(() => [instrument, synth.nextNote(), chordDuration, nextColor()]),
                                    true,
                                );
                            } else if (value < spikeSource.channels.length) {
                                spikeSource.removeChannels(spikeSource.channels.length - value, true);
                            }
                        }} {tooltip}></NumberInput>
                        <Dropdown width={120} options={[
                            ["Vertical", "vertical"],
                            ["Horizontal", "horizontal"],
                            ["V rectangle", "vertical-rectangle"],
                            ["H rectangle", "horizontal-rectangle"]
                        ]} value={selection.style} onchange={value => {
                            (selection as SpikeSource).setStyle(value as ContainerStyle);
                        }}></Dropdown>
                    </div>
                </div>
                {#if selection.type === "source"}
                    <div class="category">
                        <div class="title" onmouseenter={event => {
                            showTooltip(event.target as HTMLElement, "<strong>Channels and times of generated spikes</strong>&mdash;<em>channel1:time1 channel2:time2... </em><br>The spike / channel pairs can be in any order but they must be unique");
                        }} onmouseleave={() => {
                            hideTooltip();
                        }} role={null}>Spikes</div>
                        <SpikeInput channels={selection.channels.length} bind:content={selection.spikeInputContent} onchange={spikesTimeAndChannel => {
                            const spikeSource = selection as SpikeSource;
                            if (
                                spikeSource.spikesTimeAndChannel.length !== spikesTimeAndChannel.length
                                || spikeSource.spikesTimeAndChannel.some(
                                    (timeAndChannel, index) => (
                                        timeAndChannel[0] !== spikesTimeAndChannel[index][0]
                                        || timeAndChannel[1] !== spikesTimeAndChannel[index][1]
                                    )
                                )
                            ) {
                                spikeSource.spikesTimeAndChannel = spikesTimeAndChannel;
                                const period = spikeSource.period;
                                let minimum;
                                if (spikeSource.period[0]) {
                                    if (spikesTimeAndChannel.length > 0) {
                                        minimum = spikesTimeAndChannel[spikesTimeAndChannel.length - 1][0] + 1;
                                    } else {
                                        minimum = 1;
                                    }
                                } else {
                                    minimum = 0;
                                }
                                spikeSource.period = [period[0], Math.max(minimum, period[1])];
                                spikeSource.parent.dispatch(SubscriptionType.Parameters);
                            }
                        }}></SpikeInput>
                        <div class="fields spike-input-fields">
                            <BooleanInput title="Periodic" mathTitle={false} help="<strong>Periodic input</strong><br>If ticked, generate the input spikes again after <em>period</em> ticks" value={selection.period[0]} {tooltip} onchange={value => {
                                const spikeSource = selection as SpikeSource;
                                let minimum;
                                if (value) {
                                    const spikesTimeAndChannel = spikeSource.spikesTimeAndChannel;
                                    if (spikesTimeAndChannel.length > 0) {
                                        minimum = spikesTimeAndChannel[spikesTimeAndChannel.length - 1][0] + 1;
                                    } else {
                                        minimum = 1;
                                    }
                                } else {
                                    minimum = 0;
                                }
                                spikeSource.period = [value, Math.max(minimum, spikeSource.period[1])];
                                spikeSource.parent.dispatch(SubscriptionType.Parameters);
                            }}></BooleanInput>
                            <NumberInput title="Period" mathTitle={false} help="<strong>Input repeat period in ticks</strong>&mdash;<em>positive integer</em><br>Must be strictly larger than the last spike's time" integer={true} minimum={0} value={selection.period[1]} {tooltip} onchange={value => {
                                const spikeSource = selection as SpikeSource;
                                let minimum;
                                if (spikeSource.period[0]) {
                                    const spikesTimeAndChannel = spikeSource.spikesTimeAndChannel;
                                    if (spikesTimeAndChannel.length > 0) {
                                        minimum = spikesTimeAndChannel[spikesTimeAndChannel.length - 1][0] + 1;
                                    } else {
                                        minimum = 1;
                                    }
                                } else {
                                    minimum = 0;
                                }
                                spikeSource.period = [spikeSource.period[0], Math.max(minimum, value)];
                                spikeSource.parent.dispatch(SubscriptionType.Parameters);
                            }}></NumberInput>
                        </div>
                    </div>
                {/if}
                <div class="category">
                    <div class="fields">
                        <NumberInput
                            title="<mi>x</mi>"
                            mathTitle={true}
                            help={`<strong>Horizontal coordinate of the spike ${selection.type} display</strong>&mdash;<em>signed float</em>`}
                            integer={false}
                            minimum={null}
                            value={Math.round((selection.display.x + selection.display.width / 2) * 100) / 100}
                            {tooltip}
                            onchange={x => {
                                const sourceOrSink = selection as SpikeSource | SpikeSink;
                                const dx = (x - sourceOrSink.display.width / 2) - sourceOrSink.display.x;
                                for (const channel of sourceOrSink.channels) {
                                    channel.display.x += dx;
                                    channel.display.fx = channel.display.x;
                                }
                                sourceOrSink.display.x += dx;
                                sourceOrSink.parent.dispatch(SubscriptionType.Display);
                            }}>
                        </NumberInput>
                        <NumberInput
                            title="<mi>y</mi>"
                            mathTitle={true}
                            help={`<strong>Vertical coordinate of the spike ${selection.type} display</strong>&mdash;<em>signed float</em>`}
                            integer={false}
                            minimum={null}
                            value={Math.round((selection.display.y + selection.display.height / 2) * 100) / 100}
                            {tooltip}
                            onchange={y => {
                                const sourceOrSink = selection as SpikeSource | SpikeSink;
                                const dy = (y - sourceOrSink.display.height / 2) - sourceOrSink.display.y;
                                for (const channel of sourceOrSink.channels) {
                                    channel.display.y += dy;
                                    channel.display.fy = channel.display.y;
                                }
                                sourceOrSink.display.y += dy;
                                sourceOrSink.parent.dispatch(SubscriptionType.Display);
                            }}>
                        </NumberInput>
                    </div>
                </div>
                <button class="delete-selection" aria-label="Delete" onclick={() => {
                    switch (selection?.type) {
                        case "source":
                            selection.parent.removeSpikeSource(selection, true);
                            selection = null;
                            break;
                        case "sink":
                            selection.parent.removeSpikeSink(selection, true);
                            selection = null;
                            break;
                        default:
                            throw new Error("unreachable");
                    }
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19,9 L19,19 C19,20.6568542 17.6568542,22 16,22 L8,22 C6.34314575,22 5,20.6568542 5,19 L5,9 L19,9 Z M14.8284271,10.7573593 L12,13.5857864 L9.17157288,10.7573593 L7.75735931,12.1715729 L10.5857864,15 L7.75735931,17.8284271 L9.17157288,19.2426407 L12,16.4142136 L14.8284271,19.2426407 L16.2426407,17.8284271 L13.4149207,14.9992929 L16.2426407,12.1715729 L14.8284271,10.7573593 Z M20,6 C20.5522847,6 21,6.44771525 21,7 C21,7.55228475 20.5522847,8 20,8 L4,8 C3.44771525,8 3,7.55228475 3,7 C3,6.44771525 3.44771525,6 4,6 L20,6 Z M14,2.0005414 C15.6568542,2.0005414 17,3.34368715 17,5.0005414 L17,6 L15,6.0002707 L15,5.0002707 C15,4.44798595 14.5522847,4.0002707 14,4.0002707 L10,4.0002707 C9.44771525,4.0002707 9,4.44798595 9,5.0002707 L9,6.0002707 L7,6 L7,5.0005414 C7,3.34368715 8.34314575,2.0005414 10,2.0005414 L14,2.0005414 Z"/></svg>
                    <span class="label">
                        {#if selection.type === "source"}
                            Delete spike source
                        {:else}
                            Delete spike sink
                        {/if}
                    </span>
                </button>
                {#each selection.channels as channel}
                    <div class="category">
                        <div class="title channel">
                            <div class="left">
                                Channel {channel.name}
                            </div>
                            <div class="right">
                                <button class="delete-channel" aria-label="Delete" onclick={() => {
                                   (selection as SpikeSource).removeChannelObject(channel as SpikeSourceChannel, true, true);
                                }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19,9 L19,19 C19,20.6568542 17.6568542,22 16,22 L8,22 C6.34314575,22 5,20.6568542 5,19 L5,9 L19,9 Z M14.8284271,10.7573593 L12,13.5857864 L9.17157288,10.7573593 L7.75735931,12.1715729 L10.5857864,15 L7.75735931,17.8284271 L9.17157288,19.2426407 L12,16.4142136 L14.8284271,19.2426407 L16.2426407,17.8284271 L13.4149207,14.9992929 L16.2426407,12.1715729 L14.8284271,10.7573593 Z M20,6 C20.5522847,6 21,6.44771525 21,7 C21,7.55228475 20.5522847,8 20,8 L4,8 C3.44771525,8 3,7.55228475 3,7 C3,6.44771525 3.44771525,6 4,6 L20,6 Z M14,2.0005414 C15.6568542,2.0005414 17,3.34368715 17,5.0005414 L17,6 L15,6.0002707 L15,5.0002707 C15,4.44798595 14.5522847,4.0002707 14,4.0002707 L10,4.0002707 C9.44771525,4.0002707 9,4.44798595 9,5.0002707 L9,6.0002707 L7,6 L7,5.0005414 C7,3.34368715 8.34314575,2.0005414 10,2.0005414 L14,2.0005414 Z"/></svg>
                                </button>
                            </div>
                        </div>
                        {#if selection.type === "source"}
                            <div class="fields with-space">
                                <div class="title" onmouseenter={event => {
                                    showTooltip(event.target as HTMLElement, "<strong>Instrument played by the channel</strong><br>Sounds do not play by default, they must be enabled by ticking the checkbox in the bottom control bar");
                                }} onmouseleave={() => {
                                    hideTooltip();
                                }} role={null}>Instrument</div>
                                <Dropdown width={200} options={synth.dropdownOptions()} bind:value={(channel as SpikeSourceChannel).instrument}></Dropdown>
                            </div>
                            <div class="fields with-space">
                                <NumberInput title="Chord" mathTitle={false} help="<strong>Chord duration in seconds and notes</strong>&mdash;<em>positive float or zero, note1 note2...</em><br>The chord duration of sampled instruments (anything but Synth) is limited by the samples' duration<br>The note(s) use the scientific pitch notation and are played when the neuron spikes" integer={false} minimum={0} bind:value={(channel as SpikeSourceChannel).chordDuration} {tooltip}></NumberInput>
                                <NoteInput bind:content={(channel as SpikeSourceChannel).noteInputContent} onchange={notes => {
                                    (channel as SpikeSourceChannel).notes = notes;
                                }}></NoteInput>
                            </div>
                            <ColorInput
                                title="Color"
                                help="<strong>Channel spike color</strong><br>Connected neurons can be configured to update their color when they receive a spike<br>The color has no impact on the simulation and only serves visualization purposes"
                                bind:value={(channel as SpikeSourceChannel).color}
                                {tooltip}
                                onchange={() => {
                                    (channel as SpikeSourceChannel).parent.parent.dispatch(SubscriptionType.Parameters);
                                }}
                            ></ColorInput>
                            <SynapseList synapses={(channel as SpikeSourceChannel).postSynapses} end="post" bind:selection {tooltip}></SynapseList>
                        {:else}
                            <SynapseList synapses={(channel as SpikeSinkChannel).preSynapses} end="post" bind:selection {tooltip}></SynapseList>
                        {/if}
                    </div>
                {/each}
            {:else}
                <div>Unsupported selection {selection}</div>
            {/if}
        </div>
    {/if}
    <div bind:this={tooltipElement} class="detail-tooltip"></div>
</div>

<style>
    .detail {
        overflow-y: auto;
    }

    .placeholder {
        font-style: italic;
        color: var(--base01);
        padding: 10px;
    }

    .name-container {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        border-bottom: 1px solid var(--base0);
    }

    .name-container .type {
        flex-grow: 0;
        flex-shrink: 0;
        color: var(--base03);
    }

    .name-input {
        width: 0;
        flex-grow: 1;
        height: 28px;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        background-color: var(--base2);
        border: 1px solid var(--base0);
        outline: 0;
    }

    .name-input:active, .name-input:focus {
        border: 2px solid var(--blue);
        padding: 3px 7px;
    }

    .category {
        margin: 10px;
        background-color: var(--base3);
        padding: 10px;
        border-radius: 6px;
    }

    .category .title {
        color: var(--base03);
    }

    .category .title.channel {
        display: flex;
        align-items: center;
        gap: 5px;
        justify-content: space-between;
    }

    .fields {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .fields.with-space {
        padding-bottom: 5px;
    }

    .spike-input-fields {
        margin-top: 5px;
    }

    button.delete-selection {
        margin-left: 10px;
        margin-right: 10px;
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

    button.delete-selection:hover, button.delete-selection:active {
        background-color: var(--base2);
    }

    button.delete-channel {
        height: 24px;
        background: transparent;
        border: none;
        color: var(--base01);
        text-align: left;
        cursor: pointer;
        padding: 0;
    }

    button.delete-channel svg path {
        fill: var(--base01);
    }

    button.delete-channel:hover svg path {
        fill: var(--base03);
    }

    .detail-tooltip {
        display: none;
        position: fixed;
        border-radius: 4px;
        padding: 5px;
        border: 1px solid var(--base0);
        background-color: var(--base2);
        color: var(--base03);
        box-shadow: 0px 0px 3px 0px var(--base03);
        z-index: 10;
    }

    :global(.detail-tooltip.show) {
        display: block;
    }
</style>
