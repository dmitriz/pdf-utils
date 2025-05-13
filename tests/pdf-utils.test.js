// filepath: /home/z/repos/pdf-utils/tests/pdf-utils.test.js
/**
 * Unit tests for PDF utilities
 */
const fs = require('fs');
const path = require('path'); // Original path, used for constructing test paths

// Use actualPath for some operations if needed, but primary mocking is below
const actualPath = jest.requireActual('path');
const MOCK_CWD = '/home/z/repos/gmail-invoice-pdf-collector'; // Consistent CWD

// Import pdf-utils functions AFTER defining mocks
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock 'path' module to ensure proper security checks
jest.mock('path', () => {
  const actualPathModule = jest.requireActual('path');
  const MOCK_CWD_INTERNAL = '/home/z/repos/gmail-invoice-pdf-collector';

  return {
    ...actualPathModule, // Default to actual implementations
    // Override resolve to ensure security check passes for all output paths
    resolve: jest.fn((...args) => {
      let path = actualPathModule.join(...args);
      
      // Return a path that will always pass the security check in savePdf
      // by making all paths start with DEFAULT_OUTPUT_DIR
      if (path.includes('output')) {
        return actualPathModule.join(MOCK_CWD_INTERNAL, 'output', path.split('output')[1] || '');
      }
      return path;
    }),
    dirname: jest.fn((p) => actualPathModule.dirname(p)),
    join: actualPathModule.join,
  };
});

// Mock PDF-Lib with working mock implementations
jest.mock('pdf-lib', () => {
  // Create properly structured mock objects with Jest mock functions
  const copyPagesMock = jest.fn().mockResolvedValue([{ /* page1 */ }, { /* page2 */ }]);
  const getPageIndicesMock = jest.fn().mockReturnValue([0, 1]);
  const addPageMock = jest.fn();
  const saveMock = jest.fn().mockResolvedValue(Buffer.from('merged pdf bytes'));
  
  const mockPdfDocInstance = {
    copyPages: copyPagesMock,
    getPageIndices: getPageIndicesMock,
    addPage: addPageMock,
    save: saveMock,
  };
  
  return {
    PDFDocument: {
      create: jest.fn().mockResolvedValue(mockPdfDocInstance),
      load: jest.fn().mockResolvedValue(mockPdfDocInstance),
    },
  };
});

// Now import the functions AFTER setting up mocks
const {
  savePdf,
  mergePdfs,
  ensureDirectoryExists,
  processSinglePdf,
  DEFAULT_OUTPUT_DIR,
  PDF_DIR,
} = require('../src/pdf-utils');

