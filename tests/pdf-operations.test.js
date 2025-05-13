/**
 * Unit tests for PDF utility functions using mocks.
 * 
 * These tests focus on testing the library functionality with mocks, not the actual PDF lib.
 */

// Import the functions to be tested
const { appendPdfs, mergePdfs } = require('../src/pdf-utils');

// Define a predictable mock PDF result that our mock pdf-lib will return
const MOCK_MERGED_PDF_RESULT = Buffer.from('mock-merged-pdf-content');

// Create a module mock for pdf-lib
jest.mock('pdf-lib', () => {
  const MOCK_SAVE_RESULT = Buffer.from('mock-merged-pdf-content'); // Re-define or ensure it's accessible if defined outside

  return {
    PDFDocument: {
      load: jest.fn().mockImplementation(buffer => {
        const bufferStr = buffer.toString();

        if (bufferStr === 'target-load-error-pdf') {
          return Promise.reject(new Error('Failed to load target PDF'));
        }
        // Handles 'error-pdf' from original tests and 'source-load-error-pdf' for new ones
        if (bufferStr === 'error-pdf' || bufferStr === 'source-load-error-pdf') {
          return Promise.reject(new Error('Failed to load source PDF'));
        }
        // Specific mock for the case where a PDF-like buffer fails to load
        if (bufferStr === '%PDF-source-error-looks-like-pdf') {
          return Promise.reject(new Error('Simulated load failure for PDF-like source'));
        }
        // For testing mergePdfs error message when internal error has no message
        if (bufferStr === 'source-error-no-message-pdf') {
          return Promise.reject({}); // Error object without a 'message' property
        }

        // Default successful load behavior
        const pageIndices = bufferStr.includes('multi') ? [0, 1, 2] : // 3 pages
                            (bufferStr.includes('empty') ? [] : [0, 1]); // 0 or 2 pages

        const mockDoc = {
          _pageCount: pageIndices.length,
          _pageIndices: [...pageIndices], // Use a copy
          
          copyPages: jest.fn().mockImplementation((sourceDoc, indicesToCopy) => {
            // Simulate copying pages; the actual content doesn't matter for the mock
            return Promise.resolve(indicesToCopy.map(idx => ({ pageIndex: idx, source: 'mocked' })));
          }),
          addPage: jest.fn().mockImplementation(page => {
            mockDoc._pageCount++;
            // mockDoc._pageIndices.push(mockDoc._pageIndices.length); // Not strictly needed for current tests
          }),
          getPageIndices: jest.fn().mockImplementation(() => {
            return mockDoc._pageIndices;
          }),
          getPageCount: jest.fn().mockImplementation(() => {
            // This should reflect the number of pages in the loaded/created document
            return mockDoc._pageIndices.length; 
          }),
          save: jest.fn().mockResolvedValue(MOCK_SAVE_RESULT)
        };
        return Promise.resolve(mockDoc);
      }),
      create: jest.fn().mockImplementation(() => {
        const mockDoc = {
          _pageCount: 0,
          _pageIndices: [],
          copyPages: jest.fn().mockImplementation((sourceDoc, pageIndicesToCopy) => {
            return Promise.resolve(pageIndicesToCopy.map(idx => ({ pageIndex: idx, source: 'mocked' })));
          }),
          addPage: jest.fn().mockImplementation(page => {
            mockDoc._pageCount++;
            // mockDoc._pageIndices.push(mockDoc._pageIndices.length);
          }),
          getPageIndices: jest.fn().mockImplementation(() => mockDoc._pageIndices),
          getPageCount: jest.fn().mockImplementation(() => mockDoc._pageCount),
          save: jest.fn().mockResolvedValue(MOCK_SAVE_RESULT)
        };
        return Promise.resolve(mockDoc);
      })
    }
  };
});

