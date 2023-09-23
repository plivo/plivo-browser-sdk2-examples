import type { Process } from './utils/process';
import { createProcessor } from './processor';
import { Rnnoise } from './c/rnnoise';
import { id, RnnoiseWorkletOptions } from './workletUtil';

const AudioWorkletBufferSize = 128;

class RnnoiseProcessor extends AudioWorkletProcessor {
  private processor: { process: Process; destroy: () => void } | undefined;

  private destroyed = false;

  constructor(options: RnnoiseWorkletOptions) {
    super();

    this.port.addEventListener('message', (e) => {
      if (e.data === 'destroy') {
        this.destroy();
      }
    });
    (async () => {
      const rnnoiseModule = await Rnnoise.loadBinary(
        options.processorOptions.wasmBinary,
      );
      this.processor = createProcessor(rnnoiseModule, {
        bufferSize: AudioWorkletBufferSize,
        maxChannels: options.processorOptions.maxChannels,
      });
      if (this.destroyed) {
        this.destroy();
      }
    })();
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _parameters: unknown,
  ) {
    if (inputs.length === 0 || !inputs[0] || inputs[0]?.length === 0) {
      return true;
    }
    if (!this.processor) {
      return true;
    }

    this.processor.process(inputs[0]!, outputs[0]!);
    return true;
  }

  private destroy() {
    this.destroyed = true;
    this.processor?.destroy();
    this.processor = undefined;
  }
}

registerProcessor(id, RnnoiseProcessor);
