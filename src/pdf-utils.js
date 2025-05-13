/**
 * PDF utility functions for handling PDF operations
 * Following functional programming paradigm with single object input/output
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

/**
 * Processes a single PDF for merging
 * Updated to accept raw PDF data instead of file paths.
 * @param {Buffer} pdfBuffer - The raw PDF data
 * @param {PDFDocument} targetDoc - Target PDF document to add pages to
 * @returns {Promise<Object>} Result of processing
 */
const appendPdfPages = async (pdfBuffer, targetDoc) => {
  try {
    const sourceDoc = await PDFDocument.load(pdfBuffer);
    const copiedPages = await targetDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
    copiedPages.forEach((page) => targetDoc.addPage(page));
    return { success: true, pagesAdded: copiedPages.length };
  } catch (error) {
    return { success: false, error };
  }
};

/**
 * Merges multiple PDFs into a single PDF
 * Updated to accept raw PDF data instead of file paths.
 * @param {Array<Buffer>} pdfBuffers - Array of raw PDF data
 * @returns {Promise<Buffer>} The merged PDF data
 */
const mergePdfs = async (pdfBuffers) => {
  if (!Array.isArray(pdfBuffers) || pdfBuffers.length === 0) {
    throw new Error('Input must be a non-empty array of PDF buffers.');
  }

  try {
    // Initialize with the first PDF buffer by creating a new document from it,
    // or start with an empty document if preferred, though this approach
    // avoids an unnecessary initial empty document if there's only one buffer.
    // However, for a reduce pattern, starting with a created empty doc is cleaner.

    const mainDoc = await PDFDocument.create();

    // Use reduce to sequentially append pages from each buffer to the mainDoc
    await pdfBuffers.reduce(async (previousPromise, currentPdfBuffer) => {
      // Wait for the previous append operation to complete (if any)
      await previousPromise;
      
      // Append pages from the current buffer to the mainDoc
      const result = await appendPdfPages(currentPdfBuffer, mainDoc);
      if (!result.success) {
        // If appendPdfPages fails, it returns an error object.
        // We throw this error to be caught by the outer try...catch block.
        throw result.error;
      }
      // The return value of the reducer isn't strictly needed here since we're modifying mainDoc directly,
      // but we need to return a promise for the async reducer.
      return Promise.resolve(); 
    }, Promise.resolve()); // Initial value for the reduce accumulator

    return await mainDoc.save();
  } catch (error) {
    // console.error('Error during PDF merge operation:', error);
    // Ensure a consistent error message format
    throw new Error(`Failed to merge PDFs: ${error.message}`);
  }
};

module.exports = {
  appendPdfPages,
  mergePdfs,
};
