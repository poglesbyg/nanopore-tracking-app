import { describe, it, expect } from 'vitest'
import { processHTSFPdf, validateHTSFData } from '../../src/lib/pdf/htsf-pdf-processor'

describe('HTSF PDF Processor', () => {
  describe('processHTSFPdf', () => {
    it('should extract data from HTSF quote PDF', async () => {
      // Mock file
      const mockFile = new File([''], 'HTSF--JL-147_quote_160217072025.pdf', {
        type: 'application/pdf'
      })
      
      const result = await processHTSFPdf(mockFile)
      
      expect(result).toBeDefined()
      expect(result.quote_number).toBe('JL-147')
      expect(result.chart_field).toBe('HTSF-JL-147')
      expect(result.submitter_name).toBe('Dr. Jennifer Liu')
      expect(result.submitter_email).toBe('jliu@university.edu')
      expect(result.samples).toHaveLength(3)
    })

    it('should parse quote number from filename', async () => {
      const testCases = [
        { filename: 'HTSF--AB-123_quote.pdf', expected: 'AB-123' },
        { filename: 'HTSF--XY-999_quote_12345.pdf', expected: 'XY-999' },
        { filename: 'HTSF--TEST-001_quote.pdf', expected: 'TEST-001' }
      ]

      for (const testCase of testCases) {
        const mockFile = new File([''], testCase.filename, { type: 'application/pdf' })
        const result = await processHTSFPdf(mockFile)
        expect(result.quote_number).toBe(testCase.expected)
        expect(result.chart_field).toBe(`HTSF-${testCase.expected}`)
      }
    })

    it('should extract sample data with correct structure', async () => {
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' })
      const result = await processHTSFPdf(mockFile)
      
      expect(result.samples).toHaveLength(3)
      
      const firstSample = result.samples[0]
      expect(firstSample).toHaveProperty('sample_id')
      expect(firstSample).toHaveProperty('sample_name')
      expect(firstSample).toHaveProperty('concentration')
      expect(firstSample).toHaveProperty('concentration_unit')
      expect(firstSample).toHaveProperty('volume')
      expect(firstSample).toHaveProperty('volume_unit')
      expect(firstSample).toHaveProperty('sample_type')
    })
  })

  describe('validateHTSFData', () => {
    it('should validate valid HTSF data', () => {
      const validData = {
        samples: [
          {
            sample_id: 'TEST-001',
            sample_name: 'Test Sample',
            concentration: '100',
            concentration_unit: 'ng/μL',
            volume: '50',
            volume_unit: 'μL',
            sample_type: 'DNA'
          }
        ]
      }

      const errors = validateHTSFData(validData)
      expect(errors).toHaveLength(0)
    })

    it('should return errors for missing sample data', () => {
      const invalidData = {
        samples: []
      }

      const errors = validateHTSFData(invalidData)
      expect(errors).toContain('No samples found in PDF')
    })

    it('should validate missing sample fields', () => {
      const invalidData = {
        samples: [
          {
            sample_id: '',
            sample_name: '',
            concentration: 'invalid',
            volume: '-10'
          }
        ]
      }

      const errors = validateHTSFData(invalidData)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.includes('missing sample ID'))).toBe(true)
      expect(errors.some(e => e.includes('missing sample name'))).toBe(true)
      expect(errors.some(e => e.includes('Invalid concentration'))).toBe(true)
      expect(errors.some(e => e.includes('Invalid volume'))).toBe(true)
    })

    it('should validate numeric values', () => {
      const data = {
        samples: [
          {
            sample_id: 'TEST-001',
            sample_name: 'Test',
            concentration: '0',
            volume: '0'
          }
        ]
      }

      const errors = validateHTSFData(data)
      expect(errors.some(e => e.includes('Invalid concentration'))).toBe(true)
      expect(errors.some(e => e.includes('Invalid volume'))).toBe(true)
    })
  })
})