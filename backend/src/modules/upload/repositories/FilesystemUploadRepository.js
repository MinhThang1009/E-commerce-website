const fsPromises = require('fs').promises;
const IUploadRepository = require('./IUploadRepository');

// Filesystem impl của IUploadRepository — wrap fs operations.
// Service phụ thuộc interface, không phụ thuộc fs trực tiếp.
class FilesystemUploadRepository extends IUploadRepository {
  async fileExists(filePath) {
    try {
      await fsPromises.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath) {
    return fsPromises.unlink(filePath);
  }

  async readFileHeader(filePath, bytesToRead = 12) {
    const fd = await fsPromises.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(bytesToRead);
      await fd.read(buf, 0, bytesToRead, 0);
      return buf;
    } finally {
      await fd.close();
    }
  }
}

module.exports = FilesystemUploadRepository;
