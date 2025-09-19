import { HttpException, HttpStatus } from '@nestjs/common'

export class PostponeException extends HttpException {
  constructor(reason: string) {
    super('Le service est occupé : ' + reason, HttpStatus.TOO_MANY_REQUESTS)
  }
}
