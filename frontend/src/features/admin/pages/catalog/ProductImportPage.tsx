/**
 * @file ProductImportPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import React, { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import {
  Card,
  Button,
  Steps,
  Table,
  Alert,
  Typography,
  Space,
  Tag,
  Tabs,
  message,
  Progress,
  Upload,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ──────────────────────────────────────────────────
// Kiểu dữ liệu
// ──────────────────────────────────────────────────

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: ImportError[];
}

interface ImportHistoryLog {
  id: number;
  adminId: number;
  filename: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  importedAt: string;
}

interface ParsedRow {
  [key: string]: string;
}

// ──────────────────────────────────────────────────
// Hàm tiện ích
// ──────────────────────────────────────────────────

/** Lấy API base URL từ biến môi trường hoặc mặc định */
function getApiBase(): string {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';
  return url.endsWith('/api') ? url : `${url}/api`;
}

function getAuthToken(): string {
  return useAuthStore.getState().token || '';
}

/** Parse đơn giản một dòng CSV — xử lý ngoặc kép */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse CSV content → mảng object */
function parseCsvPreview(content: string, maxRows = 10): ParsedRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1, maxRows + 1).map((line) => {
    const values = parseCsvLine(line);
    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
}

/** Parse JSON content → mảng object (tối đa maxRows để preview) */
function parseJsonPreview(content: string, maxRows = 10): ParsedRow[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, maxRows).map((item) => {
        const row: ParsedRow = {};
        Object.entries(item).forEach(([k, v]) => {
          row[k] = String(v ?? '');
        });
        return row;
      });
    }
    return [];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────
// Component chính
// ──────────────────────────────────────────────────

