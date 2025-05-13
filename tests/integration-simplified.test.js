/**
 * Integration tests for PDF utility functions.
 * 
 * These tests verify that our utility functions work correctly with real PDF data,
 * focusing on the public API functionality rather than implementation details.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { appendPdfs, mergePdfs } = require('../src/pdf-utils');

// Helper function to create simple PDF buffers with specified page count
// Uses PDFDocument internally but returns a standard Buffer for testing
const createSamplePdfBuffer = async (pageCount = 1) => {
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
  
  // Convert to Buffer and return
  return Buffer.from(await pdfDoc.save());
};

// Helper function to get page count from a PDF buffer
const getPageCount = async (pdfBuffer) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return pdfDoc.getPageCount();
};

describe('Integration Tests with Real PDFs', () => {
  describe('mergePdfs', () => {
    it('should correctly merge multiple PDFs using array syntax', async () => {
      // ARRANGE: Create sample PDF buffers with different page counts
      const pdf1Buffer = await createSamplePdfBuffer(2); // 2-page PDF
      const pdf2Buffer = await createSamplePdfBuffer(3); // 3-page PDF
      const pdf3Buffer = await createSamplePdfBuffer(1); // 1-page PDF
      
      // Verify our test PDFs have the expected page counts
      expect(await getPageCount(pdf1Buffer)).toBe(2);
      expect(await getPageCount(pdf2Buffer)).toBe(3);
      expect(await getPageCount(pdf3Buffer)).toBe(1);
      
      // ACT: Merge the PDFs
      const mergedPdfBuffer = await mergePdfs([pdf1Buffer, pdf2Buffer, pdf3Buffer]);
      
      // ASSERT:
      // Verify the result is a buffer
      expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
      
      // Verify the merged document has the correct total page count
      const mergedPageCount = await getPageCount(mergedPdfBuffer);
      expect(mergedPageCount).toBe(6); // 2 + 3 + 1 = 6 pages
    });
    
    it('should correctly merge PDFs using individual arguments', async () => {
      // ARRANGE: Create sample PDFs
      const pdf1Buffer = await createSamplePdfBuffer(1);
      const pdf2Buffer = await createSamplePdfBuffer(2);
      
      // ACT: Merge using individual arguments
      const mergedPdfBuffer = await mergePdfs(pdf1Buffer, pdf2Buffer);
      
      // ASSERT:
      expect(Buffer.isBuffer(mergedPdfBuffer)).toBe(true);
      expect(await getPageCount(mergedPdfBuffer)).toBe(3); // 1 + 2 = 3 pages
    });
    
    it('should create a single-page PDF when no inputs are provided', async () => {
      // ACT: Call with no arguments
      const emptyPdfBuffer = await mergePdfs();
      
      // ASSERT:
      expect(Buffer.isBuffer(emptyPdfBuffer)).toBe(true);
      expect(await getPageCount(emptyPdfBuffer)).toBe(1);
    });
  });
  
  describe('appendPdfs', () => {
    it('should correctly append pages from one PDF to another', async () => {
      // ARRANGE: Create real PDF documents
      const sourcePdfBuffer = await createSamplePdfBuffer(3); // 3-page PDF
      
      // Create a target document with 1 page
      const targetPdfDoc = await PDFDocument.create();
      targetPdfDoc.addPage();
      
      // ACT: Append the source pages to the target
      const result = await appendPdfs(sourcePdfBuffer, targetPdfDoc);
      
      // ASSERT:
      expect(result.success).toBe(true);
      expect(result.pagesAdded).toBe(3);
      
      // Verify the target document now has 4 pages (1 original + 3 added)
      const targetPages = targetPdfDoc.getPageIndices();
      expect(targetPages.length).toBe(4);
    });
  });
});
