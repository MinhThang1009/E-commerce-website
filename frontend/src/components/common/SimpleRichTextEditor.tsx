import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { processHtmlForEditor } from '../../utils/htmlProcessor';
import EditorErrorBoundary from './EditorErrorBoundary';

interface SimpleRichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
}

const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  height = 200,
  readonly = false,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('editor.placeholder');
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const isInternalChange = useRef(false);

  // Khởi tạo Quill
  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder: resolvedPlaceholder,
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
      },
      readOnly: readonly,
    });

    quillRef.current = quill;

    // Thiết lập giá trị ban đầu
    if (value) {
      quill.root.innerHTML = processHtmlForEditor(value);
    }

    // Lắng nghe sự thay đổi nội dung
    quill.on('text-change', () => {
      if (isInternalChange.current) return;
      
      const content = quill.root.innerHTML;
      // Tránh gửi lại value rỗng nếu Quill tự động thêm <p><br></p>
      const finalContent = content === '<p><br></p>' ? '' : content;
      
      if (onChange) {
        onChange(finalContent);
      }
    });

    return () => {
      quillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Khởi tạo Quill một lần khi mount, các props dùng qua ref
  }, []);

  // Đồng bộ value từ bên ngoài vào editor
  useEffect(() => {
    if (!quillRef.current) return;

    const currentContent = quillRef.current.root.innerHTML;
    const processedNewValue = processHtmlForEditor(value || '');
    
    // Chỉ cập nhật nếu giá trị thực sự khác biệt để tránh loop
    if (processedNewValue !== currentContent && processedNewValue !== (currentContent === '<p><br></p>' ? '' : currentContent)) {
      isInternalChange.current = true;
      quillRef.current.root.innerHTML = processedNewValue;
      isInternalChange.current = false;
    }
  }, [value]);

  // Cập nhật chế độ readonly
  useEffect(() => {
    if (quillRef.current) {
      if (readonly) {
        quillRef.current.disable();
      } else {
        quillRef.current.enable();
      }
    }
  }, [readonly]);

  return (
    <EditorErrorBoundary
      height={height}
      placeholder={resolvedPlaceholder}
      value={value}
      onChange={onChange}
    >
      <div className="simple-quill-editor" style={{ height: `${height + 42}px` }}>
        <div ref={containerRef} style={{ height: `${height}px` }} />
        <style>{`
          .simple-quill-editor .ql-container {
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
          }
          .simple-quill-editor .ql-toolbar {
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
          }
        `}</style>
      </div>
    </EditorErrorBoundary>
  );
};

export default SimpleRichTextEditor;

