import { HttpException, HttpStatus } from '@nestjs/common'

export class BadPropertiesException extends HttpException {
  constructor(missingProperties: string[], value: Record<string, any>) {
    super(
      JSON.stringify({
        missingProperties: missingProperties,
        idJuridiction: value.idJuridiction,
        dateDecision: value.dateDecision
      }),
      HttpStatus.BAD_REQUEST
    )
  }
}