describe('mergePdfs (public API)', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });
  
  it('should merge multiple PDF buffers when passed as array argument', async () => {
    // ARRANGE: Set up test data - multiple PDF buffers to merge
    const pdfInputBuffers = [
      Buffer.from('pdf-content-1'),
      Buffer.from('pdf-content-2')
    ];
    
    // ACT: Call the function with array syntax
    const mergedPdfBuffer = await mergePdfs(pdfInputBuffers);
    
    // ASSERT: Focus on the expected output behavior
    // 1. The result should be a Buffer (correct type)
    expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
    
    // 2. The output should match what the pdf-lib's save method produced
    expect(mergedPdfBuffer).toEqual(MOCK_MERGED_PDF_RESULT);
  });
  
  it('should merge multiple PDF buffers when passed as individual arguments', async () => {
    // ARRANGE: Create two PDF buffers
    const pdfBuffer1 = Buffer.from('pdf-content-1');
    const pdfBuffer2 = Buffer.from('pdf-content-2');
    
    // ACT: Call the function with multiple arguments syntax
    const mergedPdfBuffer = await mergePdfs(pdfBuffer1, pdfBuffer2);
    
    // ASSERT: Verify the result
    expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
    expect(mergedPdfBuffer).toEqual(MOCK_MERGED_PDF_RESULT);
  });
  
  it('should throw an error if any PDF fails to load', async () => {
    // ARRANGE: One normal buffer and one that will trigger an error
    const normalPdf = Buffer.from('normal-pdf');
    const errorPdf = Buffer.from('source-load-error-pdf'); // Use specific string for mock
    
    // ASSERT: The function should propagate the error appropriately
    await expect(mergePdfs(normalPdf, errorPdf))
      .rejects
      .toThrow('Failed to merge PDFs');
  });

  it('should return an empty PDF if no arguments are provided', async () => {
    const mergedPdfBuffer = await mergePdfs();
    expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
    // The mock for PDFDocument.create().save() returns MOCK_SAVE_RESULT (content: 'mock-merged-pdf-content')
    expect(mergedPdfBuffer).toEqual(MOCK_MERGED_PDF_RESULT); 
    const { PDFDocument } = require('pdf-lib'); // Get the mocked version
    expect(PDFDocument.create).toHaveBeenCalledTimes(1);
  });

  it('should return an empty PDF if an empty array is provided', async () => {
    const mergedPdfBuffer = await mergePdfs([]);
    expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
    expect(mergedPdfBuffer).toEqual(MOCK_MERGED_PDF_RESULT);
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.create).toHaveBeenCalledTimes(1);
  });

  it('should throw a specific error message if an internal error occurs without a message during merge', async () => {
    const errorSource = Buffer.from('source-error-no-message-pdf'); // Triggers error without message
    await expect(mergePdfs(errorSource))
      .rejects
      .toThrow('Failed to merge PDFs: Unknown error during PDF merge');
  });
});

describe('appendPdfs (public API)', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });
  
  it('should append pages from source buffer to target buffer', async () => {
    // ARRANGE: Create test buffers
    const sourceBuffer = Buffer.from('multi-page-pdf');
    const targetBuffer = Buffer.from('target-pdf');
    
    // ACT: Call the function
    const result = await appendPdfs(sourceBuffer, targetBuffer);
    
    // ASSERT: Check the function's return value
    expect(result).toMatchObject({
      success: true,
      pagesAdded: 3  // Based on our mock for 'multi-page-pdf'
    });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
  
  it('should handle empty source PDFs without adding pages', async () => {
    // ARRANGE: Create an empty source PDF
    const emptySourceBuffer = Buffer.from('empty-pdf');
    const targetBuffer = Buffer.from('target-pdf');
    
    // ACT: Call the function
    const result = await appendPdfs(emptySourceBuffer, targetBuffer);
    
    // ASSERT: Should report success with zero pages added
    expect(result).toMatchObject({
      success: true,
      pagesAdded: 0
    });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
  
  it('should return failure object when source PDF fails to load', async () => {
    // ARRANGE: Create a buffer that will cause load to fail
    const badSourceBuffer = Buffer.from('source-load-error-pdf'); // Use specific string for mock
    const targetBuffer = Buffer.from('target-pdf');
    
    // ACT: Call the function
    const result = await appendPdfs(badSourceBuffer, targetBuffer);
    
    // ASSERT: Check error handling
    expect(result).toMatchObject({
      success: false,
      pagesAdded: 0
    });
    expect(result.error).toBeDefined();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it('should return failure when target PDF buffer fails to load', async () => {
    const sourceBuffer = Buffer.from('multi-page-pdf'); // Valid source
    const targetErrorBuffer = Buffer.from('target-load-error-pdf'); // Target will fail to load
    
    const result = await appendPdfs(sourceBuffer, targetErrorBuffer);
    
    expect(result).toMatchObject({
      success: false,
      pagesAdded: 0,
      buffer: targetErrorBuffer, // Should return original target buffer on target load failure
    });
    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Failed to load target PDF');
  });

  it('should handle source PDF that looks like PDF but fails to load, treating as empty', async () => {
    // This buffer content must match the mock condition for a PDF-like source that fails to load
    const sourceErrorLooksLikePdf = Buffer.from('%PDF-source-error-looks-like-pdf');
    const targetBuffer = Buffer.from('target-pdf-for-special-case');
    
    const result = await appendPdfs(sourceErrorLooksLikePdf, targetBuffer);
    
    // According to _appendPdfToDoc logic, this is success: true, pagesAdded: 0
    expect(result).toMatchObject({
      success: true, 
      pagesAdded: 0,
    });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    // targetDoc.save() would be called, so the buffer should be MOCK_MERGED_PDF_RESULT
    expect(result.buffer).toEqual(MOCK_MERGED_PDF_RESULT); 
    expect(result.error).toBeUndefined();
  });
});
