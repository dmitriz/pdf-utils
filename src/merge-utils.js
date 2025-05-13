// src/merge-utils.js
const { PDFDocument } = require('pdf-lib');

async function mergePdfsInMemory(...pdfBuffers) {
    try {
        const mergedPdf = await PDFDocument.create();
        if (pdfBuffers && pdfBuffers.length > 0) {
            for (const pdfBuffer of pdfBuffers) {
                if (pdfBuffer && pdfBuffer.length > 0) {
                    try {
                        // Ensure buffer is treated as Uint8Array if pdf-lib requires it
                        const currentPdfBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
                        const pdf = await PDFDocument.load(currentPdfBuffer, { ignoreEncryption: true });
                        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                        copiedPages.forEach((page) => mergedPdf.addPage(page));
                    } catch (loadError) {
                        // console.warn(`Skipping a buffer that could not be loaded as a PDF: ${loadError.message}`);
                        // Propagate error to indicate a failed merge attempt if any part fails.
                        throw new Error(`Failed to load one of the PDF buffers: ${loadError.message}`);
                    }
                }
            }
        }
        return Buffer.from(await mergedPdf.save());
    } catch (error) {
        // console.error('Error in mergePdfsInMemory:', error);
        // Ensure the error message clearly indicates it's from mergePdfsInMemory
        throw new Error(`mergePdfsInMemory failed: ${error.message}`);
    }
}

module.exports = { mergePdfsInMemory };
