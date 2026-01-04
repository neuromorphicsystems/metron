<script lang="ts">
let {
    title,
    mathTitle,
    help,
    integer,
    minimum,
    value = $bindable(),
    onchange,
    tooltip,
}: {
    title: string;
    mathTitle: boolean;
    help: string;
    integer: boolean;
    minimum: number | null;
    value: number;
    onchange?: (value: number) => void;
    tooltip?: [(element: HTMLElement, message: string) => void, () => void];
} = $props();

let displayedValue = $derived(value.toString());

function update(newValue: number) {
    displayedValue = newValue.toString();
    if (newValue !== value) {
        value = newValue;
        if (onchange) {
            onchange(value);
        }
    }
}

function validate() {
    const parsedValue = parseFloat(displayedValue);
    if (Number.isNaN(parsedValue)) {
        update(value);
    } else {
        if (minimum != null && parsedValue < minimum) {
            update(minimum);
        } else if (integer) {
            update(Math.round(parsedValue));
        } else {
            update(parsedValue);
        }
    }
}
</script>

<div class="number-input">
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
    <input
        type="text"
        bind:value={displayedValue}
        onkeydown={event => {
            switch (event.key) {
                case "Enter": {
                    validate();
                    break;
                }
                case "ArrowUp": {
                    event.preventDefault();
                    validate();
                    update(value + 1);
                    break;
                }
                case "ArrowDown": {
                    event.preventDefault();
                    validate();
                    if (minimum != null && value < minimum + 1) {
                        update(minimum);
                    } else {
                        update(value - 1);
                    }
                    break;
                }
                default: {
                    break;
                }
            }
        }}
        onchange={_ => {
            validate();
        }}
    />
</div>

<style>
    .number-input {
        flex-grow: 1;
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

    input {
        width: 0;
        flex-grow: 1;
        height: 28px;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        background-color: var(--base3);
        border: 1px solid var(--base0);
        outline: 0;
    }

    input:active, input:focus {
        border: 2px solid var(--blue);
        padding: 3px 7px;
    }
</style>
