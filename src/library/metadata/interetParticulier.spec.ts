import { RaisonInteretParticulier } from 'dbsder-api-types'
import { computeInteretParticulier } from './interetParticulier'

describe('computeInteretParticulier', () => {
  it('returns false when selection is false', () => {
    // WHEN
    const result = computeInteretParticulier(false, 'S4 - Valid code')

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when selection is undefined', () => {
    // WHEN
    const result = computeInteretParticulier(undefined, 'S4 - Valid code')

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when sommaire is empty', () => {
    // WHEN
    const result = computeInteretParticulier(true, '')

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when sommaire is undefined', () => {
    // WHEN
    const result = computeInteretParticulier(true, undefined)

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when sommaire has less than 2 characters', () => {
    // WHEN
    const result = computeInteretParticulier(true, 'S')

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when selection is true and sommaire has invalid code', () => {
    // WHEN
    const result = computeInteretParticulier(true, 'ZZ99')

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns true with correct raison when sommaire has valid code in lowercase', () => {
    // WHEN
    const result = computeInteretParticulier(true, 's4')

    // THEN
    expect(result.interetParticulier).toBe(true)
    expect(result.raisonInteretParticulier).toEqual(
      RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR
    )
  })

  it('returns true with correct raison when sommaire has valid code with whitespaces', () => {
    // WHEN
    const result = computeInteretParticulier(true, '  F3  - Test with whitespaces   ')

    // THEN
    expect(result.interetParticulier).toBe(true)
    expect(result.raisonInteretParticulier).toEqual(
      RaisonInteretParticulier.F3_SAISINE_TRIBUNAL_CONFLITS
    )
  })
})
