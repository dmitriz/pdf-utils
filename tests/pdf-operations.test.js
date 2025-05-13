/**
 * Test suite for PDF utility functions: ensureDirectoryExists, appendPdfPages, and mergePdfs.
 *
 * - `ensureDirectoryExists`: Validates directory creation logic.
 * - `appendPdfPages`: Verifies that pages from a source PDF buffer are correctly appended
 *   to a target PDFDocument instance provided by `pdf-lib`.
 * - `mergePdfs`: Ensures multiple PDF buffers are correctly merged into a single PDF buffer
 *   by creating a new PDFDocument and sequentially appending pages from each source buffer.
 */

// Node.js 'fs' module, automatically mocked by Jest for most functions if not explicitly unmocked.
// We will provide specific mock implementations for fs.existsSync and fs.mkdirSync.
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const {
  // ensureDirectoryExists, // Removed
  appendPdfPages, // Renamed from processSinglePdf
  mergePdfs,
} = require('../src/pdf-utils');

/**
 * Tests for `appendPdfPages(sourcePdfBuffer, targetPdfDoc)`
 *
 * `appendPdfPages` takes a raw PDF buffer (source) and a `pdf-lib` PDFDocument
 * instance (target). It loads the source buffer into a new (temporary) PDFDocument,
 * then copies all pages from this temporary document into the provided target document.
 * It's a core operation for merging PDFs.
 */
describe('appendPdfPages', () => {
  let mockTargetDoc; // Mock of the target PDFDocument instance (passed as argument)
  let mockLoadedSourceDoc; // Mock of the PDFDocument instance returned by PDFDocument.load()

  beforeEach(() => {
    // This mock represents the PDFDocument instance to which pages will be appended.
    mockTargetDoc = {
      copyPages: jest.fn().mockResolvedValue(['mockPageObject1', 'mockPageObject2']), // Simulates successfully copied page objects
      addPage: jest.fn(), // Used to track calls when adding pages to the target document
    };

    // This mock represents the PDFDocument instance that `PDFDocument.load(sourcePdfBuffer)`
    // would resolve to. It needs `getPageIndices` for `targetDoc.copyPages`.
    mockLoadedSourceDoc = {
      getPageIndices: jest.fn().mockReturnValue([0, 1]), // Default: simulates a 2-page source PDF
    };

    // Spy on `PDFDocument.load` (static method) to control its behavior.
    // When `appendPdfPages` calls `PDFDocument.load(buffer)`, it will resolve to `mockLoadedSourceDoc`.
    jest.spyOn(PDFDocument, 'load').mockResolvedValue(mockLoadedSourceDoc);
  });

  afterEach(() => {
    // Restore all mocks to their original implementations after each test.
    jest.restoreAllMocks();
  });

  it('should load source buffer, copy pages to target, and return success with page count', async () => {
    // Arrange:
    const sourceBuffer = Buffer.from('%PDF-dummy-source');
    // Customize mocks for this specific test: source PDF has 3 pages.
    mockLoadedSourceDoc.getPageIndices.mockReturnValue([0, 1, 2]);
    mockTargetDoc.copyPages.mockResolvedValue(['p0', 'p1', 'p2']); // `copyPages` returns an array of copied page objects

    // Act: Call the function under test.
    const result = await appendPdfPages(sourceBuffer, mockTargetDoc);

    // Assert:
    // 1. `PDFDocument.load` was called with the provided source buffer.
    expect(PDFDocument.load).toHaveBeenCalledWith(sourceBuffer);
    // 2. `copyPages` was called on `mockTargetDoc`, with `mockLoadedSourceDoc` and its page indices.
    expect(mockTargetDoc.copyPages).toHaveBeenCalledWith(mockLoadedSourceDoc, [0, 1, 2]);
    // 3. `addPage` was called on `mockTargetDoc` for each page returned by `copyPages`.
    expect(mockTargetDoc.addPage).toHaveBeenCalledTimes(3);
    expect(mockTargetDoc.addPage).toHaveBeenNthCalledWith(1, 'p0');
    expect(mockTargetDoc.addPage).toHaveBeenNthCalledWith(2, 'p1');
    expect(mockTargetDoc.addPage).toHaveBeenNthCalledWith(3, 'p2');
    // 4. The function returned a success status and the correct number of pages added.
    expect(result).toEqual({ success: true, pagesAdded: 3 });
  });

  it('should return a failure object if PDFDocument.load fails', async () => {
    // Arrange:
    const sourceBuffer = Buffer.from('%PDF-bad-source');
    const expectedError = new Error('Failed to load PDF');
    jest.spyOn(PDFDocument, 'load').mockRejectedValue(expectedError); // Simulate load failure

    // Act:
    const result = await appendPdfPages(sourceBuffer, mockTargetDoc);

    // Assert:
    expect(result.success).toBe(false);
    expect(result.error).toBe(expectedError); // The exact error should be propagated
    expect(mockTargetDoc.copyPages).not.toHaveBeenCalled(); // `copyPages` should not be called if load fails
    expect(mockTargetDoc.addPage).not.toHaveBeenCalled(); // `addPage` should not be called
  });

  it('should return a failure object if targetDoc.copyPages fails', async () => {
    // Arrange:
    const sourceBuffer = Buffer.from('%PDF-good-source');
    const expectedError = new Error('Failed to copy pages');
    mockTargetDoc.copyPages.mockRejectedValue(expectedError); // Simulate copyPages failure

    // Act:
    const result = await appendPdfPages(sourceBuffer, mockTargetDoc);

    // Assert:
    expect(result.success).toBe(false);
    expect(result.error).toBe(expectedError);
    expect(mockTargetDoc.addPage).not.toHaveBeenCalled(); // `addPage` should not be called if copyPages fails
  });
});

