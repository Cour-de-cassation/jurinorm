import { v4 as uuidv4 } from 'uuid'
import { removeOrReplaceUnnecessaryCharacters } from './services/removeOrReplaceUnnecessaryCharacters'
import { ConvertedDecisionWithMetadonneesDto } from '../../shared/infrastructure/dto/convertedDecisionWithMetadonnees.dto'
import { fetchDecisionListFromS3 } from './services/fetchDecisionListFromS3'
import { DecisionS3Repository } from '../../shared/infrastructure/repositories/decisionS3.repository'
import { mapDecisionNormaliseeToDecisionDto } from './infrastructure/decision.dto'
import { computeLabelStatus } from './services/computeLabelStatus'
import { computeOccultation } from './services/computeOccultation'
import { DbSderApiGateway } from './repositories/gateways/dbsderApi.gateway'
import {
  fetchPDFFromS3,
  fetchNLPDataFromPDF,
  HTMLToPlainText,
  markdownToPlainText,
  NLPPDFToTextDTO,
  isEmptyText,
  hasNoBreak
} from './services/PDFToText'
import { PostponeException } from './infrastructure/nlp.exception'
import { LabelStatus, PublishStatus, UnIdentifiedDecisionTcom } from 'dbsder-api-types'
import { logger } from '../../../../config/logger'

import { strict as assert } from 'assert'
import { computeCategories } from '../../../../services/rules/annotation'
import { saveDecisionInAffaire } from '../../../../services/affaire'
import { ZoningApiService } from './services/zoningApi.service'
import { publishToNlpNer, publishToNlpPdf } from '../../../../connectors/nlpQueues'
import { CollectDto } from '../../shared/infrastructure/dto/collect.dto'

const dbSderApiGateway = new DbSderApiGateway()

interface Diff {
  major: Array<string>
  minor: Array<string>
}

export async function normalizationJob(
  limit?: number
): Promise<ConvertedDecisionWithMetadonneesDto[]> {
  logger.info({
    operations: ['normalization', `normalizationJob-TCOM`],
    path: 'src/tcom/batch/normalization/normalization.ts',
    message: 'Starting TCOM normalization'
  })


  const s3Repository = new DecisionS3Repository()
  const zoningApiService: ZoningApiService = new ZoningApiService()

  const listConvertedDecision: ConvertedDecisionWithMetadonneesDto[] = []
  const decisionList = (await fetchDecisionListFromS3(s3Repository, limit)).filter((name) =>
    name.endsWith('.json')
  )

  for (const decisionFilename of decisionList) {
    try {
      const jobId = uuidv4()

      const decision = await s3Repository.getDecisionByFilename(decisionFilename, process.env.S3_BUCKET_NAME_RAW_TCOM)
      if (process.env.PLAINTEXT_SOURCE === 'nlp') {
        // Send PDF to NLP API to extract text and metadata
        const pdfFilename = decisionFilename.replace(/\.json$/, '.pdf')
        await fetchPDFFromS3(s3Repository, pdfFilename)
        await publishToNlpPdf(pdfFilename, decisionFilename, jobId)

        // Move decision JSON file to pending bucket
        await s3Repository.moveRawToPending(
          JSON.stringify(decision),
          decisionFilename
        )

        logger.info({
          operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
          path: 'src/tcom/batch/normalization/normalization.ts',
          message: 'Decision sent to NLP API and moved to pending bucket.'
        })

        continue
      }

      // If PLAINTEXT_SOURCE !== 'nlp' : use texteDecisionIntegre property
      if (
        !decision.texteDecisionIntegre ||
        isEmptyText(decision.texteDecisionIntegre) ||
        hasNoBreak(decision.texteDecisionIntegre)
      ) {
        throw new Error('Collected texteDecisionIntegre property is empty')
      }

      logger.info({
        operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
        path: 'src/tcom/batch/normalization/normalization.ts',
        message: 'Plain text from collected texteDecisionIntegre property'
      })

      const result = await normalizeDecision(decision, decisionFilename, jobId, s3Repository, zoningApiService)
      if (result) {
        listConvertedDecision.push(result)
      }
    } catch (error) {
      if (error.message && /nosuchkey/i.test(error.message)) {
        logger.error({
          operations: ['normalization', `normalizationJob-TCOM`],
          path: 'src/tcom/batch/normalization/normalization.ts',
          message: 'Decision has no PDF. Archiving decision to failed bucket',
          stack: error.stack
        })
        await s3Repository.archiveFailedDecision(decisionFilename)
        logger.error({
          operations: ['normalization', `normalizationJob-TCOM`],
          path: 'src/tcom/batch/normalization/normalization.ts',
          message: 'Failed to normalize the decision ' + decisionFilename + '.'
        })
      } else {
        logger.error({
          operations: ['normalization', `normalizationJob-TCOM`],
          path: 'src/tcom/batch/normalization/normalization.ts',
          message: error.message,
          stack: error.stack
        })
        await s3Repository.archiveFailedDecision(decisionFilename)
        logger.error({
          operations: ['normalization', `normalizationJob-TCOM`],
          path: 'src/tcom/batch/normalization/normalization.ts',
          message:
            'Failed to normalize the decision ' + decisionFilename + '. Archived to failed bucket.'
        })
        // To avoid too many request errors (as in Label):
        if (error instanceof PostponeException) {
          await new Promise((_) => setTimeout(_, 20 * 1000))
        } else {
          await new Promise((_) => setTimeout(_, 10 * 1000))
        }
      }
      continue
    }
  }

  if (listConvertedDecision.length == 0) {
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: 'No decision to normalize.'
    })
    return []
  }

  return listConvertedDecision
}

