/**
 * Integration tests for PDF utility functions.
 * 
 * These tests verify that our utility functions work correctly with real PDF data
 * using only buffers (the public API) without exposing any implementation details.
 */

const fs = require('fs');
const path = require('path');
const { appendPdfs, mergePdfs } = require('../src/pdf-utils-clean');

// Helper to create a minimal valid PDF buffer with content
const createTestPdf = async (identifier, pageCount = 1) => {
  // For a real test with multiple pages, we'd need a more sophisticated PDF creation
  // This is just a simple example to demonstrate the concept
  let content = `%PDF-1.7
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count ${pageCount}/Kids[`;

  // Add references to each page
  for (let i = 0; i < pageCount; i++) {
    content += `${3 + i * 2} 0 R`;
    if (i < pageCount - 1) content += ' ';
  }
  
  content += `]>>endobj
`;

  // Add each page and its content
  for (let i = 0; i < pageCount; i++) {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    
    content += `${pageNum} 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents ${contentNum} 0 R>>endobj
${contentNum} 0 obj<</Length 30>>stream
BT /F1 12 Tf 100 700 Td (${identifier} Page ${i+1}) Tj ET
endstream
endobj
`;
  }

  // Add a simple xref table and trailer
  content += `xref
0 ${3 + pageCount * 2}
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
`;
  
  // Simple trailer
  content += `trailer<</Size ${3 + pageCount * 2}/Root 1 0 R>>
startxref
${content.length}
%%EOF`;

  return Buffer.from(content);
};

// Helper to check if a buffer contains specific text (simple validation)
const bufferContainsText = (buffer, text) => {
  return buffer.toString().includes(text);
};

describe('PDF Utility Integration Tests (Buffer API)', () => {
  describe('mergePdfs', () => {
    it('should merge multiple PDF buffers', async () => {
      // ARRANGE: Create test PDF buffers
      const pdf1 = await createTestPdf('TEST1', 2);
      const pdf2 = await createTestPdf('TEST2', 1);
      const pdf3 = await createTestPdf('TEST3', 3);
      
      // ACT: Merge the PDFs using the public API
      const mergedPdfBuffer = await mergePdfs([pdf1, pdf2, pdf3]);
      
      // ASSERT:
      // 1. Result is a Buffer
      expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
      
      // 2. Result contains content from all source PDFs
      expect(bufferContainsText(mergedPdfBuffer, 'TEST1')).toBe(true);
      expect(bufferContainsText(mergedPdfBuffer, 'TEST2')).toBe(true);
      expect(bufferContainsText(mergedPdfBuffer, 'TEST3')).toBe(true);
      
      // 3. The PDF is valid (at minimum contains PDF header)
      expect(mergedPdfBuffer.toString().startsWith('%PDF-')).toBe(true);
    });

    it('should merge PDFs when provided as individual arguments', async () => {
      // ARRANGE: Create test PDF buffers
      const pdf1 = await createTestPdf('ARG1', 1);
      const pdf2 = await createTestPdf('ARG2', 2);
      
      // ACT: Merge using individual arguments syntax
      const mergedPdfBuffer = await mergePdfs(pdf1, pdf2);
      
      // ASSERT:
      expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
      expect(bufferContainsText(mergedPdfBuffer, 'ARG1')).toBe(true);
      expect(bufferContainsText(mergedPdfBuffer, 'ARG2')).toBe(true);
    });

    it('should create a valid PDF when no inputs are provided', async () => {
      // ACT: Call with no arguments
      const resultBuffer = await mergePdfs();
      
      // ASSERT:
      expect(Buffer.isBuffer(resultBuffer)).toBe(true);
      expect(resultBuffer.toString().startsWith('%PDF-')).toBe(true);
    });
  });
  
  describe('appendPdfs', () => {
    it('should append pages from source PDF to target PDF', async () => {
      // ARRANGE: Create source and target PDFs
      const sourcePdf = await createTestPdf('SOURCE', 2);
      const targetPdf = await createTestPdf('TARGET', 1);
      
      // ACT: Append source to target
      const result = await appendPdfs(sourcePdf, targetPdf);
      
      // ASSERT:
      expect(result.success).toBe(true);
      expect(result.pagesAdded).toBe(2);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      
      // Check that resulting PDF contains both source and target content
      const resultBuffer = result.buffer;
      expect(bufferContainsText(resultBuffer, 'SOURCE')).toBe(true);
      expect(bufferContainsText(resultBuffer, 'TARGET')).toBe(true);
    });
    
    it('should handle empty source PDF gracefully', async () => {
      // ARRANGE: Create empty source (0 pages) and standard target
      const emptyPdf = await createTestPdf('EMPTY', 0);
      const targetPdf = await createTestPdf('TARGET', 1);
      
      // ACT: Append empty source to target
      const result = await appendPdfs(emptyPdf, targetPdf);
      
      // ASSERT:
      expect(result.success).toBe(true);
      expect(result.pagesAdded).toBe(0);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      
      // The output should just have the target content
      expect(bufferContainsText(result.buffer, 'TARGET')).toBe(true);
    });
  });
});
