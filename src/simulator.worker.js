const ACTION_NEXT = 0;
const ACTION_SNAPSHOT = 1;

// simulator control
let playing = false;
let timeout = null;
let tick = 0;
let tickRate = 60;
const buffers = new Array(8).fill().map(() => new ArrayBuffer());
const pendingActions = [];

const TYPE_NEURON = 0;
const TYPE_SPIKE_SOURCE = 1;
const TYPE_SPIKE_SINK = 2;

// neurons: {
//     id: number,
//     type: number,
//     mu: number | null,
//     threshold: number,
//     subtractOnReset: boolean,
//     postSynapses: Synapse[],
//     potential: number,
//     spikeTime: number | null,
// }[]
const neurons = [];

// SpikeSourceChannel: {
//     id: number,
//     type: number,
//     postSynapses: Synapse[],
//     spikeTime: number | null,
// }
// spikeSources: {
//     id: number,
//     channels: SpikeSourceChannel[],
//     spikesTimeAndChannel: [number, number][],
//     spikesTimeAndChannelIndex: number,
//     period: number | null,
// }[]
const spikeSources = [];

// SpikeSinkChannel: {
//     id: number,
//     type: number,
// }
// spikeSinks: {
//     id: number,
//     channels: SpikeSinkChannel[],
// }[]
const spikeSinks = [];

// synapses: {
//     id: number,
//     pre: Neuron | SpikeSourceChannel,
//     post: Neuron | SpikeSinkChannel,
//     delayMinusOne: number,
//     weight: number,
//     muAndAlpha: [number, number] | null,
//     spikes: number[],
//     current: number,
// }[]
const synapses = [];

function bisectLeft(spikesTimeAndChannel, time, periodic) {
    let left = 0;
    let right = spikesTimeAndChannel.length;
    while (left < right) {
        const index = (left + right) >> 1;
        if (spikesTimeAndChannel[index][0] < time) {
            left = index + 1;
        } else {
            right = index;
        }
    }
    if (periodic && left === spikesTimeAndChannel.length) {
        return 0;
    }
    return left;
}

function join(currentArray, newArray, onEnter, onUpdate) {
    const currentIndicesToRemove = [];
    let currentIndex = 0;
    let newIndex = 0;
    const currentLength = currentArray.length;
    for (; ;) {
        if (currentIndex < currentLength) {
            if (newIndex < newArray.length) {
                if (currentArray[currentIndex].id === newArray[newIndex][0]) {
                    onUpdate(currentArray[currentIndex], newArray[newIndex]);
                    ++currentIndex;
                    ++newIndex;
                } else {
                    currentIndicesToRemove.push(currentIndex);
                    ++currentIndex;
                }
            } else {
                currentIndicesToRemove.push(currentIndex);
                ++currentIndex;
            }
        } else {
            if (newIndex < newArray.length) {
                currentArray.push(onEnter(newArray[newIndex]));
                ++newIndex;
            } else {
                break;
            }
        }
    }
    for (let index = currentIndicesToRemove.length; index > 0; --index) {
        currentArray.splice(currentIndicesToRemove[index - 1], 1);
    }
}

