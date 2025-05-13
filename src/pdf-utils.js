/**
 * PDF utility functions for handling PDF operations
 * Following functional programming paradigm with single object input/output
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

/**
 * Ensures that a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path to ensure exists
 * @returns {Object} Result object
 */
const ensureDirectoryExists = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return { success: true, dirPath };
  } catch (error) {
    return {
      success: false,
      error: new Error(`Failed to create directory ${dirPath}: ${error.message}`),
    };
  }
};

/**
 * Processes a single PDF for merging
 * Updated to accept raw PDF data instead of file paths.
 * @param {Buffer} pdfBuffer - The raw PDF data
 * @param {PDFDocument} targetDoc - Target PDF document to add pages to
 * @returns {Promise<Object>} Result of processing
 */
const processSinglePdf = async (pdfBuffer, targetDoc) => {
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
  try {
    const targetDoc = await PDFDocument.create();
    for (const pdfBuffer of pdfBuffers) {
      const result = await processSinglePdf(pdfBuffer, targetDoc);
      if (!result.success) {
        throw result.error;
      }
    }
    return await targetDoc.save();
  } catch (error) {
    throw new Error(`Failed to merge PDFs: ${error.message}`);
  }
};

module.exports = {
  processSinglePdf,
  mergePdfs,
  ensureDirectoryExists,
};
