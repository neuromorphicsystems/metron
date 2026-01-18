<script lang="ts">
import type { HsvaColor, RgbaColor } from "colord";

const defaultTexts = {
    label: {
        h: "hue channel",
        s: "saturation channel",
        v: "brightness channel",
        r: "red channel",
        g: "green channel",
        b: "blue channel",
        a: "alpha channel",
        hex: "hex color",
        withoutColor: "without color",
    },
    color: {
        rgb: "rgb",
        hsv: "hsv",
        hex: "hex",
    },
    changeTo: "change to ",
    swatch: {
        ariaTitle: "saved colors",
        ariaLabel: (color: string) => `select color: ${color}`,
    },
};

let {
    // @ts-expect-error @typescript-eslint/no-unused-vars
    isAlpha,
    rgb = $bindable(),
    hsv = $bindable(),
    hex = $bindable(),
    // @ts-expect-error @typescript-eslint/no-unused-vars
    textInputModes,
    // @ts-expect-error @typescript-eslint/no-unused-vars
    texts,
    onInput,
}: {
    isAlpha: boolean;
    rgb: RgbaColor;
    hsv: HsvaColor;
    hex: string;
    textInputModes: Array<"hex" | "rgb" | "hsv">;
    texts: typeof defaultTexts;
    onInput: (color: {
        hsv?: HsvaColor;
        rgb?: RgbaColor;
        hex?: string;
    }) => void;
} = $props();
</script>

<div class="color-input-text-input">
    <span>#</span>
    <input
        type="text"
        value={hex.startsWith("#") ? hex.slice(1) : hex}
        oninput={event => {
            let newHex = (event.target as HTMLInputElement).value.replace(/\n/g, "");
			if (newHex.startsWith("#")) {
				newHex = newHex.slice(1);
			}
            if ((newHex.length === 3 || newHex.length === 6) && newHex.match(/^[a-fA-F0-9]+$/) != null) {
				onInput({
					hex: `#${newHex}`
				});
            }
        }}
    />
</div>

<style>
    .color-input-text-input {
        padding-left: 6px;
        padding-right: 6px;
        padding-bottom: 6px;
        display: flex;
        gap: 6px;
        align-items: center;
    }

    input {
        flex-grow: 1;
        height: 28px;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        background-color: var(--base3);
        border: 1px solid var(--base0);
        outline: 0;
        font-family: "RobotoMono", monospace;
    }

    input:active, input:focus {
        border: 2px solid var(--blue);
        padding: 3px 7px;
    }
</style>
