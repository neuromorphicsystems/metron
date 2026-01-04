<script lang="ts">
import type { Tool } from "./tool";

let {
    tool = $bindable(),
}: {
    tool: Tool;
} = $props();

const toolsProperties: { tool: Tool; label: string; path: string }[] = [
    {
        tool: "select",
        label: "Select",
        path: "M4 4 L11 20 L13 13 L20 11 z",
    },
    {
        tool: "add-neuron",
        label: "Add neuron",
        path: "M12.04059,1.78192 C17.56409,1.78192 22.04109,6.25892 22.04109,11.78192 C22.04109,17.30492 17.56409,21.78192 12.04059,21.78192 C6.51809,21.78192 2.04059,17.30492 2.04059,11.78192 C2.04059,6.25942 6.51809,1.78192 12.04059,1.78192 Z M12.04064,3.78192 C7.62275045,3.78192 4.04084,7.36392 4.04084,11.78192 C4.04084,16.20032 7.62275045,19.78192 12.04064,19.78192 C16.4593295,19.78192 20.04084,16.20032 20.04084,11.78192 C20.04084,7.36352 16.4593295,3.78192 12.04064,3.78192 Z M13,8 L12.99959,10.99992 L16,11 L16,13 L12.99959,12.99992 L13,16 L11,16 L10.99959,12.99992 L8,13 L8,11 L10.99959,10.99992 L11,8 L13,8 Z",
    },
    {
        tool: "add-synapse",
        label: "Draw synapse",
        path: "M10.04059,1.78192 C15.3008724,1.78192 19.6120183,5.84239173 20.0109606,10.999836 L23,11 L23,13 L19.9675477,13.0008982 C19.3662649,17.9489124 15.1514108,21.78192 10.04059,21.78192 L10,21.78092 L10,19.78092 L10.04064,19.78192 C14.375958,19.78192 17.9053906,16.3341997 18.0370334,12.031106 L18.04084,11.78192 C18.04084,7.36352 14.4593295,3.78192 10.04064,3.78192 C10.0272494,3.78192 10.0138665,3.78195291 10.0004914,3.78201865 L10.0004934,1.7819987 C10.0138528,1.78194625 10.0272183,1.78192 10.04059,1.78192 Z M10,6 C13.3137085,6 16,8.6862915 16,12 C16,15.3137085 13.3137085,18 10,18 C7.02728549,18 4.55950437,15.8381232 4.08309386,13.0008069 L1,13 L1,11 L4.08292631,11.0001915 C4.55892549,8.16238395 7.02693683,6 10,6 Z M10,8 C7.790861,8 6,9.790861 6,12 C6,14.209139 7.790861,16 10,16 C12.209139,16 14,14.209139 14,12 C14,9.790861 12.209139,8 10,8 Z",
    },
    {
        tool: "add-spike-source",
        label: "Add spike source",
        path: "M12,1 L15,6 L13,6 L13.0007613,8.12621352 C14.406088,8.48821631 15.5123973,9.59477429 15.8740452,11.0002435 L18,11 L18,9 L23,12 L18,15 L18,13 L15.8737865,13.0007613 C15.51187,14.4057531 14.4057531,15.51187 13.0007613,15.8737865 L13,18 L15,18 L12,23 L9,18 L11,18 L11.0002435,15.8740452 C9.59477429,15.5123973 8.48821631,14.406088 8.12621352,13.0007613 L6,13 L6,15 L1,12 L6,9 L6,11 L8.12595483,11.0002435 C8.4876889,9.59443934 9.59443934,8.4876889 11.0002435,8.12595483 L11,6 L9,6 L12,1 Z M12,10 C10.8954305,10 10,10.8954305 10,12 C10,13.1045695 10.8954305,14 12,14 C13.1045695,14 14,13.1045695 14,12 C14,10.8954305 13.1045695,10 12,10 Z",
    },
    {
        tool: "add-spike-sink",
        label: "Add spike sink",
        path: "M12,16 L15,21 L13,21 L13,23 L11,23 L11,21 L9,21 L12,16 Z M12,8 C14.209139,8 16,9.790861 16,12 L16,11.999 L21,9 L21,11 L23,11 L23,13 L21,13 L21,15 L15.9999999,12.0010092 C15.9994546,14.2096844 14.2088026,16 12,16 C9.790861,16 8,14.209139 8,12 C8,9.790861 9.790861,8 12,8 Z M3,9 L8,12 L3,15 L3,13 L1,13 L1,11 L3,11 L3,9 Z M12,10 C10.8954305,10 10,10.8954305 10,12 C10,13.1045695 10.8954305,14 12,14 C13.1045695,14 14,13.1045695 14,12 C14,10.8954305 13.1045695,10 12,10 Z M13,1 L13,3 L15,3 L12,8 L9,3 L11,3 L11,1 L13,1 Z",
    },
];
</script>

<div class="toolbar">
    {#each toolsProperties as toolProperties}
        <button
            class="toolbar-item"
            class:active={tool === toolProperties.tool}
            onclick={() => (tool = toolProperties.tool)}
            title={toolProperties.label}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
            >
                <path d={toolProperties.path} />
            </svg>
            <span class="label">{toolProperties.label}</span>
        </button>
    {/each}
</div>

<style>
    .toolbar {
        height: 50px;
        width: 100%;
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-direction: row;
        padding-top: 10px;
        padding-bottom: 10px;
    }

    .toolbar-item {
        display: flex;
        align-items: center;
        padding-left: 10px;
        padding-right: 20px;
        gap: 10px;
        background: transparent;
        border: none;
        color: var(--base01);
        font-size: 14px;
        text-align: left;
    }

    .toolbar-item:not(:last-of-type) {
        border-right: 1px solid var(--base00);
    }

    .toolbar-item:not(.active) {
        cursor: pointer;
    }

    .toolbar-item:hover {
        color: var(--base03);
    }

    .toolbar-item.active {
        color: var(--blue);
    }


    .toolbar-item svg path {
        fill: var(--base01);
    }

    .toolbar-item:hover svg path {
        fill: var(--base03);
    }

    .toolbar-item.active svg path {
        fill: var(--blue);
    }

    svg {
        width: 24px;
        height: 24px;
    }
</style>
