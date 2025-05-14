const pdfUtils = require('../src/pdf-utils');

// Mock the entire module
jest.mock('../src/pdf-utils');

describe('Mock test', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up mock implementations
    pdfUtils.savePdf = jest.fn().mockReturnValue('mocked result');
    pdfUtils.mergePdfsFromDisk = jest.fn().mockReturnValue('mocked merge');
  });
  
  test('mocks are working', () => {
    // Call the mocked function
    const result = pdfUtils.savePdf({ test: 123 });
    
    // Verify mock was called
    expect(pdfUtils.savePdf).toHaveBeenCalledWith({ test: 123 });
    expect(result).toBe('mocked result');
  });
});
