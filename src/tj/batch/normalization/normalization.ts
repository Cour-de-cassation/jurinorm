import { v4 as uuidv4 } from 'uuid'
import { generateUniqueId } from './services/generateUniqueId'
import {
  removeOrReplaceUnnecessaryCharacters,
  isEmptyText,
  hasNoBreak
} from './services/removeOrReplaceUnnecessaryCharacters'
import { logger } from '../../../connectors/logger'
import { mapDecisionNormaliseeToDecisionDto } from './infrastructure/decision.dto'
import { transformDecisionIntegreFromWPDToText } from './services/transformDecisionIntegreContent'
import { computeLabelStatus } from './services/computeLabelStatus'
import { DbSderApiGateway } from './repositories/gateways/dbsderApi.gateway'
import { normalizationFormatLogs } from '../../shared/infrastructure/utils/log'
import { computeOccultation } from './services/computeOccultation'

import { DecisionTj, LabelStatus, PublishStatus, UnIdentifiedDecisionTj } from 'dbsder-api-types'

import { strict as assert } from 'assert'
import { annotateDecision } from '../../../services/nlp/annotation'
import { computeRulesDecisionTj } from './services/rulesTj'
import { fetchZoning } from './repositories/gateways/zoning'
import { findDecisions } from '../../../connectors/DbSder'
import { saveDecisionInAffaire } from '../../../services/affaire'
import { RawTj } from './models'
import { getFileByName } from '../../../connectors/bucket'