export async function normalizeDecision(
  decision: CollectDto,
  decisionFilename: string,
  jobId: string,
  s3Repository: DecisionS3Repository,
  zoningApiService: ZoningApiService,
  fromPendingBucket: boolean = false
): Promise<ConvertedDecisionWithMetadonneesDto | null> {
  // Step 3: Cloning decision to save it in normalized bucket
  const decisionFromS3Clone = JSON.parse(JSON.stringify(decision))

  logger.info({
    operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
    path: 'src/tcom/batch/normalization/normalization.ts',
    message: 'Starting normalization of ' + decisionFilename
  })

  // Step 4: Generating unique id for decision
  const _id = decision.metadonnees.idDecision

  logger.info({
    operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
    path: 'src/tcom/batch/normalization/normalization.ts',
    message: 'Generated unique id for decision'
  })

  // Step 5: Removing or replace (by other thing) unnecessary characters from decision
  const cleanedDecision = removeOrReplaceUnnecessaryCharacters(decision.texteDecisionIntegre)

  logger.info({
    operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
    path: 'src/tcom/batch/normalization/normalization.ts',
    message: 'Removed unnecessary characters'
  })

  // Step 6: Map decision to DBSDER API Type to save it in database
  const decisionToSave = mapDecisionNormaliseeToDecisionDto(
    _id,
    cleanedDecision,
    decision.metadonnees,
    decisionFilename
  )

  try {
    decisionToSave.originalTextZoning = await zoningApiService.getDecisionZoning(decisionToSave)
  } catch (error) {
    logger.error({
      operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `Error while calling zoning. Error : ${error}`
    })
  }

  decisionToSave.labelStatus = await computeLabelStatus(decisionToSave)
  decisionToSave.occultation = {
    additionalTerms: '',
    categoriesToOmit: [],
    motivationOccultation: false
  }
  decisionToSave.occultation = computeOccultation(decision.metadonnees)

  decisionToSave.publishStatus =
    decisionToSave.labelStatus !== LabelStatus.TOBETREATED
      ? PublishStatus.BLOCKED
      : PublishStatus.TOBEPUBLISHED

  // Step 7: check diff (major/minor) and upsert/patch accordingly
  const previousVersion = await dbSderApiGateway.getDecisionBySourceId(decisionToSave.sourceId)
  const diff = previousVersion ? computeDiff(previousVersion, decisionToSave) : null
  if (
    diff?.major?.length === 0 &&
    diff?.minor?.length > 0 &&
    previousVersion.labelStatus !== LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
  ) {
    // Patch decision with minor changes:
    delete decisionToSave.__v
    delete decisionToSave.sourceId
    delete decisionToSave.sourceName
    delete decisionToSave.public
    delete decisionToSave.debatPublic
    delete decisionToSave.occultation
    delete decisionToSave.originalText
    if (
      decisionToSave.labelStatus === LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE ||
      decisionToSave.labelStatus === LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE
    ) {
      decisionToSave.publishStatus = PublishStatus.BLOCKED
      // Bad new date? Throw a warning... @TODO ODDJDashboard
      logger.warn({
        operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
        path: 'src/tcom/batch/normalization/normalization.ts',
        message: `Decision has a bad updated date: ${decisionToSave.dateDecision}`
      })
    } else {
      if (previousVersion.labelStatus === LabelStatus.EXPORTED) {
        decisionToSave.labelStatus = LabelStatus.DONE
      } else {
        decisionToSave.labelStatus = previousVersion.labelStatus
      }
      if (
        previousVersion.publishStatus === PublishStatus.SUCCESS ||
        previousVersion.publishStatus === PublishStatus.UNPUBLISHED ||
        previousVersion.publishStatus === PublishStatus.FAILURE_PREPARING ||
        previousVersion.publishStatus === PublishStatus.FAILURE_INDEXING
      ) {
        decisionToSave.publishStatus = PublishStatus.TOBEPUBLISHED
      } else {
        decisionToSave.publishStatus = previousVersion.publishStatus
      }
    }
    await dbSderApiGateway.patchDecision(previousVersion._id, decisionToSave)
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `Decision patched in database with minor changes: ${JSON.stringify(diff.minor)}`
    })
  } else if (
    diff?.major?.length === 0 &&
    diff?.minor?.length === 0 &&
    previousVersion.labelStatus !== LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
  ) {
    // No change? Throw a warning and do nothing... @TODO ODDJDashboard
    logger.warn({
      operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: 'Decision has no change'
    })
  } else {
    // if (
    //   decisionToSave.labelStatus === LabelStatus.TOBETREATED ||
    //   decisionToSave.labelStatus === LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
    // ) {
      await publishToNlpNer({
        rawId: _id.toString(),
        decisionFilename,
        decision: decisionToSave,
        sourceId: decisionToSave.sourceId,
        sourceName: decisionToSave.sourceName,
        parties: decisionToSave.parties,
        text: decisionToSave.originalText,
        categories: computeCategories(decisionToSave.occultation.categoriesToOmit),
        additionalTerms: decisionToSave.occultation.additionalTerms
      })

    //   return null
    // } else {
    //   await saveDecisionInAffaire(decisionToSave)
    // }
  }

  // Step 8: Save decision in normalized bucket BEFORE publishing it to NLP
  // in case NLP fails, we have the normalized decision saved and we can retry to publish to NLP without having to redo the normalization
  await s3Repository.saveDecisionNormalisee(
    JSON.stringify(decisionFromS3Clone),
    decisionFilename
  )

  logger.info({
    operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
    path: 'src/tcom/batch/normalization/normalization.ts',
    message: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
  })

  // Step 9: Delete raw/pending decision
  const bucketToDeleteFrom = fromPendingBucket
    ? process.env.S3_BUCKET_NAME_PENDING_TCOM
    : process.env.S3_BUCKET_NAME_RAW_TCOM
  const reqParamsDelete = {
    Bucket: bucketToDeleteFrom,
    Key: decisionFilename
  }
  await s3Repository.deleteDecision(reqParamsDelete)

  logger.info({
    operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
    path: 'src/tcom/batch/normalization/normalization.ts',
    message: 'Successful normalization of ' + decisionFilename
  })

  return { metadonnees: decisionToSave, decisionNormalisee: cleanedDecision}
}

