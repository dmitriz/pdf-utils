/**
 * Test suite for PDF utility functions: appendPdfPages, and mergePdfs.
 *
 * - `appendPdfPages`: Verifies that pages from a source PDF buffer are correctly appended
 *   to a target PDFDocument instance.
 * - `mergePdfs`: Ensures multiple PDF buffers are correctly merged into a single PDF buffer.
 *
 * This test suite uses module-level mocking for 'pdf-lib' to isolate pdf-utils
 * from the actual implementation of the PDF library.
 */

// --- Mock Setup for 'pdf-lib' ---
// These will hold the mock functions for PDFDocument static and instance methods
const mockPdfLibStatic = {
  load: jest.fn(),
  create: jest.fn(),
};

// Helper to create fresh mock instances for PDF documents each time they're needed.
// This ensures test isolation, where one test's mock instance doesn't affect another.
const createMockPdfDocInstance = () => ({
  copyPages: jest.fn().mockResolvedValue(['mockPageObject1', 'mockPageObject2']), // Default for success
  addPage: jest.fn(),
  save: jest.fn().mockResolvedValue(Buffer.from('mock saved pdf data')), // Default for success
  getPageIndices: jest.fn().mockReturnValue([0, 1]), // Default for 2 pages
});

jest.mock('pdf-lib', () => ({
  PDFDocument: mockPdfLibStatic,
  // If pdf-utils.js starts using other exports like rgb, StandardFonts, etc.,
  // they would need to be mocked here as well.
  // e.g., rgb: jest.fn(), StandardFonts: { Helvetica: 'mockHelveticaFont' }
}));
// --- End Mock Setup ---

// Import the functions to be tested *after* setting up the mocks.
const { appendPdfPages, mergePdfs } = require('../src/pdf-utils');

describe('appendPdfPages', () => {
  let mockTargetDoc; // This is the PDFDocument instance passed as an argument to appendPdfPages
  let mockLoadedSourceDoc; // This is the PDFDocument instance resolved by PDFDocument.load()

  beforeEach(() => {
    // Reset all mock functions in the static interface of PDFDocument
    mockPdfLibStatic.load.mockReset();
    // mockPdfLibStatic.create.mockReset(); // Not directly used by appendPdfPages

    // Create fresh mock instances for this test
    mockTargetDoc = createMockPdfDocInstance();
    mockLoadedSourceDoc = createMockPdfDocInstance();

    // Configure the behavior of the mocked PDFDocument.load static method
    // to return our mockLoadedSourceDoc when called by appendPdfPages.
    mockPdfLibStatic.load.mockResolvedValue(mockLoadedSourceDoc);
  });

  it('should load source buffer, copy pages to target, and return success with page count', async () => {
    const sourceBuffer = Buffer.from('%PDF-dummy-source');
    // Customize the behavior of the mock instances for this specific test case:
    mockLoadedSourceDoc.getPageIndices.mockReturnValue([0, 1, 2]); // Source PDF has 3 pages
    mockTargetDoc.copyPages.mockResolvedValue(['p0', 'p1', 'p2']); // Simulate copyPages returning 3 page objects

    const result = await appendPdfPages(sourceBuffer, mockTargetDoc);

    // Assertions:
    // 1. PDFDocument.load (our mock) was called with the source buffer.
    expect(mockPdfLibStatic.load).toHaveBeenCalledWith(sourceBuffer);
    // 2. copyPages was called on the mockTargetDoc, with the mockLoadedSourceDoc and its page indices.
    expect(mockTargetDoc.copyPages).toHaveBeenCalledWith(mockLoadedSourceDoc, [0, 1, 2]);
    // 3. addPage was called on mockTargetDoc for each page returned by copyPages.
    expect(mockTargetDoc.addPage).toHaveBeenCalledTimes(3);
    expect(mockTargetDoc.addPage).toHaveBeenNthCalledWith(1, 'p0');
    expect(mockTargetDoc.addPage).toHaveBeenNthCalledWith(2, 'p1');
    expect(mockTargetDoc.addPage).toHaveBeenNthCalledWith(3, 'p2');
    // 4. The function returned the expected success status and page count.
    expect(result).toEqual({ success: true, pagesAdded: 3 });
  });

  it('should return a failure object if PDFDocument.load fails', async () => {
    const sourceBuffer = Buffer.from('%PDF-bad-source');
    const expectedError = new Error('Failed to load PDF');
    mockPdfLibStatic.load.mockRejectedValue(expectedError); // Simulate PDFDocument.load failure

    const result = await appendPdfPages(sourceBuffer, mockTargetDoc);

    expect(result.success).toBe(false);
    expect(result.error).toBe(expectedError);
    expect(mockTargetDoc.copyPages).not.toHaveBeenCalled();
    expect(mockTargetDoc.addPage).not.toHaveBeenCalled();
  });

  it('should return a failure object if targetDoc.copyPages fails', async () => {
    const sourceBuffer = Buffer.from('%PDF-good-source');
    const expectedError = new Error('Failed to copy pages');
    mockTargetDoc.copyPages.mockRejectedValue(expectedError); // Simulate copyPages failure on the target doc

    const result = await appendPdfPages(sourceBuffer, mockTargetDoc);

    expect(result.success).toBe(false);
    expect(result.error).toBe(expectedError);
    expect(mockTargetDoc.addPage).not.toHaveBeenCalled();
  });

  it('should handle zero pages in the source document correctly', async () => {
    const sourceBuffer = Buffer.from('%PDF-empty-source');
    mockLoadedSourceDoc.getPageIndices.mockReturnValue([]); // Source PDF has 0 pages

    const result = await appendPdfPages(sourceBuffer, mockTargetDoc);

    expect(mockPdfLibStatic.load).toHaveBeenCalledWith(sourceBuffer);
    expect(mockTargetDoc.copyPages).not.toHaveBeenCalled();
    expect(mockTargetDoc.addPage).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, pagesAdded: 0 });
  });
});

