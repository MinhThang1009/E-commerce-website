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
import ProductPickerModal from '@/components/admin/news/ProductPickerModal';

// --- Custom Quill Blot for Product Card ---
const BlockEmbed = Quill.import('blots/block/embed');

class ProductCardBlot extends BlockEmbed {
  static create(value: any) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.setAttribute('class', 'product-embed-card not-prose');
    
    // Đảm bảo value là object. Nếu khôi phục từ DOM mà thiếu data attribute,
    // thử dùng value được truyền vào hoặc giá trị mặc định.
    const data = typeof value === 'object' ? value : { 
        id: value.id || '#', 
        name: value.name || 'Sản phẩm', 
        price: value.price || '0 đ', 
        oldPrice: value.oldPrice || '', 
        imageUrl: value.imageUrl || '' 
    };

    // Lưu data để khôi phục bền vững
    node.setAttribute('data-product', JSON.stringify(data));
    
    // Áp dụng inline style cho container
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
        cursor: 'default', // Không hiển thị như link trong editor
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
          <a href="/products/${data.id}" class="btn-view" target="_blank" style="display: inline-block; padding: 8px 20px; background-color: #3b82f6; color: white; border-radius: 6px; font-weight: 500; font-size: 14px; text-decoration: none;">Xem chi tiết</a>
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
        console.error('Lỗi parse dữ liệu sản phẩm', e);
      }
    }
    
    // Fallback: Khôi phục từ cấu trúc DOM nếu thiếu data attribute (nội dung cũ)
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
      id: link?.getAttribute('href')?.split('/').pop() || '#'
    };
  }
}

ProductCardBlot.blotName = 'productCard';
ProductCardBlot.tagName = 'div';
ProductCardBlot.className = 'product-embed-card';

Quill.register(ProductCardBlot);
// ---------------------------------------------

const { Title } = Typography;
const { Option } = Select;

const CreateNewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  // ... (existing code) ...

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
        message.success('Cập nhật bài viết thành công');
      } else {
        await createNews(values).unwrap();
        message.success('Tạo bài viết thành công');
      }
      navigate('/admin/news');
    } catch (error: any) {
      message.error(error?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    if (!isEditMode && !form.getFieldValue('slug')) {
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');
      form.setFieldsValue({ slug });
    }
  };

  const handleInsertProduct = (product: any) => {
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection(true); // true = focus nếu cần
    
    // Định dạng giá
    const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price);
    const oldPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price * 1.2);
    const imageUrl = product.images?.[0] || '/placeholder-image.jpg';

    // Chuẩn bị data cho Blot
    const productData = {
      id: product.id,
      name: product.name,
      price: price,
      oldPrice: oldPrice,
      imageUrl: imageUrl
    };

    // Chèn embed tùy chỉnh
    // Chèn dòng mới trước và sau để đảm bảo nó chiếm block riêng
    quill.insertText(range.index, '\n');
    quill.insertEmbed(range.index + 1, 'productCard', productData);
    quill.setSelection(range.index + 2);
    
    setIsProductPickerOpen(false);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="mb-4 flex justify-between items-center">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/news')}
        >
          Quay lại
        </Button>
        <Space>
           <Button 
            icon={<PlusSquareOutlined />} 
            onClick={() => setIsProductPickerOpen(true)}
            type="dashed"
           >
             Chèn sản phẩm
           </Button>
           <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />} loading={isLoading}>
              {isEditMode ? 'Cập nhật' : 'Lưu bài viết'}
           </Button>
        </Space>
      </div>

      <Spin spinning={isLoading}>
        <Card title={isEditMode ? 'Chỉnh sửa bài viết' : 'Thêm bài viết mới'}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ isPublished: true }}
          >
            <Form.Item
              name="title"
              label="Tiêu đề"
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
            >
              <Input onChange={handleTitleChange} />
            </Form.Item>

            <Form.Item
              name="slug"
              label="Slug"
              rules={[{ required: true, message: 'Vui lòng nhập slug' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="thumbnail"
              label="Hình ảnh Thumbnail (URL)"
              rules={[{ required: true, message: 'Vui lòng nhập URL hình ảnh' }]}
            >
              <Input placeholder="https://example.com/image.jpg" />
            </Form.Item>

            <Form.Item
              name="category"
              label="Chuyên mục"
              rules={[{ required: true, message: 'Vui lòng chọn chuyên mục' }]}
            >
              <Select placeholder="Chọn chuyên mục">
                <Option value="Tin tức">Tin tức</Option>
                <Option value="Đánh giá">Đánh giá</Option>
                <Option value="Tư vấn">Tư vấn</Option>
                <Option value="Thủ thuật">Thủ thuật</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="description"
              label="Mô tả ngắn"
            >
              <Input.TextArea rows={3} />
            </Form.Item>

            <Form.Item
              name="content"
              label="Nội dung"
              rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
            >
              <ReactQuill 
                ref={quillRef}
                theme="snow" 
                style={{ height: 400, marginBottom: 50 }} 
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                    ['link', 'image', 'video'],
                    ['clean']
                  ],
                }}
              />
            </Form.Item>

            <Form.Item
              name="tags"
              label="Thẻ (Tags - Ngăn cách bởi dấu phẩy)"
            >
              <Input placeholder="ví dụ: laptop, review, dell" />
            </Form.Item>

            <Form.Item
              name="isPublished"
              label="Trạng thái"
            >
              <Select>
                <Option value={true}>Đã xuất bản</Option>
                <Option value={false}>Bản nháp</Option>
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
