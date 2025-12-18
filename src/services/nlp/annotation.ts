import {
  Category,
  Entity,
  hasSourceNameTcom,
  hasSourceNameTj,
  LabelTreatments,
  UnIdentifiedDecision,
  UnIdentifiedDecisionDila,
  ZoneRange
} from 'dbsder-api-types'
import { NerParameters, NerResponse, postNer } from './ner'
import { isCurrentZoning, parseCurrentZoning } from 'dbsder-api-types/dist/typeGuards/common.zod'
import { NotSupported, toNotSupported } from '../error'
import { logger } from '../../connectors/logger'

export type AnnotationResult = {
  treatments: LabelTreatments
  newCategoriesToOmit?: Category[]
  additionalTermsToAnnotate?: string[]
  additionalTermsToUnAnnotate?: string[]
}

export async function annotateDecision<
  T extends Exclude<UnIdentifiedDecision, UnIdentifiedDecisionDila>
>(decision: T): Promise<T> {
  const nerParameters: NerParameters = {
    sourceId: decision.sourceId,
    sourceName: decision.sourceName,
    parties: decision.parties,
    text: decision.originalText,
    categories: computeCategories(decision.occultation.categoriesToOmit),
    additionalTerms: decision.occultation.additionalTerms
  }

  const annotatedDecision = decision

  logger.info({
    path: 'src/library/annotation.ts',
    operations: ['other', 'annotation'],
    message: `Sending ${decision.sourceName} ${decision.sourceId} to /ner endpoint`
  })

  const nerResult = await postNer(nerParameters)

  annotatedDecision.labelTreatments = [
    {
      annotations: nerResult.entities,
      source: 'NLP',
      order: 1,
      checklist: nerResult.checklist,
      version: nerResult.versions,
      treatmentDate: new Date().toISOString()
    }
  ]

  if (nerResult.newCategoriesToAnnotate || nerResult.newCategoriesToUnAnnotate) {
    annotatedDecision.occultation.categoriesToOmit = computeNewCategoriesToOmit(
      decision.occultation.categoriesToOmit,
      nerResult.newCategoriesToAnnotate,
      nerResult.newCategoriesToUnAnnotate
    )
  }

  if (
    nerResult.additionalTermsToAnnotate?.length ||
    nerResult.additionalTermsToUnAnnotate?.length
  ) {
    annotatedDecision.occultation.additionalTermsToAnnotate = nerResult.additionalTermsToAnnotate
    annotatedDecision.occultation.additionalTermsToUnAnnotate =
      nerResult.additionalTermsToUnAnnotate
  }

  if (
    (hasSourceNameTj(decision) || hasSourceNameTcom(decision)) &&
    decision.occultation.motivationOccultation
  ) {
    try {
      // parse to have zod error, typeguard to ensure type
      parseCurrentZoning(decision.originalTextZoning)
      if (isCurrentZoning(decision.originalTextZoning)) {
        const motivation = decision.originalTextZoning.zones.motivations
        const exposeDuLitige = decision.originalTextZoning.zones['expose du litige']

        if ((motivation || exposeDuLitige) && motivation.length <= 1) {
          const motifsAnnotations: Entity[] = []

          if (motivation) {
            const annotation = extractZoneEntity(motivation[0], decision.originalText, 'motivation')
            if (annotation) {
              motifsAnnotations.push(annotation)
            }
          }

          if (exposeDuLitige) {
            const annotation = extractZoneEntity(
              exposeDuLitige,
              decision.originalText,
              'exposeDuLitige'
            )
            if (annotation) {
              motifsAnnotations.push(annotation)
            }
          }

          annotatedDecision.labelTreatments = [
            ...annotatedDecision.labelTreatments,
            {
              order: 2,
              source: 'supplementaryAnnotations',
              annotations: removeOverlappingEntities([...nerResult.entities, ...motifsAnnotations]),
              treatmentDate: new Date().toISOString()
            }
          ]
        } else {
          throw new Error(
            'Cannot annotate motifs with multiple motivations/expose du litige zones or without zones'
          )
        }
      } else {
        throw new NotSupported('originalTextZoning', decision.originalTextZoning)
      }
    } catch (err) {
      throw toNotSupported('originalTextZoning', decision.originalTextZoning, err)
    }
  }

  return annotatedDecision
}

