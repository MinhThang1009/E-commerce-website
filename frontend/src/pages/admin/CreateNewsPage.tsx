import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useGetNewsByIdQuery,
  useCreateNewsMutation,
  useUpdateNewsMutation,
} from '@/services/newsApi';
import {
  Form,
  Input,
  Button,
  Select,
  Card,
  message,
  Space,
  Spin,
  Typography,
  Divider,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PlusSquareOutlined } from '@ant-design/icons';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import ProductPickerModal from '@/components/admin/news/ProductPickerModal';
import { getLocale } from '@/utils/format';

// --- Custom Quill Blot for Product Card ---
const BlockEmbed = Quill.import('blots/block/embed') as any;

class ProductCardBlot extends BlockEmbed {
  static create(value: any) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.setAttribute('class', 'product-embed-card not-prose');

    const data = typeof value === 'object' ? value : {
      id: value.id || '#',
      name: value.name || 'Product',
      price: value.price || `0${i18n.t('common.currencySymbol')}`,
      oldPrice: value.oldPrice || '',
      imageUrl: value.imageUrl || '',
    };

    node.setAttribute('data-product', JSON.stringify(data));

    Object.assign(node.style, {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white',
      borderRadius: '40px',
      border: '1px solid #f0f0f0',
      padding: '24px',
      margin: '24px 0',
      gap: '24px',
      textDecoration: 'none',
      color: 'inherit',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      cursor: 'default',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    node.innerHTML = `
      <div class="product-img-wrapper" style="flex-shrink: 0;">
        <img src="${data.imageUrl}" alt="${data.name}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: block;" />
      </div>
      <div class="product-info" style="flex-grow: 1; display: flex; flex-direction: column; align-items: flex-start;">
        <h4 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #111; line-height: 1.3;">${data.name}</h4>
        <div class="product-price" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span class="current-price" style="font-size: 22px; font-weight: 700; color: #ef4444;">${data.price}</span>
          <span class="old-price" style="font-size: 14px; color: #999; text-decoration: line-through;">${data.oldPrice}</span>
        </div>
        <a href="/products/${data.id}" class="btn-view" target="_blank" style="display: inline-block; padding: 8px 20px; background-color: #3b82f6; color: white; border-radius: 6px; font-weight: 500; font-size: 14px; text-decoration: none;">${data.viewDetailsText || i18n.t('product.viewDetails')}</a>
      </div>
    `;

    return node;
  }

  static value(node: any) {
    const dataAttr = node.getAttribute('data-product');
    if (dataAttr) {
      try {
        return JSON.parse(dataAttr);
      } catch (e) {
        console.error('Error parsing product data', e);
      }
    }

    const img = node.querySelector('img');
    const title = node.querySelector('h4');
    const currentPrice = node.querySelector('.current-price');
    const oldPrice = node.querySelector('.old-price');
    const link = node.querySelector('a.btn-view');

    return {
      imageUrl: img?.getAttribute('src') || '',
      name: title?.innerText || '',
      price: currentPrice?.innerText || '',
      oldPrice: oldPrice?.innerText || '',
      id: link?.getAttribute('href')?.split('/').pop() || '#',
    };
  }
}

(ProductCardBlot as any).blotName = 'productCard';
(ProductCardBlot as any).tagName = 'div';
(ProductCardBlot as any).className = 'product-embed-card';

Quill.register(ProductCardBlot as any);
// ---------------------------------------------

const { Title } = Typography;
const { Option } = Select;

const CreateNewsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [form] = Form.useForm();
  const quillRef = useRef<any>(null);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  const { data: newsData, isLoading: isFetching } = useGetNewsByIdQuery(id!, {
    skip: !isEditMode,
  });

  const [createNews, { isLoading: isCreating }] = useCreateNewsMutation();
  const [updateNews, { isLoading: isUpdating }] = useUpdateNewsMutation();

  const isLoading = isFetching || isCreating || isUpdating;

  useEffect(() => {
    if (newsData && newsData.news) {
      form.setFieldsValue(newsData.news);
    }
  }, [newsData, form]);

