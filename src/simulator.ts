export interface Play {
    type: "play";
}

export interface Pause {
    type: "pause";
}

export interface TickRate {
    type: "tickRate";
    value: number;
}

export interface Next {
    type: "next";
}

export interface Reset {
    type: "reset";
}

export interface Network {
    type: "network";
    data: {
        neurons: [number, number, number, boolean, string, boolean][];
        spikeSources: [number, [number, string][], [number, number][], number | null][];
        spikeSinks: [number, number[]][];
        synapses: [number, number, number, number, number, number][];
    };
}

export interface Buffer {
    type: "buffer";
    buffer: ArrayBuffer;
}

export type ToSimulator =
    | Play
    | Pause
    | TickRate
    | Next
    | Reset
    | Network
    | Buffer;

export interface ResetAcknowledge {
    type: "reset-acknowledge";
}

export interface SimulatorUpdate {
    type: "simulator-update";
    playing: boolean;
    tick: number;
    tickRate: number;
    buffer: ArrayBuffer;
    sunkSpikes: [number, number, number, number, number, number, string][];
    spikes: [number, [number, string][]][];
    neuronCount: number;
}

export type FromSimulator = ResetAcknowledge | SimulatorUpdate;
