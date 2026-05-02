import React from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { useSendFeedbackMutation } from '@/services/contactApi';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

const { Option } = Select;
const { TextArea } = Input;

const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [sendFeedback, { isLoading }] = useSendFeedbackMutation();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await sendFeedback(values).unwrap();
      message.success('Cảm ơn bạn đã gửi phản hồi. Chúng tôi sẽ ghi nhận và phản hồi sớm nhất!');
      form.resetFields();
      onClose();
    } catch (error: any) {
      if (error?.name !== 'ValidationError') {
        message.error(error?.data?.message || 'Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại sau.');
      }
    }
  };

  return (
    <Modal
      title="Gửi phản hồi, góp ý"
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isLoading}
      okText="Gửi"
      cancelText="Hủy"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ subject: 'Support' }}
        className="mt-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            name="name"
            label="Họ và tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nhập họ tên của bạn" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' }
            ]}
          >
            <Input placeholder="Email của bạn" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            name="phone"
            label="Số điện thoại"
          >
            <Input placeholder="Số điện thoại (tùy chọn)" />
          </Form.Item>
          <Form.Item
            name="subject"
            label="Chủ đề"
            rules={[{ required: true, message: 'Vui lòng chọn chủ đề' }]}
          >
            <Select>
              <Option value="Support">Hỗ trợ kỹ thuật</Option>
              <Option value="Sales">Tư vấn mua hàng</Option>
              <Option value="Complaint">Khiếu nại dịch vụ</Option>
              <Option value="Suggestion">Góp ý phát triển</Option>
              <Option value="Other">Khác</Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item
          name="content"
          label="Nội dung"
          rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
        >
          <TextArea rows={5} placeholder="Nhập nội dung phản hồi của bạn..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FeedbackModal;
