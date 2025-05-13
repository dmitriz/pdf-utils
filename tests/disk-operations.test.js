/**
 * Unit tests for disk operation functions in pdf-utils.js
 */
const path = require('path');

// Mock promises directly for fs
const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();
const mockStat = jest.fn();

jest.mock('fs', () => ({
  promises: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    stat: mockStat
  }
}));

// Import the module to test
const pdfUtils = require('../src/pdf-utils');
const { ensureDirectoryExists, savePdf, mergePdfsFromDisk } = pdfUtils;

// Spy on and mock mergePdfsInMemory (and by extension its alias mergePdfs)
let mockMergePdfsInMemorySpy;

describe('ensureDirectoryExists', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clears fs mocks
  });

  it('should create directory if it does not exist', async () => {
    // Setup: mkdir succeeds
    mockMkdir.mockResolvedValue(undefined);

    const result = await ensureDirectoryExists({ dirPath: '/test/dir' });
    
    expect(mockMkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    expect(result).toEqual({
      success: true,
      path: '/test/dir'
    });
  });

  it('should handle directory already exists case', async () => {
    // Setup: mkdir fails but stat shows directory exists
    const error = new Error('Directory already exists');
    error.code = 'EEXIST';
    mockMkdir.mockRejectedValue(error);
    
    mockStat.mockResolvedValue({
      isDirectory: () => true
    });

    const result = await ensureDirectoryExists({ dirPath: '/existing/dir' });
    
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockStat).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      path: '/existing/dir'
    });
  });

  it('should handle errors where directory cannot be created', async () => {
    // Setup: mkdir fails with permission error
    const error = new Error('Permission denied');
    error.code = 'EACCES';
    mockMkdir.mockRejectedValue(error);
    
    // And stat also fails
    mockStat.mockRejectedValue(new Error('Cannot access'));

    const result = await ensureDirectoryExists({ dirPath: '/root/restricted' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.path).toBe('/root/restricted');
  });

  it('should handle case where path exists but is not a directory', async () => {
    // Setup: mkdir fails but stat succeeds with a file
    mockMkdir.mockRejectedValue(new Error('Not a directory'));
    
    mockStat.mockResolvedValue({
      isDirectory: () => false // It's a file, not a directory
    });

    const result = await ensureDirectoryExists({ dirPath: '/path/to/file' });
    
    expect(result.success).toBe(false);
    expect(result.path).toBe('/path/to/file');
  });
});

