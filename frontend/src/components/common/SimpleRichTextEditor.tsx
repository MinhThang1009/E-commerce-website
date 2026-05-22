/**
 * @file SimpleRichTextEditor.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { processHtmlForEditor } from '../../utils/html-processor';
import EditorErrorBoundary from './EditorErrorBoundary';

interface SimpleRichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
  id?: string;
}

const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  height = 200,
  readonly = false,
  id,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('editor.placeholder');
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const isInternalChange = useRef(false);
  // Ref này tồn tại qua StrictMode simulated-unmount nhưng reset khi unmount thật
  const hasInitialized = useRef(false);
  // Stable ref để tránh stale closure trong Quill handler (không cần re-register khi onChange thay đổi)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Khởi tạo Quill
  useEffect(() => {
    if (!containerRef.current || quillRef.current || hasInitialized.current) return;
    hasInitialized.current = true;

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

    // Gán id vào ql-editor để label[for] của Form.Item trỏ đúng element
    if (id) quill.root.id = id;

    // Thiết lập giá trị ban đầu
    if (value) {
      quill.root.innerHTML = processHtmlForEditor(value);
    }

    // Lắng nghe sự thay đổi nội dung
    const handleTextChange = () => {
      if (isInternalChange.current) return;
      const content = quill.root.innerHTML;
      const finalContent = content === '<p><br></p>' ? '' : content;
      if (onChangeRef.current) onChangeRef.current(finalContent);
    };
    quill.on('text-change', handleTextChange);

    // KHÔNG gọi quill.off trong cleanup: React.StrictMode simulates unmount-remount,
    // cleanup sẽ xóa handler nhưng hasInitialized.current = true ngăn re-register.
    // Quill instance tồn tại qua cycle này nên handler phải tồn tại cùng.
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Khởi tạo Quill một lần khi mount, các props dùng qua ref
  }, []);

  // Đồng bộ value từ bên ngoài vào editor
  useEffect(() => {
    if (!quillRef.current) return;

    const currentContent = quillRef.current.root.innerHTML;
    const processedNewValue = processHtmlForEditor(value || '');

    // Chỉ cập nhật nếu giá trị thực sự khác biệt để tránh loop
    if (
      processedNewValue !== currentContent &&
      processedNewValue !== (currentContent === '<p><br></p>' ? '' : currentContent)
    ) {
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
        {/* Textarea ẩn để label[for] của Form.Item có labelable target hợp lệ */}
        {id && (
          <textarea
            id={id}
            aria-hidden="true"
            tabIndex={-1}
            readOnly
            onFocus={() => quillRef.current?.focus()}
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              opacity: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          />
        )}
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
          .simple-quill-editor .ql-editor.ql-blank::before {
            color: #6b7280;
          }
        `}</style>
      </div>
    </EditorErrorBoundary>
  );
};

export default SimpleRichTextEditor;
