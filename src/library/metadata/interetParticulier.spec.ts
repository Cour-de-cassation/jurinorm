import { RaisonInteretParticulier } from 'dbsder-api-types'
import { computeInteretParticulier, extractCodeFromSommaire } from './interetParticulier'

describe('computeInteretParticulier', () => {
  it('returns false when selection is false', () => {
    // WHEN
    const result = computeInteretParticulier(false, 'S4 - Valid code')

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when selection is true and sommaire is undefined', () => {
    // WHEN
    const result = computeInteretParticulier(true, undefined)

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when selection is true and sommaire has invalid code', () => {
    // WHEN
    const result = computeInteretParticulier(true, 'S9999')

    // THEN
    expect(result.interetParticulier).toBe(false)
    expect(result.raisonInteretParticulier).toBeUndefined()
  })

  it('returns false when selection is true and sommaire has invalid code with correct pattern', () => {
    // WHEN
    const result = computeInteretParticulier(true, 'Z9')

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

  it('returns true with correct raison when sommaire has valid code in uppercase', () => {
    // WHEN
    const result = computeInteretParticulier(true, "S4 - Sujet d'intérêt public majeur")

    // THEN
    expect(result.interetParticulier).toBe(true)
    expect(result.raisonInteretParticulier).toEqual(
      RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR
    )
  })
})

describe('extractCodeFromSommaire', () => {
  it('returns null when code has multiple digits', () => {
    // WHEN
    const code = extractCodeFromSommaire('S49')

    // THEN
    expect(code).toBeNull()
  })

  it('returns null when code has multiple letters', () => {
    // WHEN
    const code = extractCodeFromSommaire('SS4 - Invalid')

    // THEN
    expect(code).toBeNull()
  })

  it('returns null when code starts with digit', () => {
    // WHEN
    const code = extractCodeFromSommaire('4S - Invalid')

    // THEN
    expect(code).toBeNull()
  })

  it('returns null when sommaire is empty', () => {
    // WHEN
    const code = extractCodeFromSommaire('')

    // THEN
    expect(code).toBeNull()
  })

  it('returns null when sommaire is too short', () => {
    // WHEN
    const code = extractCodeFromSommaire('S')

    // THEN
    expect(code).toBeNull()
  })

  it('accepts lowercase code and returns it as is', () => {
    // WHEN
    const code = extractCodeFromSommaire('s4 - lowercase code')

    // THEN
    expect(code).toBe('s4')
  })

  it('handles leading and trailing whitespaces', () => {
    // WHEN
    const code = extractCodeFromSommaire('  F3  - test  ')

    // THEN
    expect(code).toBe('F3')
  })

  it('extracts valid code with description', () => {
    // WHEN
    const code = extractCodeFromSommaire("S4 - Sujet d'intérêt public majeur")

    // THEN
    expect(code).toBe('S4')
  })

  it('extracts valid code without description', () => {
    // WHEN
    const code = extractCodeFromSommaire('F1')

    // THEN
    expect(code).toBe('F1')
  })
})
