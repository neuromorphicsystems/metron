enum ChunkType {
    Default = 0,
    Warning = 1,
    Error = 3,
}

interface ChunkInformation {
    type: ChunkType;
    message: string | null;
}

const spacePattern: RegExp = /[\s\n\r]/;
const digitPattern: RegExp = /\d/;
const separatorCharacter: string = ":";
const pitchPattern = /^[A-G]$/;
const noSharpPitchPattern = /^[BE]$/;

interface ParsedSpikeInput {
    spikesTimeAndChannel: [number, number][];
    elements: (string | HTMLSpanElement)[];
    carretOffset: number;
    carretElementIndex: number | null;
}

export function parseSpikeInput(
    content: string,
    channels: number,
    dom: null,
): [number, number][];
export function parseSpikeInput(
    content: string,
    channels: number,
    dom: {
        offset: number;
        tooltip: HTMLDivElement | null;
    },
): ParsedSpikeInput;
export function parseSpikeInput(
    content: string,
    channels: number,
    dom: {
        offset: number;
        tooltip: HTMLDivElement | null;
    } | null,
): ParsedSpikeInput | [number, number][] {
    const timeToChannels = new Map();
    let chunk = "";
    let spikeChannel: number = 0;
    let spikeTime: number = 0;
    const parsedSpikeInputContent: ParsedSpikeInput | null =
        dom == null
            ? null
            : {
                  spikesTimeAndChannel: [],
                  elements: [],
                  carretOffset: 0,
                  carretElementIndex: null,
              };
    let chunkInformation: ChunkInformation | null =
        dom == null
            ? null
            : {
                  type: ChunkType.Default,
                  message: "",
              };

    function flush(
        index: number,
        newChunkInformation: ChunkInformation,
        newChunk: string,
    ) {
        if (dom != null) {
            if (chunk.length > 0) {
                const parsed = parsedSpikeInputContent as ParsedSpikeInput;
                const information = chunkInformation as ChunkInformation;
                if (parsed.carretElementIndex == null && index > dom.offset) {
                    parsed.carretElementIndex = parsed.elements.length;
                    parsed.carretOffset = dom.offset - (index - chunk.length);
                }
                switch (information.type) {
                    case ChunkType.Default: {
                        parsed.elements.push(chunk);
                        break;
                    }
                    case ChunkType.Warning:
                    case ChunkType.Error: {
                        const span = document.createElement("span");
                        span.classList.add(
                            information.type === ChunkType.Warning
                                ? "warning"
                                : "error",
                        );
                        span.innerText = chunk;
                        const tooltipMessage =
                            information.type === ChunkType.Error
                                ? `Unexpected character${chunk.length > 1 ? "s" : ""}`
                                : (information.message as string);
                        span.addEventListener("mouseenter", () => {
                            if (dom.tooltip != null) {
                                const boundingClientRect =
                                    span.getBoundingClientRect();
                                dom.tooltip.style.left = `${boundingClientRect.x}px`;
                                dom.tooltip.style.top = `${boundingClientRect.y + 20}px`;
                                dom.tooltip.innerHTML = tooltipMessage;
                                dom.tooltip.classList.add("show");
                            }
                        });
                        span.addEventListener("mouseleave", () => {
                            if (dom.tooltip != null) {
                                dom.tooltip.classList.remove("show");
                            }
                        });
                        parsed.elements.push(span);
                        break;
                    }
                    default:
                        throw new Error("unreachable");
                }
            }
            chunkInformation = newChunkInformation;
        }
        chunk = newChunk;
    }

    let state = 0;
    const trimmedContent = content.slice(
        0,
        content.endsWith("\n") ? content.length - 1 : content.length,
    );
    for (let index = 0; index < trimmedContent.length; ++index) {
        const character = trimmedContent.charAt(index);
        switch (state) {
            case -1: // error
                if (digitPattern.test(character)) {
                    flush(
                        index,
                        { type: ChunkType.Default, message: null },
                        character,
                    );
                    state = 1;
                } else if (spacePattern.test(character)) {
                    flush(
                        index,
                        { type: ChunkType.Default, message: null },
                        character,
                    );
                    state = 0;
                } else {
                    chunk += character;
                }
                break;
            case 0: // channel (first character)
                if (digitPattern.test(character)) {
                    flush(
                        index,
                        { type: ChunkType.Default, message: null },
                        character,
                    );
                    state = 1;
                } else if (spacePattern.test(character)) {
                    chunk += character;
                } else {
                    flush(
                        index,
                        { type: ChunkType.Error, message: null },
                        character,
                    );
                    state = -1;
                }
                break;
            case 1: // channel (other characters)
                if (digitPattern.test(character)) {
                    chunk += character;
                } else {
                    spikeChannel = parseInt(chunk, 10);
                    if (
                        character === separatorCharacter ||
                        spacePattern.test(character)
                    ) {
                        if (spikeChannel < channels) {
                            chunk += character;
                        } else {
                            if (chunkInformation != null) {
                                chunkInformation.type = ChunkType.Warning;
                                chunkInformation.message = `Channel ${spikeChannel} does not exist`;
                            }
                            flush(
                                index,
                                { type: ChunkType.Default, message: null },
                                character,
                            );
                        }
                        state = character === separatorCharacter ? 3 : 2;
                    } else {
                        if (spikeChannel >= channels) {
                            if (chunkInformation != null) {
                                chunkInformation.type = ChunkType.Warning;
                                chunkInformation.message = `Channel ${spikeChannel} does not exist`;
                            }
                        }
                        flush(
                            index,
                            { type: ChunkType.Error, message: null },
                            character,
                        );
                        state = -1;
                    }
                }
                break;
            case 2: // separator
                if (spacePattern.test(character)) {
                    chunk += character;
                } else if (character === separatorCharacter) {
                    chunk += character;
                    state = 3;
                } else {
                    flush(
                        index,
                        { type: ChunkType.Error, message: null },
                        character,
                    );
                    state = -1;
                }
                break;
            case 3: // time (first character)
                if (digitPattern.test(character)) {
                    flush(
                        index,
                        {
                            type: ChunkType.Default,
                            message: null,
                        },
                        character,
                    );
                    state = 4;
                } else if (spacePattern.test(character)) {
                    chunk += character;
                } else {
                    flush(
                        index,
                        { type: ChunkType.Error, message: null },
                        character,
                    );
                    state = -1;
                }
                break;
            case 4: // time (other characters)
                if (digitPattern.test(character)) {
                    chunk += character;
                } else {
                    spikeTime = parseInt(chunk, 10);
                    let valid = true;
                    if (spikeChannel < channels) {
                        const activeChannels = timeToChannels.get(spikeTime);
                        if (activeChannels == null) {
                            timeToChannels.set(
                                spikeTime,
                                new Set([spikeChannel]),
                            );
                        } else {
                            if (activeChannels.has(spikeChannel)) {
                                valid = false;
                            } else {
                                activeChannels.add(spikeChannel);
                            }
                        }
                    }
                    if (spacePattern.test(character)) {
                        if (valid) {
                            chunk += character;
                        } else {
                            if (chunkInformation != null) {
                                chunkInformation.type = ChunkType.Warning;
                                chunkInformation.message = `Channel ${spikeChannel} already has a spike at time ${spikeTime}`;
                            }
                            flush(
                                index,
                                {
                                    type: ChunkType.Default,
                                    message: null,
                                },
                                character,
                            );
                        }
                        state = 0;
                    } else {
                        if (!valid && chunkInformation != null) {
                            chunkInformation.type = ChunkType.Warning;
                            chunkInformation.message = `Channel ${spikeChannel} already has a spike at time ${spikeTime}`;
                        }
                        flush(
                            index,
                            { type: ChunkType.Error, message: null },
                            character,
                        );
                        state = -1;
                    }
                }
                break;
            default:
                throw new Error("unreachable");
        }
    }
    if (state === 1) {
        spikeChannel = parseInt(chunk, 10);
        if (spikeChannel >= channels && chunkInformation != null) {
            chunkInformation.type = ChunkType.Warning;
            chunkInformation.message = `Channel ${spikeChannel} does not exist`;
        }
    } else if (state === 4) {
        spikeTime = parseInt(chunk, 10);
        let valid = true;
        if (spikeChannel < channels) {
            const activeChannels = timeToChannels.get(spikeTime);
            if (activeChannels == null) {
                timeToChannels.set(spikeTime, new Set([spikeChannel]));
            } else {
                if (activeChannels.has(spikeChannel)) {
                    valid = false;
                } else {
                    activeChannels.add(spikeChannel);
                }
            }
        }
        if (!valid && chunkInformation != null) {
            chunkInformation.type = ChunkType.Warning;
            chunkInformation.message = `Channel ${spikeChannel} already has a spike at time ${spikeTime}`;
        }
    }
    flush(
        trimmedContent.length,
        { type: ChunkType.Default, message: null },
        "\n",
    );
    flush(
        trimmedContent.length + 1,
        { type: ChunkType.Default, message: null },
        "\n",
    );
    const spikesTimeAndChannel: [number, number][] = [];
    for (const [time, channels] of timeToChannels.entries()) {
        for (const channel of channels) {
            spikesTimeAndChannel.push([time, channel]);
        }
    }
    spikesTimeAndChannel.sort((a, b) =>
        a[0] === b[0] ? a[1] - b[1] : a[0] - b[0],
    );
    if (dom == null) {
        return spikesTimeAndChannel;
    }
    if (dom.tooltip != null) {
        dom.tooltip.classList.remove("show");
    }
    (parsedSpikeInputContent as ParsedSpikeInput).spikesTimeAndChannel =
        spikesTimeAndChannel;
    return parsedSpikeInputContent as ParsedSpikeInput;
}

