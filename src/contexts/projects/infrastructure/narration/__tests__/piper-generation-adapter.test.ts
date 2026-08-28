import { describe, expect, it } from 'vitest'
import { PiperGenerationAdapter } from '../piper-generation-adapter'

describe('PiperGenerationAdapter guards', () => {
  it('rejects empty text before spawning Piper', async () => {
    const adapter = new PiperGenerationAdapter('C:/project', 'C:/missing/piper.exe', [])
    await expect(adapter.generate({ texte: '   ', voixId: 'fr_FR-siwis-medium' })).rejects.toThrow('EMPTY_TEXT')
  })

  it('returns PIPER_NOT_FOUND when the executable is absent', async () => {
    const adapter = new PiperGenerationAdapter('C:/project', 'C:/definitely-missing/piper.exe', [
      { voiceId: 'fr_FR-siwis-medium', modelPath: 'C:/missing/model.onnx' }
    ])
    await expect(adapter.generate({ texte: 'Bonjour', voixId: 'fr_FR-siwis-medium' })).rejects.toThrow('PIPER_NOT_FOUND')
  })
})
