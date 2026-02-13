import { expect, jest } from '@jest/globals'
import { ObjectId } from 'mongodb'

import { DbSderApiGateway } from '../repositories/gateways/dbsderApi.gateway'
import * as rulesTj from './rulesTj'
import { occultationRecommendationCodeNac } from './rulesTj'
import {
  BlocOccultation,
  CategoriesToOmit,
  Category,
  CodeNac,
  DecisionTj,
  LabelStatus,
  SuiviOccultation
} from 'dbsder-api-types'

const findCodeNac = jest.spyOn(DbSderApiGateway.prototype, 'getCodeNac')

const fakeDecision: DecisionTj = {
  _id: new ObjectId(),
  sourceId: 1,
  sourceName: 'juritj',
  __v: 0,
  originalText: 'text',
  registerNumber: '',
  dateCreation: '',
  dateDecision: '',
  jurisdictionCode: '',
  jurisdictionId: '',
  jurisdictionName: '',
  labelStatus: LabelStatus.TOBETREATED,
  NACCode: '',
  NPCode: '',
  libelleNAC: '',
  libelleNatureParticuliere: '',
  endCaseCode: '',
  libelleEndCaseCode: '',
  chamberId: '',
  chamberName: '',
  codeService: '',
  libelleService: '',
  debatPublic: true,
  indicateurQPC: false,
  matiereDeterminee: false,
  pourvoiCourDeCassation: false,
  pourvoiLocal: false,
  selection: false,
  blocOccultation: BlocOccultation.TOUTES_CATAGORIES,
  recommandationOccultation: SuiviOccultation.AUCUNE,
  occultation: { additionalTerms: '', categoriesToOmit: [] },
  parties: [],
  filenameSource: '',
  idDecisionTJ: '',
  numeroRoleGeneral: '',
  appeals: [],
  decatt: [],
  publication: [],
  public: true
}

const codeNac: CodeNac = {
  _id: new ObjectId(),
  decisionsPubliques: 'décisions publiques',
  codeNAC: '',
  libelleNAC: '',
  chapitre: { code: '', libelle: '' },
  sousChapitre: { code: '', libelle: '' },
  blocOccultation: 1,
  categoriesToOmit: { suivi: [], nonSuivi: [] },
  debatsPublics: 'débats publics',
  codeUsageNonConseille: false
}

describe('service/decision/rulesTj', () => {
  beforeEach(() => {
    findCodeNac.mockReset()
  })

  describe('computeRulesDecisionTj', () => {
    it('should be ignored if decision is not public', async () => {
      const decision: DecisionTj = { ...fakeDecision, public: false }
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.labelStatus).not.toEqual(LabelStatus.TOBETREATED)
    })

    it('should be ignored if zoning fallback into not public', async () => {
      const decision: DecisionTj = fakeDecision
      const originalTextZoning = { is_public: 0 }
      const result = await rulesTj.computeRulesDecisionTj(decision, originalTextZoning)

      expect(result.labelStatus).not.toEqual(LabelStatus.TOBETREATED)
    })

    it('should be ignored if zoning fallback into partially not public', async () => {
      const decision: DecisionTj = {
        ...fakeDecision,
        debatPublic: true
      }
      const originalTextZoning = { is_public: 2 }
      const result = await rulesTj.computeRulesDecisionTj(decision, originalTextZoning)

      expect(result.labelStatus).not.toEqual(LabelStatus.TOBETREATED)
    })

    it('should be ignored if decision has no codeNac', async () => {
      findCodeNac.mockResolvedValue(null)

      const decision = fakeDecision
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.labelStatus).not.toEqual(LabelStatus.TOBETREATED)
    })

    it('should be ignored if not public by code Nac', async () => {
      findCodeNac.mockResolvedValue({ ...codeNac, decisionsPubliques: 'débats non publics' })
      const decision = fakeDecision
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.labelStatus).not.toEqual(LabelStatus.TOBETREATED)
    })

    it('should be ignored if codeNac occultations are undefined', async () => {
      findCodeNac.mockResolvedValue({ ...codeNac, blocOccultation: undefined })
      const decision = fakeDecision
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.labelStatus).not.toEqual(LabelStatus.TOBETREATED)
    })

    it('should be ignored if partially not public by nac', async () => {
      findCodeNac.mockResolvedValue({ ...codeNac, debatsPublics: 'débats non publics' })
      const decision = fakeDecision
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.labelStatus).not.toEqual(LabelStatus.TOBETREATED)
    })

    it('should be treated otherwise', async () => {
      findCodeNac.mockResolvedValue(codeNac)
      const decision = fakeDecision
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.labelStatus).toEqual(LabelStatus.TOBETREATED)
    })

    it('should return decision with codeNac categoriesToOmit', async () => {
      const categoriesToOmit = [Category.ADRESSE]
      findCodeNac.mockResolvedValue({
        ...codeNac,
        categoriesToOmit: {
          suivi: categoriesToOmit,
          nonSuivi: []
        }
      })
      const decision = { ...fakeDecision, recommandationOccultation: SuiviOccultation.COMPLEMENT }
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.occultation.categoriesToOmit).toEqual(categoriesToOmit)
    })

    it('should return decision with codeNac blocOccultation', async () => {
      const blocOccultation = 3
      findCodeNac.mockResolvedValue({ ...codeNac, blocOccultation: blocOccultation })
      const decision = fakeDecision
      const result = await rulesTj.computeRulesDecisionTj(decision, undefined)

      expect(result.blocOccultation).toEqual(blocOccultation)
    })
  })
  describe('occultationRecommendationCodeNac', () => {
    describe('devrait retourner SUIVI', () => {
      it.each([SuiviOccultation.COMPLEMENT, SuiviOccultation.CONFORME])(
        'quand la recommandation est COMPLEMENT ou CONFORME',
        (recommandation) => {
          const result = occultationRecommendationCodeNac(recommandation)
          expect(result).toBe(CategoriesToOmit.SUIVI)
        }
      )
    })

    describe('devrait retourner NON_SUIVI', () => {
      it.each([SuiviOccultation.AUCUNE, SuiviOccultation.SUBSTITUANT])(
        'quand la recommandation est AUCUNE ou SUBSTITUANT',
        (recommandation) => {
          const result = occultationRecommendationCodeNac(recommandation)
          expect(result).toBe(CategoriesToOmit.NON_SUIVI)
        }
      )
    })
  })

  afterAll(() => {
    findCodeNac.mockRestore()
  })
})