interface ParsedNoteInput {
    notes: string[];
    elements: (string | HTMLSpanElement)[];
    carretOffset: number;
    carretElementIndex: number | null;
}

export function parseNoteInput(content: string, dom: null): string[];
export function parseNoteInput(
    content: string,
    dom: {
        offset: number;
        tooltip: HTMLDivElement | null;
    },
): ParsedNoteInput;
export function parseNoteInput(
    content: string,
    dom: {
        offset: number;
        tooltip: HTMLDivElement | null;
    } | null,
): ParsedNoteInput | string[] {
    const notes: string[] = [];
    let chunk = "";
    const parsedNoteInput: ParsedNoteInput | null =
        dom == null
            ? null
            : {
                  notes: [],
                  elements: [],
                  carretOffset: 0,
                  carretElementIndex: null,
              };
    let chunkInformation: ChunkInformation | null =
        dom == null
            ? null
            : {
                  type: ChunkType.Default,
                  message: "",
              };

    function flush(
        index: number,
        newChunkInformation: ChunkInformation,
        newChunk: string,
    ) {
        if (dom != null) {
            if (chunk.length > 0) {
                const parsed = parsedNoteInput as ParsedNoteInput;
                const information = chunkInformation as ChunkInformation;
                if (parsed.carretElementIndex == null && index > dom.offset) {
                    parsed.carretElementIndex = parsed.elements.length;
                    parsed.carretOffset = dom.offset - (index - chunk.length);
                }
                switch (information.type) {
                    case ChunkType.Default: {
                        parsed.elements.push(chunk);
                        break;
                    }
                    case ChunkType.Error: {
                        const span = document.createElement("span");
                        span.classList.add("error");
                        span.innerText = chunk;
                        const tooltipMessage = `Unexpected character${chunk.length > 1 ? "s" : ""}`;
                        span.addEventListener("mouseenter", () => {
                            if (dom.tooltip != null) {
                                const boundingClientRect =
                                    span.getBoundingClientRect();
                                dom.tooltip.style.left = `${boundingClientRect.x}px`;
                                dom.tooltip.style.top = `${boundingClientRect.y + 20}px`;
                                dom.tooltip.innerHTML = tooltipMessage;
                                dom.tooltip.classList.add("show");
                            }
                        });
                        span.addEventListener("mouseleave", () => {
                            if (dom.tooltip != null) {
                                dom.tooltip.classList.remove("show");
                            }
                        });
                        parsed.elements.push(span);
                        break;
                    }
                    default:
                        throw new Error("unreachable");
                }
            }
            chunkInformation = newChunkInformation;
        }
        chunk = newChunk;
    }

    let state = 0;
    const trimmedContent = content.slice(
        0,
        content.endsWith("\n") ? content.length - 1 : content.length,
    );
    for (let index = 0; index < trimmedContent.length; ++index) {
        const character = trimmedContent.charAt(index);
        switch (state) {
            case -1: // error
                if (pitchPattern.test(character)) {
                    flush(
                        index,
                        { type: ChunkType.Default, message: null },
                        character,
                    );
                    state = noSharpPitchPattern.test(character) ? 2 : 1;
                } else if (spacePattern.test(character)) {
                    flush(
                        index,
                        { type: ChunkType.Default, message: null },
                        character,
                    );
                    state = 0;
                } else {
                    chunk += character;
                }
                break;
            case 0: // note (first character)
                if (pitchPattern.test(character)) {
                    flush(
                        index,
                        { type: ChunkType.Default, message: null },
                        character,
                    );
                    state = noSharpPitchPattern.test(character) ? 2 : 1;
                } else if (spacePattern.test(character)) {
                    chunk += character;
                } else {
                    flush(
                        index,
                        { type: ChunkType.Error, message: null },
                        character,
                    );
                    state = -1;
                }
                break;
            case 1: // note (sharp, minus, or digit)
                if (character === "#") {
                    chunk += character;
                    state = 2;
                } else if (character === "-" || digitPattern.test(character)) {
                    chunk += character;
                    state = 3;
                } else {
                    flush(
                        index,
                        { type: ChunkType.Error, message: null },
                        character,
                    );
                    state = -1;
                }
                break;
            case 2: // note (minus or digit)
                if (character === "-" || digitPattern.test(character)) {
                    chunk += character;
                    state = 3;
                } else {
                    flush(
                        index,
                        { type: ChunkType.Error, message: null },
                        character,
                    );
                    state = -1;
                }
                break;
            case 3: // note (digit or end)
                if (digitPattern.test(character)) {
                    chunk += character;
                } else if (spacePattern.test(character)) {
                    notes.push(chunk);
                    flush(
                        index,
                        { type: ChunkType.Default, message: null },
                        character,
                    );
                    state = 0;
                } else {
                    flush(
                        index,
                        { type: ChunkType.Error, message: null },
                        character,
                    );
                    state = -1;
                }
                break;
            default:
                throw new Error("unreachable");
        }
    }
    if (state === 3) {
        notes.push(chunk);
    }
    flush(
        trimmedContent.length,
        { type: ChunkType.Default, message: null },
        "\n",
    );
    flush(
        trimmedContent.length + 1,
        { type: ChunkType.Default, message: null },
        "\n",
    );
    if (dom == null) {
        return notes;
    }
    if (dom.tooltip != null) {
        dom.tooltip.classList.remove("show");
    }
    (parsedNoteInput as ParsedNoteInput).notes = notes;
    return parsedNoteInput as ParsedNoteInput;
}

export function contentAndOffset(input: HTMLDivElement): [string, number] {
    const content = input.innerText;
    const selection = window.getSelection();
    if (selection == null) {
        return [content, content.length];
    }
    const range = selection.getRangeAt(0);
    const childNodes = input.childNodes;
    let offset = 0;
    for (let index = 0; index < childNodes.length; ++index) {
        const node = childNodes[index];
        if (node.nodeType === Node.TEXT_NODE) {
            if (node === range.endContainer) {
                offset += range.endOffset;
                break;
            }
            if (node.textContent != null) {
                offset += node.textContent.length;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            let found = false;
            const subChildNodes = node.childNodes;
            for (
                let subIndex = 0;
                subIndex < subChildNodes.length;
                ++subIndex
            ) {
                const subNode = subChildNodes[subIndex];
                if (subNode.nodeType === Node.TEXT_NODE) {
                    if (subNode === range.endContainer) {
                        offset += range.endOffset;
                        found = true;
                        break;
                    }
                    if (subNode.textContent != null) {
                        offset += subNode.textContent.length;
                    }
                }
            }
            if (found) {
                break;
            }
        }
    }
    return [content, Math.min(offset, content.length)];
}
