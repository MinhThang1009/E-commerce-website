/**
 * @file FilesystemUploadRepository.test.js
 * @description Tests cho FilesystemUploadRepository — mock fs.promises.
 */

const mockStat = jest.fn();
const mockUnlink = jest.fn();
const mockOpen = jest.fn();

jest.mock('fs', () => ({
  promises: {
    stat: (...args) => mockStat(...args),
    unlink: (...args) => mockUnlink(...args),
    open: (...args) => mockOpen(...args),
  },
}));

const FilesystemUploadRepository = require('./filesystem-upload-repository');

let repo;
beforeEach(() => {
  repo = new FilesystemUploadRepository();
  jest.clearAllMocks();
});

describe('FilesystemUploadRepository.fileExists', () => {
  test('trả về true khi file tồn tại', async () => {
    mockStat.mockResolvedValue({ size: 1024 });
    expect(await repo.fileExists('/path/to/file.jpg')).toBe(true);
  });

  test('trả về false khi file không tồn tại (stat throw)', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));
    expect(await repo.fileExists('/path/not/exist.jpg')).toBe(false);
  });
});

describe('FilesystemUploadRepository.deleteFile', () => {
  test('gọi fs.unlink với đúng path', async () => {
    mockUnlink.mockResolvedValue(undefined);
    await repo.deleteFile('/path/to/file.jpg');
    expect(mockUnlink).toHaveBeenCalledWith('/path/to/file.jpg');
  });
});

describe('FilesystemUploadRepository.readFileHeader (line 26)', () => {
  test('đọc bytesToRead bytes từ đầu file và đóng fd', async () => {
    const buf = Buffer.alloc(12);
    buf.write('JPEG_HEADER_', 'ascii');

    const mockFd = {
      read: jest.fn().mockResolvedValue({ bytesRead: 12 }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockOpen.mockResolvedValue(mockFd);

    const result = await repo.readFileHeader('/path/image.jpg');

    expect(mockOpen).toHaveBeenCalledWith('/path/image.jpg', 'r');
    expect(mockFd.read).toHaveBeenCalledWith(expect.any(Buffer), 0, 12, 0);
    expect(mockFd.close).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Buffer);
  });

  test('đóng fd ngay cả khi read throw (finally block)', async () => {
    const mockFd = {
      read: jest.fn().mockRejectedValue(new Error('read error')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockOpen.mockResolvedValue(mockFd);

    await expect(repo.readFileHeader('/path/bad.jpg')).rejects.toThrow('read error');
    expect(mockFd.close).toHaveBeenCalled();
  });

  test('đọc với bytesToRead tuỳ chỉnh', async () => {
    const mockFd = {
      read: jest.fn().mockResolvedValue({ bytesRead: 4 }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockOpen.mockResolvedValue(mockFd);

    await repo.readFileHeader('/path/file', 4);
    expect(mockFd.read).toHaveBeenCalledWith(expect.any(Buffer), 0, 4, 0);
  });
});
