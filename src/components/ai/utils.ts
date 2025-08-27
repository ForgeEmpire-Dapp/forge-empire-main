import { logger } from '@/utils/logger'

export const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  const uint8Array = new Uint8Array(int16Array.buffer)
  let binary = ''
  const chunkSize = 0x8000
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length))
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  
  return btoa(binary)
}

export const createWavFromPCM = (pcmData: Uint8Array): Uint8Array => {
  logger.debug("Creating WAV from PCM data", { length: pcmData.length })
  
  // Convert bytes to 16-bit samples (little-endian)
  const int16Data = new Int16Array(pcmData.length / 2)
  for (let i = 0; i < pcmData.length; i += 2) {
    int16Data[i / 2] = pcmData[i] | (pcmData[i + 1] << 8)
  }
  
  // Create WAV header
  const wavHeader = new ArrayBuffer(44)
  const view = new DataView(wavHeader)
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // WAV header parameters
  const sampleRate = 24000
  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign

  // Write WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + int16Data.byteLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // AudioFormat (PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, int16Data.byteLength, true)

  // Combine header and data
  const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength)
  wavArray.set(new Uint8Array(wavHeader), 0)
  wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength)
  
  logger.debug("WAV created", { totalLength: wavArray.length })
  return wavArray
}
