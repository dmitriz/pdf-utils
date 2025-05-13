/**
 * Test suite for PDF utility functions.
 * 
 * This suite focuses on testing the public API of the library:
 * - `mergePdfs`: The main function users will call to merge multiple PDF buffers into one
 * - `appendPdfPages`: A utility function for adding pages from a source PDF to a target document
 *
 * Tests are designed to validate behavior based on inputs and outputs,
 * rather than implementation details.
 */

// Simple mock for pdf-lib that provides the functionality our library needs
// without exposing internal implementation details
const mockSavedBuffer = Buffer.from('mock saved pdf data');

// Mock document for testing appendPdfPages
const createMockDoc = () => ({
  _pageCount: 0, // Internal tracker for testing
  getPageCount: function() { return this._pageCount; },
  // We'll test the behavior of appendPdfPages by checking if the page count increases
  // rather than verifying internal calls to methods like copyPages and addPage
});

// Mock the pdf-lib module
jest.mock('pdf-lib', () => {
  return {
    PDFDocument: {
      // The load function simulates loading a PDF and returns information about it
      load: jest.fn().mockImplementation(buffer => {
        // Different behaviors based on buffer content for testing
        if (buffer.toString().includes('empty')) {
          // Empty PDF case
          return Promise.resolve({
            getPageIndices: () => [],
          });
        } else if (buffer.toString().includes('error')) {
          // Error case
          return Promise.reject(new Error('Failed to load PDF'));
        } else {
          // Default case - determine page count based on buffer content
          const pageCount = buffer.toString().includes('multi') ? 3 : 1;
          const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
          
          return Promise.resolve({
            getPageIndices: () => pageIndices,
          });
        }
      }),
      
      // The create function returns a mock document
      create: jest.fn().mockImplementation(() => {
        const mockDoc = {
          _pageCount: 0,
          _pages: [],
          
          // Tracking calls for verification
          copyPagesCallCount: 0,
          addPageCallCount: 0,
          
          copyPages: jest.fn().mockImplementation((sourceDoc, indices) => {
            mockDoc.copyPagesCallCount += 1;
            // Return mock pages based on the indices
            return Promise.resolve(indices.map(i => ({ pageIndex: i })));
          }),
          
          addPage: jest.fn().mockImplementation(page => {
            mockDoc._pageCount += 1;
            mockDoc._pages.push(page);
            mockDoc.addPageCallCount += 1;
          }),
          
          getPageIndices: jest.fn().mockImplementation(() => {
            return Array.from({ length: mockDoc._pageCount }, (_, i) => i);
          }),
          
          save: jest.fn().mockImplementation(() => {
            if (mockDoc._saveError) {
              return Promise.reject(mockDoc._saveError);
            }
            return Promise.resolve(mockSavedBuffer);
          }),
          
          // Helper method for testing to simulate save error
          _setSaveError: function(error) {
            this._saveError = error;
          }
        };
        return Promise.resolve(mockDoc);
      })
    }
  };
});

// Import the functions to be tested
const { appendPdfPages, mergePdfs } = require('../src/pdf-utils');

describe('mergePdfs (public API)', () => {
  beforeEach(() => {
    // Clear mock counts between tests
    jest.clearAllMocks();
  });
  
  it('should merge multiple PDF buffers into a single buffer', async () => {
    // Test merging a couple of PDFs
    const pdfBuffers = [
      Buffer.from('pdf-content-1'),
      Buffer.from('pdf-content-2')
    ];
    
    const result = await mergePdfs(pdfBuffers);
    
    // Verify the result is a buffer
    expect(Buffer.isBuffer(result)).toBe(true);
    // The actual content would match our mock saved buffer
    expect(result).toEqual(mockSavedBuffer);
    
    // We're focusing on the output, not the implementation details
    // But we could add basic verification that the PDFDocument.create and
    // PDFDocument.load were called the expected number of times
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.create).toHaveBeenCalledTimes(1);
    expect(PDFDocument.load).toHaveBeenCalledTimes(2);
  });
  
  it('should handle an empty array of buffers', async () => {
    const result = await mergePdfs([]);
    
    // Should still return a buffer (empty PDF)
    expect(Buffer.isBuffer(result)).toBe(true);
    
    // Minimal implementation checking
    const { PDFDocument } = require('pdf-lib');
    expect(PDFDocument.create).toHaveBeenCalledTimes(1);
    expect(PDFDocument.load).not.toHaveBeenCalled(); // No docs to load
  });
  
  it('should throw an error if any PDF fails to load', async () => {
    const pdfBuffers = [
      Buffer.from('pdf-content-1'),
      Buffer.from('error-pdf') // This will cause PDFDocument.load to reject
    ];
    
    await expect(mergePdfs(pdfBuffers)).rejects.toThrow('Failed to merge PDFs');
  });
  
  it('should throw an error if PDF creation fails', async () => {
    // Make PDFDocument.create reject for this test
    const { PDFDocument } = require('pdf-lib');
    PDFDocument.create.mockRejectedValueOnce(new Error('Failed to create PDF'));
    
    await expect(mergePdfs([Buffer.from('pdf')])).rejects.toThrow('Failed to merge PDFs');
  });
  
  it('should throw an error if final PDF saving fails', async () => {
    // Use our mock to simulate a save error
    const { PDFDocument } = require('pdf-lib');
    PDFDocument.create.mockImplementationOnce(() => {
      const mockDoc = require('pdf-lib').PDFDocument.create.getMockImplementation()();
      return mockDoc.then(doc => {
        doc._setSaveError(new Error('Failed to save PDF'));
        return doc;
      });
    });
    
    await expect(mergePdfs([Buffer.from('pdf')])).rejects.toThrow('Failed to merge PDFs');
  });
});

// Since appendPdfPages is more of a utility function that requires PDFDocument instances,
// we test it more simply with less focus on implementation details
describe('appendPdfPages (utility function)', () => {
  it('should append pages from source buffer to target document', async () => {
    const sourceBuffer = Buffer.from('multi-page-pdf');
    
    // Create a target doc using the actual PDFDocument.create mock
    const { PDFDocument } = require('pdf-lib');
    const targetDoc = await PDFDocument.create();
    
    // Initial page count should be 0
    expect(targetDoc._pageCount).toBe(0);
    
    const result = await appendPdfPages(sourceBuffer, targetDoc);
    
    // Verify the function reports success and the correct number of pages
    expect(result).toEqual({ success: true, pagesAdded: 3 }); // Based on our mock for 'multi'
    
    // The target document should now have pages added
    expect(targetDoc._pageCount).toBe(3);
  });
  
  it('should handle empty source PDFs', async () => {
    const sourceBuffer = Buffer.from('empty-pdf');
    
    const { PDFDocument } = require('pdf-lib');
    const targetDoc = await PDFDocument.create();
    
    const result = await appendPdfPages(sourceBuffer, targetDoc);
    
    expect(result).toEqual({ success: true, pagesAdded: 0 });
    expect(targetDoc._pageCount).toBe(0); // No pages added
  });
  
  it('should return failure object when source PDF fails to load', async () => {
    const sourceBuffer = Buffer.from('error-pdf');
    
    const { PDFDocument } = require('pdf-lib');
    const targetDoc = await PDFDocument.create();
    
    const result = await appendPdfPages(sourceBuffer, targetDoc);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.pagesAdded).toBe(0);
  });
});