/**
 * Tests for `mergePdfs(pdfBuffers[])`
 *
 * `mergePdfs` takes an array of PDF buffers. It creates a new, empty PDFDocument,
 * then iteratively calls `appendPdfPages` for each buffer to add its content to the
 * new document. Finally, it saves the new document and returns its data as a Buffer.
 */
describe('mergePdfs', () => {
  let mockCreatedPdfDoc; // Mock of the PDFDocument instance returned by PDFDocument.create()
  let sourcePdfBuffers;

  beforeEach(() => {
    // This mock represents the new PDFDocument that `mergePdfs` creates internally.
    // `appendPdfPages` will interact with its `copyPages` and `addPage` methods.
    // `mergePdfs` will call its `save` method.
    mockCreatedPdfDoc = {
      copyPages: jest.fn().mockResolvedValue(['mockPageObject']), // Mock for appendPdfPages's internal call
      addPage: jest.fn(),                                     // Mock for appendPdfPages's internal call
      save: jest.fn().mockResolvedValue(Buffer.from('merged PDF content')),
    };

    // Spy on `PDFDocument.create` (static method) to return our `mockCreatedPdfDoc`.
    jest.spyOn(PDFDocument, 'create').mockResolvedValue(mockCreatedPdfDoc);

    // Spy on `PDFDocument.load` as it's called by the *actual* `appendPdfPages` function.
    // For successful merge operations, `appendPdfPages` needs `PDFDocument.load` to succeed.
    // We make it return a minimal mock of a loaded document.
    jest.spyOn(PDFDocument, 'load').mockResolvedValue({
      getPageIndices: jest.fn().mockReturnValue([0]), // Simulate each source PDF having 1 page
    });

    // Prepare dummy PDF buffers for merging.
    sourcePdfBuffers = [
      Buffer.from('%PDF-source1'),
      Buffer.from('%PDF-source2'),
    ];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a new PDF, append pages from all buffers, save, and return the merged buffer', async () => {
    // Act: Call the function under test.
    const mergedBuffer = await mergePdfs(sourcePdfBuffers);

    // Assert:
    // 1. A new PDFDocument was created.
    expect(PDFDocument.create).toHaveBeenCalledTimes(1);

    // 2. `PDFDocument.load` (called by `appendPdfPages`) was invoked for each source buffer.
    expect(PDFDocument.load).toHaveBeenCalledTimes(sourcePdfBuffers.length);
    expect(PDFDocument.load).toHaveBeenNthCalledWith(1, sourcePdfBuffers[0]);
    expect(PDFDocument.load).toHaveBeenNthCalledWith(2, sourcePdfBuffers[1]);

    // 3. `copyPages` on `mockCreatedPdfDoc` (the target) was called for each source buffer
    //    (via the internal `appendPdfPages` calls).
    expect(mockCreatedPdfDoc.copyPages).toHaveBeenCalledTimes(sourcePdfBuffers.length);

    // 4. `addPage` on `mockCreatedPdfDoc` was called for each page copied.
    //    (Since getPageIndices returns [0], one page per source, copyPages returns ['mockPageObject'])
    expect(mockCreatedPdfDoc.addPage).toHaveBeenCalledTimes(sourcePdfBuffers.length);
    expect(mockCreatedPdfDoc.addPage).toHaveBeenCalledWith('mockPageObject');


    // 5. The `save` method of the `mockCreatedPdfDoc` was called.
    expect(mockCreatedPdfDoc.save).toHaveBeenCalledTimes(1);

    // 6. The function returned the buffer from `mockCreatedPdfDoc.save`.
    expect(Buffer.isBuffer(mergedBuffer)).toBe(true);
    expect(mergedBuffer.toString()).toBe('merged PDF content');
  });

  it('should throw an error if an internal appendPdfPages operation fails (e.g., PDFDocument.load fails)', async () => {
    // Arrange: Simulate a failure during one of the `appendPdfPages` operations.
    // Let the first `PDFDocument.load` succeed, but the second one fail.
    const loadError = new Error('Simulated load failure');
    jest.spyOn(PDFDocument, 'load')
      .mockResolvedValueOnce({ getPageIndices: jest.fn().mockReturnValue([0]) }) // First call to appendPdfPages's load
      .mockRejectedValueOnce(loadError); // Second call to appendPdfPages's load fails

    // Act & Assert: Expect `mergePdfs` to catch the error from `appendPdfPages` and re-throw its own error.
    await expect(mergePdfs(sourcePdfBuffers)).rejects.toThrow(`Failed to merge PDFs: ${loadError.message}`);

    // Ensure `save` was not called on the new document if an append operation failed.
    expect(mockCreatedPdfDoc.save).not.toHaveBeenCalled();
  });

  it('should throw an error if PDFDocument.create itself fails', async () => {
    // Arrange: Simulate `PDFDocument.create` failing.
    const createError = new Error('Failed to create new PDFDocument');
    jest.spyOn(PDFDocument, 'create').mockRejectedValue(createError);

    // Act & Assert:
    await expect(mergePdfs(sourcePdfBuffers)).rejects.toThrow(`Failed to merge PDFs: ${createError.message}`);
  });

  it('should throw an error if the final save operation on the merged document fails', async () => {
    // Arrange: Simulate `mockCreatedPdfDoc.save` failing.
    const saveError = new Error('Failed to save merged PDF');
    mockCreatedPdfDoc.save.mockRejectedValue(saveError);

    // Act & Assert:
    await expect(mergePdfs(sourcePdfBuffers)).rejects.toThrow(`Failed to merge PDFs: ${saveError.message}`);
  });
});
