/**
 * Integration tests for PDF utility functions.
 * 
 * These tests verify that our utility functions work correctly with real PDF data
 * using only the public API (Buffer in, Buffer out) without exposing implementation details.
 */

const { mergePdfs, appendPdfs } = require('../src/pdf-utils');

// Simple helper to create a valid PDF buffer with a specific "signature"
const createTestPdfBuffer = async (identifier) => {
  // This is a minimal valid PDF structure
  return Buffer.from(
    `%PDF-1.7
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 23>>stream
BT /F1 12 Tf 100 700 Td (PDF ${identifier}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
0000000169 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
240
%%EOF`
  );
};

// Helper to extract the content from a PDF for verification
const extractTextContent = async (pdfBuffer) => {
  // In a real implementation, we'd use a PDF text extraction tool
  // For this test, we'll just check if the buffer contains our identifiers
  const content = pdfBuffer.toString();
  return content;
};

describe('mergePdfs', () => {
  it('should merge multiple PDF buffers and preserve their content', async () => {
    // ARRANGE: Create test PDF buffers with unique identifiers
    const pdf1 = await createTestPdfBuffer('TEST1');
    const pdf2 = await createTestPdfBuffer('TEST2');
    const pdf3 = await createTestPdfBuffer('TEST3');
    
    // ACT: Merge the PDFs using the public API
    const mergedPdfBuffer = await mergePdfs([pdf1, pdf2, pdf3]);
    
    // ASSERT:
    // 1. Result is a Buffer
    expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
    
    // 2. Result contains content from all source PDFs
    const extractedContent = await extractTextContent(mergedPdfBuffer);
    expect(extractedContent.includes('TEST1')).toBe(true);
    expect(extractedContent.includes('TEST2')).toBe(true);
    expect(extractedContent.includes('TEST3')).toBe(true);
  });

  it('should merge PDFs when provided as individual arguments', async () => {
    // ARRANGE: Create test PDF buffers
    const pdf1 = await createTestPdfBuffer('ARG1');
    const pdf2 = await createTestPdfBuffer('ARG2');
    
    // ACT: Merge using individual arguments syntax
    const mergedPdfBuffer = await mergePdfs(pdf1, pdf2);
    
    // ASSERT:
    expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
    
    const extractedContent = await extractTextContent(mergedPdfBuffer);
    expect(extractedContent.includes('ARG1')).toBe(true);
    expect(extractedContent.includes('ARG2')).toBe(true);
  });

  it('should create a valid PDF when no inputs are provided', async () => {
    // ACT: Call with no arguments
    const resultBuffer = await mergePdfs();
    
    // ASSERT:
    expect(Buffer.isBuffer(resultBuffer)).toBe(true);
    // The result should be a valid PDF starting with the PDF header
    expect(resultBuffer.toString().startsWith('%PDF-')).toBe(true);
  });
  
  it('should handle an empty array of buffers', async () => {
    // ACT: Pass an empty array
    const resultBuffer = await mergePdfs([]);
    
    // ASSERT:
    expect(Buffer.isBuffer(resultBuffer)).toBe(true);
    expect(resultBuffer.toString().startsWith('%PDF-')).toBe(true);
  });
});

describe('appendPdfs', () => {
  it('should append pages from source PDF to target PDF', async () => {
    // ARRANGE: Create test PDF buffers with unique identifiers
    const sourcePdf = await createTestPdfBuffer('SOURCE');
    const targetPdf = await createTestPdfBuffer('TARGET');
    
    // ACT: Append source to target
    const result = await appendPdfs(sourcePdf, targetPdf);
    
    // ASSERT:
    expect(result.success).toBe(true);
    expect(result.pagesAdded).toBeGreaterThan(0);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    
    // Check that the resulting PDF contains content from both PDFs
    const extractedContent = await extractTextContent(result.buffer);
    expect(extractedContent.includes('SOURCE')).toBe(true);
    expect(extractedContent.includes('TARGET')).toBe(true);
  });

  it('should handle empty source PDF gracefully', async () => {
    // ARRANGE: Create an empty source PDF and a target PDF
    const emptyPdf = Buffer.from('%PDF-1.7\ntrailer<</Root 1 0 R>>\n%%EOF');
    const targetPdf = await createTestPdfBuffer('TARGET');
    
    // ACT: Append empty source to target
    const result = await appendPdfs(emptyPdf, targetPdf);
    
    // ASSERT:
    expect(result.success).toBe(true);
    // The exact pagesAdded value depends on how pdf-lib handles empty PDFs
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
});
