import * as tone from "tone";

process.env.INSTRUMENTS_IMPORTS;

const pitches: string[] = [
    "A",
    "A#",
    "B",
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
];
const minimumOctave = 0;
const maximumOctave = 7;

export const DEFAULT_INSTRUMENT: string = "synth";
export const DEFAULT_CHORD_DURATION: number = 0.3;

export class Synth {
    enabled: boolean = $state.raw(false);
    started: boolean;
    compressor: tone.Compressor;
    instruments: Map<string, tone.Sampler | tone.PolySynth>;
    nextNoteIndex: number;

    constructor() {
        this.enabled = false;
        this.started = false;
        this.compressor = new tone.Compressor(-30, 2).toDestination();
        this.instruments = new Map();
        this.instruments.set(DEFAULT_INSTRUMENT, new tone.PolySynth());
        process.env.INSTRUMENTS;
        for (const instrument of this.instruments.values()) {
            instrument.connect(this.compressor);
        }
        this.nextNoteIndex = 36; // A3
    }

    toggle() {
        if (this.enabled) {
            this.enabled = false;
            this.compressor.disconnect();
        } else {
            if (!this.started) {
                this.started = true;
                (async () => {
                    await tone.start();
                })();
            }
            this.enabled = true;
            this.compressor.toDestination();
        }
    }

    trigger(instrumentName: string, notes: string[], duration: number) {
        if (this.enabled && instrumentName !== "none") {
            const instrument = this.instruments.get(instrumentName);
            if (instrument == null) {
                throw new Error(`unsupport instrument "${instrument}"`);
            }
            instrument.triggerAttackRelease(
                notes,
                duration,
                tone.getContext().currentTime,
            );
        }
    }

    dropdownOptions(): [string, string][] {
        return [
            ["None", "none"],
            ...Array.from(this.instruments.keys())
                .sort((a, b) => a.localeCompare(b))
                .map(
                    instrument =>
                        [
                            `${instrument.charAt(0).toUpperCase()}${instrument.slice(1)}`,
                            instrument,
                        ] as [string, string],
                ),
        ];
    }

    nextNote(): string {
        const noteIndex =
            this.nextNoteIndex %
            (pitches.length * (maximumOctave - minimumOctave + 1));
        ++this.nextNoteIndex;
        return `${pitches[noteIndex % pitches.length]}${Math.floor(noteIndex / pitches.length)}`;
    }
}

export const synth = new Synth();
