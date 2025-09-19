import { LabelStatus } from 'dbsder-api-types'
import { computeLabelStatus } from './computeLabelStatus'
import { MockUtils } from '../../../shared/infrastructure/utils/mock.utils'

jest.mock('../index', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn()
  }
}))

describe('updateLabelStatus', () => {
  const mockUtils = new MockUtils()
  describe('Returns provided labelStatus', () => {
    it('when decision is not ignored', async () => {
      // GIVEN
      const dateDecision = new Date(2025, 1, 12)
      const dateCreation = new Date(2025, 1, 13)
      const mockDecisionLabel = {
        ...mockUtils.decisionMock,
        dateDecision: dateDecision.toISOString(),
        dateCreation: dateCreation.toISOString(),
        public: true
      }
      const expectedLabelStatus = LabelStatus.TOBETREATED

      // WHEN
      mockDecisionLabel.labelStatus = await computeLabelStatus(mockDecisionLabel)

      // THEN
      expect(mockDecisionLabel.labelStatus).toEqual(expectedLabelStatus)
    })
  })

  describe('changes labelStatus if it has exceptions', () => {
    /*
    describe('returns ignored_juridictionEnPhaseDeTest', () => {
      it('when jurisdiction is not in whitelist', async () => {
        // GIVEN
        const dateDecision = new Date(2025, 1, 12)
        const dateCreation = new Date(2025, 1, 13)
        const mockDecisionLabel = {
          ...mockUtils.decisionMock,
          jurisdictionId: '7501',
          dateDecision: dateDecision.toISOString(),
          dateCreation: dateCreation.toISOString(),
          public: true
        }
        const expectedLabelStatus = LabelStatus.IGNORED_JURIDICTION_EN_PHASE_DE_TEST

        // WHEN
        mockDecisionLabel.labelStatus = await computeLabelStatus(mockDecisionLabel)

        // THEN
        expect(mockDecisionLabel.labelStatus).toEqual(expectedLabelStatus)
      })
    })
    */

    describe('returns ignored_decisionDateIncoherente', () => {
      it('when dateDecision is in the future compared to dateCreation', async () => {
        // GIVEN
        const dateDecisionInTheFuture = new Date(2023, 7, 20)
        const dateCreation = new Date(2023, 6, 20)
        const mockDecisionLabel = {
          ...mockUtils.decisionMock,
          dateDecision: dateDecisionInTheFuture.toISOString(),
          dateCreation: dateCreation.toISOString(),
          public: true
        }
        const expectedLabelStatus = LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE

        // WHEN
        mockDecisionLabel.labelStatus = await computeLabelStatus(mockDecisionLabel)

        // THEN
        expect(mockDecisionLabel.labelStatus).toEqual(expectedLabelStatus)
      })
    })

    describe('returns ignored_dateAvantMiseEnService', () => {
      it('when decisionDate is before mise en service date', async () => {
        // GIVEN
        const dateDecisionBeforeMiseEnService = new Date(2023, 11, 13)
        const mockDecisionLabel = {
          ...new MockUtils().decisionMock,
          dateDecision: dateDecisionBeforeMiseEnService.toISOString()
        }
        const expectedLabelStatus = LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE

        // WHEN
        mockDecisionLabel.labelStatus = await computeLabelStatus(mockDecisionLabel)

        // THEN
        expect(mockDecisionLabel.labelStatus).toEqual(expectedLabelStatus)
      })

      it('when decisionDate is in January 2023 and dateCreation is in July 2023', async () => {
        // GIVEN
        const dateJanuary2023 = new Date(2023, 0, 15)
        const dateJuly2023 = new Date(2023, 6, 20)
        const mockDecisionLabel = {
          ...mockUtils.decisionMock,
          dateDecision: dateJanuary2023.toISOString(),
          dateCreation: dateJuly2023.toISOString()
        }
        // change with new condditions now this is before mise en service
        const expectedLabelStatus = LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE

        // WHEN
        mockDecisionLabel.labelStatus = await computeLabelStatus(mockDecisionLabel)

        // THEN
        expect(mockDecisionLabel.labelStatus).toEqual(expectedLabelStatus)
      })
      it('when decisionDate is in September 2022 and dateCreation is in March 2023', async () => {
        // GIVEN
        const dateSeptember2022 = new Date(2022, 8, 20)
        const dateMarch2023 = new Date(2023, 2, 25)
        const mockDecisionLabel = {
          ...mockUtils.decisionMock,
          dateDecision: dateSeptember2022.toISOString(),
          dateCreation: dateMarch2023.toISOString()
        }
        const expectedLabelStatus = LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE

        // WHEN
        mockDecisionLabel.labelStatus = await computeLabelStatus(mockDecisionLabel)

        // THEN
        expect(mockDecisionLabel.labelStatus).toEqual(expectedLabelStatus)
      })
    })

    /*
    describe('when decision contains unknown characters', () => {
      it('when originalText contains tibetan characters', () => {
        // GIVEN
        const dateDecision = new Date(2025, 7, 20)
        const dateCreation = new Date(2025, 7, 20)
        const mockDecisionLabel = {
          ...mockUtils.decisionMock,
          originalText:
            'la somme de 66. 224, 25 €, après imputation de la créance des tiers payeurs et déduction faite des provisions à hauteur de 9. 000 སྒྱ, en réparation de son préjudice corporel, consécutif à l’accident survenu le',
          dateDecision: dateDecision.toISOString(),
          dateCreation: dateCreation.toISOString()
        }
        const expectedLabelStatus = LabelStatus.IGNORED_CARACTERE_INCONNU

        // WHEN
        mockDecisionLabel.labelStatus = await computeLabelStatus(mockDecisionLabel)

        // THEN
        expect(mockDecisionLabel.labelStatus).toEqual(expectedLabelStatus)
      })
    })
    */
  })
})
