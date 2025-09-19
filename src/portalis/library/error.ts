import { ParseError, stringifyError } from 'dbsder-api-types'

export class NotSupported extends Error {
  type = 'notSupported' as const
  variableName: string
  variableValue: unknown
  message: string

  constructor(variableName: string, variableValue: unknown, message?: string) {
    const _message = message
      ? message
      : `value: ${variableValue} is not supported to ${variableName}.`
    super()
    this.variableName = variableName
    this.variableValue = variableValue
    this.message = _message
  }
}

export function toNotSupported(variableName: string, variableValue: unknown, error: Error) {
  if (error instanceof ParseError) {

    return new NotSupported(
      variableName,
      variableValue,
      `'${variableName}' parse error: ${stringifyError(error)}`,
    )
  }
  return Object.assign(error, new NotSupported(variableName, variableValue, error.message))
}

export class MissingValue extends Error {
  type = "missingValue" as const
  variableName: string
  constructor(variableName: string, message?: string) {
    const _message = message ? message : `${variableName} is required but missing.`
    super(_message)
    this.variableName = variableName
  }
}
export function isMissingValue(x: any) {
  return x?.type === "missingValue" && x instanceof Error
}
export class NotFound extends Error {
  type = "notFound" as const
  variableName: string
  constructor(variableName: string, message?: string) {
    const _message = message ? message : `${variableName} not found.`
    super(_message)
    this.variableName = variableName
  }
}

export class UnauthorizedError extends Error {
  type = "unauthorizedError" as const
  constructor(message?: string) {
    const _message = message ? message : `Resource needs to be logged to access. Currently unauthorized.`
    super(_message)
  }
}

export class ForbiddenError extends Error {
  type = "forbiddenError" as const
  constructor(message?: string) {
    const _message = message ? message : `Your connexion cannot access to this resource. Currently forbidden.`
    super(_message)
  }
}

export class UnexpectedError extends Error {
  type = "unexpectedError" as const
  constructor(message?: string) {
    const _message = message ? message : `Unexepected error occurs.`
    super(_message)
  }
}
export function toUnexpectedError(error: any) {
  if (!(error instanceof Error)) return new UnexpectedError(`${error}`)

  const unexpected = new UnexpectedError()
  if (error.message?.length > 0) unexpected.message = error.message
  if ((error.stack?.length ?? 0) > 0) unexpected.stack = error.stack
  return unexpected
}

type CustomError = NotSupported | MissingValue | NotFound | UnauthorizedError | ForbiddenError | UnexpectedError

export function isCustomError(x: any): x is CustomError {
  switch (x.type) {
    case "notSupported":
    case "missingValue":
    case "unauthorizedError":
    case "unexpectedError":
      return x instanceof Error
    default:
      return false
  }
}