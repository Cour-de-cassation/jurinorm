import { Category, LabelTreatments, UnIdentifiedDecision } from 'dbsder-api-types'
import { NerParameters, NerResponse, postNer } from './ner'

export type AnnotationResult = {
  treatments: LabelTreatments
  newCategoriesToOmit?: Category[]
  additionalTermsToAnnotate?: string[]
  additionalTermsToUnAnnotate?: string[]
}

export async function annotateDecision(decision: UnIdentifiedDecision): Promise<AnnotationResult> {
  const nerParameters: NerParameters = {
    sourceId: decision.sourceId,
    sourceName: decision.sourceName,
    parties: decision.parties,
    text: decision.originalText,
    categories: computeCategories(decision.occultation.categoriesToOmit),
    additionalTerms: decision.occultation.additionalTerms
  }

  const nerResult = await postNer(nerParameters)

  console.log(`nerResult: ${JSON.stringify(nerResult)}`)

  const result: AnnotationResult = {
    treatments: [
      {
        annotations: nerResult.entities,
        source: 'NLP',
        order: 1,
        checklist: nerResult.checklist,
        version: nerResult.versions,
        treatmentDate: new Date().toISOString()
      }
    ]
  }

  if (nerResult.newCategoriesToAnnotate || nerResult.newCategoriesToUnAnnotate) {
    result.newCategoriesToOmit = computeNewCategoriesToOmit(
      decision.occultation.categoriesToOmit,
      nerResult.newCategoriesToAnnotate,
      nerResult.newCategoriesToUnAnnotate
    )
  }

  if (
    nerResult.additionalTermsToAnnotate?.length ||
    nerResult.additionalTermsToUnAnnotate?.length
  ) {
    result.additionalTermsToAnnotate = nerResult.additionalTermsToAnnotate
    result.additionalTermsToUnAnnotate = nerResult.additionalTermsToUnAnnotate
  }
  return result
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
