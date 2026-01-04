<script lang="ts">
import { onMount } from "svelte";

import { contentAndOffset, parseSpikeInput } from "./parsers";

let {
    channels,
    content = $bindable(),
    onchange,
}: {
    channels: number;
    content: string;
    onchange: (spikesTimeAndChannel: [number, number][]) => void;
} = $props();

let currentChannels: number = channels;
let currentContent: string = content;
let input: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;
let offset: number = content.length;

onMount(() => {
    update();
});

$effect(() => {
    if (currentChannels !== channels || currentContent !== content) {
        currentChannels = channels;
        currentContent = content;
        offset = content.length;
        update();
    }
});

function update() {
    if (input != null) {
        const {
            spikesTimeAndChannel,
            elements,
            carretOffset,
            carretElementIndex,
        } = parseSpikeInput(content, channels, { offset, tooltip });
        onchange(spikesTimeAndChannel);
        const selection = window.getSelection();
        const focused = document.activeElement === input;
        input.innerHTML = "";
        input.append(...elements);
        if (selection != null && focused) {
            if (carretElementIndex == null) {
                const lastChild = input.lastChild;
                if (lastChild == null) {
                    selection.setPosition(input, 0);
                } else {
                    selection.getRangeAt(0).setEndAfter(lastChild);
                    selection.getRangeAt(0).collapse();
                }
            } else {
                const node = input.childNodes[carretElementIndex];
                selection.setPosition(
                    node.nodeType === Node.TEXT_NODE ? node : node.firstChild,
                    carretOffset,
                );
            }
        }
    }
}
</script>

<div class="spike-input-container">
    <div
        bind:this={input}
        contenteditable="plaintext-only"
        spellcheck="false"
        class="spike-input"
        oninput={() => {
            if (input != null) {
                [content, offset] = contentAndOffset(input);
                currentContent = content;
                update();
            }
        }}
        onscroll={() => {
            if (tooltip != null) {
                tooltip.classList.remove("show");
            }
        }}
    ></div>
    <div bind:this={tooltip} class="spike-input-tooltip"></div>
</div>

<style>
    .spike-input-container {
        position: relative;
    }

    .spike-input {
        font-size: 14px;
        margin-top: 5px;
        padding: 4px 8px;
        border-radius: 4px;
        background-color: var(--base3);
        border: 1px solid var(--base0);
        outline: 0;
        white-space: pre-wrap;
        font-family: "RobotoMono", monospace;
        max-height: 40vh;
        overflow-y: auto;
    }

    .spike-input:active, .spike-input:focus {
        border: 2px solid var(--blue);
        padding: 3px 7px;
    }

    :global(.spike-input .error) {
        text-decoration-line: underline;
        text-decoration-style: wavy;
        text-decoration-color: var(--red);
    }

    :global(.spike-input .warning) {
        text-decoration-line: underline;
        text-decoration-style: wavy;
        text-decoration-color: var(--yellow);
    }

    .spike-input-tooltip {
        display: none;
        position: fixed;
        border-radius: 4px;
        padding: 5px;
        border: 1px solid var(--base0);
        background-color: var(--base2);
        color: var(--base03);
        box-shadow: 0px 0px 3px 0px var(--base03);
        text-wrap: nowrap;
    }

    :global(.spike-input-tooltip.show) {
        display: block;
    }
</style>
