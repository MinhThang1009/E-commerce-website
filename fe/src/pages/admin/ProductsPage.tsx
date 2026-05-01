import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetAdminProductsQuery,
  useDeleteProductMutation,
  useCloneProductMutation,
  useUpdateProductStatusMutation,
  useLazyGetAdminProductsQuery,
} from '@/services/adminProductApi';
import { useGetAllCategoriesQuery } from '@/services/categoryApi';
import { useTranslation } from 'react-i18next';
import ProductExportModal from '@/components/admin/ProductExportModal';
import { calculatePriceRange } from '@/utils/priceUtils';
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Card,
  Space,
  Tag,
  Pagination,
  Row,
  Col,
  Typography,
  Image,
  Popconfirm,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  ExportOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

// Status options
// Status options will be handled inside component due to hooks

const ProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const statusOptions = [
    { value: 'all', label: t('admin.products.filters.allStatus') },
    { value: 'active', label: t('admin.products.status.active') },
    { value: 'inactive', label: t('admin.products.status.inactive') },
    { value: 'draft', label: t('admin.products.status.draft') },
  ];

  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // State for row selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  // State for export
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // State for modals
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  // Fetch categories from API
  const { data: categoriesResponse, isLoading: isCategoriesLoading } =
    useGetAllCategoriesQuery();

  // API queries and mutations
  const {
    data: productsResponse,
    error,
    isLoading,
    refetch,
  } = useGetAdminProductsQuery({
    page: currentPage,
    limit: 10,
    search: searchTerm || undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    sortBy,
    sortOrder,
  });

  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();
  const [cloneProduct, { isLoading: isCloning }] = useCloneProductMutation();
  const [updateProductStatus, { isLoading: isUpdatingStatus }] = useUpdateProductStatusMutation();
  const [triggerGetProducts, { isFetching: isFetchingForExport }] = useLazyGetAdminProductsQuery();

  // Xử lý dữ liệu sản phẩm từ API
  const products = productsResponse?.data?.products || [];
  const pagination = productsResponse?.data?.pagination;

  // Xử lý dữ liệu danh mục từ API
  const rawCategories = categoriesResponse?.data;
  const apiCategories = Array.isArray(rawCategories)
    ? rawCategories
    : rawCategories
      ? [rawCategories]
      : [];

  // Tạo options cho dropdown danh mục
  const categoryOptions = [
    { value: 'all', label: t('admin.products.filters.allCategories') },
    ...(Array.isArray(apiCategories)
      ? apiCategories.map((cat: any) => ({
          value: cat.id,
          label: cat.name,
        }))
      : []),
  ];

  // Log dữ liệu sản phẩm để debug
  useEffect(() => {
    if (products.length > 0) {
      console.log('Products data:', products);
      // Kiểm tra xem sản phẩm có biến thể không
      const hasVariants = products.some(
        (product) => product.variants && product.variants.length > 0
      );
      console.log('Products have variants:', hasVariants);
      if (hasVariants) {
        // Log sản phẩm đầu tiên có biến thể
        const productWithVariants = products.find(
          (product) => product.variants && product.variants.length > 0
        );
        console.log('Example product with variants:', productWithVariants);
      }
    }
  }, [products]);

  // Log dữ liệu danh mục để debug
  useEffect(() => {
    if (apiCategories.length > 0) {
      console.log('Categories data:', apiCategories);
    }
  }, [apiCategories]);

  // Handle delete product
  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId).unwrap();
      message.success(t('admin.products.messages.deleteSuccess'));
      refetch();
    } catch (error) {
      message.error(t('admin.products.messages.deleteError'));
      console.error('Failed to delete product:', error);
    }
  };

  // Handle product status change
  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      await updateProductStatus({ id: productId, status: newStatus }).unwrap();
      message.success(t('admin.products.messages.statusSuccess'));
    } catch (error) {
      message.error(t('admin.products.messages.statusError'));
      console.error('Failed to change status:', error);
    }
  };

  // Handle clone product
  const handleCloneProduct = async (productId: string) => {
    try {
      await cloneProduct(productId).unwrap();
      message.success(t('admin.products.messages.cloneSuccess'));
      refetch();
    } catch (error) {
      message.error(t('admin.products.messages.cloneError'));
      console.error('Failed to clone product:', error);
    }
  };

  // Handle export data fetch
  const handleExportAll = async (exportFilters: any) => {
    try {
      const result = await triggerGetProducts({
        ...exportFilters,
        limit: 99999, // Fetch all for export
      }).unwrap();
      return result?.data?.products || [];
    } catch (error) {
      console.error('Failed to fetch products for export:', error);
      throw error;
    }
  };

  // Open quick view modal
  const openQuickView = (product: any) => {
    setSelectedProduct(product);
    setIsQuickViewOpen(true);
  };

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, categoryFilter, statusFilter]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  // Calculate lowest price from variants or base price
  const calculateDisplayPrice = (product: any) => {
    // Nếu sản phẩm có variants, hiển thị giá thấp nhất
    if (product.variants && product.variants.length > 0) {
      const prices = product.variants.map((variant: any) =>
        parseFloat(variant.price)
      );
      const minPrice = Math.min(...prices);

      // Chỉ hiển thị giá thấp nhất (không hiển thị range)
      return formatCurrency(minPrice);
    }

    // Nếu không có variants, dùng giá cơ bản
    return formatCurrency(product.price);
  };

  // Get status tag color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'orange';
      case 'draft':
        return 'red';
      default:
        return 'default';
    }
  };

  // Table columns
  const columns = [
    {
      title: t('admin.products.table.image'),
      dataIndex: 'images',
      key: 'images',
      width: 80,
      render: (images: string[]) => (
        <Image
          width={50}
          height={50}
          src={images?.[0] || '/placeholder-image.jpg'}
          alt="Product"
          style={{ objectFit: 'cover', borderRadius: 4 }}
          fallback="/placeholder-image.jpg"
        />
      ),
    },
    {
      title: t('admin.products.table.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (text: string) => (
        <div style={{ maxWidth: 200 }}>
          <div style={{ fontWeight: 500 }}>{text}</div>
        </div>
      ),
    },
    {
      title: t('admin.products.table.category'),
      dataIndex: 'categories',
      key: 'categories',
      render: (categories: any[]) => (
        <>
          {categories && categories.length > 0 ? (
            categories.map((cat, index) => (
              <Tag color="blue" key={index}>
                {cat.name}
              </Tag>
            ))
          ) : (
            <span>-</span>
          )}
        </>
      ),
    },
    {
      title: t('admin.products.table.price'),
      dataIndex: 'price',
      key: 'price',
      sorter: true,
      render: (price: number, record: any) => (
        <span style={{ fontWeight: 500, color: '#52c41a' }}>
          {calculateDisplayPrice(record)}
        </span>
      ),
    },
    {
      title: t('admin.products.table.stock'),
      dataIndex: 'stockQuantity',
      key: 'stock',
      sorter: true,
      render: (stockQuantity: number, record: any) => {
        // Sử dụng stockQuantity từ API hoặc fallback về stock nếu có
        const stock =
          stockQuantity !== undefined ? stockQuantity : record.stock;
        return (
          <span style={{ color: stock > 0 ? '#52c41a' : '#ff4d4f' }}>
            {stock}
          </span>
        );
      },
    },
    {
      title: t('admin.products.table.status'),
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string, record: any) => (
        <Select
          value={status}
          style={{ width: 140 }}
          onChange={(value) => handleStatusChange(record.id, value)}
          loading={isUpdatingStatus && selectedProduct?.id === record.id}
          onMouseEnter={() => setSelectedProduct(record)}
          size="small"
        >
          {statusOptions.filter(opt => opt.value !== 'all').map((opt) => (
            <Select.Option key={opt.value} value={opt.value}>
              <Tag color={getStatusColor(opt.value)} style={{ border: 'none', margin: 0 }}>
                {opt.label}
              </Tag>
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: t('admin.products.table.actions'),
      key: 'actions',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openQuickView(record)}
            title={t('admin.products.actions.view')}
            size="small"
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              console.log('Edit button clicked, record.id:', record.id);
              navigate(`/admin/products/edit/${record.id}`);
            }}
            title={t('admin.products.actions.edit')}
            size="small"
          />
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={() => handleCloneProduct(record.id)}
            loading={isCloning}
            title={t('admin.products.actions.clone')}
            size="small"
            style={{ color: '#1890ff' }}
          />
          <Popconfirm
            title={t('admin.products.messages.deleteTitle')}
            description={t('admin.products.messages.deleteDescription')}
            onConfirm={() => handleDeleteProduct(record.id)}
            okText={t('admin.products.actions.delete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              title={t('admin.products.actions.delete')}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Handle table change (sorting, pagination)
  const handleTableChange = (
    paginationInfo: any,
    filters: any,
    sorter: any
  ) => {
    if (sorter.field) {
      setSortBy(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'ASC' : 'DESC');
    }
  };

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message={t('admin.products.messages.loadError')}
          description={t('admin.products.messages.loadError')}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('admin.products.actions.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  // Row selection config
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[], rows: any[]) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      {/* Header */}
      <Card className="mb-4 md:mb-6">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Title
              level={2}
              style={{ margin: 0 }}
              className="text-xl md:text-2xl"
            >
              {t('admin.products.title')}
            </Title>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {pagination?.totalItems
                ? t('admin.products.stats', { totalItems: pagination.totalItems, totalPages: pagination.totalPages })
                : t('admin.products.subtitle')}
            </p>
          </Col>
          <Col xs={24} sm={12} className="flex justify-start sm:justify-end gap-2">
            <Button
              type="default"
              icon={<ExportOutlined />}
              onClick={() => setIsExportModalOpen(true)}
              size="large"
            >
              {t('admin.products.actions.export')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/products/create')}
              size="large"
            >
              {t('admin.products.actions.add')}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Filters */}
      <Card className="mb-4 md:mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={10} lg={8}>
            <Input
              placeholder={t('admin.products.filters.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              suffix={<SearchOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
            />
          </Col>
          <Col xs={12} md={7} lg={4}>
            <Select
              style={{ width: '100%' }}
              placeholder={t('admin.products.filters.categoryPlaceholder')}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              loading={isCategoriesLoading}
            />
          </Col>
          <Col xs={12} md={7} lg={4}>
            <Select
              style={{ width: '100%' }}
              placeholder={t('admin.products.filters.statusPlaceholder')}
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />
          </Col>
        </Row>
      </Card>

      {/* Products Table */}
      <Card>
        <Spin spinning={isLoading}>
          <div className="overflow-x-auto">
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={products}
              rowKey="id"
              pagination={false}
              onChange={handleTableChange}
              scroll={{ x: 800 }}
              className="min-w-full dark-table-fixed-columns"
            />
          </div>
        </Spin>

        {/* Pagination */}
        {pagination && (
          <div className="mt-4 text-center">
            <Pagination
              current={currentPage}
              total={pagination?.totalItems || 0}
              pageSize={pagination?.itemsPerPage || 10}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
              responsive
              showTotal={(total, range) =>
                t('admin.products.pagination.total', { start: range[0], end: range[1], total })
              }
            />
          </div>
        )}
      </Card>

      {/* Quick View Modal */}
      <Modal
        title={t('admin.products.modal.viewTitle')}
        open={isQuickViewOpen}
        onCancel={() => setIsQuickViewOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsQuickViewOpen(false)}>
            {t('admin.products.modal.close')}
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              setIsQuickViewOpen(false);
              navigate(`/admin/products/edit/${selectedProduct?.id}`);
            }}
          >
            {t('admin.products.modal.edit')}
          </Button>,
        ]}
        width={600}
      >
        {selectedProduct && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Image
                  width="100%"
                  src={selectedProduct.images?.[0] || '/placeholder-image.jpg'}
                  alt={selectedProduct.name}
                  fallback="/placeholder-image.jpg"
                />
              </Col>
              <Col span={16}>
                <Space
                  direction="vertical"
                  size="middle"
                  style={{ width: '100%' }}
                >
                  <div>
                    <strong>{t('admin.products.modal.productName')}:</strong> {selectedProduct.name}
                  </div>
                  <div>
                    <strong>{t('admin.products.modal.category')}:</strong>{' '}
                    {selectedProduct.categories &&
                    selectedProduct.categories.length > 0 ? (
                      selectedProduct.categories.map(
                        (cat: any, index: number) => (
                          <Tag color="blue" key={index}>
                            {cat.name}
                          </Tag>
                        )
                      )
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                  <div>
                    <strong>{t('admin.products.modal.price')}:</strong>{' '}
                    <span style={{ fontWeight: 500, color: '#52c41a' }}>
                      {
                        calculatePriceRange(
                          selectedProduct.price,
                          selectedProduct.variants
                        ).priceText
                      }
                    </span>
                  </div>
                  <div>
                    <strong>{t('admin.products.modal.stock')}:</strong>{' '}
                    <span
                      style={{
                        color:
                          (selectedProduct.stockQuantity ||
                            selectedProduct.stock) > 0
                            ? '#52c41a'
                            : '#ff4d4f',
                      }}
                    >
                      {selectedProduct.stockQuantity !== undefined
                        ? selectedProduct.stockQuantity
                        : selectedProduct.stock}
                    </span>
                  </div>
                  <div>
                    <strong>{t('admin.products.modal.status')}:</strong>{' '}
                    <Tag color={getStatusColor(selectedProduct.status)}>
                      {selectedProduct.status ? t(`admin.products.status.${selectedProduct.status}`) : ''}
                    </Tag>
                  </div>
                  {selectedProduct.description && (
                    <div>
                      <strong>{t('admin.products.modal.description')}:</strong>
                      <p style={{ marginTop: 8 }}>
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      <ProductExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentPageData={products}
        selectedRows={selectedRows}
        filters={{
          search: searchTerm,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          sortBy,
          sortOrder,
        }}
        onExportAll={handleExportAll}
        isLoading={isFetchingForExport}
      />
    </div>
  );
};

export default ProductsPage;
