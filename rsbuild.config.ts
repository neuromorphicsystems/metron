import { defineConfig } from "@rsbuild/core";
import { pluginSvelte } from "@rsbuild/plugin-svelte";

export default defineConfig({
    plugins: [pluginSvelte()],
    html: {
        template: "./src/index.html",
        inject: "body",
    },
    output: {
        distPath: {
            root: "build",
        },
        dataUriLimit: {
            font: Number.MAX_SAFE_INTEGER,
            media: Number.MAX_SAFE_INTEGER,
            assets: Number.MAX_SAFE_INTEGER,
        },
        inlineScripts: true,
        inlineStyles: true,
    },
    tools: {
        swc: {
            jsc: {
                transform: {
                    useDefineForClassFields: false,
                },
            },
        },
        rspack: {
            module: {
                rules: [
                    {
                        test: /\.worker\.js$/,
                        loader: "worker-rspack-loader",
                        options: {
                            inline: "fallback",
                        },
                    },
                    {
                        test: /synth\.svelte\.ts$/,
                        loader: "./samples/loader.ts",
                    }
                ],
            },
        },
    },
});