export const rawTjToNormalize = {
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

interface Diff {
  major: Array<string>
  minor: Array<string>
}

const dbSderApiGateway = new DbSderApiGateway()
const bucketNameIntegre = process.env.S3_BUCKET_NAME_RAW_TJ

export async function normalizeTj(rawTj: RawTj): Promise<void> {
  try {
    const jobId = uuidv4()
    normalizationFormatLogs.correlationId = jobId

    const wpdFile = await getFileByName(bucketNameIntegre, rawTj.path)

    const metadonnees = rawTj.metadatas

    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: 'Starting normalization of ' + rawTj.path
    })

    // Step 3: Generating unique id for decision
    const _id = generateUniqueId(metadonnees)
    normalizationFormatLogs.data = { decisionId: _id }
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: 'Generated unique id for decision'
    })

    // Step 4: Transforming decision from WPD to text
    const decisionContent = await transformDecisionIntegreFromWPDToText(wpdFile, rawTj.path)

    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: 'Decision conversion finished. Removing unnecessary characters'
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
      metadonnees,
      rawTj.path
    )

    decisionToSave.labelStatus = computeLabelStatus(decisionToSave)
    decisionToSave.occultation = computeOccultation(
      metadonnees.recommandationOccultation,
      metadonnees.occultationComplementaire,
      metadonnees.debatPublic
    )

    /* Normalisation part that was done on dbsder-api */
    /* ---------------------------------------- */

    const originalTextZoning = await fetchZoning({
      arret_id: decisionToSave.sourceId,
      source: 'tj',
      text: decisionToSave.originalText
    })

    const decisionWithRules = await computeRulesDecisionTj(decisionToSave, originalTextZoning)

    decisionWithRules.originalTextZoning = originalTextZoning

    decisionWithRules.publishStatus =
      decisionWithRules.labelStatus !== LabelStatus.TOBETREATED
        ? PublishStatus.BLOCKED
        : PublishStatus.TOBEPUBLISHED

    /* ---------------------------------------- */

    // Step 7: check diff (major/minor) and upsert/patch accordingly
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `Check diff with previous version of decision ${decisionWithRules.sourceName} ${decisionWithRules.sourceId} (if any)...`
    })

    const [previousVersion] = (
      await findDecisions<DecisionTj>({
        sourceName: 'juritj',
        sourceId: decisionWithRules.sourceId
      })
    ).decisions
    const diff = previousVersion ? computeDiff(previousVersion, decisionWithRules) : null

    if (
      diff?.major?.length === 0 &&
      diff?.minor?.length > 0 &&
      previousVersion.labelStatus !== LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
    ) {
      // Patch decision with minor changes:
      delete decisionWithRules.__v
      delete decisionWithRules.sourceId
      delete decisionWithRules.sourceName
      delete decisionWithRules.public
      delete decisionWithRules.debatPublic
      delete decisionWithRules.occultation
      delete decisionWithRules.originalText
      if (
        decisionWithRules.labelStatus === LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE ||
        decisionWithRules.labelStatus === LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE
      ) {
        decisionWithRules.publishStatus = PublishStatus.BLOCKED
        logger.warn({
          path: 'src/tj/batch/normalization.ts',
          operations: ['normalization', 'normalizationJob-TJ'],
          message: `Decision has a bad updated date: ${decisionWithRules.dateDecision}`
        })
      } else if (decisionWithRules.labelStatus === LabelStatus.IGNORED_CODE_DECISION_BLOQUE_CC) {
        decisionWithRules.publishStatus = PublishStatus.BLOCKED
        logger.warn({
          path: 'src/tj/batch/normalization.ts',
          operations: ['normalization', 'normalizationJob-TJ'],
          message: `Decision has a codeDecision in blocked codeDecision list: ${decisionWithRules.endCaseCode}`
        })
      } else if (decisionWithRules.labelStatus === LabelStatus.IGNORED_CARACTERE_INCONNU) {
        decisionWithRules.publishStatus = PublishStatus.BLOCKED
        logger.warn({
          path: 'src/tj/batch/normalization.ts',
          operations: ['normalization', 'normalizationJob-TJ'],
          message: `Decision contains unknown characters`
        })
      } else {
        if (previousVersion.labelStatus === LabelStatus.EXPORTED) {
          decisionWithRules.labelStatus = LabelStatus.DONE
        } else {
          decisionWithRules.labelStatus = previousVersion.labelStatus
        }
        if (
          previousVersion.publishStatus === PublishStatus.SUCCESS ||
          previousVersion.publishStatus === PublishStatus.UNPUBLISHED ||
          previousVersion.publishStatus === PublishStatus.FAILURE_PREPARING ||
          previousVersion.publishStatus === PublishStatus.FAILURE_INDEXING
        ) {
          decisionWithRules.publishStatus = PublishStatus.TOBEPUBLISHED
        } else {
          decisionWithRules.publishStatus = previousVersion.publishStatus
        }
      }
      await dbSderApiGateway.patchDecision(previousVersion._id, decisionWithRules)
      logger.info({
        path: 'src/tj/batch/normalization.ts',
        operations: ['normalization', 'normalizationJob-TJ'],
        message: `Decision patched in database with minor changes: ${JSON.stringify(diff.minor)}`
      })
    } else if (
      diff?.major?.length === 0 &&
      diff?.minor?.length === 0 &&
      previousVersion.labelStatus !== LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
    ) {
      logger.warn({
        path: 'src/tj/batch/normalization.ts',
        operations: ['normalization', 'normalizationJob-TJ'],
        message: 'Decision has no change'
      })
    } else {
      // Insert new decision:
      const annotatedDecision = await annotateDecision(decisionWithRules)
      await saveDecisionInAffaire(annotatedDecision)
      logger.info({
        path: 'src/tj/batch/normalization.ts',
        operations: ['normalization', 'normalizationJob-TJ'],
        message: `Decision saved in database`
      })
    }

    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
    })

    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: 'Successful normalization of ' + rawTj.path
    })
  } catch (error) {
    throw error
  }
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
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `major change to public: '${oldDecision.public}' -> '${newDecision.public}'`
    })
  }
  if (newDecision.debatPublic !== oldDecision.debatPublic) {
    diff.major.push('debatPublic')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
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
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to dateDecision: '${oldDecision.dateDecision}' -> '${newDecision.dateDecision}'`
    })
  }
  if (newDecision.jurisdictionId !== oldDecision.jurisdictionId) {
    diff.minor.push('jurisdictionId')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to jurisdictionId: '${oldDecision.jurisdictionId}' -> '${newDecision.jurisdictionId}'`
    })
  }
  if (newDecision.jurisdictionName !== oldDecision.jurisdictionName) {
    diff.minor.push('jurisdictionName')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to jurisdictionName: '${oldDecision.jurisdictionName}' -> '${newDecision.jurisdictionName}'`
    })
  }
  if (newDecision.numeroRoleGeneral !== oldDecision.numeroRoleGeneral) {
    diff.minor.push('numeroRoleGeneral')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to numeroRoleGeneral: '${oldDecision.numeroRoleGeneral}' -> '${newDecision.numeroRoleGeneral}'`
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
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to selection: '${oldDecision.selection}' -> '${newDecision.selection}'`
    })
  }
  if (newDecision.libelleEndCaseCode !== oldDecision.libelleEndCaseCode) {
    diff.minor.push('libelleEndCaseCode')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to libelleEndCaseCode: '${oldDecision.libelleEndCaseCode}' -> '${newDecision.libelleEndCaseCode}'`
    })
  }
  if (newDecision.registerNumber !== oldDecision.registerNumber) {
    diff.minor.push('registerNumber')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to registerNumber: '${oldDecision.registerNumber}' -> '${newDecision.registerNumber}'`
    })
  }
  if (newDecision.jurisdictionCode !== oldDecision.jurisdictionCode) {
    diff.minor.push('jurisdictionCode')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to jurisdictionCode: '${oldDecision.jurisdictionCode}' -> '${newDecision.jurisdictionCode}'`
    })
  }
  if (newDecision.solution !== oldDecision.solution) {
    diff.minor.push('solution')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to solution: '${oldDecision.solution}' -> '${newDecision.solution}'`
    })
  }
  if (newDecision.formation !== oldDecision.formation) {
    diff.minor.push('formation')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to formation: '${oldDecision.formation}' -> '${newDecision.formation}'`
    })
  }
  if (newDecision.libelleNAC !== oldDecision.libelleNAC) {
    diff.minor.push('libelleNAC')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to libelleNAC: '${oldDecision.libelleNAC}' -> '${newDecision.libelleNAC}'`
    })
  }
  if (newDecision.NPCode !== oldDecision.NPCode) {
    diff.minor.push('NPCode')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to NPCode: '${oldDecision.NPCode}' -> '${newDecision.NPCode}'`
    })
  }
  if (newDecision.libelleNatureParticuliere !== oldDecision.libelleNatureParticuliere) {
    diff.minor.push('libelleNatureParticuliere')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to libelleNatureParticuliere: '${oldDecision.libelleNatureParticuliere}' -> '${newDecision.libelleNatureParticuliere}'`
    })
  }
  if (newDecision.codeService !== oldDecision.codeService) {
    diff.minor.push('codeService')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to codeService: '${oldDecision.codeService}' -> '${newDecision.codeService}'`
    })
  }
  if (newDecision.libelleService !== oldDecision.libelleService) {
    diff.minor.push('libelleService')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to libelleService: '${oldDecision.libelleService}' -> '${newDecision.libelleService}'`
    })
  }
  if (newDecision.indicateurQPC !== oldDecision.indicateurQPC) {
    diff.minor.push('indicateurQPC')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to indicateurQPC: '${oldDecision.indicateurQPC}' -> '${newDecision.indicateurQPC}'`
    })
  }
  if (newDecision.matiereDeterminee !== oldDecision.matiereDeterminee) {
    diff.minor.push('matiereDeterminee')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to matiereDeterminee: '${oldDecision.matiereDeterminee}' -> '${newDecision.matiereDeterminee}'`
    })
  }
  if (newDecision.pourvoiCourDeCassation !== oldDecision.pourvoiCourDeCassation) {
    diff.minor.push('pourvoiCourDeCassation')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to pourvoiCourDeCassation: '${oldDecision.pourvoiCourDeCassation}' -> '${newDecision.pourvoiCourDeCassation}'`
    })
  }
  if (newDecision.pourvoiLocal !== oldDecision.pourvoiLocal) {
    diff.minor.push('pourvoiLocal')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to pourvoiLocal: '${oldDecision.pourvoiLocal}' -> '${newDecision.pourvoiLocal}'`
    })
  }
  if (newDecision.sommaire !== oldDecision.sommaire) {
    diff.minor.push('sommaire')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to sommaire: '${oldDecision.sommaire}' -> '${newDecision.sommaire}'`
    })
  }
  if (newDecision.president !== oldDecision.president) {
    diff.minor.push('president')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to president: '${oldDecision.president}' -> '${newDecision.president}'`
    })
  }
  if (newDecision.decisionAssociee !== oldDecision.decisionAssociee) {
    diff.minor.push('decisionAssociee')
    logger.info({
      path: 'src/tj/batch/normalization.ts',
      operations: ['normalization', 'normalizationJob-TJ'],
      message: `minor change to decisionAssociee: '${oldDecision.decisionAssociee}' -> '${newDecision.decisionAssociee}'`
    })
  }
  diff.major.sort()
  diff.minor.sort()
  return diff
}