const ProductImportPage: React.FC = () => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [historyLogs, setHistoryLogs] = useState<ImportHistoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('import');
  const fileContentRef = useRef<string>('');
  const selectedFileRef = useRef<RcFile | null>(null);

  // ── Xử lý khi chọn file ──
  const handleFileSelect = useCallback(
    (file: RcFile): boolean => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'json'].includes(ext || '')) {
        message.error(t('adminImport.invalidFileType'));
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        message.error(t('adminImport.fileTooLarge'));
        return false;
      }

      selectedFileRef.current = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        fileContentRef.current = content;

        let rows: ParsedRow[] = [];
        let lineCount = 0;

        if (ext === 'json') {
          try {
            const parsed = JSON.parse(content);
            lineCount = Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            lineCount = 0;
          }
          rows = parseJsonPreview(content);
        } else {
          const lines = content.split(/\r?\n/).filter((l) => l.trim());
          // Trừ 1 dòng header
          lineCount = Math.max(0, lines.length - 1);
          rows = parseCsvPreview(content);
        }

        setTotalRows(lineCount);
        setPreviewRows(rows);
        setPreviewHeaders(rows.length > 0 ? Object.keys(rows[0]) : []);

        const uploadFile: UploadFile = {
          uid: file.uid,
          name: file.name,
          status: 'done',
          size: file.size,
        };
        setFileList([uploadFile]);
      };
      reader.readAsText(file, 'utf-8');

      // Ngăn Antd tự upload — chúng ta sẽ upload thủ công
      return false;
    },
    [t],
  );

  // ── Gửi file lên server ──
  const handleImport = async () => {
    if (!selectedFileRef.current) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', selectedFileRef.current);

    try {
      const res = await fetch(`${getApiBase()}/admin/products/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          // Không set Content-Type — để browser tự thêm boundary cho multipart
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        message.error(json.message || t('errors.server'));
        return;
      }

      setImportResult(json.data);
      setCurrentStep(3);
    } catch {
      message.error(t('errors.network'));
    } finally {
      setIsImporting(false);
    }
  };

  // ── Download CSV template ──
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`${getApiBase()}/admin/products/import-template`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error(t('errors.network'));
    }
  };

  // ── Export sản phẩm ──
  const handleExport = async () => {
    try {
      const res = await fetch(`${getApiBase()}/admin/products/export?format=csv`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('adminImport.exportBtn'));
    } catch {
      message.error(t('errors.network'));
    }
  };

  // ── Load lịch sử import ──
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/admin/products/import-history`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const json = await res.json();
      if (json.status === 'success') {
        setHistoryLogs(json.data.logs || []);
      }
    } catch {
      message.error(t('errors.network'));
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Reset wizard ──
  const resetWizard = () => {
    setCurrentStep(0);
    setFileList([]);
    setPreviewRows([]);
    setPreviewHeaders([]);
    setTotalRows(0);
    setImportResult(null);
    fileContentRef.current = '';
    selectedFileRef.current = null;
  };

  // ──────────────────────────────────────────────────
  // Cột bảng preview
  // ──────────────────────────────────────────────────
  const previewColumns = previewHeaders.map((h) => ({
    title: h,
    dataIndex: h,
    key: h,
    ellipsis: true,
    width: 150,
  }));

  // ──────────────────────────────────────────────────
  // Cột bảng lỗi
  // ──────────────────────────────────────────────────
  const errorColumns = [
    { title: t('adminImport.colRow'), dataIndex: 'row', key: 'row', width: 80 },
    { title: t('adminImport.colField'), dataIndex: 'field', key: 'field', width: 120 },
    { title: t('adminImport.colMessage'), dataIndex: 'message', key: 'message' },
  ];

  // ──────────────────────────────────────────────────
  // Cột bảng lịch sử
  // ──────────────────────────────────────────────────
  const historyColumns = [
    { title: t('adminImport.historyFilename'), dataIndex: 'filename', key: 'filename' },
    {
      title: t('adminImport.historyDate'),
      dataIndex: 'importedAt',
      key: 'importedAt',
      render: (v: string) => new Date(v).toLocaleString('vi-VN'),
    },
    { title: t('adminImport.historyTotal'), dataIndex: 'totalRows', key: 'totalRows', width: 100 },
    {
      title: t('adminImport.historySuccess'),
      dataIndex: 'successRows',
      key: 'successRows',
      width: 100,
      render: (v: number) => <Tag color="green">{v}</Tag>,
    },
    {
      title: t('adminImport.historyFailed'),
      dataIndex: 'failedRows',
      key: 'failedRows',
      width: 100,
      render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag>),
    },
  ];

  // ──────────────────────────────────────────────────
  // Render từng bước
  // ──────────────────────────────────────────────────

  const renderStep0 = () => (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
          {t('adminImport.downloadTemplate')}
        </Button>

        <Dragger
          name="file"
          multiple={false}
          fileList={fileList}
          beforeUpload={handleFileSelect}
          accept=".csv,.json"
          showUploadList
          onRemove={() => {
            setFileList([]);
            setPreviewRows([]);
            setPreviewHeaders([]);
            setTotalRows(0);
            selectedFileRef.current = null;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('adminImport.dropzoneText')}</p>
          <p className="ant-upload-hint">{t('adminImport.dropzoneHint')}</p>
        </Dragger>

        <Button type="primary" disabled={fileList.length === 0} onClick={() => setCurrentStep(1)}>
          {t('adminImport.next')}
        </Button>
      </Space>
    </div>
  );

  const renderStep1 = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Text>{t('adminImport.previewTitle')}</Text>
      {previewRows.length > 0 ? (
        <Table
          dataSource={previewRows.map((r, i) => ({ ...r, key: i }))}
          columns={previewColumns}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={false}
        />
      ) : (
        <Alert type="warning" message={t('adminImport.noFileSelected')} />
      )}
      <Space>
        <Button onClick={() => setCurrentStep(0)}>{t('adminImport.back')}</Button>
        <Button
          type="primary"
          disabled={previewRows.length === 0}
          onClick={() => setCurrentStep(2)}
        >
          {t('adminImport.next')}
        </Button>
      </Space>
    </Space>
  );

  const renderStep2 = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        message={t('adminImport.confirmTitle')}
        description={t('adminImport.confirmDesc', { count: totalRows })}
        showIcon
      />
      <Space>
        <Button onClick={() => setCurrentStep(1)}>{t('adminImport.back')}</Button>
        <Button type="primary" loading={isImporting} onClick={handleImport}>
          {isImporting ? t('adminImport.importing') : t('adminImport.startImport')}
        </Button>
      </Space>
    </Space>
  );

  const renderStep3 = () => {
    if (!importResult) return null;
    const successRate =
      importResult.totalRows > 0
        ? Math.round((importResult.successCount / importResult.totalRows) * 100)
        : 0;

    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Progress
          percent={successRate}
          status={importResult.failedCount > 0 ? 'exception' : 'success'}
          format={() => `${importResult.successCount}/${importResult.totalRows}`}
        />

        <Space>
          {importResult.successCount > 0 && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              {t('adminImport.successCount', { count: importResult.successCount })}
            </Tag>
          )}
          {importResult.failedCount > 0 && (
            <Tag icon={<CloseCircleOutlined />} color="error">
              {t('adminImport.failedCount', { count: importResult.failedCount })}
            </Tag>
          )}
        </Space>

        {importResult.errors.length > 0 ? (
          <>
            <Text type="secondary">{t('adminImport.errorTableTitle')}</Text>
            <Table
              dataSource={importResult.errors.map((e, i) => ({ ...e, key: i }))}
              columns={errorColumns}
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </>
        ) : (
          <Alert type="success" message={t('adminImport.noErrors')} showIcon />
        )}

        <Button icon={<ReloadOutlined />} onClick={resetWizard}>
          {t('adminImport.tabImport')}
        </Button>
      </Space>
    );
  };

  // ──────────────────────────────────────────────────
  // Render tab lịch sử
  // ──────────────────────────────────────────────────
  const renderHistory = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Button icon={<ReloadOutlined />} loading={historyLoading} onClick={loadHistory}>
        {t('adminImport.historyTitle')}
      </Button>

      <Table
        dataSource={historyLogs.map((l) => ({ ...l, key: l.id }))}
        columns={historyColumns}
        size="small"
        loading={historyLoading}
        locale={{ emptyText: t('adminImport.noHistory') }}
        pagination={{ pageSize: 20 }}
      />
    </Space>
  );

  // ──────────────────────────────────────────────────
  // Render chính
  // ──────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            {t('adminImport.pageTitle')}
          </Title>
          <Text type="secondary">{t('adminImport.pageDesc')}</Text>
        </div>
        <Button icon={<ExportOutlined />} onClick={handleExport}>
          {t('adminImport.exportBtn')}
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          if (key === 'history') loadHistory();
        }}
        items={[
          {
            key: 'import',
            label: t('adminImport.tabImport'),
            children: (
              <Card>
                <Steps
                  current={currentStep}
                  style={{ marginBottom: 32 }}
                  items={[
                    { title: t('adminImport.step1Title'), description: t('adminImport.step1Desc') },
                    { title: t('adminImport.step2Title'), description: t('adminImport.step2Desc') },
                    { title: t('adminImport.step3Title'), description: t('adminImport.step3Desc') },
                    { title: t('adminImport.step4Title'), description: t('adminImport.step4Desc') },
                  ]}
                />
                <Divider />
                {currentStep === 0 && renderStep0()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
              </Card>
            ),
          },
          {
            key: 'history',
            label: t('adminImport.tabHistory'),
            children: <Card>{renderHistory()}</Card>,
          },
        ]}
      />
    </div>
  );
};

export default ProductImportPage;
