import { v4 as uuidv4 } from 'uuid'
import { generateUniqueId } from './services/generateUniqueId'
import {
  removeOrReplaceUnnecessaryCharacters,
  isEmptyText,
  hasNoBreak
} from './services/removeOrReplaceUnnecessaryCharacters'
import { ConvertedDecisionWithMetadonneesDto } from '../../shared/infrastructure/dto/convertedDecisionWithMetadonnees.dto'
import { logger } from '../../shared/infrastructure/utils/log'
import { DecisionS3Repository } from '../../shared/infrastructure/repositories/decisionS3.repository'
import { mapDecisionNormaliseeToDecisionDto, RawTj } from './infrastructure/decision.dto'
import { transformDecisionIntegreFromWPDToText } from './services/transformDecisionIntegreContent'
import { CollectDto } from '../../shared/infrastructure/dto/collect.dto'
import { computeLabelStatus } from './services/computeLabelStatus'
import { DbSderApiGateway } from './repositories/gateways/dbsderApi.gateway'
import { normalizationFormatLogs } from '../../shared/infrastructure/utils/log'
import { computeOccultation } from './services/computeOccultation'

import { LabelStatus, PublishStatus, UnIdentifiedDecisionTj } from 'dbsder-api-types'

import { strict as assert } from 'assert'
import { updateRawStatus } from '../../../service/eventSourcing'
import { S3_BUCKET_NAME_RAW_TJ } from '../../../library/env'
import { findRawInformations, mapCursorSync } from '../../../library/DbRaw'

interface Diff {
  major: Array<string>
  minor: Array<string>
}

const dbSderApiGateway = new DbSderApiGateway()
const bucketNameIntegre = S3_BUCKET_NAME_RAW_TJ

export const rawToNormalize = {
  // Ne contient pas normalized:
  events: { $not: { $elemMatch: { type: 'normalized' } } },
  // Les 3 derniers events ne sont pas "blocked":
  $expr: {
    $not: {
      $eq: [
        3,
        {
          $size: {
            $filter: {
              input: { $slice: ['$events', -3] },
              as: 'e',
              cond: { $eq: ['$$e.type', 'blocked'] }
            }
          }
        }
      ]
    }
  }
}

