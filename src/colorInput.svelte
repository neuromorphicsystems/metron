<script lang="ts">
import ColorPicker from "svelte-awesome-color-picker";
import ColorInputTextInput from "./colorInputTextInput.svelte";
import ColorInputWrapper from "./colorInputWrapper.svelte";
import { swatches } from "./colormap";

let {
    title,
    help,
    value = $bindable(),
    onchange,
    tooltip,
}: {
    title: string;
    help: string;
    value: string;
    onchange?: (value: string) => void;
    tooltip?: [(element: HTMLElement, message: string) => void, () => void];
} = $props();

let colorpickerWrapper: HTMLDivElement | null = null;
let isOpen: boolean = $state(false);
</script>

<div class="overlay" role="none" onclick={() => {
    isOpen = false;
}} class:show={isOpen}></div>

<div class="color-input">
    <div onmouseenter={(event: MouseEvent) => {
        if (tooltip) {
            tooltip[0](event.target as HTMLElement, help);
        }
    }} onmouseleave={() => {
        if (tooltip) {
            tooltip[1]();
        }
    }} class="title" role={null}>{@html title}</div>
    <div
        class="color-button"
        onclick={event => {
            if (event.target != null && colorpickerWrapper != null) {
                const boundingClientRect = (event.target as HTMLDivElement).getBoundingClientRect();
                colorpickerWrapper.style.left = `${boundingClientRect.left}px`;
                if (boundingClientRect.top + boundingClientRect.height / 2 < window.innerHeight / 2) {
                    colorpickerWrapper.style.top = `${boundingClientRect.top + boundingClientRect.height + 5}px`;
                } else {
                    colorpickerWrapper.style.top = `${boundingClientRect.top - 5 - 304}px`;
                }
                isOpen = !isOpen;
            }
        }}
        style="background-color: {value}"
        role="none"
    ></div>
    <div bind:this={colorpickerWrapper} class="colorpicker-wrapper" class:show={isOpen}>
        <ColorPicker
            {swatches}
            label=""
            isAlpha={false}
            components={{wrapper: ColorInputWrapper, textInput: ColorInputTextInput}}
            sliderDirection="horizontal"
            isDialog={false}
            onInput={color => {
                if (color.hex != null) {
                    value = color.hex;
                    if (onchange) {
                        onchange(color.hex);
                    }
                }
            }}
            bind:hex={value}
        ></ColorPicker>
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9;
        display: none;
    }

    .overlay.show {
        display: block;
    }

    .colorpicker-wrapper {
        display: none;
        position: fixed;
        z-index: 10;
    }

    .colorpicker-wrapper.show {
        display: block;
        top: 0;
        left: 0;
    }

    .color-input {
        flex-grow: 1;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .color-button {
        width: 24px;
        height: 24px;
        border-radius: 12px;
        border: 1px solid var(--base03);
    }

    .color-button:hover, .color-button:active {
        cursor: pointer;
        opacity: 0.8;
        border: 2px solid var(--base03);
    }

    .title {
        color: var(--base03);
        font-size: 14px;
    }
</style>