  const onFinish = async (values: any) => {
    try {
      if (isEditMode) {
        await updateNews({ id: id!, data: values }).unwrap();
        message.success(t('admin.news.messages.editSuccess'));
      } else {
        await createNews(values).unwrap();
        message.success(t('admin.news.messages.createSuccess'));
      }
      navigate('/admin/news');
    } catch (error: any) {
      message.error(error?.data?.message || t('common.errorOccurred'));
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    if (!isEditMode && !form.getFieldValue('slug')) {
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');
      form.setFieldsValue({ slug });
    }
  };

  const handleInsertProduct = (product: any) => {
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection(true);

    const price = new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'VND' }).format(product.price);
    const oldPrice = new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'VND' }).format(product.price * 1.2);
    const imageUrl = product.images?.[0] || '/placeholder-image.jpg';

    const productData = { id: product.id, name: product.name, price, oldPrice, imageUrl, viewDetailsText: t('product.viewDetails') };

    quill.insertText(range.index, '\n');
    quill.insertEmbed(range.index + 1, 'productCard', productData);
    quill.setSelection(range.index + 2);

    setIsProductPickerOpen(false);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="mb-4 flex justify-between items-center">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/news')}>
          {t('admin.news.backButton')}
        </Button>
        <Space>
          <Button
            icon={<PlusSquareOutlined />}
            onClick={() => setIsProductPickerOpen(true)}
            type="dashed"
          >
            {t('admin.news.insertProduct')}
          </Button>
          <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />} loading={isLoading}>
            {isEditMode ? t('admin.news.update') : t('admin.news.save')}
          </Button>
        </Space>
      </div>

      <Spin spinning={isLoading}>
        <Card title={isEditMode ? t('admin.news.editTitle') : t('admin.news.createTitle')}>
          <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ isPublished: true }}>
            <Form.Item
              name="title"
              label={t('admin.news.form.title')}
              rules={[{ required: true, message: t('admin.news.form.titleRequired') }]}
            >
              <Input onChange={handleTitleChange} />
            </Form.Item>

            <Form.Item
              name="slug"
              label={t('admin.news.form.slug')}
              rules={[{ required: true, message: t('admin.news.form.slugRequired') }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="thumbnail"
              label={t('admin.news.form.thumbnail')}
              rules={[{ required: true, message: t('admin.news.form.thumbnailRequired') }]}
            >
              <Input placeholder="https://example.com/image.jpg" />
            </Form.Item>

            <Form.Item
              name="category"
              label={t('admin.news.form.category')}
              rules={[{ required: true, message: t('admin.news.form.categoryRequired') }]}
            >
              <Select placeholder={t('admin.news.form.categoryPlaceholder')}>
                <Option value="Tin tức">{t('admin.news.categories.news')}</Option>
                <Option value="Đánh giá">{t('admin.news.categories.review')}</Option>
                <Option value="Tư vấn">{t('admin.news.categories.advice')}</Option>
                <Option value="Thủ thuật">{t('admin.news.categories.tips')}</Option>
              </Select>
            </Form.Item>

            <Form.Item name="description" label={t('admin.news.form.description')}>
              <Input.TextArea rows={3} />
            </Form.Item>

            <Form.Item
              name="content"
              label={t('admin.news.form.content')}
              rules={[{ required: true, message: t('admin.news.form.contentRequired') }]}
            >
              <ReactQuill
                ref={quillRef}
                theme="snow"
                style={{ height: 400, marginBottom: 50 }}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                    [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
                    ['link', 'image', 'video'],
                    ['clean'],
                  ],
                }}
              />
            </Form.Item>

            <Form.Item name="tags" label={t('admin.news.form.tags')}>
              <Input placeholder={t('admin.news.form.tagsPlaceholder')} />
            </Form.Item>

            <Form.Item name="isPublished" label={t('common.status')}>
              <Select>
                <Option value={true}>{t('admin.news.status.published')}</Option>
                <Option value={false}>{t('admin.news.status.draft')}</Option>
              </Select>
            </Form.Item>
          </Form>
        </Card>
      </Spin>

      <ProductPickerModal
        open={isProductPickerOpen}
        onCancel={() => setIsProductPickerOpen(false)}
        onSelect={handleInsertProduct}
      />
    </div>
  );
};

export default CreateNewsPage;
