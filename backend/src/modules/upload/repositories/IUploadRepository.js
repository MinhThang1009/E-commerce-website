// IUploadRepository — interface filesystem operations cho upload module.
// Tên là "Repository" theo convention nhưng thực chất wrap file system, không
// phải DB. Service phụ thuộc interface này để dễ swap implementation (vd
// S3FileStorage thay FilesystemUploadRepository ở môi trường production).

class IUploadRepository {
  async fileExists(_filePath) { throw new Error('not implemented'); }
  async deleteFile(_filePath) { throw new Error('not implemented'); }
  async readFileHeader(_filePath, _bytesToRead) { throw new Error('not implemented'); }
}

module.exports = IUploadRepository;