describe('savePdf', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clears fs mocks
  });

  it('should successfully save a PDF', async () => {
    // Setup
    const pdfBuffer = Buffer.from('test pdf content');
    const outputPath = '/output/test.pdf';
    
    // Mock successful directory creation
    mockMkdir.mockResolvedValue(undefined);
    // Mock successful file write
    mockWriteFile.mockResolvedValue(undefined);

    const result = await savePdf({ 
      pdfBuffer, 
      outputPath,
      allowOutsideBaseDir: false
    });

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(outputPath, pdfBuffer);
    expect(result).toEqual({
      success: true,
      path: outputPath
    });
  });

  it('should handle errors when saving PDF', async () => {
    // Setup
    const pdfBuffer = Buffer.from('test pdf content');
    const outputPath = '/output/test.pdf';
    
    // Force writeFile to fail
    const error = new Error('Write failed');
    mockWriteFile.mockRejectedValue(error);

    const result = await savePdf({ 
      pdfBuffer, 
      outputPath,
      allowOutsideBaseDir: true
    });

    expect(result).toEqual({
      success: false,
      path: outputPath,
      error
    });
  });

  it('should handle errors when ensuring directory exists', async () => {
    // Setup
    const pdfBuffer = Buffer.from('test pdf content');
    const outputPath = '/output/test.pdf';
    
    // Force mkdir to fail
    const error = new Error('Permission denied');
    mockMkdir.mockRejectedValue(error);
    mockStat.mockRejectedValue(error); // Also fail the stat check

    const result = await savePdf({ 
      pdfBuffer, 
      outputPath
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('mergePdfsFromDisk', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clears fs mocks (mockMkdir, mockWriteFile, mockReadFile, mockStat)
    // Spy on mergePdfsInMemory for each test in this describe block
    mockMergePdfsInMemorySpy = jest.spyOn(pdfUtils, 'mergePdfsInMemory');
  });

  afterEach(() => {
    // Restore the original implementation after each test
    mockMergePdfsInMemorySpy.mockRestore();
  });

  it('should successfully merge PDFs from disk', async () => {
    const pdfPaths = ['/path/to/pdf1.pdf', '/path/to/pdf2.pdf'];
    const outputPath = '/output/merged.pdf';
    
    const pdf1Content = Buffer.from('%PDF-1.4\\n%âãÏÓ\\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\\ntrailer<</Root 1 0 R>>\\n%%EOF');
    const pdf2Content = Buffer.from('%PDF-1.4\\n%âãÏÓ\\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\\ntrailer<</Root 1 0 R>>\\n%%EOF');

    mockReadFile.mockImplementation((filePath) => {
      if (filePath === pdfPaths[0]) return Promise.resolve(pdf1Content);
      if (filePath === pdfPaths[1]) return Promise.resolve(pdf2Content);
      return Promise.reject(new Error('Unknown file path in mockReadFile'));
    });
    
    mockWriteFile.mockResolvedValue(undefined); 
    mockMkdir.mockResolvedValue(undefined);   

    const expectedMergedBuffer = Buffer.from('successfully-merged-pdf-content');
    mockMergePdfsInMemorySpy.mockResolvedValue(expectedMergedBuffer);

    const result = await mergePdfsFromDisk({ 
      pdfPaths, 
      outputPath,
      allowOutsideBaseDir: true 
    });

    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(mockReadFile).toHaveBeenCalledWith(pdfPaths[0]);
    expect(mockReadFile).toHaveBeenCalledWith(pdfPaths[1]);
    
    expect(mockMergePdfsInMemorySpy).toHaveBeenCalledTimes(1);
    expect(mockMergePdfsInMemorySpy).toHaveBeenCalledWith(pdf1Content, pdf2Content);
    
    expect(mockMkdir).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledWith(outputPath, expectedMergedBuffer);

    expect(result).toEqual({
      success: true,
      path: outputPath
    });
  });

  it('should handle errors when reading PDF files', async () => {
    const pdfPaths = ['/path/to/pdf1.pdf', '/path/to/missing.pdf'];
    const outputPath = '/output/merged.pdf';
    
    mockReadFile.mockImplementation((filePath) => {
      if (filePath === '/path/to/missing.pdf') {
        return Promise.reject(new Error('File not found'));
      }
      return Promise.resolve(Buffer.from(`content of ${filePath}`));
    });

    const result = await mergePdfsFromDisk({ pdfPaths, outputPath });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockMergePdfsInMemorySpy).not.toHaveBeenCalled();
  });

  it('should handle errors in the mergePdfsInMemory function', async () => {
    const pdfPaths = ['/path/to/pdf1.pdf'];
    const outputPath = '/output/merged.pdf';
    
    const pdfContent = Buffer.from('%PDF-1.4\\n%...');
    mockReadFile.mockResolvedValue(pdfContent);
    
    const mergeError = new Error('Internal merge failure');
    mockMergePdfsInMemorySpy.mockRejectedValue(mergeError);

    const result = await mergePdfsFromDisk({ 
      pdfPaths, 
      outputPath,
      allowOutsideBaseDir: true
    });

    expect(mockMergePdfsInMemorySpy).toHaveBeenCalledTimes(1);
    expect(mockMergePdfsInMemorySpy).toHaveBeenCalledWith(pdfContent);
    expect(result.success).toBe(false);
    expect(result.error.message).toBe(`Failed to merge PDFs: ${mergeError.message}`);
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should handle empty pdfPaths array', async () => {
    const pdfPaths = [];
    const outputPath = '/output/merged.pdf';
    
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    
    const emptyMergedPdfBuffer = Buffer.from('empty-pdf-from-mergePdfsInMemory');
    mockMergePdfsInMemorySpy.mockResolvedValue(emptyMergedPdfBuffer); 
    
    const result = await mergePdfsFromDisk({ 
      pdfPaths, 
      outputPath,
      allowOutsideBaseDir: true
    });
    
    expect(mockMergePdfsInMemorySpy).toHaveBeenCalledTimes(1);
    expect(mockMergePdfsInMemorySpy).toHaveBeenCalledWith(); 
    
    expect(mockMkdir).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledWith(outputPath, emptyMergedPdfBuffer);
    expect(result.success).toBe(true);
    expect(result.path).toBe(outputPath);
  });
  
  it('should handle undefined pdfPaths', async () => {
    const outputPath = '/output/merged.pdf';
    
    const result = await mergePdfsFromDisk({ 
      outputPath,
      allowOutsideBaseDir: true
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // This error comes directly from mergePdfsFromDisk's check or the spread operator failing
    expect(result.error.message).toMatch(/pdfPaths is not iterable|pdfPaths must be an array/); 
    expect(mockMergePdfsInMemorySpy).not.toHaveBeenCalled();
  });
});
