import { HttpException, HttpStatus } from '@nestjs/common'

export class InfrastructureException extends HttpException {
  constructor(reason: string) {
    super('Une erreur de dépendance a eu lieu : ' + reason, HttpStatus.SERVICE_UNAVAILABLE)
  }
}
