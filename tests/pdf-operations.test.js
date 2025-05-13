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
  return {
    // The mock PDFDocument class
    PDFDocument: {
      load: jest.fn().mockImplementation(buffer => {
        // For testing error conditions
        if (buffer.toString().includes('error')) {
          return Promise.reject(new Error('Failed to load PDF'));
        }
        
        // Create a mock document with appropriate page count
        const mockDoc = {
          _pageCount: 0,
          _pageIndices: buffer.toString().includes('multi') ? 
                        [0, 1, 2] : // Multi-page document (3 pages)
                        (buffer.toString().includes('empty') ? [] : [0, 1]), // Empty or standard (2 pages)
          
          copyPages: jest.fn().mockImplementation((sourceDoc, pageIndices) => {
            return Promise.resolve(pageIndices.map(idx => ({ pageIndex: idx })));
          }),
          
          addPage: jest.fn().mockImplementation(page => {
            mockDoc._pageCount++;
          }),
          
          getPageIndices: jest.fn().mockImplementation(() => {
            return mockDoc._pageIndices;
          }),
          
          getPageCount: jest.fn().mockImplementation(() => {
            return mockDoc._pageIndices.length;
          }),
          
          save: jest.fn().mockResolvedValue(MOCK_MERGED_PDF_RESULT)
        };
        
        return Promise.resolve(mockDoc);
      }),
      
      create: jest.fn().mockImplementation(function() {
        const mockDoc = {
          _pageCount: 0,
          _pageIndices: [],
          
          copyPages: jest.fn().mockImplementation((sourceDoc, pageIndices) => {
            return Promise.resolve(pageIndices.map(idx => ({ pageIndex: idx })));
          }),
          
          addPage: jest.fn().mockImplementation(page => {
            mockDoc._pageCount++;
            mockDoc._pageIndices.push(mockDoc._pageIndices.length);
          }),
          
          getPageIndices: jest.fn().mockImplementation(() => {
            return mockDoc._pageIndices;
          }),
          
          getPageCount: jest.fn().mockImplementation(() => {
            return mockDoc._pageIndices.length;
          }),
          
          save: jest.fn().mockResolvedValue(MOCK_MERGED_PDF_RESULT)
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
    const errorPdf = Buffer.from('error-pdf'); // Will cause load to reject
    
    // ASSERT: The function should propagate the error appropriately
    await expect(mergePdfs(normalPdf, errorPdf))
      .rejects
      .toThrow('Failed to merge PDFs');
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
    const badSourceBuffer = Buffer.from('error-pdf');
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
});
