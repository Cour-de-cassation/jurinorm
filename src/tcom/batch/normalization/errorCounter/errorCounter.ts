import fs from 'fs'

const errorCountFileName = '/home/node/errorCounter.json'

export function incrementErrorCount(pdfFilename: string): number {
  let errorCountData = {}

  try {
    const errorCountFileContent = fs.readFileSync(errorCountFileName).toString()
    errorCountData = JSON.parse(errorCountFileContent)
  } catch (_) {
    errorCountData = {}
  }

  if (errorCountData[pdfFilename] === undefined) {
    errorCountData[pdfFilename] = 0
  }

  errorCountData[pdfFilename]++

  try {
    fs.writeFileSync(errorCountFileName, JSON.stringify(errorCountData))
  } catch (_) {}

  return errorCountData[pdfFilename]
}

export function resetErrorCount(pdfFilename: string) {
  let errorCountData = {}

  try {
    const errorCountFileContent = fs.readFileSync(errorCountFileName).toString()
    errorCountData = JSON.parse(errorCountFileContent)
  } catch (_) {
    errorCountData = {}
  }

  if (errorCountData[pdfFilename] !== undefined) {
    errorCountData[pdfFilename] = 0
  }

  try {
    fs.writeFileSync(errorCountFileName, JSON.stringify(errorCountData))
  } catch (_) {}
}
