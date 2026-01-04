<script lang="ts">
let {
    title,
    mathTitle,
    help,
    value = $bindable(),
    onchange,
    tooltip,
}: {
    title: string;
    mathTitle: boolean;
    help: string;
    value: boolean;
    onchange?: (value: boolean) => void;
    tooltip?: [(element: HTMLElement, message: string) => void, () => void];
} = $props();
</script>

<div class="boolean-input">
    {#if mathTitle}
        <math onmouseenter={(event: MouseEvent) => {
            if (tooltip) {
                tooltip[0](event.target as HTMLElement, help);
            }
        }} onmouseleave={() => {
            if (tooltip) {
                tooltip[1]();
            }
        }}>{@html title}</math>
    {:else}
        <div onmouseenter={(event: MouseEvent) => {
            if (tooltip) {
                tooltip[0](event.target as HTMLElement, help);
            }
        }} onmouseleave={() => {
            if (tooltip) {
                tooltip[1]();
            }
        }} class="title" role={null}>{@html title}</div>
    {/if}
    <div class="checkbox-container">
        <input
            type="checkbox"
            bind:checked={value}
            onchange={() => {
                if (onchange) {
                    onchange(value);
                }
            }}
        />
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M14,16 L14,2 L16,2 L16,18 L8,18 L8,16 L14,16 Z" transform="rotate(45 12 10)"/></svg>
    </div>
</div>

<style>
    .boolean-input {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    math {
        color: var(--base03);
        font-size: 16px;
    }

    .title {
        color: var(--base03);
        font-size: 14px;
    }

    .checkbox-container {
        position: relative;
        height: 18px;
    }

    input {
        margin: 0;
        width: 18px;
        height: 18px;
        border-radius: 9px;
        border: 1px solid var(--base03);
        background-color: var(--base3);
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        cursor: pointer;
    }

    input:hover {
        border: 2px solid var(--base01);
    }

    input:checked {
        background-color: var(--base03);
    }

    input:checked:hover {
        background-color: var(--base01);
    }

    svg {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        pointer-events: none;
    }

    svg path {
        fill: var(--base3);
    }
</style>