function next(hotloopStart) {
    const start = performance.now();
    if (buffers.length === 0) {
        pendingActions.push(ACTION_NEXT);
        return;
    }
    const buffer = buffers.pop();
    ++tick;

    // sunkSpikes: [
    //     synapseId: number,
    //     preId: number,
    //     postId: number,
    //     delay: number,
    //     weight: number,
    //     mu: number,
    // ][]
    const sunkSpikes = [];

    // neuron decay
    for (const neuron of neurons) {
        if (neuron.mu != null) {
            neuron.potential *= neuron.mu;
        }
    }

    // synapse decay and spikes
    for (const synapse of synapses) {
        // current decay
        if (synapse.muAndAlpha != null && synapse.current > 0) {
            synapse.current *= synapse.muAndAlpha[0];
        }
        // remove spikes that have arrived and:
        // - update the current for a 2nd order neuron
        // - update the potential for a 1st order neuron
        // - save the synapse properties for a sink
        {
            let index = 0;
            for (; index < synapse.spikes.length; ++index) {
                if (synapse.spikes[index] < synapse.delayMinusOne) {
                    break;
                }
                if (synapse.post.type === TYPE_NEURON) {
                    if (synapse.muAndAlpha == null) {
                        synapse.post.potential = Math.max(0.0, synapse.post.potential + synapse.weight);
                    } else {
                        synapse.current += synapse.muAndAlpha[1];
                    }
                } else {
                    sunkSpikes.push([
                        synapse.id,
                        synapse.pre.id,
                        synapse.post.id,
                        synapse.delayMinusOne + 1,
                        synapse.weight,
                        synapse.muAndAlpha == null
                            ? 0
                            : -1 / Math.log(synapse.muAndAlpha[0]),
                    ]);
                }
            }
            synapse.spikes.splice(0, index);
        }
        // update the time of remaining spikes
        for (let index = 0; index < synapse.spikes.length; ++index) {
            ++synapse.spikes[index];
        }
        // update the post potential for 2nd order neurons
        if (
            synapse.muAndAlpha != null &&
            synapse.current > 0 &&
            synapse.post.type === TYPE_NEURON
        ) {
            synapse.post.potential = Math.max(0.0, synapse.post.potential + synapse.current * synapse.weight);
        }
    }

    // neuron spikes
    for (const neuron of neurons) {
        if (neuron.potential >= neuron.threshold) {
            if (neuron.subtractOnReset) {
                neuron.potential -= neuron.threshold;
            } else {
                neuron.potential = 0;
            }
            for (const synapse of neuron.postSynapses) {
                synapse.spikes.push(0);
            }
            neuron.spikeTime = tick;
        }
    }

    // inject source spikes
    for (const spikeSource of spikeSources) {
        const initialSpikesTimeAndChannelIndex = spikeSource.spikesTimeAndChannelIndex;
        const sourceTick = spikeSource.period == null ? tick : tick % spikeSource.period;
        while (
            spikeSource.spikesTimeAndChannelIndex <
            spikeSource.spikesTimeAndChannel.length &&
            spikeSource.spikesTimeAndChannel[
            spikeSource.spikesTimeAndChannelIndex
            ][0] === sourceTick
        ) {
            const channel =
                spikeSource.channels[
                spikeSource.spikesTimeAndChannel[
                spikeSource.spikesTimeAndChannelIndex
                ][1]
                ];
            for (const synapse of channel.postSynapses) {
                synapse.spikes.push(0);
            }
            channel.spikeTime = tick;
            if (spikeSource.period == null) {
                ++spikeSource.spikesTimeAndChannelIndex;
            } else {
                spikeSource.spikesTimeAndChannelIndex = (spikeSource.spikesTimeAndChannelIndex + 1) % spikeSource.spikesTimeAndChannel.length;
                if (spikeSource.spikesTimeAndChannelIndex === initialSpikesTimeAndChannelIndex) {
                    break;
                }
            }
        }
    }
    postData(buffer, sunkSpikes);
    const end = performance.now();
    if (playing) {
        let sleep = tickRate === 0 ? 0 : Math.floor(1000 / tickRate);
        const elapsed = end - start;
        if (sleep > elapsed) {
            sleep -= elapsed;
        } else {
            sleep = 0;
        }
        if (sleep < 5 && end - hotloopStart < 20) {
            next(hotloopStart);
        } else {
            timeout = setTimeout(next, sleep);
        }
    }
}

