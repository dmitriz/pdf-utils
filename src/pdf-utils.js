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
 * If an empty array is provided, it returns a new, empty PDF document.
 *
 * @param {Array<Buffer>} pdfBuffers An array of PDF buffers to merge.
 * @returns {Promise<Buffer>} A buffer representing the merged PDF.
 * @throws {Error} If any error occurs during the merging process.
 */
const mergePdfs = async (pdfBuffers) => {
  // Removed the check for empty pdfBuffers to allow creating an empty PDF.
  // if (!Array.isArray(pdfBuffers) || pdfBuffers.length === 0) {
  //   throw new Error('Input must be a non-empty array of PDF buffers.');
  // }

  let newPdfDoc;
  try {
    newPdfDoc = await PDFDocument.create();

    // Only iterate if pdfBuffers is not empty
    if (Array.isArray(pdfBuffers) && pdfBuffers.length > 0) {
      for (const pdfBuffer of pdfBuffers) {
        const result = await appendPdfPages(pdfBuffer, newPdfDoc);
        if (!result.success) {
          // Propagate the error from appendPdfPages
          throw result.error; // result.error should be an Error object
        }
      }
    }
    return await newPdfDoc.save();
  } catch (error) {
    // Ensure a more descriptive error is thrown if it originates here or is re-thrown.
    // Check if error already has a message, otherwise use a generic one.
    const errorMessage = error.message ? error.message : 'Unknown error during PDF merge';
    throw new Error(`Failed to merge PDFs: ${errorMessage}`);
  }
};

module.exports = {
  appendPdfPages,
  mergePdfs,
};
