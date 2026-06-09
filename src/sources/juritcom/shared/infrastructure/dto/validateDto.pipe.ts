import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate, ValidationError } from 'class-validator'
import { NotSupported } from '@services/error'

@Injectable()
export class ValidateDtoPipe implements PipeTransform {
  async transform(value: unknown, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value
    }
    const object = plainToInstance(metatype, value)
    const errors: ValidationError[] = await validate(object)
    if (errors.length > 0) {
      const messages = errors.map((err) => err.property)
      const error = new NotSupported(messages.join('; '), value)
      throw error
    }
    return value
  }

  private toValidate(metatype): boolean {
    const types = [String, Boolean, Number, Array, Object]
    return !types.includes(metatype)
  }
}
