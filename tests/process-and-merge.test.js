/*
 * processSinglePdf(pdfBuffer, targetDoc)
 *  - loads a PDFDocument from raw buffer
 *  - copies all pages into the targetDoc
 *  - returns { success: true, pagesAdded: number }
 *  - on error returns { success: false, error }
 *
 * mergePdfs(pdfBuffers[])
 *  - creates a new PDFDocument
 *  - calls processSinglePdf for each buffer
 *  - returns merged Buffer on success
 *  - throws on error
 */

const { PDFDocument } = require('pdf-lib');
const { processSinglePdf, mergePdfs } = require('../src/pdf-utils');

describe('processSinglePdf', () => {
  let mockDoc;
  let mockSource;

  beforeEach(() => {
    // reset and prepare mock PDFDocument methods
    mockSource = {
      getPageIndices: jest.fn().mockReturnValue([0, 1]),
    };
    mockDoc = {
      copyPages: jest.fn().mockResolvedValue(['page1', 'page2']),
      addPage: jest.fn(),
    };
    jest.spyOn(PDFDocument, 'load').mockResolvedValue(mockSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies pages and returns count', async () => {
    mockSource.getPageIndices.mockReturnValue([0, 1, 2]);
    mockDoc.copyPages.mockResolvedValue(['p0', 'p1', 'p2']);

    const result = await processSinglePdf(Buffer.from('dummy'), mockDoc);

    expect(PDFDocument.load).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mockDoc.copyPages).toHaveBeenCalledWith(mockSource, [0, 1, 2]);
    expect(mockDoc.addPage).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ success: true, pagesAdded: 3 });
  });

  it('returns error on load failure', async () => {
    jest.spyOn(PDFDocument, 'load').mockRejectedValue(new Error('load failed'));
    const result = await processSinglePdf(Buffer.from('bad'), mockDoc);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toContain('load failed');
  });
});

describe('mergePdfs', () => {
  let buffers;

  beforeEach(() => {
    // Mock PDF document creation
    const mockPdfDoc = {
      save: jest.fn().mockResolvedValue(Buffer.from('merged')),
      copyPages: jest.fn().mockResolvedValue(['p']),
      addPage: jest.fn(),
      getPageIndices: jest.fn().mockReturnValue([0]),
    };
    
    jest.spyOn(PDFDocument, 'create').mockResolvedValue(mockPdfDoc);
    
    // Mock PDF buffers with mock PDF header structure to avoid parsing errors
    buffers = [
      Buffer.from('%PDF-1.5\n%mock pdf content 1'),
      Buffer.from('%PDF-1.5\n%mock pdf content 2')
    ];
    
    // Mock PDF loading to avoid actual parsing of the mock buffers
    jest.spyOn(PDFDocument, 'load').mockImplementation(async () => {
      return {
        getPageIndices: jest.fn().mockReturnValue([0]),
        copyPages: jest.fn().mockResolvedValue(['p'])
      };
    });
    
    // Spy on processSinglePdf to ensure it's using our mocks
    jest.spyOn(require('../src/pdf-utils'), 'processSinglePdf').mockImplementation(
      async () => ({ success: true, pagesAdded: 1 })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('merges multiple PDF buffers into one buffer', async () => {
    const merged = await mergePdfs(buffers);
    expect(PDFDocument.create).toHaveBeenCalled();
    expect(Buffer.isBuffer(merged)).toBe(true);
    expect(merged.toString()).toBe('merged');
  });

  it('throws if any buffer processing fails', async () => {
    // force processSinglePdf to fail on second buffer by mocking PDFDocument.load
    jest.spyOn(require('../src/pdf-utils'), 'processSinglePdf')
      .mockImplementationOnce(async () => ({ success: true, pagesAdded: 1 }))
      .mockImplementationOnce(async () => ({ success: false, error: new Error('bad pdf') }));

    await expect(mergePdfs(buffers)).rejects.toThrow('bad pdf');
  });
});
