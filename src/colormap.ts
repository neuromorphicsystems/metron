import Color from "colorjs.io";

const thetaStep = Math.sqrt(5) * Math.PI;
const center: [number, number, number] = [54.52857027, 14.41791532, 11.5413544];
const radius: number = 56.86590289744259;
const u: [number, number, number] = [0.04866721, 0.0, 0.99881505];
const v: [number, number, number] = [0.11531499, -0.99331308, -0.00561872];

let nextTheta: number = Math.PI;

function thetaToColor(theta: number): string {
    const rCosTheta = radius * Math.cos(theta);
    const rSinTheta = radius * Math.sin(theta);
    return new Color({
        space: "lab",
        coords: [
            center[0] + rCosTheta * u[0] + rSinTheta * v[0],
            center[1] + rCosTheta * u[1] + rSinTheta * v[1],
            center[2] + rCosTheta * u[2] + rSinTheta * v[2],
        ],
    }).toString({ format: "hex" });
}

export function nextColor(): string {
    const color = thetaToColor(nextTheta);
    nextTheta += thetaStep;
    return color;
}

export const swatches = new Array(7)
    .fill(null)
    .map((_, index) => thetaToColor((2 * Math.PI * index) / 7));
