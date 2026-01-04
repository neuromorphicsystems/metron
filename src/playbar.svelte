<script lang="ts">
import Dropdown from "./dropdown.svelte";
import { synth } from "./synth.svelte";

const {
    playing,
    tickRate,
    tick,
    onplay,
    onpause,
    onnext,
    onreset,
    ontickratechange,
}: {
    playing: boolean;
    tickRate: number;
    tick: number;
    onplay: () => void;
    onpause: () => void;
    onnext: () => void;
    onreset: () => void;
    ontickratechange: (tickRate: number) => void;
} = $props();

let soundInput: HTMLInputElement | null = null;
</script>

<div class="playbar">
    <div class="sound-container playbar-item right-border" onclick={event => {
            if (soundInput != null && event.target != soundInput) {
                soundInput.click();
            }
        }} role="none">
        <div class="checkbox-container">
            <input
                bind:this={soundInput}
                type="checkbox"
                checked={synth.enabled}
                onchange={() => {
                    synth.toggle();
                }}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M14,16 L14,2 L16,2 L16,18 L8,18 L8,16 L14,16 Z" transform="rotate(45 12 10)"/></svg>
        </div>
        <div class="title">Sound</div>
    </div>
    <div class="play-pause">
        {#if playing}
            <button
                class="playbar-item"
                onclick={() => {
                    onpause();
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill-rule="evenodd" d="M5,3 L10,3 L10,21 L5,21 Z M14,3 L19,3 L19,21 L14,21 Z"/>
                </svg>
                <span class="label">Pause</span>
            </button>
        {:else}
            <button
                class="playbar-item"
                onclick={() => {
                    onplay();
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill-rule="evenodd" transform="rotate(90 12.5 12)" d="M12.5 3.5L22.5 20.5L2.5 20.5z" />
                </svg>
                <span class="label">Play</span>
            </button>
        {/if}
    </div>
    <Dropdown width={100} options={[
        ["Unlimited", 0],
        ["60 ticks/s", 60],
        ["30 ticks/s", 30],
        ["10 ticks/s", 10],
        ["5 ticks/s", 5],
        ["1 tick/s", 1],
    ]} value={tickRate} onchange={newTickRate => ontickratechange(newTickRate as number)}></Dropdown>
    <button
        class="playbar-item"
        class:disabled={playing}
        onclick={() => {
            if (!playing) {
                onnext();
            }
        }}
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M22,12 L8,20 L8,4 L22,12 Z M3,4 L6,4 L6,20 L3,20 Z"/></svg>
        <span class="label">Next tick</span>
    </button>
    <button
        class="playbar-item right-border"
        onclick={() => {
            onreset();
        }}
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12,9 L6,5 L12,1 L12,4 C16.9705627,4 21,8.02943725 21,13 C21,17.9705627 16.9705627,22 12,22 C7.02943725,22 3,17.9705627 3,13 C3,11.3465861 3.4458579,9.79730782 4.22390281,8.46583615 L5.95166173,9.47387768 C5.34667801,10.5093659 5,11.7141975 5,13 C5,16.8659932 8.13400675,20 12,20 C15.8659932,20 19,16.8659932 19,13 C19,9.13400675 15.8659932,6 12,6 L12,9 Z"/></svg>
        <span class="label">Reset</span>
    </button>
    <div class="tick">Tick <span>{tick}</span></div>
</div>

<style>
    .playbar {
        height: 50px;
        width: 100%;
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-direction: row;
        padding-top: 10px;
        padding-bottom: 10px;
    }

    .play-pause {
        display: flex;
    }

    .playbar-item {
        display: flex;
        align-items: center;
        padding-left: 10px;
        padding-right: 10px;
        gap: 3px;
        background: transparent;
        border: none;
        color: var(--base01);
        font-size: 14px;
        text-align: left;
    }

    :global(.playbar-item.disabled) {
        color: var(--base0);
    }

    .playbar-item:not(.disabled) {
        cursor: pointer;
    }

    .playbar-item:not(.disabled):hover {
        color: var(--base03);
    }

    .playbar-item svg path {
        fill: var(--base01);
    }

    :global(.playbar-item.disabled svg path) {
        fill: var(--base0);
    }

    :global(.playbar-item:not(.disabled):hover svg path) {
        fill: var(--base03);
    }

    .playbar-item svg {
        width: 24px;
        height: 24px;
    }

    .playbar-item.right-border {
        padding-right: 20px;
        border-right: 1px solid var(--base00);
    }

    .tick {
        padding-left: 10px;
        color: var(--base01);
        font-size: 14px;
        line-height: 30px;
    }

    .tick span {
        color: var(--base02);
        font-family: "RobotoMono", monospace;
    }

    .sound-container {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .checkbox-container {
        position: relative;
        height: 18px;
    }

    .checkbox-container input {
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

    .sound-container:hover .checkbox-container input {
        border: 2px solid var(--base01);
    }

    .sound-container .checkbox-container input:checked {
        background-color: var(--base03);
    }

    .sound-container:hover .checkbox-container input:checked {
        background-color: var(--base01);
    }

    .sound-container .checkbox-container svg {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        pointer-events: none;
    }

    .sound-container .checkbox-container svg path {
        fill: var(--base3);
    }
</style>