export async function normalizationJob(): Promise<ConvertedDecisionWithMetadonneesDto[]> {
  logger.info({ ...normalizationFormatLogs, msg: 'Starting TJ normalization' })

  const listConvertedDecision: ConvertedDecisionWithMetadonneesDto[] = []
  const s3Repository = new DecisionS3Repository(logger)

  const decisions = await findRawInformations<RawTj>(bucketNameIntegre, rawToNormalize)

  const results = await mapCursorSync(decisions, async (rawTj) => {
    try {
        const jobId = uuidv4()
        normalizationFormatLogs.correlationId = jobId

        // Step 1: Fetch decision from S3
        const decision: CollectDto = await s3Repository.getDecisionByFilename(rawTj.path)

        // Step 2: Cloning decision to save it in normalized bucket
        const decisionFromS3Clone = JSON.parse(JSON.stringify(decision))

        logger.info({
          ...normalizationFormatLogs,
          msg: 'Starting normalization of ' + rawTj.path
        })

        // Step 3: Generating unique id for decision
        const _id = generateUniqueId(decision.metadonnees)
        normalizationFormatLogs.data = { decisionId: _id }
        logger.info({ ...normalizationFormatLogs, msg: 'Generated unique id for decision' })

        // Step 4: Transforming decision from WPD to text
        const decisionContent = await transformDecisionIntegreFromWPDToText(
          decision.decisionIntegre
        )

        logger.info({
          ...normalizationFormatLogs,
          msg: 'Decision conversion finished. Removing unnecessary characters'
        })

        // Step 5: Removing or replace (by other thing) unnecessary characters from decision
        const cleanedDecision = removeOrReplaceUnnecessaryCharacters(decisionContent)

        if (!cleanedDecision || isEmptyText(cleanedDecision) || hasNoBreak(cleanedDecision)) {
          throw new Error('Empty text')
        }

        // Step 6: Map decision to DBSDER API Type to save it in database
        const decisionToSave = mapDecisionNormaliseeToDecisionDto(
          _id,
          cleanedDecision,
          decision.metadonnees,
          rawTj.path
        )
        decisionToSave.labelStatus = computeLabelStatus(decisionToSave)
        decisionToSave.occultation = computeOccultation(
          decision.metadonnees.recommandationOccultation,
          decision.metadonnees.occultationComplementaire,
          decision.metadonnees.debatPublic
        )

        // Step 7: check diff (major/minor) and upsert/patch accordingly
        logger.info({
          ...normalizationFormatLogs,
          msg: `Check diff with previous version of decision ${decisionToSave.sourceId} (if any)...`
        })
        const previousVersion = await dbSderApiGateway.getDecisionBySourceId(
          decisionToSave.sourceId
        )
        if (previousVersion !== null) {
          const diff = computeDiff(previousVersion, decisionToSave)
          if (diff.major && diff.major.length > 0) {
            // Update decision with major changes:
            await dbSderApiGateway.saveDecision(decisionToSave)
            logger.info({
              ...normalizationFormatLogs,
              msg: `Decision updated in database with major changes: ${JSON.stringify(diff.major)}`
            })
          } else if (diff.minor && diff.minor.length > 0) {
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
              // Bad dateDecision? Throw a warning... @TODO ODDJDashboard
              logger.warn({
                ...normalizationFormatLogs,
                msg: `Decision has a bad updated date: ${decisionToSave.dateDecision}`
              })
            } else if (decisionToSave.labelStatus === LabelStatus.IGNORED_CODE_DECISION_BLOQUE_CC) {
              decisionToSave.publishStatus = PublishStatus.BLOCKED
              // Bad endCaseCode? Throw a warning... @TODO ODDJDashboard
              logger.warn({
                ...normalizationFormatLogs,
                msg: `Decision has a codeDecision in blocked codeDecision list: ${decisionToSave.endCaseCode}`
              })
            } else if (decisionToSave.labelStatus === LabelStatus.IGNORED_CARACTERE_INCONNU) {
              decisionToSave.publishStatus = PublishStatus.BLOCKED
              // Unknown characters? Throw a warning... @TODO ODDJDashboard
              logger.warn({
                ...normalizationFormatLogs,
                msg: `Decision contains unknown characters`
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
              ...normalizationFormatLogs,
              msg: `Decision patched in database with minor changes: ${JSON.stringify(diff.minor)}`
            })
          } else {
            // No change? Throw a warning and do nothing... @TODO ODDJDashboard
            logger.warn({ ...normalizationFormatLogs, msg: 'Decision has no change' })
          }
        } else {
          // Insert new decision:
          await dbSderApiGateway.saveDecision(decisionToSave)
          logger.info({ ...normalizationFormatLogs, msg: `Decision saved in database` })
        }

        // Step 8: Save decision in normalized bucket
        await s3Repository.saveDecisionNormalisee(
          JSON.stringify(decisionFromS3Clone),
          rawTj.path
        )

        logger.info({
          ...normalizationFormatLogs,
          msg: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
        })

        // Step 9: Delete decision in raw bucket
        await s3Repository.deleteDecision(rawTj.path, bucketNameIntegre)

        // Step 10: Add Status
        await updateRawStatus(bucketNameIntegre, { rawDecision: rawTj, status: 'success' })

        logger.info({
          ...normalizationFormatLogs,
          msg: 'Successful normalization of ' + rawTj.path
        })
        listConvertedDecision.push({
          metadonnees: decisionToSave,
          decisionNormalisee: cleanedDecision
        })
      } catch (error) {
        logger.error({
          ...normalizationFormatLogs,
          msg: error.message,
          data: error
        })
        await updateRawStatus(bucketNameIntegre, { rawDecision: rawTj, status: 'error', error })
        logger.error({
          ...normalizationFormatLogs,
          msg: 'Failed to normalize the decision ' + rawTj.path + '.'
        })
      }
  })

  if (results.length == 0) {
    logger.info({ ...normalizationFormatLogs, msg: 'No decision to normalize.' })
    return []
  }

  return listConvertedDecision
}

