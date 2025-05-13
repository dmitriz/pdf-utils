/**
 * Unit tests for index.js which serves as the main API wrapper
 */

// Save original module require to use in resetModule
const originalRequire = require;

// Import modules
const path = require('path');

// Mock the pdf-utils dependency before importing any other modules
jest.mock('../src/pdf-utils', () => {
  return {
    savePdf: jest.fn().mockImplementation(({ pdfBuffer, outputPath }) => {
      return Promise.resolve({
        success: true,
        path: outputPath
      });
    }),
    mergePdfs: jest.fn().mockImplementation(({ pdfPaths, outputPath }) => {
      return Promise.resolve({
        success: true,
        path: outputPath
      });
    }),
    ensureDirectoryExists: jest.fn().mockImplementation(({ dirPath }) => {
      return Promise.resolve({
        success: true,
        path: dirPath
      });
    })
  };
});

// Import these AFTER the mock is set up
const pdfUtils = require('../src/pdf-utils');
const indexPath = '../src/index';

describe('index.js API wrapper', () => {
  let pdfUtilsIndexApi;
  
  // Before each test, reload the module to reset its state
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    pdfUtilsIndexApi = require(indexPath);
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
      expect(pdfUtils.savePdf).toHaveBeenCalledWith({
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
      expect(pdfUtils.savePdf).toHaveBeenCalledWith({
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
      expect(pdfUtils.savePdf).toHaveBeenCalledWith({
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
      expect(pdfUtils.mergePdfs).toHaveBeenCalledWith({
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
      expect(pdfUtils.ensureDirectoryExists).toHaveBeenCalledWith({
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
      expect(pdfUtils.ensureDirectoryExists).not.toHaveBeenCalled();
    });
    
    // Add test for default branch coverage
    it('should use correct default values', () => {
      // Test the default values by examining the configuration
      const defaultConfig = pdfUtilsIndexApi.configure({});
      
      // Use API to verify defaults
      const dirPath = 'test-defaults/dir';
      return pdfUtilsIndexApi.ensureDirectoryExists({ dirPath })
        .then(() => {
          expect(pdfUtils.ensureDirectoryExists).toHaveBeenCalled();
        });
    });
  });
});
