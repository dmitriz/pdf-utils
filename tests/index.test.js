/**
 * Unit tests for index.js which serves as the main API wrapper
 */
const path = require('path');

// Clear any existing mocks
jest.resetModules();

// Define our mocks
const mockSavePdf = jest.fn().mockImplementation(({ pdfBuffer, outputPath }) => {
  return Promise.resolve({
    success: true,
    path: outputPath
  });
});

const mockMergePdfsFromDisk = jest.fn().mockImplementation(({ pdfPaths, outputPath }) => {
  return Promise.resolve({
    success: true,
    path: outputPath
  });
});

const mockEnsureDirectoryExists = jest.fn().mockImplementation(({ dirPath }) => {
  return Promise.resolve({
    success: true,
    path: dirPath
  });
});

// Create a mock module
jest.mock('../src/pdf-utils', () => {
  return {
    savePdf: mockSavePdf,
    mergePdfsFromDisk: mockMergePdfsFromDisk,
    ensureDirectoryExists: mockEnsureDirectoryExists
  };
});

describe('index.js API wrapper', () => {
  let pdfUtilsIndexApi;
  
  // Before each test, reload the module to reset its state
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Re-setup our mocks
    require('../src/pdf-utils').savePdf = mockSavePdf;
    require('../src/pdf-utils').mergePdfsFromDisk = mockMergePdfsFromDisk;
    require('../src/pdf-utils').ensureDirectoryExists = mockEnsureDirectoryExists;
    
    // Reload the index module to use fresh mocks
    pdfUtilsIndexApi = require('../src/index');
  });

  describe('configure', () => {
    it('should merge provided options with defaults', async () => {
      // Call configure with custom options
      const result = pdfUtilsIndexApi.configure({
        baseDir: '/custom/dir',
        allowOutsideBaseDir: true
      });

      // Verify that it returns the API for chaining
      expect(result).toBe(pdfUtilsIndexApi);

      // Test that the config was applied by using the API
      const testPath = 'test.pdf';
      await pdfUtilsIndexApi.savePdf({
        pdfBuffer: Buffer.from('test'),
        outputPath: testPath
      });
      
      // Should have used the custom baseDir
      expect(mockSavePdf).toHaveBeenCalledWith({
        pdfBuffer: Buffer.from('test'),
        outputPath: path.resolve('/custom/dir', testPath),
        allowOutsideBaseDir: true
      });
    });
  });

  describe('savePdf', () => {
    it('should correctly handle absolute paths', async () => {
      const absPath = '/absolute/path/doc.pdf';
      await pdfUtilsIndexApi.savePdf({
        pdfBuffer: Buffer.from('test'),
        outputPath: absPath
      });

      // Should not modify absolute paths
      expect(mockSavePdf).toHaveBeenCalledWith({
        pdfBuffer: Buffer.from('test'),
        outputPath: absPath,
        allowOutsideBaseDir: false
      });
    });

    it('should resolve relative paths based on baseDir', async () => {
      const relPath = 'relative/path/doc.pdf';
      const baseDir = process.cwd(); // Default baseDir

      await pdfUtilsIndexApi.savePdf({
        pdfBuffer: Buffer.from('test'),
        outputPath: relPath
      });

      // Should resolve relative paths
      expect(mockSavePdf).toHaveBeenCalledWith({
        pdfBuffer: Buffer.from('test'),
        outputPath: path.resolve(baseDir, relPath),
        allowOutsideBaseDir: false
      });
    });
  });

  describe('mergePdfs', () => {
    it('should correctly resolve all paths', async () => {
      const pdfPaths = [
        '/absolute/path1.pdf',
        'relative/path2.pdf'
      ];
      const outputPath = 'output/merged.pdf';
      const baseDir = process.cwd(); // Default baseDir

      await pdfUtilsIndexApi.mergePdfs({
        pdfPaths,
        outputPath
      });

      // Should resolve relative paths but keep absolute intact
      expect(mockMergePdfsFromDisk).toHaveBeenCalledWith({
        pdfPaths: [
          '/absolute/path1.pdf',
          path.resolve(baseDir, 'relative/path2.pdf')
        ],
        outputPath: path.resolve(baseDir, outputPath),
        allowOutsideBaseDir: false
      });
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory when createDirsIfMissing is true', async () => {
      const dirPath = 'some/dir';
      const baseDir = process.cwd(); // Default baseDir

      await pdfUtilsIndexApi.ensureDirectoryExists({
        dirPath
      });

      // Should call ensureDirectoryExists with resolved path
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith({
        dirPath: path.resolve(baseDir, dirPath)
      });
    });

    it('should return error when createDirsIfMissing is false', async () => {
      // Configure with createDirsIfMissing = false
      pdfUtilsIndexApi.configure({
        createDirsIfMissing: false
      });

      const result = await pdfUtilsIndexApi.ensureDirectoryExists({
        dirPath: 'test/dir'
      });

      // Should return error and not call the underlying function
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toMatch(/Directory creation disabled/);
      expect(mockEnsureDirectoryExists).not.toHaveBeenCalled();
    });
    
    // Add test for default branch coverage
    it('should use correct default values', async () => {
      // Test the default values by examining the configuration
      const dirPath = 'test-defaults/dir';
      await pdfUtilsIndexApi.ensureDirectoryExists({ dirPath });
      
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith({
        dirPath: path.resolve(process.cwd(), dirPath)
      });
    });
  });
});