function postData(buffer, sunkSpikes) {
    const byteLength =
        (neurons.length * 3 +
            spikeSources.length * 2 +
            spikeSources.reduce(
                (total, spikeSource) => total + spikeSource.channels.length,
                0,
            ) *
            2) *
        8;

    if (buffer.byteLength !== byteLength) {
        buffer = new ArrayBuffer(byteLength);
    }
    const view = new Float64Array(buffer);
    let offset = 0;
    for (const neuron of neurons) {
        view.set(
            [
                neuron.id,
                neuron.potential / neuron.threshold,
                neuron.spikeTime == null ? -1 : tick - neuron.spikeTime,
            ],
            offset,
        );
        offset += 3;
    }
    for (const spikeSource of spikeSources) {
        view.set([spikeSource.id, spikeSource.channels.length], offset);
        offset += 2;
        for (const channel of spikeSource.channels) {
            view.set(
                [
                    channel.id,
                    channel.spikeTime == null ? -1 : tick - channel.spikeTime,
                ],
                offset,
            );
            offset += 2;
        }
    }
    const spikes = synapses
        .filter(synapse => synapse.spikes.length > 0)
        .map(synapse => [
            synapse.id,
            synapse.spikes.map(spike => spike / (synapse.delayMinusOne + 1)),
        ]);
    self.postMessage({
        type: "simulator-update",
        playing,
        tick,
        tickRate,
        buffer,
        sunkSpikes,
        spikes,
        neuronCount: neurons.length,
    });
}

function snapshot() {
    if (buffers.length === 0) {
        pendingActions.push(ACTION_SNAPSHOT);
        return;
    }
    const buffer = buffers.pop();
    postData(buffer, []);
}

