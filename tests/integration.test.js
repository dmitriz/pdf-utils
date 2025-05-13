/**
 * Integration tests for PDF utility functions.
 * 
 * These tests use real PDF files to verify that our utility functions work correctly
 * with the actual pdf-lib library, not just the mocks.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { appendPdfs, mergePdfs } = require('../src/pdf-utils');

// Helper function to create simple PDF documents with specified page count
const createSamplePdf = async (pageCount = 1) => {
  const pdfDoc = await PDFDocument.create();
  
  // Add specified number of pages
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage();
    
    // Add some content to the page to make it identifiable
    const { width, height } = page.getSize();
    page.drawText(`Page ${i+1}`, {
      x: 50,
      y: height - 50,
      size: 24,
    });
  }
  
  // Convert Uint8Array to Node.js Buffer
  return Buffer.from(await pdfDoc.save());
};

describe('Integration Tests with Real PDFs', () => {
  describe('appendPdfs', () => {
    it('should correctly append pages from one PDF to another', async () => {
      // ARRANGE: Create real PDF documents
      const sourcePdfBuffer = await createSamplePdf(3); // 3-page PDF
      const targetPdfDoc = await PDFDocument.create();
      targetPdfDoc.addPage(); // Target starts with 1 page
      
      // ACT: Append the source pages to the target
      const result = await appendPdfs(sourcePdfBuffer, targetPdfDoc);
      
      // ASSERT:
      expect(result.success).toBe(true);
      expect(result.pagesAdded).toBe(3);
      
      // Verify the target document now has 4 pages (1 original + 3 added)
      const targetPages = targetPdfDoc.getPageIndices();
      expect(targetPages.length).toBe(4);
    });
    
    it('should handle empty source PDFs without errors', async () => {
      // ARRANGE: Create an empty PDF
      const emptyPdfDoc = await PDFDocument.create();
      const emptyPdfBuffer = await emptyPdfDoc.save();
      const targetPdfDoc = await PDFDocument.create();
      targetPdfDoc.addPage();
      
      // ACT: Append from the empty source
      const result = await appendPdfs(emptyPdfBuffer, targetPdfDoc);
      
      // ASSERT:
      expect(result.success).toBe(true);
      // A "blank" PDF actually has one page when loaded by pdf-lib
      expect(result.pagesAdded).toBe(1);
      
      // Target should now have two pages (original + blank page from empty PDF)
      expect(targetPdfDoc.getPageIndices().length).toBe(2);
    });
  });
  
  describe('mergePdfs', () => {
    it('should correctly merge multiple PDFs using array syntax', async () => {
      // ARRANGE: Create sample PDFs with different page counts
      const pdf1Buffer = await createSamplePdf(2); // 2-page PDF
      const pdf2Buffer = await createSamplePdf(3); // 3-page PDF
      const pdf3Buffer = await createSamplePdf(1); // 1-page PDF
      
      // ACT: Merge the PDFs
      const mergedPdfBuffer = await mergePdfs([pdf1Buffer, pdf2Buffer, pdf3Buffer]);
      
      // ASSERT:
      // Verify the result is a buffer
      expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
      
      // Load the merged document and check its page count
      const mergedDoc = await PDFDocument.load(mergedPdfBuffer);
      expect(mergedDoc.getPageCount()).toBe(6); // 2 + 3 + 1 = 6 pages
    });
    
    it('should correctly merge PDFs using individual arguments', async () => {
      // ARRANGE: Create sample PDFs
      const pdf1Buffer = await createSamplePdf(1);
      const pdf2Buffer = await createSamplePdf(2);
      
      // ACT: Merge using individual arguments
      const mergedPdfBuffer = await mergePdfs(pdf1Buffer, pdf2Buffer);
      
      // ASSERT:
      const mergedDoc = await PDFDocument.load(mergedPdfBuffer);
      expect(mergedDoc.getPageCount()).toBe(3); // 1 + 2 = 3 pages
    });
    
    it('should create an empty PDF when no inputs are provided', async () => {
      // ACT: Call with no arguments
      const emptyPdfBuffer = await mergePdfs();
      
      // ASSERT:
      const emptyDoc = await PDFDocument.load(emptyPdfBuffer);
      // pdf-lib treats an initially empty PDF as having 1 page when loaded
      expect(emptyDoc.getPageCount()).toBe(1);
    });
  });
  
  // Optional: Test with actual PDF files from the filesystem if available
  // This is commented out as it depends on the environment
  /*
  describe('Using actual PDF files from disk', () => {
    it('should merge actual PDF files', async () => {
      // Get paths to sample PDFs (assumes they exist in the repo)
      const samplePath = path.join(__dirname, '../sample-pdfs');
      const file1Path = path.join(samplePath, 'sample1.pdf');
      const file2Path = path.join(samplePath, 'sample2.pdf');
      
      // Read the files
      const file1Buffer = fs.readFileSync(file1Path);
      const file2Buffer = fs.readFileSync(file2Path);
      
      // Merge them
      const merged = await mergePdfs(file1Buffer, file2Buffer);
      
      // Validate the merge worked
      const mergedDoc = await PDFDocument.load(merged);
      expect(mergedDoc.getPageCount()).toBeGreaterThan(0);
    });
  });
  */
});
