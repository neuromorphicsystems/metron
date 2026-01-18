<script lang="ts">
import type { Snippet } from "svelte";

let {
    wrapper = $bindable(),
    isOpen,
    // @ts-expect-error @typescript-eslint/no-unused-vars
    isDialog,
    children,
}: {
    wrapper: HTMLElement | undefined;
    isOpen: boolean;
    isDialog: boolean;
    children: Snippet;
} = $props();

let localIsOpen = false;

$effect(() => {
    localIsOpen = isOpen;
    if (isOpen) {
        console.log(wrapper);
    }
});
</script>

<div
	class="color-input-wrapper"
	bind:this={wrapper}
	class:show={isOpen}
	aria-label="color picker"
>
	{@render children()}
</div>

<style>
	div {
		border: 1px solid var(--base0);
        background-color: var(--base2);
		box-shadow: 0px 0px 3px 0px var(--base03);
		border-radius: 8px;
		display: none;
		--text-input-margin: 5px 5px 6px;
		--picker-radius: 8px 8px 0 0;
		--picker-width: 260px;
	}
	.show {
		display: flex;
		flex-direction: column;
	}
	div {
		display: inline-flex;
		flex-direction: column;
	}

	:global(.swatches) {
		padding-left: 6px;
		padding-right: 6px;
		gap: 6px !important;
	}

	:global(.swatches button) {
		border-radius: 15px !important;
	}
</style>
