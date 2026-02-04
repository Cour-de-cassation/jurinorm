import { RaisonInteretParticulier } from 'dbsder-api-types'
import {
  computeRaisonInteretParticulier,
  extractCodeFromSommaire
} from './raisonInteretParticulier'

describe('computeRaisonInteretParticulier', () => {
  it('returns false when selection is false', () => {
    // WHEN
    const raisonInteretParticulier = computeRaisonInteretParticulier(false, 'S4 - sommaire avec un code valide')

    // THEN
    expect(raisonInteretParticulier).toBeNull()
  })

  it('returns false when selection is true and sommaire is undefined', () => {
    // WHEN
    const raisonInteretParticulier = computeRaisonInteretParticulier(true, undefined)

    // THEN
    expect(raisonInteretParticulier).toBeNull()
  })

  it('returns false when selection is true and sommaire has invalid code', () => {
    // WHEN
    const raisonInteretParticulier = computeRaisonInteretParticulier(true, 'S9999')

    // THEN
    expect(raisonInteretParticulier).toBeNull()
  })

  it('returns false when selection is true and sommaire has invalid code with correct pattern', () => {
    // WHEN
    const raisonInteretParticulier = computeRaisonInteretParticulier(true, 'Z9')

    // THEN
    expect(raisonInteretParticulier).toBeNull()
  })

  it.only('returns null when sommaire contains C0 (reserved for Cour de cassation)', () => {
    // WHEN
    const raisonInteretParticulier = computeRaisonInteretParticulier(true, 'C0 - sommaire avec le code interdit')

    // THEN
    expect(raisonInteretParticulier).toBeNull()
  })

  it('returns true with correct raison when sommaire has valid code in lowercase', () => {
    // WHEN
    const raisonInteretParticulier = computeRaisonInteretParticulier(true, 's4')

    // THEN
    expect(raisonInteretParticulier).toEqual(
      RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR
    )
  })

  it('returns true with correct raison when sommaire has valid code in uppercase', () => {
    // WHEN
    const raisonInteretParticulier = computeRaisonInteretParticulier(
      true,
      "S4 - Sujet d'intérêt public majeur"
    )

    // THEN
    expect(raisonInteretParticulier).toEqual(
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
    const code = extractCodeFromSommaire('s4 - code en minuscule')

    // THEN
    expect(code).toBe('s4')
  })

  it('handles leading and trailing whitespaces', () => {
    // WHEN
    const code = extractCodeFromSommaire('  F3  - sommaire avec des espaces  ')

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
