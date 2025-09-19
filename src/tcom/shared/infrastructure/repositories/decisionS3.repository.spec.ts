import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { AwsClientStub, mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import { DecisionS3Repository } from './decisionS3.repository'
import { Logger } from '@nestjs/common'
import { BucketError } from '../../domain/errors/bucket.error'

describe('DecisionS3Repository', () => {
  let repository: DecisionS3Repository
  const mockS3: AwsClientStub<S3Client> = mockClient(S3Client)

  beforeEach(() => {
    mockS3.reset()
    repository = new DecisionS3Repository(new Logger())
  })

  describe('saveDecision', () => {
    const requestS3Dto = { decisionIntegre: 'decision', metadonnees: 'metadonnees' }
    const requestS3DtoJson = JSON.stringify(requestS3Dto)

    it('throws error when S3 called failed', async () => {
      // GIVEN
      mockS3.on(PutObjectCommand).rejects(new Error('Some S3 error'))

      await expect(
        // WHEN
        repository.saveDecision(requestS3DtoJson)
      )
        // THEN
        .rejects.toThrow(BucketError)
    })
  })
})
