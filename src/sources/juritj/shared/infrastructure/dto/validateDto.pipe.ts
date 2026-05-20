import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common'
import { isCustomError, NotSupported } from '@services/error'
import { plainToInstance } from 'class-transformer'
import { validate, ValidationError } from 'class-validator'

@Injectable()
export class ValidateDtoPipe implements PipeTransform {
  async transform(value: Record<string, unknown>, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value
    }
    const object = plainToInstance(metatype, value)
    const errors: ValidationError[] = await validate(object)
    if (errors.length > 0) {
      const messages = errors.map((err) => err.property)
      throw new NotSupported(messages.join('; '), value)
    }
    return value
  }

  private toValidate(metatype): boolean {
    const types = [String, Boolean, Number, Array, Object]
    return !types.includes(metatype)
  }
}
