/**
 * @file RichTextEditor.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import ReactQuill from 'react-quill';
import 'quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
  // Hỗ trợ Ant Design Form.Item
  style?: React.CSSProperties;
  className?: string;
}

// Hàm tiện ích chuyển đổi chuỗi base64 thành thẻ img
const convertBase64ToImages = (content: string, altText = 'Product image'): string => {
  if (!content) return '';

  let convertedContent = content;

  // Tìm tất cả data URL ảnh base64
  const base64Pattern = /data:image\/[a-zA-Z]*;base64,[A-Za-z0-9+/=]+/g;

  // Thay thế từng chuỗi base64 bằng thẻ img nếu chưa được bao bọc
  convertedContent = convertedContent.replace(base64Pattern, (match) => {
    // Kiểm tra xem base64 này đã nằm trong thẻ img chưa
    const beforeMatch = convertedContent.substring(
      0,
      convertedContent.indexOf(match)
    );
    // Kiểm tra đơn giản: nếu có <img trước và > sau, có thể đã được bao bọc
    if (
      beforeMatch.includes('<img') &&
      beforeMatch.lastIndexOf('<img') > beforeMatch.lastIndexOf('>')
    ) {
      return match; // Đã được bao bọc
    }

    // Chưa được bao bọc, tạo thẻ img
    return `<img src="${match}" alt="${altText}" style="max-width: 100%; height: auto;" />`;
  });

  return convertedContent;
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  height = 200,
  readonly = false,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('editor.placeholder');
  const [displayValue, setDisplayValue] = useState('');
  const quillRef = useRef<ReactQuill>(null);

  // Chuyển đổi ảnh base64 khi value thay đổi
  useEffect(() => {
    const converted = convertBase64ToImages(value, t('product.imageAlt'));
    setDisplayValue(converted);
  }, [value, t]);

  // Chèn nội dung HTML vào Quill editor khi sẵn sàng
  useEffect(() => {
    if (!readonly && displayValue && quillRef.current) {
      const timer = setTimeout(() => {
        const quill = quillRef.current?.getEditor();
        if (quill) {
          if (displayValue.includes('<img')) {
            // Xóa nội dung editor trước
            quill.setText('');
            // Sau đó dán nội dung HTML
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReactQuill internal API
      (quill as any).dangerouslyPasteHTML(displayValue);
          } else {
            // Với văn bản thường, dùng setText
            quill.setText(displayValue);
          }
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [displayValue, readonly]);

  const handleChange = (content: string) => {
    setDisplayValue(content);
    if (onChange) {
      onChange(content);
    }
  };

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['link', 'image'],
        ['clean'],
      ],
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'color',
    'background',
    'list',
    'bullet',
    'indent',
    'link',
    'image',
  ];

  // Nếu readonly và có chứa ảnh, dùng dangerouslySetInnerHTML để hiển thị đúng
  if (readonly && displayValue.includes('<img')) {
    return (
      <div className="rich-text-editor readonly-mode">
        <div
          className="ql-editor"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayValue) }}
          style={{
            minHeight: `${height - 42}px`,
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '12px 15px',
            backgroundColor: '#f8f9fa',
          }}
        />
        <style>{`
          .readonly-mode .ql-editor {
            min-height: ${height - 42}px;
          }
          .readonly-mode .ql-editor img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px 0;
          }
          .readonly-mode .ql-editor p {
            margin-bottom: 10px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="rich-text-editor">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={displayValue.includes('<img') ? '' : displayValue}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={resolvedPlaceholder}
        readOnly={readonly}
        style={{ height: `${height}px`, marginBottom: '50px' }}
      />
      <style>{`
        .rich-text-editor .ql-editor {
          min-height: ${height - 42}px;
        }
        .rich-text-editor .ql-toolbar {
          border-top: 1px solid #ccc;
          border-left: 1px solid #ccc;
          border-right: 1px solid #ccc;
        }
        .rich-text-editor .ql-container {
          border-bottom: 1px solid #ccc;
          border-left: 1px solid #ccc;
          border-right: 1px solid #ccc;
        }
        .rich-text-editor .ql-editor img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 10px 0;
        }
        .rich-text-editor .ql-editor p {
          margin-bottom: 10px;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;