function computeCategories(categoriesToOmit: Category[]): Category[] {
  const currentCategories = [
    Category.PERSONNEPHYSIQUE,
    Category.DATENAISSANCE,
    Category.DATEMARIAGE,
    Category.DATEDECES,
    Category.NUMEROIDENTIFIANT,
    Category.PERSONNEMORALE,
    Category.ETABLISSEMENT,
    Category.NUMEROSIRETSIREN,
    Category.ADRESSE,
    Category.LOCALITE,
    Category.TELEPHONEFAX,
    Category.EMAIL,
    Category.SITEWEBSENSIBLE,
    Category.COMPTEBANCAIRE,
    Category.CADASTRE,
    Category.PLAQUEIMMATRICULATION
  ]
  const toBeAnnotatedCategories = Object.values(currentCategories).filter(
    (category) => !categoriesToOmit.includes(category)
  )
  toBeAnnotatedCategories.push(Category.PROFESSIONNELMAGISTRATGREFFIER)
  toBeAnnotatedCategories.push(Category.PROFESSIONNELAVOCAT)

  return toBeAnnotatedCategories
}

function computeNewCategoriesToOmit(
  originalCategoriesToOmit: Category[],
  newCategoriesToAnnotate: NerResponse['newCategoriesToAnnotate'],
  newCategoriesToUnAnnotate: NerResponse['newCategoriesToUnAnnotate']
): Category[] | undefined {
  if (!newCategoriesToAnnotate && !newCategoriesToUnAnnotate) {
    return undefined
  }

  let newCategoriesToOmit = [...originalCategoriesToOmit]

  if (newCategoriesToUnAnnotate?.length) {
    newCategoriesToOmit = Array.from(new Set(newCategoriesToOmit.concat(newCategoriesToUnAnnotate)))
  }

  if (newCategoriesToAnnotate?.length) {
    newCategoriesToOmit = newCategoriesToOmit.filter(
      (category) => !newCategoriesToAnnotate.includes(category)
    )
  }

  return newCategoriesToOmit
}

function extractZoneEntity(range: ZoneRange, originalText: string, source: string): Entity | null {
  const rawZoneText = originalText.substring(range.start, range.end)
  const trimmedStart = rawZoneText.replace(/^[\s\r\n]+/, '')
  const removedCharactersAtStart = rawZoneText.length - trimmedStart.length
  const finalTrimmedText = trimmedStart.replace(/[\s\r\n]+$/, '')

  if (!finalTrimmedText) return null

  return {
    category: Category.MOTIVATIONS,
    score: 1,
    entityId: `${Category.MOTIVATIONS}_${finalTrimmedText.length}`,
    source,
    text: finalTrimmedText,
    start: range.start + removedCharactersAtStart,
    end: range.start + removedCharactersAtStart + finalTrimmedText.length
  }
}

function removeOverlappingEntities(entities: Entity[]): Entity[] {
  const sortedEntities = entities.sort((entityA, entityB) => entityA.start - entityB.start)
  const cleanedEntities = []
  cleanedEntities.push(sortedEntities[0])
  for (let i = 1, l = sortedEntities.length; i < l; i++) {
    const entityA = cleanedEntities[cleanedEntities.length - 1]
    const entityB = sortedEntities[i]
    if (areOverlapping(entityA, entityB)) {
      if (entityA.text.length < entityB.text.length) {
        cleanedEntities.pop()
        cleanedEntities.push(entityB)
      }
    } else {
      cleanedEntities.push(entityB)
    }
  }
  return cleanedEntities
}

function areOverlapping(entity1: Entity, entity2: Entity) {
  const startA = entity1.start
  const endA = entity1.start + entity1.text.length
  const startB = entity2.start
  const endB = entity2.start + entity2.text.length

  return (
    (startA < startB && endA > startB) ||
    (startA <= startB && endA >= endB) ||
    (startB < startA && endB > startA) ||
    (startB <= startA && endB >= endA)
  )
}
