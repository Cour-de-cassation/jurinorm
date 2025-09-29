import * as dotenv from 'dotenv'
dotenv.config()

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

import { CollectDto } from '../shared/infrastructure/dto/collect.dto'

import {
  OccultationComplementaireDto,
  MetadonneeDto
} from '../shared/infrastructure/dto/metadonnee.dto'

import { DecisionTcom, Category, LabelStatus, UnIdentifiedDecisionTcom } from 'dbsder-api-types'
import { DbSderApiGateway } from '../batch/normalization/repositories/gateways/dbsderApi.gateway'

const dbSderApiGateway = new DbSderApiGateway()

async function main(jurisdiction: string) {
  if (!jurisdiction) {
    throw new Error(
      'Usage: reprocessWrongOccultation.js <jurisdiction>\nThis script re-computes the occultations data of all the collected decisions for the given jurisdiction:\nreprocessWrongOccultation.js 7501 --> reprocess all collected decisions from Paris\nreprocessWrongOccultation.js * or reprocessWrongOccultation all --> reprocess all collected decisions'
    )
    throw new Error('Usage : <script> jurisdiction')
  }

  const decisions = await dbSderApiGateway.listDecisions('ignored_controleRequis')
  let decision = await decisions.next()
  let doneCount = 0

  while (decision) {
    try {
      if (
        /ignored/i.test(decision.labelStatus) === false &&
        /blocked/i.test(decision.labelStatus) === false
      ) {
        const done = await reprocessDecision(decision)
        if (done) {
          console.log(`Reprocess ${decision._id}`)
          doneCount++
        }
      }
    } catch (e) {
      console.log(`Skip ${decision._id}: error`, e)
    }

    decision = await decisions.next()
  }

  console.log(`Reprocessed ${doneCount} decisions`)
}

async function reprocessDecision(
  decision: Omit<DecisionTcom, '_id'> & { _id: string }
): Promise<boolean> {
  const s3Client = new S3Client({
    endpoint: process.env.S3_URL,
    forcePathStyle: true,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  })
  const reqParams = {
    Bucket: process.env.S3_BUCKET_NAME_NORMALIZED,
    Key: decision.filenameSource
  }
  try {
    const decisionFromS3 = await s3Client.send(new GetObjectCommand(reqParams))
    const stringifiedDecision = await decisionFromS3.Body?.transformToString()
    const objectDecision: CollectDto = JSON.parse(stringifiedDecision)
    if (
      objectDecision &&
      objectDecision.metadonnees &&
      `${objectDecision.metadonnees.idDecision}.json` === decision.filenameSource
    ) {
      const oldOccultation = JSON.stringify(decision.occultation.categoriesToOmit)
      const newOccultation = computeOccultation(objectDecision.metadonnees)
      decision.occultation.additionalTerms = newOccultation.additionalTerms
      decision.occultation.categoriesToOmit = newOccultation.categoriesToOmit
      decision.occultation.motivationOccultation = newOccultation.motivationOccultation
      decision.labelStatus = LabelStatus.TOBETREATED
      delete decision._id
      console.log(
        `OLD: ${oldOccultation} --> NEW: ${JSON.stringify(decision.occultation.categoriesToOmit)}`
      )
      await dbSderApiGateway.saveDecision(decision)
      return true
    } else {
      throw new Error('Decision incomplete or ID mismatch')
    }
  } catch (error) {
    console.log(error.message)
    return false
  }
}

function isNonEmptyString(str: string | undefined): str is string {
  return typeof str === 'string' && str.trim() !== ''
}

function occultationsDataAreEmpty(
  occultationsComplementaires: OccultationComplementaireDto
): boolean {
  if (occultationsComplementaires.personneMorale === true) {
    return false
  }
  if (occultationsComplementaires.personnePhysicoMoraleGeoMorale === true) {
    return false
  }
  if (occultationsComplementaires.adresse === true) {
    return false
  }
  if (occultationsComplementaires.dateCivile === true) {
    return false
  }
  if (occultationsComplementaires.plaqueImmatriculation === true) {
    return false
  }
  if (occultationsComplementaires.cadastre === true) {
    return false
  }
  if (occultationsComplementaires.chaineNumeroIdentifiante === true) {
    return false
  }
  if (occultationsComplementaires.coordonneeElectronique === true) {
    return false
  }
  if (occultationsComplementaires.professionnelMagistratGreffier === true) {
    return false
  }
  if (occultationsComplementaires.motifsDebatsChambreConseil === true) {
    return false
  }
  if (occultationsComplementaires.motifsSecretAffaires === true) {
    return false
  }
  if (
    occultationsComplementaires.conserverElement &&
    isNonEmptyString(occultationsComplementaires.conserverElement)
  ) {
    return false
  }
  if (
    occultationsComplementaires.supprimerElement &&
    isNonEmptyString(occultationsComplementaires.supprimerElement)
  ) {
    return false
  }
  return true
}