describe('mergePdfs', () => {
  let mockCreatedPdfDoc;  // Mock instance for the PDFDocument created by PDFDocument.create()
  let mockLoadedPdfDoc;   // Mock instance for PDFDocuments loaded by PDFDocument.load()

  beforeEach(() => {
    mockPdfLibStatic.create.mockReset();
    mockPdfLibStatic.load.mockReset();

    mockCreatedPdfDoc = createMockPdfDocInstance();
    mockLoadedPdfDoc = createMockPdfDocInstance(); // General mock for loaded documents

    // Configure static mock methods
    mockPdfLibStatic.create.mockResolvedValue(mockCreatedPdfDoc);
    // appendPdfPages (called by mergePdfs) will use PDFDocument.load
    mockPdfLibStatic.load.mockResolvedValue(mockLoadedPdfDoc);
  });

  it('should create a new PDF, append pages from all buffers, save, and return the merged buffer', async () => {
    const sourcePdfBuffers = [
      Buffer.from('%PDF-source1'),
      Buffer.from('%PDF-source2'),
    ];

    // Customize behavior for this test:
    // Each loaded source PDF will appear to have 1 page.
    mockLoadedPdfDoc.getPageIndices.mockReturnValue([0]);
    // When appendPdfPages calls copyPages on mockCreatedPdfDoc, it will simulate copying one page object.
    mockCreatedPdfDoc.copyPages.mockResolvedValue(['oneCopiedPageObject']);
    // The save method on the created document will return specific content.
    const expectedMergedContent = Buffer.from('successfully merged content');
    mockCreatedPdfDoc.save.mockResolvedValue(expectedMergedContent);

    const mergedBuffer = await mergePdfs(sourcePdfBuffers);

    // Assertions:
    // 1. A new PDFDocument was created.
    expect(mockPdfLibStatic.create).toHaveBeenCalledTimes(1);

    // 2. PDFDocument.load was called for each source buffer (by appendPdfPages).
    expect(mockPdfLibStatic.load).toHaveBeenCalledTimes(sourcePdfBuffers.length);
    expect(mockPdfLibStatic.load).toHaveBeenNthCalledWith(1, sourcePdfBuffers[0]);
    expect(mockPdfLibStatic.load).toHaveBeenNthCalledWith(2, sourcePdfBuffers[1]);

    // 3. copyPages on mockCreatedPdfDoc was called for each source PDF.
    //    (appendPdfPages uses mockCreatedPdfDoc as its targetDoc).
    expect(mockCreatedPdfDoc.copyPages).toHaveBeenCalledTimes(sourcePdfBuffers.length);
    expect(mockCreatedPdfDoc.copyPages).toHaveBeenCalledWith(mockLoadedPdfDoc, [0]); // Assuming [0] from getPageIndices

    // 4. addPage on mockCreatedPdfDoc was called for each page copied.
    expect(mockCreatedPdfDoc.addPage).toHaveBeenCalledTimes(sourcePdfBuffers.length);
    expect(mockCreatedPdfDoc.addPage).toHaveBeenCalledWith('oneCopiedPageObject');

    // 5. The save method of mockCreatedPdfDoc was called.
    expect(mockCreatedPdfDoc.save).toHaveBeenCalledTimes(1);

    // 6. The function returned the buffer from mockCreatedPdfDoc.save.
    expect(Buffer.isBuffer(mergedBuffer)).toBe(true);
    expect(mergedBuffer).toBe(expectedMergedContent);
  });

  it('should throw an error if PDFDocument.create fails', async () => {
    const sourcePdfBuffers = [Buffer.from('s1')];
    const createError = new Error('Failed to create PDF');
    mockPdfLibStatic.create.mockRejectedValue(createError);

    await expect(mergePdfs(sourcePdfBuffers)).rejects.toThrow(`Failed to merge PDFs: ${createError.message}`);
    expect(mockCreatedPdfDoc.save).not.toHaveBeenCalled(); // Save should not be called
  });

  it('should throw an error if an internal appendPdfPages (PDFDocument.load) fails', async () => {
    const sourcePdfBuffers = [Buffer.from('s1'), Buffer.from('s2')];
    const loadError = new Error('Simulated load failure in appendPdfPages');

    // First load succeeds, second fails
    mockPdfLibStatic.load
      .mockResolvedValueOnce(createMockPdfDocInstance()) // for first buffer
      .mockRejectedValueOnce(loadError); // for second buffer

    await expect(mergePdfs(sourcePdfBuffers)).rejects.toThrow(`Failed to merge PDFs: ${loadError.message}`);
    expect(mockCreatedPdfDoc.save).not.toHaveBeenCalled();
  });

  it('should throw an error if an internal appendPdfPages (targetDoc.copyPages) fails', async () => {
    const sourcePdfBuffers = [Buffer.from('s1')];
    const copyError = new Error('Simulated copyPages failure in appendPdfPages');

    // PDFDocument.load for the source succeeds
    mockPdfLibStatic.load.mockResolvedValue(mockLoadedPdfDoc);
    // But when appendPdfPages tries to copy to mockCreatedPdfDoc, it fails
    mockCreatedPdfDoc.copyPages.mockRejectedValue(copyError);

    await expect(mergePdfs(sourcePdfBuffers)).rejects.toThrow(`Failed to merge PDFs: ${copyError.message}`);
    expect(mockCreatedPdfDoc.save).not.toHaveBeenCalled();
  });

  it('should throw an error if the final save operation on the merged document fails', async () => {
    const sourcePdfBuffers = [Buffer.from('s1')];
    const saveError = new Error('Failed to save merged PDF');
    mockCreatedPdfDoc.save.mockRejectedValue(saveError);

    await expect(mergePdfs(sourcePdfBuffers)).rejects.toThrow(`Failed to merge PDFs: ${saveError.message}`);
  });

  it('should correctly merge an empty array of PDF buffers (resulting in an empty new PDF)', async () => {
    const sourcePdfBuffers = [];
    const expectedEmptyPdfContent = Buffer.from('empty new pdf');
    mockCreatedPdfDoc.save.mockResolvedValue(expectedEmptyPdfContent); // Save on an empty doc

    const mergedBuffer = await mergePdfs(sourcePdfBuffers);

    expect(mockPdfLibStatic.create).toHaveBeenCalledTimes(1);
    expect(mockPdfLibStatic.load).not.toHaveBeenCalled(); // No buffers to load
    expect(mockCreatedPdfDoc.copyPages).not.toHaveBeenCalled();
    expect(mockCreatedPdfDoc.addPage).not.toHaveBeenCalled();
    expect(mockCreatedPdfDoc.save).toHaveBeenCalledTimes(1);
    expect(mergedBuffer).toBe(expectedEmptyPdfContent);
  });
});
