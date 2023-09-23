import type { TypedAudioWorkletOptions } from './utils/TypedAudioWorklet'
import type { RnnoiseProcessorOptions } from './options'

export const id = 'plivo-noise-suppressor/rnnoise'

export type RnnoiseWorkletOptions =
  TypedAudioWorkletOptions<RnnoiseProcessorOptions>
