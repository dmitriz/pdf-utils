/**
 * Test suite for PDF utility functions.
 * 
 * This suite focuses on testing the public API of the library:
 * - `mergePdfs`: The main function users will call to merge multiple PDF buffers into one
 *    - Supports both individual arguments (mergePdfs(pdf1, pdf2)) and arrays (mergePdfs([pdf1, pdf2]))
 * - `appendPdfPages`: A utility function for adding pages from a source PDF to a target document
 */

// Import the functions to be tested
const { appendPdfs, mergePdfs } = require('../src/pdf-utils');

// Define a predictable mock PDF result that our mock pdf-lib will return
const MOCK_MERGED_PDF_RESULT = Buffer.from('mock-merged-pdf-content');

// Create a module mock for pdf-lib
jest.mock('pdf-lib', () => {
  // This factory function cannot reference variables from outside its scope
  // We'll use module-level state instead
  return {
    __shouldFailCreate: false,
    __shouldFailSave: false,
    
    // Methods to control test behavior
    __setFailCreate: function(shouldFail) {
      this.__shouldFailCreate = shouldFail;
    },
    __setFailSave: function(shouldFail) {
      this.__shouldFailSave = shouldFail;
    },
    
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
          
          save: jest.fn().mockResolvedValue(MOCK_MERGED_PDF_RESULT)
        };
        
        return Promise.resolve(mockDoc);
      }),
      
      create: jest.fn().mockImplementation(function() {
        // Access the module state through 'this' to determine if we should fail
        if (require('pdf-lib').__shouldFailCreate) {
          require('pdf-lib').__setFailCreate(false); // Reset for next test
          return Promise.reject(new Error('Failed to create PDF'));
        }
        
        const mockDoc = {
          _pageCount: 0,
          _pageIndices: [0, 1], // Default to 2 pages
          
          copyPages: jest.fn().mockImplementation((sourceDoc, pageIndices) => {
            return Promise.resolve(pageIndices.map(idx => ({ pageIndex: idx })));
          }),
          
          addPage: jest.fn().mockImplementation(page => {
            mockDoc._pageCount++;
          }),
          
          getPageIndices: jest.fn().mockImplementation(() => {
            return mockDoc._pageIndices;
          }),
          
          save: jest.fn().mockImplementation(() => {
            if (require('pdf-lib').__shouldFailSave) {
              require('pdf-lib').__setFailSave(false); // Reset for next test
              return Promise.reject(new Error('Failed to save PDF'));
            }
            return Promise.resolve(MOCK_MERGED_PDF_RESULT);
          })
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
    
    // Reset test control flags
    const mockPdfLib = require('pdf-lib');
    mockPdfLib.__setFailCreate(false);
    mockPdfLib.__setFailSave(false);
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
    
    // Minimal verification that the right number of PDFs were loaded
    // This verifies our code is working but isn't overly coupled to implementation
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.load).toHaveBeenCalledTimes(pdfInputBuffers.length);
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
    
    // Check that both PDFs were processed
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.load).toHaveBeenCalledTimes(2);
    expect(PDFDocument.load).toHaveBeenNthCalledWith(1, pdfBuffer1);
    expect(PDFDocument.load).toHaveBeenNthCalledWith(2, pdfBuffer2);
  });
  
  it('should merge a single PDF buffer when passed as the only argument', async () => {
    // ARRANGE: Create a single PDF buffer
    const singlePdfBuffer = Buffer.from('single-pdf-content');
    
    // ACT: Call the function with a single argument
    const resultBuffer = await mergePdfs(singlePdfBuffer);
    
    // ASSERT: Verify the result
    expect(Buffer.isBuffer(resultBuffer)).toBe(true);
    expect(resultBuffer).toEqual(MOCK_MERGED_PDF_RESULT);
    
    // Check that the PDF was processed
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.load).toHaveBeenCalledTimes(1);
    expect(PDFDocument.load).toHaveBeenCalledWith(singlePdfBuffer);
  });
  
  it('should handle an empty array of buffers', async () => {
    // ARRANGE: Empty array of PDF buffers
    const emptyInputArray = [];
    
    // ACT: Call function with empty array
    const result = await mergePdfs(emptyInputArray);
    
    // ASSERT: Should still produce a valid buffer (an empty PDF)
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(MOCK_MERGED_PDF_RESULT);
    
    // Verify no PDFs were loaded
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.load).not.toHaveBeenCalled();
  });
  
  it('should handle no arguments and return an empty PDF', async () => {
    // ACT: Call function with no arguments
    const result = await mergePdfs();
    
    // ASSERT: Should still produce a valid buffer (an empty PDF)
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(MOCK_MERGED_PDF_RESULT);
    
    // Verify no PDFs were loaded
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.load).not.toHaveBeenCalled();
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
  
  it('should throw an error if PDF creation fails', async () => {
    // ARRANGE: Configure mock to fail on PDFDocument.create
    const mockPdfLib = require('pdf-lib');
    mockPdfLib.__setFailCreate(true);
    
    // ASSERT: Should throw with appropriate message
    await expect(mergePdfs([Buffer.from('any-pdf')]))
      .rejects
      .toThrow('Failed to merge PDFs');
  });
  
  it('should throw an error if final PDF saving fails', async () => {
    // ARRANGE: Configure mock to fail on save
    const mockPdfLib = require('pdf-lib');
    mockPdfLib.__setFailSave(true);
    
    // ASSERT: Should throw with appropriate message
    await expect(mergePdfs([Buffer.from('any-pdf')]))
      .rejects
      .toThrow('Failed to merge PDFs');
  });
});

describe('appendPdfs (utility function)', () => {
  let mockTargetDoc;
  
  beforeEach(async () => {
    // Create a fresh mock target document for each test
    const { PDFDocument } = require('pdf-lib');
    mockTargetDoc = await PDFDocument.create();
    
    // Reset any test control flags
    jest.clearAllMocks();
  });
  
  it('should append pages from source buffer to target document', async () => {
    // ARRANGE: Create a multi-page source buffer
    const sourceBuffer = Buffer.from('multi-page-pdf');
    
    // ACT: Call the function
    const result = await appendPdfs(sourceBuffer, mockTargetDoc);
    
    // ASSERT: Check the function's return value
    expect(result).toEqual({
      success: true,
      pagesAdded: 3  // Based on our mock for 'multi-page-pdf'
    });
    
    // Verify the target document was modified correctly
    expect(mockTargetDoc.copyPages).toHaveBeenCalled();
    expect(mockTargetDoc.addPage).toHaveBeenCalled();
  });
  
  it('should handle empty source PDFs without adding pages', async () => {
    // ARRANGE: Create an empty source PDF
    const emptySourceBuffer = Buffer.from('empty-pdf');
    
    // ACT: Call the function
    const result = await appendPdfs(emptySourceBuffer, mockTargetDoc);
    
    // ASSERT: Should report success with zero pages added
    expect(result).toEqual({
      success: true,
      pagesAdded: 0
    });
    
    // Verify no pages were added to target
    expect(mockTargetDoc.addPage).not.toHaveBeenCalled();
  });
  
  it('should return failure object when source PDF fails to load', async () => {
    // ARRANGE: Create a buffer that will cause load to fail
    const badSourceBuffer = Buffer.from('error-pdf');
    
    // ACT: Call the function
    const result = await appendPdfs(badSourceBuffer, mockTargetDoc);
    
    // ASSERT: Check error handling
    expect(result).toMatchObject({
      success: false,
      pagesAdded: 0
    });
    expect(result.error).toBeDefined();
  });
});
