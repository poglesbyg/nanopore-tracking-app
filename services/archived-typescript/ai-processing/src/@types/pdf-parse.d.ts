declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion?: string
    IsAcroFormPresent?: boolean
    IsXFAPresent?: boolean
    Author?: string
    Subject?: string
    Title?: string
    Creator?: string
    Producer?: string
    CreationDate?: string
    ModDate?: string
    [key: string]: any
  }

  interface PDFMetadata {
    _metadata?: any
    [key: string]: any
  }

  interface PDFData {
    numpages: number
    numrender: number
    info: PDFInfo
    metadata: PDFMetadata
    version: string
    text: string
    [key: string]: any
  }

  function pdf(dataBuffer: Buffer, options?: any): Promise<PDFData>
  
  export = pdf
} 