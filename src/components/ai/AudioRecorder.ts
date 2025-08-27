import { logger } from '@/utils/logger'

export class AudioRecorder {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    logger.debug("Starting audio recorder")
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      this.audioContext = new AudioContext({
        sampleRate: 24000,
      })

      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        this.onAudioData(new Float32Array(inputData))
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      
      logger.debug("Audio recorder started successfully")
    } catch (error) {
      logger.error('Error accessing microphone', { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  stop() {
    logger.debug("Stopping audio recorder")
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}
