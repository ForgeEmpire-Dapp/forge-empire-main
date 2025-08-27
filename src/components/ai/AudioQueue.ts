import { logger } from '@/utils/logger'
import { createWavFromPCM } from './utils'

export class AudioQueue {
  private queue: Uint8Array[] = []
  private isPlaying = false
  private audioContext: AudioContext

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  async addToQueue(audioData: Uint8Array) {
    logger.debug("Adding audio to queue", { length: audioData.length })
    this.queue.push(audioData)
    if (!this.isPlaying) {
      await this.playNext()
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false
      logger.debug("Audio queue empty")
      return
    }

    this.isPlaying = true
    const audioData = this.queue.shift()!
    logger.debug("Playing next audio chunk", { length: audioData.length })

    try {
      const wavData = createWavFromPCM(audioData)
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer)
      
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      
      source.onended = () => {
        logger.debug("Audio chunk finished playing")
        this.playNext()
      }
      source.start(0)
    } catch (error) {
      logger.error('Error playing audio', { error: error instanceof Error ? error.message : 'Unknown error' })
      this.playNext() // Continue with next segment even if current fails
    }
  }
}