self.onmessage = event => {
    switch (event.data.type) {
        case "buffer": {
            buffers.push(event.data.buffer);
            if (pendingActions.length > 0) {
                const action = pendingActions.shift();
                switch (action) {
                    case ACTION_NEXT:
                        next(performance.now());
                        break;
                    case ACTION_SNAPSHOT:
                        // remove other actions if snapshot is pending
                        pendingActions.length = 0;
                        snapshot();
                        break;
                    default:
                        throw new Error("unreachable");
                }
            }
            break;
        }
        case "play": {
            if (!playing) {
                playing = true;
                next(performance.now());
            }
            break;
        }
        case "pause": {
            clearTimeout(timeout);
            playing = false;
            snapshot();
            break;
        }
        case "tickRate": {
            tickRate = event.data.value;
            break;
        }
        case "next": {
            if (!playing) {
                next(performance.now());
            }
            break;
        }
        case "reset": {
            tick = -1;
            for (const neuron of neurons) {
                neuron.potential = 0.0;
                neuron.spikeTime = null;
            }
            for (const spikeSource of spikeSources) {
                for (const channel of spikeSource.channels) {
                    channel.spikeTime = null;
                }
                spikeSource.spikesTimeAndChannelIndex = 0;
            }
            for (const synapse of synapses) {
                synapse.spikes.length = 0;
                synapse.current = 0.0;
            }
            self.postMessage({
                type: "reset-acknowledge",
            });
            if (!playing) {
                next(performance.now());
            }
            break;
        }
        case "network": {
            const network = event.data.data;
            join(
                neurons,
                network.neurons,
                neuron => ({
                    id: neuron[0],
                    type: TYPE_NEURON,
                    mu: neuron[1] === 0 ? null : Math.exp(-1.0 / neuron[1]),
                    threshold: neuron[2],
                    subtractOnReset: neuron[3],
                    postSynapses: [],
                    potential: 0.0,
                    spikeTime: null,
                }),
                (currentNeuron, newNeuron) => {
                    currentNeuron.mu =
                        newNeuron[1] === 0
                            ? null
                            : Math.exp(-1.0 / newNeuron[1]);
                    currentNeuron.threshold = newNeuron[2];
                    currentNeuron.subtractOnReset = newNeuron[3];
                    currentNeuron.postSynapses.length = 0;
                },
            );
            join(
                spikeSources,
                network.spikeSources,
                spikeSource => ({
                    id: spikeSource[0],
                    channels: spikeSource[1].map(id => ({
                        id,
                        type: TYPE_SPIKE_SOURCE,
                        postSynapses: [],
                        spikeTime: null,
                    })),
                    spikesTimeAndChannel: spikeSource[2],
                    spikesTimeAndChannelIndex: bisectLeft(
                        spikeSource[2],
                        spikeSource[3] == null ? tick : tick % spikeSource[3],
                        spikeSource[3] != null,
                    ),
                    period: spikeSource[3],
                }),
                (currentSpikeSource, newSpikeSource) => {
                    const currentChannelIdToSpikeTime = new Map(
                        currentSpikeSource.channels.map(channel => [
                            channel.id,
                            channel.spikeTime,
                        ]),
                    );
                    currentSpikeSource.channels = newSpikeSource[1].map(id => {
                        const spikeTime = currentChannelIdToSpikeTime.get(id);
                        return {
                            id,
                            type: TYPE_SPIKE_SOURCE,
                            postSynapses: [],
                            spikeTime: spikeTime == null ? null : spikeTime,
                        };
                    });
                    currentSpikeSource.spikesTimeAndChannel = newSpikeSource[2];
                    currentSpikeSource.spikesTimeAndChannelIndex = bisectLeft(
                        newSpikeSource[2],
                        newSpikeSource[3] == null ? tick : tick % newSpikeSource[3],
                        newSpikeSource[3] != null,
                    );
                    currentSpikeSource.period = newSpikeSource[3];
                },
            );
            // spike sinks hold no local state, they can be replaced completely
            spikeSinks.length = 0;
            for (const spikeSink of network.spikeSinks) {
                spikeSinks.push({
                    id: spikeSink[0],
                    channels: spikeSink[1].map(id => ({
                        id,
                        type: TYPE_SPIKE_SINK,
                    })),
                });
            }
            const idToNeuron = new Map(
                neurons.map(neuron => [neuron.id, neuron]),
            );
            const idToSpikeSourceChannel = new Map(
                spikeSources.flatMap(spikeSource =>
                    spikeSource.channels.map(channel => [channel.id, channel]),
                ),
            );
            const idToSpikeSinkChannel = new Map(
                spikeSinks.flatMap(spikeSink =>
                    spikeSink.channels.map(channel => [channel.id, channel]),
                ),
            );
            const pre = id => {
                const neuron = idToNeuron.get(id);
                if (neuron != null) {
                    return neuron;
                }
                const spikeSourceChannel = idToSpikeSourceChannel.get(id);
                if (spikeSourceChannel != null) {
                    return spikeSourceChannel;
                }
                throw new Error(
                    `no matching neuron or spike source for id ${id}`,
                );
            };
            const post = id => {
                const neuron = idToNeuron.get(id);
                if (neuron != null) {
                    return neuron;
                }
                const spikeSinkChannel = idToSpikeSinkChannel.get(id);
                if (spikeSinkChannel != null) {
                    return spikeSinkChannel;
                }
                throw new Error(
                    `no matching neuron or spike sink for id ${id}`,
                );
            };
            join(
                synapses,
                network.synapses,
                synapse => ({
                    id: synapse[0],
                    pre: pre(synapse[1]),
                    post: post(synapse[2]),
                    delayMinusOne: synapse[3] - 1,
                    weight: synapse[4],
                    muAndAlpha:
                        synapse[5] === 0
                            ? null
                            : [
                                Math.exp(-1.0 / synapse[5]),
                                1.0 - Math.exp(-1.0 / synapse[5]),
                            ],
                    spikes: [],
                    current: 0.0,
                }),
                (currentSynapse, newSynapse) => {
                    currentSynapse.pre = pre(newSynapse[1]);
                    currentSynapse.post = post(newSynapse[2]);
                    currentSynapse.delayMinusOne = newSynapse[3] - 1;
                    currentSynapse.weight = newSynapse[4];
                    if (newSynapse[5] === 0) {
                        currentSynapse.muAndAlpha = null;
                    } else {
                        const mu = Math.exp(-1.0 / newSynapse[5]);
                        currentSynapse.muAndAlpha = [mu, 1.0 - mu];
                    }
                },
            );
            for (const synapse of synapses) {
                synapse.pre.postSynapses.push(synapse);
            }
            if (!playing) {
                snapshot();
            }
            break;
        }
        default:
            throw new Error("unreachable");
    }
};
