import { normalizeCa } from './handler'
import { computeRaisonInteretParticulier } from '../library/metadata/raisonInteretParticulier'
import { saveDecisionInAffaire } from '../services/affaire'
import { RaisonInteretParticulier } from 'dbsder-api-types'

jest.mock('../library/metadata/raisonInteretParticulier', () => ({
  computeRaisonInteretParticulier: jest.fn()
}))
jest.mock('../connectors/DbRawFile', () => ({
  findFileInformations: jest
    .fn()
    .mockResolvedValue({ toArray: async () => [], next: async () => null })
}))
jest.mock('../services/affaire', () => ({
  saveDecisionInAffaire: jest.fn().mockResolvedValue({})
}))

describe('normalizeCa – caDecision content', () => {
  const rawCa: any = {
    _id: 'raw1',
    metadatas: {
      selection: true,
      sommaire: 'S4 - ...'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('merges metadata with raisonInteretParticulier when true', async () => {
    ;(computeRaisonInteretParticulier as jest.Mock).mockReturnValue(
      RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR
    )

    await normalizeCa(rawCa)

    expect(saveDecisionInAffaire).toHaveBeenCalledWith(
      expect.objectContaining({
        raisonInteretParticulier: RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR
      })
    )
  })

  it('merges metadata with raisonInteretParticulier when false', async () => {
    ;(computeRaisonInteretParticulier as jest.Mock).mockReturnValue(null)

    await normalizeCa(rawCa)

    expect(saveDecisionInAffaire).toHaveBeenCalledWith(
      expect.objectContaining({
        raisonInteretParticulier: null
      })
    )
  })
})
