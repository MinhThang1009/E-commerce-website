/**
 * @file TiptapEditor.tsx
 * @layer Component
 * @feature shared
 * @description Rich text editor dựa trên Tiptap — thay thế react-quill/quill.
 *   mode='simple': toolbar tối giản (bold, italic, lists).
 *   mode='full': toolbar đầy đủ (heading, color, align, image, link).
 *   Output HTML string (tương thích data cũ trong DB).
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { useCallback, useEffect, useMemo } from 'react';
import { AlignLeft, AlignCenter, AlignRight, Link2, Image as ImageIcon } from 'lucide-react';

interface TiptapEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  mode?: 'simple' | 'full';
  height?: number;
  readOnly?: boolean;
  className?: string;
  id?: string;
}

function MenuBar({
  editor,
  mode,
}: {
  editor: ReturnType<typeof useEditor>;
  mode: 'simple' | 'full';
}) {
  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL hình ảnh:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL liên kết:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-sm transition-colors ${
      active
        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
    }`;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-t-lg">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(editor.isActive('underline'))}
        title="Underline"
      >
        <u>U</u>
      </button>

      {mode === 'full' && (
        <>
          <span className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1 self-center" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={btnClass(editor.isActive('heading', { level: 2 }))}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={btnClass(editor.isActive('heading', { level: 3 }))}
            title="Heading 3"
          >
            H3
          </button>
        </>
      )}

      <span className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1 self-center" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
        title="Bullet list"
      >
        &#8226; List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
        title="Ordered list"
      >
        1. List
      </button>

      {mode === 'full' && (
        <>
          <span className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1 self-center" />
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={btnClass(editor.isActive({ textAlign: 'left' }))}
            title="Align left"
          >
            <AlignLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={btnClass(editor.isActive({ textAlign: 'center' }))}
            title="Align center"
          >
            <AlignCenter className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={btnClass(editor.isActive({ textAlign: 'right' }))}
            title="Align right"
          >
            <AlignRight className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <span className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1 self-center" />
          <button
            type="button"
            onClick={addLink}
            className={btnClass(editor.isActive('link'))}
            title="Link"
          >
            <Link2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button type="button" onClick={addImage} className={btnClass(false)} title="Image">
            <ImageIcon className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </>
      )}
    </div>
  );
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  mode = 'simple',
  height = 200,
  readOnly = false,
  className = '',
  id,
}) => {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: mode === 'full' ? { levels: [2, 3, 4] } : false,
        // StarterKit v3 đã kèm sẵn link + underline → tắt để tránh trùng tên extension
        // (giữ bản import riêng bên dưới vì đã cấu hình Link.openOnClick=false)
        link: false,
        underline: false,
      }),
      Underline,
      Placeholder.configure({ placeholder: placeholder || '' }),
      ...(mode === 'full'
        ? [
            Image.configure({ inline: true }),
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyle,
            Color,
          ]
        : []),
    ],
    [mode, placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div
      id={id}
      className={`border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden ${className}`}
    >
      {!readOnly && editor && <MenuBar editor={editor} mode={mode} />}
      {editor && (
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert max-w-none px-4 py-3 focus:outline-none"
          style={{ minHeight: height }}
        />
      )}
    </div>
  );
};

export default TiptapEditor;