function computeDiff(
  oldDecision: UnIdentifiedDecisionTj,
  newDecision: UnIdentifiedDecisionTj
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
      ...normalizationFormatLogs,
      msg: `major change to public: '${oldDecision.public}' -> '${newDecision.public}'`
    })
  }
  if (newDecision.debatPublic !== oldDecision.debatPublic) {
    diff.major.push('debatPublic')
    logger.info({
      ...normalizationFormatLogs,
      msg: `major change to debatPublic: '${oldDecision.debatPublic}' -> '${newDecision.debatPublic}'`
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
  if (oldDecision.NACCode !== newDecision.NACCode) {
    diff.major.push('NACCode')
  }
  if (oldDecision.endCaseCode !== newDecision.endCaseCode) {
    diff.major.push('endCaseCode')
  }
  if (oldDecision.recommandationOccultation !== newDecision.recommandationOccultation) {
    diff.major.push('recommandationOccultation')
  }

  // Minor changes...
  if (newDecision.dateDecision !== oldDecision.dateDecision) {
    diff.minor.push('dateDecision')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to dateDecision: '${oldDecision.dateDecision}' -> '${newDecision.dateDecision}'`
    })
  }
  if (newDecision.jurisdictionId !== oldDecision.jurisdictionId) {
    diff.minor.push('jurisdictionId')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to jurisdictionId: '${oldDecision.jurisdictionId}' -> '${newDecision.jurisdictionId}'`
    })
  }
  if (newDecision.jurisdictionName !== oldDecision.jurisdictionName) {
    diff.minor.push('jurisdictionName')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to jurisdictionName: '${oldDecision.jurisdictionName}' -> '${newDecision.jurisdictionName}'`
    })
  }
  if (newDecision.numeroRoleGeneral !== oldDecision.numeroRoleGeneral) {
    diff.minor.push('numeroRoleGeneral')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to numeroRoleGeneral: '${oldDecision.numeroRoleGeneral}' -> '${newDecision.numeroRoleGeneral}'`
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
  if (newDecision.selection !== oldDecision.selection) {
    diff.minor.push('selection')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to selection: '${oldDecision.selection}' -> '${newDecision.selection}'`
    })
  }
  if (newDecision.libelleEndCaseCode !== oldDecision.libelleEndCaseCode) {
    diff.minor.push('libelleEndCaseCode')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to libelleEndCaseCode: '${oldDecision.libelleEndCaseCode}' -> '${newDecision.libelleEndCaseCode}'`
    })
  }
  if (newDecision.registerNumber !== oldDecision.registerNumber) {
    diff.minor.push('registerNumber')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to registerNumber: '${oldDecision.registerNumber}' -> '${newDecision.registerNumber}'`
    })
  }
  if (newDecision.jurisdictionCode !== oldDecision.jurisdictionCode) {
    diff.minor.push('jurisdictionCode')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to jurisdictionCode: '${oldDecision.jurisdictionCode}' -> '${newDecision.jurisdictionCode}'`
    })
  }
  if (newDecision.solution !== oldDecision.solution) {
    diff.minor.push('solution')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to solution: '${oldDecision.solution}' -> '${newDecision.solution}'`
    })
  }
  if (newDecision.formation !== oldDecision.formation) {
    diff.minor.push('formation')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to formation: '${oldDecision.formation}' -> '${newDecision.formation}'`
    })
  }
  if (newDecision.libelleNAC !== oldDecision.libelleNAC) {
    diff.minor.push('libelleNAC')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to libelleNAC: '${oldDecision.libelleNAC}' -> '${newDecision.libelleNAC}'`
    })
  }
  if (newDecision.NPCode !== oldDecision.NPCode) {
    diff.minor.push('NPCode')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to NPCode: '${oldDecision.NPCode}' -> '${newDecision.NPCode}'`
    })
  }
  if (newDecision.libelleNatureParticuliere !== oldDecision.libelleNatureParticuliere) {
    diff.minor.push('libelleNatureParticuliere')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to libelleNatureParticuliere: '${oldDecision.libelleNatureParticuliere}' -> '${newDecision.libelleNatureParticuliere}'`
    })
  }
  if (newDecision.codeService !== oldDecision.codeService) {
    diff.minor.push('codeService')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to codeService: '${oldDecision.codeService}' -> '${newDecision.codeService}'`
    })
  }
  if (newDecision.libelleService !== oldDecision.libelleService) {
    diff.minor.push('libelleService')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to libelleService: '${oldDecision.libelleService}' -> '${newDecision.libelleService}'`
    })
  }
  if (newDecision.indicateurQPC !== oldDecision.indicateurQPC) {
    diff.minor.push('indicateurQPC')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to indicateurQPC: '${oldDecision.indicateurQPC}' -> '${newDecision.indicateurQPC}'`
    })
  }
  if (newDecision.matiereDeterminee !== oldDecision.matiereDeterminee) {
    diff.minor.push('matiereDeterminee')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to matiereDeterminee: '${oldDecision.matiereDeterminee}' -> '${newDecision.matiereDeterminee}'`
    })
  }
  if (newDecision.pourvoiCourDeCassation !== oldDecision.pourvoiCourDeCassation) {
    diff.minor.push('pourvoiCourDeCassation')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to pourvoiCourDeCassation: '${oldDecision.pourvoiCourDeCassation}' -> '${newDecision.pourvoiCourDeCassation}'`
    })
  }
  if (newDecision.pourvoiLocal !== oldDecision.pourvoiLocal) {
    diff.minor.push('pourvoiLocal')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to pourvoiLocal: '${oldDecision.pourvoiLocal}' -> '${newDecision.pourvoiLocal}'`
    })
  }
  if (newDecision.sommaire !== oldDecision.sommaire) {
    diff.minor.push('sommaire')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to sommaire: '${oldDecision.sommaire}' -> '${newDecision.sommaire}'`
    })
  }
  if (newDecision.president !== oldDecision.president) {
    diff.minor.push('president')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to president: '${oldDecision.president}' -> '${newDecision.president}'`
    })
  }
  if (newDecision.decisionAssociee !== oldDecision.decisionAssociee) {
    diff.minor.push('decisionAssociee')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to decisionAssociee: '${oldDecision.decisionAssociee}' -> '${newDecision.decisionAssociee}'`
    })
  }
  diff.major.sort()
  diff.minor.sort()
  return diff
}
