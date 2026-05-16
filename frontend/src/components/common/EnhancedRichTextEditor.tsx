import React, {
  useEffect,
  useRef,
  useCallback,
} from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUploadImageMutation } from '@/features/upload';
import EditorErrorBoundary from './EditorErrorBoundary';
import { getErrorMsg } from '@/utils/errorMessage';

interface EnhancedRichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
  productId?: string;
  category?: 'product' | 'user' | 'review';
  style?: React.CSSProperties;
  className?: string;
  onImageUpload?: (imageUrl: string, imageId: string) => void;
}

const EnhancedRichTextEditor: React.FC<EnhancedRichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  height = 200,
  readonly = false,
  productId,
  category = 'product',
  onImageUpload,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('richEditor.placeholder');
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const isInternalChange = useRef(false);
  const { mutateAsync: uploadImage } = useUploadImageMutation();
  const isUploadingRef = useRef(false);

  // Hàm xử lý chèn ảnh tùy chỉnh cho Quill
  const handleImageInsert = useCallback(async () => {
    if (isUploadingRef.current) {
      message.warning(t('richEditor.uploadWait'));
      return;
    }

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        message.error(t('richEditor.imageSizeLimit'));
        return;
      }

      if (!file.type.startsWith('image/')) {
        message.error(t('richEditor.imageTypeError'));
        return;
      }

      isUploadingRef.current = true;
      const hideProgress = message.loading(t('richEditor.uploading'), 0);

      try {
        const result = await uploadImage({
          file,
          options: {
            category,
            productId,
            generateThumbs: true,
            optimize: true,
          },
        });

        if (result?.data?.url) {
          const domainUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8888/api').replace(/\/api\/?$/, '');
          const imageUrl = `${domainUrl}${result.data.url}`;

          const quill = quillRef.current;
          if (quill) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', imageUrl);
            quill.setSelection(range.index + 1, 0);
          }

          if (onImageUpload) {
            onImageUpload(imageUrl, result.data.id);
          }
        }
        message.success(t('richEditor.uploadSuccess'));
      } catch (error) {
        const errorMessage = getErrorMsg(error, t('richEditor.uploadError'));
        message.error(errorMessage);
        console.error('Lỗi upload ảnh:', error);
      } finally {
        hideProgress();
        isUploadingRef.current = false;
      }
    };
  }, [uploadImage, category, productId, onImageUpload, t]);

  // Khởi tạo Quill
  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder: resolvedPlaceholder,
      modules: {
        toolbar: {
          container: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ indent: '-1' }, { indent: '+1' }],
            ['link', 'image'],
            ['clean'],
          ],
          handlers: {
            image: handleImageInsert,
          },
        },
      },
      readOnly: readonly,
    });

    quillRef.current = quill;

    if (value) {
      quill.root.innerHTML = value;
    }

    quill.on('text-change', () => {
      if (isInternalChange.current) return;
      const content = quill.root.innerHTML;
      const finalContent = content === '<p><br></p>' ? '' : content;
      if (onChange) {
        onChange(finalContent);
      }
    });

    // Hàm xử lý dán nội dung
    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      const items = clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (!file) continue;

          if (isUploadingRef.current) {
            message.warning(t('richEditor.uploadWait'));
            return;
          }

          isUploadingRef.current = true;
          const hideProgress = message.loading(t('richEditor.uploading'), 0);

          try {
            const result = await uploadImage({
              file,
              options: { category, productId, generateThumbs: true, optimize: true },
            });

            if (result?.data?.url) {
              const domainUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8888/api').replace(/\/api\/?$/, '');
              const imageUrl = `${domainUrl}${result.data.url}`;

              const currentQuill = quillRef.current;
              if (currentQuill) {
                const range = currentQuill.getSelection(true);
                currentQuill.insertEmbed(range.index, 'image', imageUrl);
                currentQuill.setSelection(range.index + 1, 0);
              }

              if (onImageUpload) onImageUpload(imageUrl, result.data.id);
            }
            message.success(t('richEditor.uploadSuccess'));
          } catch (error) {
            message.error(t('richEditor.uploadError'));
          } finally {
            hideProgress();
            isUploadingRef.current = false;
          }
          break;
        }
      }
    };

    quill.root.addEventListener('paste', handlePaste);

    return () => {
      quill.root.removeEventListener('paste', handlePaste);
      quillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Khởi tạo Quill một lần, các deps khác dùng qua ref/closure
  }, [handleImageInsert]);

  // Đồng bộ giá trị từ bên ngoài vào editor
  useEffect(() => {
    if (!quillRef.current) return;
    const currentContent = quillRef.current.root.innerHTML;
    if (value !== currentContent && value !== (currentContent === '<p><br></p>' ? '' : currentContent)) {
      isInternalChange.current = true;
      quillRef.current.root.innerHTML = value || '';
      isInternalChange.current = false;
    }
  }, [value]);

  // Xử lý trạng thái chỉ đọc
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
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    >
      <div className="enhanced-quill-editor" style={{ height: `${height + 42}px`, marginBottom: '50px' }}>
        <div ref={containerRef} style={{ height: `${height}px` }} />
        <style>{`
          .enhanced-quill-editor .ql-container {
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
          }
          .enhanced-quill-editor .ql-toolbar {
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
          }
          .enhanced-quill-editor .ql-editor img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px 0;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
        `}</style>
      </div>
    </EditorErrorBoundary>
  );
};

export default EnhancedRichTextEditor;

