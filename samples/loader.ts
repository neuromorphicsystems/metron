import { readdirSync, readFileSync } from "node:fs";
import { join, parse } from "node:path";
import type { LoaderDefinition } from "@rspack/core";

interface Sample {
    note: string;
    path: string;
    variable: string;
}

const samplePattern: RegExp = /^(A|As|B|C|Cs|D|Ds|E|F|Fs|G|Gs)(-?\d+)$/;

function loadInstrumentToSamples(): Map<string, Sample[]> {
    const instrumentToSamples: Map<string, Sample[]> = new Map();
    for (const [instrument, instrumentConfiguration] of Object.entries(
        JSON.parse(
            readFileSync(
                join(import.meta.dirname, "configuration.json"),
            ).toString(),
        ) as {
            [key: string]: { reference: string; intervalSemitones: number };
        },
    )) {
        const intervalSemitones = Math.round(
            instrumentConfiguration.intervalSemitones,
        );
        if (intervalSemitones <= 0) {
            throw new Error(
                `"intervalSemitones" must be an interger strictly larger than zero in "${instrument}"`,
            );
        }
        let minimumSemitoneIndex: number | null = null;
        let maximumSemitoneIndex: number | null = null;
        const semitoneIndexToSample: Map<number, Sample> = new Map();
        let referenceSemitoneIndex: number | null = null;
        for (const samplePath of readdirSync(
            join(import.meta.dirname, instrument),
        )) {
            if (samplePath === ".DS_Store") {
                continue;
            }
            const parsedSamplePath = parse(samplePath);
            if (parsedSamplePath.ext !== ".ogg") {
                throw new Error(
                    `"${join(import.meta.dirname, instrument, samplePath)}" does not the expected extension (".ogg")`,
                );
            }
            const match = parsedSamplePath.name.match(samplePattern);
            if (match == null) {
                throw new Error(
                    `The name of "${join(import.meta.dirname, instrument, samplePath)}" does not match the expected pattern`,
                );
            }
            const semitoneIndex =
                parseInt(match[2], 10) * 12 +
                [
                    "A",
                    "As",
                    "B",
                    "C",
                    "Cs",
                    "D",
                    "Ds",
                    "E",
                    "F",
                    "Fs",
                    "G",
                    "Gs",
                ].indexOf(match[1]);
            if (parsedSamplePath.name === instrumentConfiguration.reference) {
                referenceSemitoneIndex = semitoneIndex;
            }
            if (
                minimumSemitoneIndex == null ||
                semitoneIndex < minimumSemitoneIndex
            ) {
                minimumSemitoneIndex = semitoneIndex;
            }
            if (
                maximumSemitoneIndex == null ||
                semitoneIndex > maximumSemitoneIndex
            ) {
                maximumSemitoneIndex = semitoneIndex;
            }
            semitoneIndexToSample.set(semitoneIndex, {
                note: parsedSamplePath.name.replace("s", "#"),
                path: `../samples/${instrument}/${samplePath}`,
                variable: `${instrument}${parsedSamplePath.name}`,
            });
        }
        if (referenceSemitoneIndex == null) {
            throw new Error(
                `reference "${instrumentConfiguration.reference}" not found in `,
            );
        }
        const samples: Sample[] = [];
        for (
            let semitoneIndex = referenceSemitoneIndex - intervalSemitones;
            semitoneIndex >= (minimumSemitoneIndex as number);
            semitoneIndex -= intervalSemitones
        ) {
            const sample = semitoneIndexToSample.get(semitoneIndex);
            if (sample != null) {
                samples.push(sample);
            }
        }
        samples.reverse();
        for (
            let semitoneIndex = referenceSemitoneIndex;
            semitoneIndex <= (maximumSemitoneIndex as number);
            semitoneIndex += intervalSemitones
        ) {
            const sample = semitoneIndexToSample.get(semitoneIndex);
            if (sample != null) {
                samples.push(sample);
            }
        }
        instrumentToSamples.set(instrument, samples);
    }
    return instrumentToSamples;
}

const loader: LoaderDefinition = (source: string) => {
    const instrumentToSamples = loadInstrumentToSamples();
    const instrumentsImports = Array.from(instrumentToSamples.values())
        .flat()
        .map(sample => `import ${sample.variable} from "${sample.path}"`)
        .join(";\n");
    source = source.replace(
        "process.env.INSTRUMENTS_IMPORTS",
        instrumentsImports,
    );
    const instruments = Array.from(instrumentToSamples.entries())
        .map(
            ([instrument, samples]) =>
                `this.instruments.set("${instrument}", new tone.Sampler({urls: {${samples
                    .map(sample => `"${sample.note}": ${sample.variable}`)
                    .join(", ")}}}));`,
        )
        .join(";\n");
    source = source.replace("process.env.INSTRUMENTS", instruments);
    return source;
};

export default loader;