function computeDiff(
  oldDecision: UnIdentifiedDecisionTcom,
  newDecision: UnIdentifiedDecisionTcom
): Diff {
  const diff: Diff = {
    major: [],
    minor: []
  }

  // Major changes...
  // Note: we skip zoning diff, because the zoning should only change if the originalText changes (which is a major change anyway). If the zoning changes with the same given originalText, then the change comes from us, not from the sender
  if (newDecision.public !== oldDecision.public) {
    diff.major.push('public')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `major change to public: '${oldDecision.public}' -> '${newDecision.public}'`
    })
  }
  if (newDecision.debatPublic !== oldDecision.debatPublic) {
    diff.major.push('debatPublic')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `major change to debatPublic: '${oldDecision.debatPublic}' -> '${newDecision.debatPublic}'`
    })
  }
  if (newDecision.originalText !== oldDecision.originalText) {
    diff.major.push('originalText')
  }
  if (oldDecision.occultation.additionalTerms !== newDecision.occultation.additionalTerms) {
    diff.major.push('occultation.additionalTerms')
  }
  if (
    oldDecision.occultation.motivationOccultation !== newDecision.occultation.motivationOccultation
  ) {
    diff.major.push('occultation.motivationOccultation')
  }
  if (
    (!oldDecision.occultation.categoriesToOmit && newDecision.occultation.categoriesToOmit) ||
    (oldDecision.occultation.categoriesToOmit && !newDecision.occultation.categoriesToOmit)
  ) {
    diff.major.push('occultation.categoriesToOmit')
  } else if (oldDecision.occultation.categoriesToOmit && newDecision.occultation.categoriesToOmit) {
    if (
      oldDecision.occultation.categoriesToOmit.length !==
      newDecision.occultation.categoriesToOmit.length
    ) {
      diff.major.push('occultation.categoriesToOmit')
    } else {
      oldDecision.occultation.categoriesToOmit.sort()
      newDecision.occultation.categoriesToOmit.sort()
      if (
        JSON.stringify(oldDecision.occultation.categoriesToOmit) !==
        JSON.stringify(newDecision.occultation.categoriesToOmit)
      ) {
        diff.major.push('occultation.categoriesToOmit')
      }
    }
  }

  // Minor changes...
  if (newDecision.chamberId !== oldDecision.chamberId) {
    diff.minor.push('chamberId')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to chamberId: '${oldDecision.chamberId}' -> '${newDecision.chamberId}'`
    })
  }
  if (newDecision.chamberName !== oldDecision.chamberName) {
    diff.minor.push('chamberName')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to chamberName: '${oldDecision.chamberName}' -> '${newDecision.chamberName}'`
    })
  }
  if (newDecision.dateDecision !== oldDecision.dateDecision) {
    diff.minor.push('dateDecision')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to dateDecision: '${oldDecision.dateDecision}' -> '${newDecision.dateDecision}'`
    })
  }
  if (newDecision.jurisdictionCode !== oldDecision.jurisdictionCode) {
    diff.minor.push('jurisdictionCode')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to jurisdictionCode: '${oldDecision.jurisdictionCode}' -> '${newDecision.jurisdictionCode}'`
    })
  }
  if (newDecision.jurisdictionId !== oldDecision.jurisdictionId) {
    diff.minor.push('jurisdictionId')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to jurisdictionId: '${oldDecision.jurisdictionId}' -> '${newDecision.jurisdictionId}'`
    })
  }
  if (newDecision.jurisdictionName !== oldDecision.jurisdictionName) {
    diff.minor.push('jurisdictionName')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to jurisdictionName: '${oldDecision.jurisdictionName}' -> '${newDecision.jurisdictionName}'`
    })
  }
  if (newDecision.registerNumber !== oldDecision.registerNumber) {
    diff.minor.push('registerNumber')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to registerNumber: '${oldDecision.registerNumber}' -> '${newDecision.registerNumber}'`
    })
  }
  if (newDecision.solution !== oldDecision.solution) {
    diff.minor.push('solution')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to solution: '${oldDecision.solution}' -> '${newDecision.solution}'`
    })
  }
  if (newDecision.codeMatiereCivil !== oldDecision.codeMatiereCivil) {
    diff.minor.push('codeMatiereCivil')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to codeMatiereCivil: '${oldDecision.codeMatiereCivil}' -> '${newDecision.codeMatiereCivil}'`
    })
  }
  if (
    (!oldDecision.parties && newDecision.parties) ||
    (oldDecision.parties && !newDecision.parties)
  ) {
    diff.minor.push('parties')
  } else if (oldDecision.parties && newDecision.parties) {
    if (oldDecision.parties.length !== newDecision.parties.length) {
      diff.minor.push('parties')
    } else {
      try {
        assert.deepStrictEqual(oldDecision.parties, newDecision.parties)
      } catch (_) {
        diff.minor.push('parties')
      }
    }
  }
  if (newDecision.idGroupement !== oldDecision.idGroupement) {
    diff.minor.push('idGroupement')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to idGroupement: '${oldDecision.idGroupement}' -> '${newDecision.idGroupement}'`
    })
  }
  if (newDecision.codeProcedure !== oldDecision.codeProcedure) {
    diff.minor.push('codeProcedure')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to codeProcedure: '${oldDecision.codeProcedure}' -> '${newDecision.codeProcedure}'`
    })
  }
  if (newDecision.libelleMatiere !== oldDecision.libelleMatiere) {
    diff.minor.push('libelleMatiere')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to libelleMatiere: '${oldDecision.libelleMatiere}' -> '${newDecision.libelleMatiere}'`
    })
  }
  if (newDecision.selection !== oldDecision.selection) {
    diff.minor.push('selection')
    logger.info({
      operations: ['normalization', `normalizationJob-TCOM`],
      path: 'src/tcom/batch/normalization/normalization.ts',
      message: `minor change to selection: '${oldDecision.selection}' -> '${newDecision.selection}'`
    })
  }
  if (
    (!oldDecision.composition && newDecision.composition) ||
    (oldDecision.composition && !newDecision.composition)
  ) {
    diff.minor.push('composition')
  } else if (oldDecision.composition && newDecision.composition) {
    if (oldDecision.composition.length !== newDecision.composition.length) {
      diff.minor.push('composition')
    } else {
      try {
        assert.deepStrictEqual(oldDecision.composition, newDecision.composition)
      } catch (_) {
        diff.minor.push('composition')
      }
    }
  }
  diff.major.sort()
  diff.minor.sort()
  return diff
}
