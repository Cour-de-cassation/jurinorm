import * as FormData from 'form-data'
import axios, { AxiosError, AxiosResponse } from 'axios'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Marked } from 'marked'
import { decode } from 'html-entities'
import { convert } from 'html-to-text'

async function main(id: string) {
  if (!id) {
    throw new Error(
      'Usage: testPDFToText.js <bucketId>\nThis script allows to debug the pdf-to-text process for the given decision stored in the juritcom-bucket-pdf S3 bucket:\testPDFToText.js 0605_2024G00010_2024-09-13_2'
    )
  }

  const pdf: Buffer = await getPDFByFilename(`${id}.pdf`)
  const formdata: FormData = new FormData()
  formdata.append('pdf_file', pdf, `${id}.pdf`)
  try {
    console.log(`Processing ${id}.pdf...`)
    const t0 = new Date()
    const response: AxiosResponse = await axios.post(
      'http://nlp-api-service.nlp.svc.cluster.local:8081/pdf-to-text',
      formdata,
      {
        headers: {
          ...formdata.getHeaders()
        }
      }
    )
    const t1 = new Date()
    const delta = (t1.getTime() - t0.getTime()) / 1000
    const perPage = (delta / response.data.pdfPageCount).toFixed(2)
    console.log(`Done in: ${delta.toFixed(2)} s`)
    console.log(`Duration per page: ${perPage} page/s`)

    let htmlText = ''
    if (response.data.markdownText) {
      console.log('---MARKDOWN BEGIN---')
      console.log(JSON.stringify(response.data.markdownText))
      console.log('---MARKDOWN END---')
      htmlText = new Marked({ gfm: true, breaks: true }).parse(response.data.markdownText, {
        async: false
      })
      console.log('---HTML (FROM MARKDOWN) BEGIN---')
    } else if (response.data.HTMLText) {
      htmlText = response.data.HTMLText
      console.log('---HTML (DIRECT) BEGIN---')
    } else {
      console.log('---HTML (NONE RECEIVED) BEGIN---')
    }
    console.log(JSON.stringify(htmlText))
    console.log('---HTML END---')

    // Remove any HTML stuff:
    // 1.a HTML elements:
    let plainText = decode(htmlText)
    /*
    // 1.b Remove every <html> tag:
    plainText = plainText.replace(/<html>/gim, '\n')
    plainText = plainText.replace(/<\/html>/gim, '\n')
    // 1.c Remove every <body> tag:
    plainText = plainText.replace(/<body>/gim, '\n')
    plainText = plainText.replace(/<\/body>/gim, '\n')
    // 2. insert a space at the end of every table cell:
    plainText = plainText.replace(/<\/td>/gim, ' </td>')
    // 3.a. add a \n after each <br>:
    plainText = plainText.replace(/<br\/?>/gim, '<br>\n')
    // 3.b. add a \n before and after each paragraph:
    plainText = plainText.replace(/<p>/gim, '\n<p>')
    plainText = plainText.replace(/<\/p>/gim, '</p>\n')
    // 3.c. add a \n before and after each heading:
    plainText = plainText.replace(/<h(\d+)>/gim, '\n<h$1>')
    plainText = plainText.replace(/<\/h(\d+)>/gim, '</h$1>\n')
    // 3.d. add a \n before and after each tr:
    plainText = plainText.replace(/<tr>/gim, '\n<tr>')
    plainText = plainText.replace(/<\/tr>/gim, '</tr>\n')
    // 3.e. add a \n before and after each table:
    plainText = plainText.replace(/<table>/gim, '\n<table>')
    plainText = plainText.replace(/<\/table>/gim, '</table>\n')
    // 3.f. add a \n before and after each hr:
    plainText = plainText.replace(/<hr\/?>/gim, '\n<hr>\n')
    // 3.g. add a \n before and after each ol:
    plainText = plainText.replace(/<ol>/gim, '\n<ol>')
    plainText = plainText.replace(/<\/ol>/gim, '</ol>\n')
    // 3.h. add a \n before and after each ul:
    plainText = plainText.replace(/<ul>/gim, '\n<ul>')
    plainText = plainText.replace(/<\/ul>/gim, '</ul>\n')
    // 3.i. add a \n after each li:
    plainText = plainText.replace(/<\/li>/gim, '</li>\n')
    // 4. remove extra \n
    plainText = plainText.replace(/\n+/gm, '\n')
    */
    // 5. convert:
    plainText = convert(plainText, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        {
          selector: '*',
          options: {
            ignoreHref: true
          }
        },
        {
          selector: 'img',
          format: 'skip'
        },
        {
          selector: 'a',
          format: 'skip'
        },
        {
          selector: 'h1',
          options: {
            uppercase: false
          }
        },
        {
          selector: 'h2',
          options: {
            uppercase: false
          }
        },
        {
          selector: 'h3',
          options: {
            uppercase: false
          }
        },
        {
          selector: 'h4',
          options: {
            uppercase: false
          }
        },
        {
          selector: 'h5',
          options: {
            uppercase: false
          }
        },
        {
          selector: 'h6',
          options: {
            uppercase: false
          }
        }
      ]
    })
    // 6. remove every tag that could remain:
    // plainText = plainText.replace(/<\/?[^>]+(>|$)/gm, '')
    // 7. remove extra \n again (after tag collapsing)
    plainText = plainText.replace(/\n+\n/gm, '\n\n')
    // 8. fix list items
    plainText = plainText.replace(/\n\s+\*\s+\n\s+/gm, '\n* ')
    plainText = plainText.replace(/\n\s+(\d+)\.\s+\n\s+/gm, '\n$1. ')
    // 9. trim
    plainText = plainText.trim()

    console.log('---PLAINTEXT BEGIN---')
    console.log(JSON.stringify(plainText))
    console.log('---PLAINTEXT END---')
  } catch (error: any) {
    if (error instanceof AxiosError) {
      console.error(error.code)
      console.error(error.status)
      console.error(error.cause)
    } else {
      console.error(error)
    }
  }
}

async function getPDFByFilename(filename: string): Promise<Buffer> {
  const s3Client = new S3Client({
    endpoint: process.env.S3_URL,
    forcePathStyle: true,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  })

  const reqParams = {
    Bucket: process.env.S3_BUCKET_NAME_PDF,
    Key: filename
  }

  try {
    const fileFromS3 = await s3Client.send(new GetObjectCommand(reqParams))
    return Buffer.from(await fileFromS3.Body?.transformToByteArray())
  } catch (error) {
    console.log({ operationName: 'getPDFByFilename', msg: error.message, data: error })
  }
}

main(process.argv[2])
