/**
 * PDF utility functions for handling PDF operations
 * Following functional programming paradigm with single object input/output
 * Only exposing buffer-based interfaces in the public API
 */
const { PDFDocument } = require('pdf-lib');

/**
 * Internal helper: Appends pages from a source PDF buffer to a target PDFDocument instance.
 * Not exposed directly in the public API.
 *
 * @param {Buffer} sourceBuffer The buffer of the source PDF.
 * @param {PDFDocument} targetDoc The target PDFDocument instance to which pages will be added.
 * @returns {Promise<{success: boolean, pagesAdded: number, error?: Error}>}
 */
const _appendPdfToDoc = async (sourceBuffer, targetDoc) => {
  try {
    const sourceDoc = await PDFDocument.load(sourceBuffer);
    const pageIndices = sourceDoc.getPageIndices();
    if (pageIndices.length === 0) {
      return { success: true, pagesAdded: 0 }; // Correctly handle empty source PDF
    }
    const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndices);
    copiedPages.forEach((page) => {
      targetDoc.addPage(page);
    });
    return { success: true, pagesAdded: copiedPages.length };
  } catch (error) {
    return { success: false, error, pagesAdded: 0 };
  }
};

/**
 * Appends pages from a source PDF buffer to a target PDF buffer.
 * This function is designed for in-memory PDF manipulation.
 *
 * @param {Buffer} sourceBuffer The buffer of the source PDF.
 * @param {Buffer} targetBuffer The buffer of the target PDF.
 * @returns {Promise<{buffer: Buffer, success: boolean, pagesAdded: number, error?: Error}>}
 *          An object with the resulting buffer, success status, and number of pages added.
 */
const appendPdfs = async (sourceBuffer, targetBuffer) => {
  try {
    // Load the target PDF from buffer
    const targetDoc = await PDFDocument.load(targetBuffer);
    
    // Use the internal helper to append pages
    const result = await _appendPdfToDoc(sourceBuffer, targetDoc);
    
    if (result.success) {
      // Convert back to buffer
      const resultBuffer = Buffer.from(await targetDoc.save());
      return { 
        buffer: resultBuffer,
        success: true, 
        pagesAdded: result.pagesAdded
      };
    } else {
      // Propagate the error
      return {
        buffer: targetBuffer, // Return original buffer on error
        success: false,
        error: result.error,
        pagesAdded: 0
      };
    }
  } catch (error) {
    return {
      buffer: targetBuffer, // Return original buffer on error
      success: false,
      error,
      pagesAdded: 0
    };
  }
};

/**
 * Merges multiple PDF buffers into a single PDF buffer, purely in-memory.
 * This function accepts either:
 * - Multiple Buffer arguments: mergePdfs(pdf1, pdf2, ...)
 * - A single array of Buffers: mergePdfs([pdf1, pdf2, ...])
 * 
 * If no PDFs are provided (empty array or no arguments), it returns a new empty PDF document.
 *
 * @param {...Buffer|Buffer[]} pdfBuffers One or more PDF buffers, or an array of PDF buffers
 * @returns {Promise<Buffer>} A buffer representing the merged PDF
 * @throws {Error} If any error occurs during the merging process
 */
const mergePdfs = async (...args) => {
  let pdfBuffers;
  
  // Handle both function call styles: mergePdfs(pdf1, pdf2) and mergePdfs([pdf1, pdf2])
  if (args.length === 1 && Array.isArray(args[0])) {
    // Called as mergePdfs([pdf1, pdf2])
    pdfBuffers = args[0];
  } else {
    // Called as mergePdfs(pdf1, pdf2)
    pdfBuffers = args;
  }
  
  try {
    const newPdfDoc = await PDFDocument.create();
    
    // Process each PDF buffer
    for (const pdfBuffer of pdfBuffers) {
      const result = await _appendPdfToDoc(pdfBuffer, newPdfDoc);
      if (!result.success) {
        // Propagate the error from _appendPdfToDoc
        throw result.error;
      }
    }
    
    // Convert Uint8Array to Node.js Buffer
    const pdfBytes = await newPdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    // Ensure a more descriptive error is thrown
    const errorMessage = error.message ? error.message : 'Unknown error during PDF merge';
    throw new Error("Failed to merge PDFs: " + errorMessage);
  }
};

module.exports = {
  appendPdfs,
  mergePdfs,
};
