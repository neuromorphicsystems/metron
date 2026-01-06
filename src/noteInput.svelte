<script lang="ts">
import { onMount } from "svelte";

import { contentAndOffset, parseNoteInput } from "./parsers";

let {
    content = $bindable(),
    onchange,
}: {
    content: string;
    onchange: (notes: string[]) => void;
} = $props();

let currentContent: string = content;
let input: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;
let offset: number = content.length;

onMount(() => {
    update();
});

$effect(() => {
    if (currentContent !== content) {
        currentContent = content;
        offset = content.length;
        update();
    }
});

function update() {
    if (input != null) {
        const { notes, elements, carretOffset, carretElementIndex } =
            parseNoteInput(content, { offset, tooltip });
        onchange(notes);
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

<div class="note-input-container">
    <div
        bind:this={input}
        contenteditable="plaintext-only"
        spellcheck="false"
        class="note-input"
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
    <div bind:this={tooltip} class="note-input-tooltip"></div>
</div>

<style>
    .note-input-container {
        width: 100px;
        flex-grow: 1;
        position: relative;
    }

    .note-input {
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        background-color: var(--base3);
        border: 1px solid var(--base0);
        outline: 0;
        overflow-x: auto;
        text-wrap: nowrap;
    }

    .note-input:active, .note-input:focus {
        border: 2px solid var(--blue);
        padding: 3px 7px;
    }

    :global(.note-input .error) {
        text-decoration-line: underline;
        text-decoration-style: wavy;
        text-decoration-color: var(--red);
    }

    :global(.note-input .warning) {
        text-decoration-line: underline;
        text-decoration-style: wavy;
        text-decoration-color: var(--yellow);
    }

    .note-input-tooltip {
        display: none;
        position: fixed;
        border-radius: 4px;
        padding: 5px;
        border: 1px solid var(--base0);
        background-color: var(--base2);
        color: var(--base03);
        box-shadow: 0px 0px 3px 0px var(--base03);
        text-wrap: nowrap;
        z-index: 10;
    }

    :global(.note-input-tooltip.show) {
        display: block;
    }
</style>
