<script lang="ts">
let {
    width,
    options,
    value = $bindable(),
    onchange,
}: {
    width: number;
    options: [string, string | number][];
    value: string | number;
    onchange?: (value: string | number) => void;
} = $props();
</script>

<div class="dropdown" style="width: {width}px">
    <select
        bind:value={value}
        onchange={() => {
            if (onchange) {
                onchange(value);
            }
        }}
    >
        {#each options as option}
            <option value={option[1]}>
                {option[0]}
            </option>
        {/each}
    </select>
</div>

<style>
    .dropdown {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    select {
        width: 0;
        flex-grow: 1;
        height: 28px;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        color: var(--base03);
        background-color: var(--base3);
        border: 1px solid var(--base0);
        outline: 0;
        cursor: pointer;
        appearance: none;
        -moz-appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23002b36' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 1px center;
		background-size: 24px;
    }

    select:active, select:focus {
        border: 2px solid var(--blue);
        padding: 3px 7px;
		background-position: right 0px center;
    }
</style>