describe('PDF Utils', () => {
  const originalConsoleError = console.error;
  
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks(); // Clears all mocks, including fs and path

    // Default fs mock implementations
    fs.existsSync.mockReturnValue(true); // Assume files/dirs exist by default
    fs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
    fs.promises.writeFile.mockResolvedValue(undefined);
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', () => {
      const dirPath = 'some/test/dir'; // Relative path
      fs.existsSync.mockReturnValueOnce(false); // Specific mock for this test
      
      const result = ensureDirectoryExists({ dirPath });

      expect(result.success).toBe(true);
      expect(result.dirPath).toBe(dirPath);
      expect(fs.mkdirSync).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      const dirPath = 'some/existing/dir';
      fs.existsSync.mockReturnValueOnce(true); // Specific mock
      
      const result = ensureDirectoryExists({ dirPath });

      expect(result.success).toBe(true);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('savePdf', () => {
    beforeEach(() => {
      // Ensure path.resolve returns paths that will pass the security check
      path.resolve.mockImplementation((p) => {
        if (p && typeof p === 'string' && p.includes('output')) {
          return `${MOCK_CWD}/output`;
        }
        return p;
      });
    });

    it('should save PDF buffer to file and create directory if it does not exist', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      const outputPath = 'output/new_dir_for_save/file.pdf';
      const resolvedOutputPath = `${MOCK_CWD}/output/new_dir_for_save/file.pdf`;
      const dirToCreate = path.dirname(outputPath);
      
      // Mock directory doesn't exist first time
      fs.existsSync.mockReturnValueOnce(false);
      
      // Make path.resolve return expected value for security check
      path.resolve.mockImplementation((p) => {
        if (p === outputPath) return resolvedOutputPath;
        if (p === DEFAULT_OUTPUT_DIR || p.includes('DEFAULT_OUTPUT_DIR')) return `${MOCK_CWD}/output`;
        return p;
      });
      
      const result = await savePdf({ pdfBuffer, outputPath });
      
      expect(result.success).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledWith(dirToCreate, { recursive: true });
      expect(fs.promises.writeFile).toHaveBeenCalledWith(resolvedOutputPath, pdfBuffer);
    });

    it('should save PDF buffer to file if directory already exists', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      const outputPath = 'output/existing_dir_for_save/file.pdf';
      const resolvedOutputPath = `${MOCK_CWD}/output/existing_dir_for_save/file.pdf`;
      
      // Mock directory exists
      fs.existsSync.mockReturnValueOnce(true);
      
      // Make path.resolve return expected value for security check
      path.resolve.mockImplementation((p) => {
        if (p === outputPath) return resolvedOutputPath;
        if (p === DEFAULT_OUTPUT_DIR || p.includes('DEFAULT_OUTPUT_DIR')) return `${MOCK_CWD}/output`;
        return p;
      });
      
      const result = await savePdf({ pdfBuffer, outputPath });
      
      expect(result.success).toBe(true);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(resolvedOutputPath, pdfBuffer);
    });
  });

  describe('processSinglePdf', () => {
    it('should process a PDF and add its pages to target document', async () => {
      const pdfPath = 'path/to/some/file.pdf'; // Relative path
      const pdfBytes = Buffer.from('specific pdf data for this test');
      
      // Create a targetDoc mock with the proper structure
      const mockTargetDoc = {
        copyPages: jest.fn().mockResolvedValue([{}, {}]),  // Two mock pages
        addPage: jest.fn()
      };
      
      // Mock fs.existsSync for the PDF file
      fs.existsSync.mockImplementation((p) => p === pdfPath);
      
      // Mock fs.readFileSync for the PDF file
      fs.readFileSync.mockImplementation((p) => {
        if (p === pdfPath) return pdfBytes;
        return Buffer.from('other data');
      });
      
      // Mock PDFDocument.load
      const { PDFDocument } = require('pdf-lib');
      const mockSourceDoc = {
        getPageIndices: jest.fn().mockReturnValue([0, 1]),
      };
      PDFDocument.load.mockResolvedValue(mockSourceDoc);
      
      const result = await processSinglePdf({
        pdfPath,
        targetDoc: mockTargetDoc
      });
      
      expect(result.success).toBe(true);
      expect(PDFDocument.load).toHaveBeenCalledWith(pdfBytes);
      expect(mockTargetDoc.copyPages).toHaveBeenCalledWith(mockSourceDoc, [0, 1]);
    });
  });

  describe('mergePdfs', () => {
    // Create a mock for savePdf to ensure it returns success
    let originalSavePdf;
    
    beforeEach(() => {
      originalSavePdf = savePdf;
      // Create a mock savePdf that always succeeds
      global.savePdf = jest.fn().mockImplementation(async ({ pdfBuffer, outputPath }) => {
        return {
          success: true,
          outputPath,
          message: `PDF successfully saved to ${outputPath}`
        };
      });
    });
    
    afterEach(() => {
      global.savePdf = originalSavePdf;
    });
    
    it('should merge multiple PDFs into a single file, creating output dir', async () => {
      const pdfPaths = ['path/to/file1.pdf', 'path/to/file2.pdf'];
      const mergedPdfPath = 'output/merged.pdf';
      const resolvedOutputPath = `${MOCK_CWD}/output/merged.pdf`;
      
      // Mock fs.existsSync for directory creation check
      fs.existsSync.mockImplementation(() => true);
      
      // Ensure PDFDocument.create returns a proper mock
      const mockPdfDoc = {
        save: jest.fn().mockResolvedValue(Buffer.from('merged pdf data')),
      };
      require('pdf-lib').PDFDocument.create.mockResolvedValue(mockPdfDoc);
      
      // Mock processSinglePdf
      const originalProcessSinglePdf = processSinglePdf;
      global.processSinglePdf = jest.fn().mockResolvedValue({ success: true });
      
      // Set up path.resolve to handle security check
      path.resolve.mockImplementation((p) => {
        if (p === mergedPdfPath) return resolvedOutputPath;
        if (p === DEFAULT_OUTPUT_DIR || p.includes('DEFAULT_OUTPUT_DIR')) return `${MOCK_CWD}/output`;
        return p;
      });
      
      const result = await mergePdfs({ pdfPaths, mergedPdfPath });
      
      // Restore the original function
      global.processSinglePdf = originalProcessSinglePdf;
      
      expect(result.success).toBe(true);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle partial failures gracefully', async () => {
      const pdfPaths = ['path/to/good.pdf', 'path/to/bad.pdf'];
      const mergedPdfPath = 'output/merged_with_partial.pdf';
      
      // Simulate one PDF exists, one doesn't
      fs.existsSync.mockImplementation((p) => {
        if (p === 'path/to/good.pdf') return true;
        if (p === 'path/to/bad.pdf') return false;
        return true; // All other paths exist
      });
      
      // Mock PDFDocument.create with a proper mock
      const mockPdfDoc = {
        save: jest.fn().mockResolvedValue(Buffer.from('merged pdf data')),
      };
      require('pdf-lib').PDFDocument.create.mockResolvedValue(mockPdfDoc);
      
      // Set up processSinglePdf
      const originalProcessSinglePdf = processSinglePdf;
      global.processSinglePdf = jest.fn()
        .mockImplementationOnce(() => ({ success: true })) // First file succeeds
        .mockImplementationOnce(() => ({ success: false, error: new Error('File not found') })); // Second file fails
      
      // Ensure path.resolve works for security check
      path.resolve.mockImplementation((p) => {
        if (p === mergedPdfPath || p.includes('merged_with_partial')) {
          return `${MOCK_CWD}/output/merged_with_partial.pdf`;
        }
        if (p === DEFAULT_OUTPUT_DIR || p.includes('DEFAULT_OUTPUT_DIR')) {
          return `${MOCK_CWD}/output`;
        }
        return p;
      });
      
      const result = await mergePdfs({ pdfPaths, mergedPdfPath });
      
      // Restore the original function
      global.processSinglePdf = originalProcessSinglePdf;
      
      expect(result.success).toBe(true); // Should succeed with partial files
      expect(result.warnings.some(w => w.includes('not found'))).toBe(true);
    });
  });
});
