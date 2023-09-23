import { RnnoiseProcessorOptions } from './options';
import { RnnoiseWorkletOptions, id } from './workletUtil'; // Import 'id' and 'RnnoiseWorkletOptions' correctly.

// eslint-disable-next-line import/prefer-default-export
export class RnnoiseWorkletNode extends AudioWorkletNode {
  constructor(
    context: AudioContext,
    { maxChannels, wasmBinary }: Readonly<RnnoiseProcessorOptions>,
  ) {
    const workletOptions: RnnoiseWorkletOptions = {
      processorOptions: { maxChannels, wasmBinary },
    };
    super(context, id, workletOptions);
  }

  destroy() {
    this.port.postMessage('destroy');
  }
}
