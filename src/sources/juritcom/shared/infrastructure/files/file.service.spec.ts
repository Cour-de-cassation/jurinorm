import { FileService } from './file.service'
import { InternalServerErrorException } from '@nestjs/common'
import * as fs from 'fs'

jest.mock('fs')

describe('FileService', () => {
  let fileService: FileService
  const mockUploadPath = '/mock-upload-path'
  const mockFile: Express.Multer.File = {
    buffer: Buffer.from('mock file content'),
    originalname: 'test.pdf'
  } as Express.Multer.File

  beforeEach(() => {
    process.env.AV_PDF_PATH = mockUploadPath
    fileService = new FileService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should create the upload directory if it does not exist', () => {
    ;(fs.existsSync as jest.Mock).mockReturnValue(false)
    ;(fs.mkdirSync as jest.Mock).mockImplementation(() => {})

    new FileService()

    expect(fs.existsSync).toHaveBeenCalledWith(mockUploadPath)
  })

  it('should not create the upload directory if it already exists', () => {
    ;(fs.existsSync as jest.Mock).mockReturnValue(true)

    new FileService()

    expect(fs.existsSync).toHaveBeenCalledWith(mockUploadPath)
  })

  it('should save the file successfully and return the file path and name', () => {
    const mockFilename = 'uniqueFile.pdf'
    const mockFullPath = `${mockUploadPath}/${mockFilename}`
    ;(fs.writeFileSync as jest.Mock).mockImplementation(() => {})

    const result = fileService.saveFile(mockFile, mockFilename)

    expect(fs.writeFileSync).toHaveBeenCalledWith(mockFullPath, mockFile.buffer)
    expect(result).toEqual({
      filename: mockFilename,
      path: mockFullPath
    })
  })

  it('should throw an InternalServerErrorException if saving the file fails', () => {
    const mockFilename = 'uniqueFile.pdf'
    ;(fs.writeFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Write failed')
    })

    expect(() => fileService.saveFile(mockFile, mockFilename)).toThrow(InternalServerErrorException)
  })
})
