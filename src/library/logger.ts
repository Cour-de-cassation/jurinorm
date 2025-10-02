import pino, { Logger, LoggerOptions } from "pino";
import { NODE_ENV } from "./env";

type DecisionLog = {
  decision: {
    _id?: string,
    sourceId: string,
    sourceName: string,
    publishStatus?: string,
    labelStatus?: string
  },
  path: string
  operations: readonly ["collect" | "extraction" | "normalization", string]
  message?: string
}

type TechLog = {
  path: string
  operations: readonly ["collect" | "extraction" | "normalization" | "other", string]
  message?: string
}

const pinoPrettyConf = {
  target: "pino-pretty",
  options: {
    singleLine: true,
    colorize: true,
    translateTime: "UTC:dd-mm-yyyy - HH:MM:ss Z",
  },
};

const loggerOptions: LoggerOptions = {
  formatters: {
    level: (label) => {
      return {
        logLevel: label.toUpperCase(),
      };
    },
    log: (content) => ({
      ...content,
      type: Object.keys(content).includes("decison") ? "decision" : "tech",
      appName: "portalis-collect",
    })
  },
  timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
  redact: {
    paths: [
      "req",
      "res",
      "headers",
      "ip",
      "responseTime",
      "hostname",
      "pid",
      "level",
    ],
    censor: "",
    remove: true,
  },
  transport:
    NODE_ENV === "development" ? pinoPrettyConf : undefined,
};

export type CustomLogger = Omit<Logger, 'error' | 'warn' | 'info'> & {
  error: (a: TechLog & Pick<Error, 'stack'>) => void,
  warn: (a: TechLog) => void,
  info: (a: TechLog | DecisionLog) => void,
}

export const logger: CustomLogger = pino(loggerOptions);
