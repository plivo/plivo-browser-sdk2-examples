interface RnnoiseOptions {
    assetsPath?: string;
}

declare class Rnnoise {
    private rnnoiseModule;
    readonly frameSize: number;
    private constructor();
    static load(options?: RnnoiseOptions): Promise<Rnnoise>;
    static loadBinary(binary: ArrayBuffer): Promise<Rnnoise>;
    createDenoiseState(model?: Model): DenoiseState;
    createModel(modelString: string): Model;
}

declare class DenoiseState {
    private rnnoiseModule?;
    private state;
    private pcmInputBuf;
    private pcmOutputBuf;
    private frameSize;
    readonly model?: Model;
    processFrame(frame: Float32Array): number;
    destroy(): void;
}

declare class Model {
    private rnnoiseModule?;
    free(): void;
}

export { Rnnoise, RnnoiseOptions, DenoiseState, Model };
