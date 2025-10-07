import axios from 'axios'
import { Category, UnIdentifiedDecision, Entity, Check, NLPVersion } from 'dbsder-api-types'
import { UnexpectedError } from '../error'

type NerResponse = {
  entities: Entity[]
  checklist: Check[]
  versions: NLPVersion
  newCategoriesToAnnotate?: Category[]
  newCategoriesToUnAnnotate?: Category[]
  additionalTermsToAnnotate?: string[]
  additionalTermsToUnAnnotate?: string[]
  additionalTermsParsingFailed?: boolean
}

type NerParameters = {
  sourceId: UnIdentifiedDecision['sourceId']
  sourceName: UnIdentifiedDecision['sourceName']
  parties: UnIdentifiedDecision['parties']
  text: UnIdentifiedDecision['originalText']
  categories: Category[]
  additionalTerms: UnIdentifiedDecision['occultation']['additionalTerms']
}

async function postNer(parameters: NerParameters): Promise<NerResponse> {
  const route = `${process.env.NLP_PSEUDONYMISATION_API_URL}/ner`
  const data = {
    sourceId: parameters.sourceId,
    sourceName: parameters.sourceName,
    parties: parameters.parties,
    text: parameters.text,
    categories: parameters.categories,
    additionalTerms: parameters.additionalTerms
  }
  try {
    const response = await axios.post<NerResponse>(route, data)
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(
        `Call POST - ${route} response with code ${err.response.status}: ${err.response.data.message}`
      )
    }
    throw err
  }
}

export async function fetchResultFromNer(decision: UnIdentifiedDecision): Promise<NerResponse> {
  const nerParameters: NerParameters = {
    sourceId: decision.sourceId,
    sourceName: decision.sourceName,
    parties: decision.parties,
    text: decision.originalText,
    categories: computeCategories(decision.occultation.categoriesToOmit),
    additionalTerms: decision.occultation.additionalTerms
  }

  return await postNer(nerParameters)
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
