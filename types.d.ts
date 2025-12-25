// Type declarations for modules without type definitions

declare module 'mailparser' {
  export interface ParsedMail {
    text?: string;
    html?: string;
    subject?: string;
    from?: any;
    to?: any;
    date?: Date;
    attachments?: Array<{
      filename?: string;
      contentType?: string;
      content?: Buffer | string;
      contentId?: string;
      size?: number;
    }>;
  }

  export function simpleParser(source: any, options?: any): Promise<ParsedMail>;
}

declare module 'pdf-parse' {
  export interface PDFInfo {
    [key: string]: any;
  }

  export interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: any;
    text: string;
    version: string;
  }

  export default function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
}

