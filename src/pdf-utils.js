/**
 * PDF utility functions for handling PDF operations
 * Following functional programming paradigm with single object input/output
 */
const { PDFDocument } = require('pdf-lib');

/**
 * Appends pages from a source PDF buffer to a target PDFDocument instance.
 * This function is designed for in-memory PDF manipulation.
 *
 * @param {Buffer} sourceBuffer The buffer of the source PDF.
 * @param {PDFDocument} targetDoc The target PDFDocument instance to which pages will be added.
 * @returns {Promise<{success: boolean, pagesAdded: number, error?: Error}>}
 *          An object indicating success or failure, and the number of pages added.
 */
const appendPdfPages = async (sourceBuffer, targetDoc) => {
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
    return { success: false, error, pagesAdded: 0 }; // Ensure pagesAdded is 0 on error
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
      const result = await appendPdfPages(pdfBuffer, newPdfDoc);
      if (!result.success) {
        // Propagate the error from appendPdfPages
        throw result.error;
      }
    }
    
    return await newPdfDoc.save();
  } catch (error) {
    // Ensure a more descriptive error is thrown
    const errorMessage = error.message ? error.message : 'Unknown error during PDF merge';
    throw new Error("Failed to merge PDFs: " + errorMessage);
  }
};

module.exports = {
  appendPdfPages,
  mergePdfs,
};