function computeOccultation(metadonnees: MetadonneeDto): UnIdentifiedDecisionTcom['occultation'] {
  const occultationsComplementaires: OccultationComplementaireDto =
    metadonnees.occultationsComplementaires

  if (occultationsDataAreEmpty(occultationsComplementaires)) {
    console.warn({
      msg: `Empty occultations form received, applying the default "bloc 3" signature`
    })

    return {
      additionalTerms: '',
      categoriesToOmit: [
        Category.PERSONNEMORALE,
        Category.NUMEROSIRETSIREN,
        Category.PROFESSIONNELMAGISTRATGREFFIER
      ],
      motivationOccultation: false
    }
  } else {
    const categoriesToOmitRaw = []
    const additionalTermsRaw = []
    const motivationOccultation =
      occultationsComplementaires.motifsDebatsChambreConseil === true ||
      occultationsComplementaires.motifsSecretAffaires === true

    console.info({
      msg: `motivationOccultation computed ${motivationOccultation}`
    })

    if (occultationsComplementaires.personneMorale !== true) {
      categoriesToOmitRaw.push(Category.PERSONNEMORALE)
      categoriesToOmitRaw.push(Category.NUMEROSIRETSIREN)
    }

    if (occultationsComplementaires.personnePhysicoMoraleGeoMorale !== true) {
      categoriesToOmitRaw.push(Category.PERSONNEMORALE)
      categoriesToOmitRaw.push(Category.LOCALITE)
      categoriesToOmitRaw.push(Category.NUMEROSIRETSIREN)
    }

    if (occultationsComplementaires.adresse !== true) {
      categoriesToOmitRaw.push(Category.ADRESSE)
      categoriesToOmitRaw.push(Category.LOCALITE)
      categoriesToOmitRaw.push(Category.ETABLISSEMENT)
    }

    if (occultationsComplementaires.dateCivile !== true) {
      categoriesToOmitRaw.push(Category.DATENAISSANCE)
      categoriesToOmitRaw.push(Category.DATEDECES)
      categoriesToOmitRaw.push(Category.DATEMARIAGE)
    }

    if (occultationsComplementaires.plaqueImmatriculation !== true) {
      categoriesToOmitRaw.push(Category.PLAQUEIMMATRICULATION)
    }

    if (occultationsComplementaires.cadastre !== true) {
      categoriesToOmitRaw.push(Category.CADASTRE)
    }

    if (occultationsComplementaires.chaineNumeroIdentifiante !== true) {
      categoriesToOmitRaw.push(Category.INSEE)
      categoriesToOmitRaw.push(Category.NUMEROIDENTIFIANT)
      categoriesToOmitRaw.push(Category.COMPTEBANCAIRE)
      categoriesToOmitRaw.push(Category.PLAQUEIMMATRICULATION)
    }

    if (occultationsComplementaires.coordonneeElectronique !== true) {
      categoriesToOmitRaw.push(Category.SITEWEBSENSIBLE)
      categoriesToOmitRaw.push(Category.TELEPHONEFAX)
    }

    if (occultationsComplementaires.professionnelMagistratGreffier !== true) {
      categoriesToOmitRaw.push(Category.PROFESSIONNELMAGISTRATGREFFIER)
    }

    const categoriesToOmit = categoriesToOmitRaw.filter(
      (value, index, array) => array.indexOf(value) === index
    )

    console.info({
      msg: `categoriesToOmit computed ${categoriesToOmit}`
    })

    if (occultationsComplementaires.conserverElement) {
      for (let item of `${occultationsComplementaires.conserverElement}`.split('|')) {
        item = item.trim()
        if (item !== '') {
          additionalTermsRaw.push(`+${item}`)
        }
      }
    }

    if (occultationsComplementaires.supprimerElement) {
      for (let item of `${occultationsComplementaires.supprimerElement}`.split('|')) {
        item = item.trim()
        if (item !== '') {
          additionalTermsRaw.push(item)
        }
      }
    }

    const additionalTerms = additionalTermsRaw
      .filter((value, index, array) => array.indexOf(value) === index)
      .join('|')

    console.info({
      msg: `additionalTerms computed ${additionalTerms}`
    })

    return {
      additionalTerms,
      categoriesToOmit,
      motivationOccultation
    }
  }
}

main(process.argv[2])
