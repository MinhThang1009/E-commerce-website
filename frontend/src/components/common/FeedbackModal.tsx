import React from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSendFeedbackMutation } from '@/features/content';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

const { Option } = Select;
const { TextArea } = Input;

const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { mutateAsync: sendFeedback, isPending: isLoading } = useSendFeedbackMutation();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await sendFeedback(values);
      message.success(t('feedback.successMessage'));
      form.resetFields();
      onClose();
    } catch (error: any) {
      if (error?.name !== 'ValidationError') {
        message.error(error?.data?.message || t('feedback.errorMessage'));
      }
    }
  };

  return (
    <Modal
      title={t('feedback.title')}
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isLoading}
      okText={t('feedback.submit')}
      cancelText={t('common.cancel')}
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
            label={t('feedback.form.name')}
            rules={[{ required: true, message: t('feedback.form.nameRequired') }]}
          >
            <Input placeholder={t('feedback.form.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('feedback.form.email')}
            rules={[
              { required: true, message: t('feedback.form.emailRequired') },
              { type: 'email', message: t('feedback.form.emailInvalid') }
            ]}
          >
            <Input placeholder={t('feedback.form.emailPlaceholder')} />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            name="phone"
            label={t('feedback.form.phone')}
          >
            <Input placeholder={t('feedback.form.phonePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="subject"
            label={t('feedback.form.subject')}
            rules={[{ required: true, message: t('feedback.form.subjectRequired') }]}
          >
            <Select>
              <Option value="Support">{t('feedback.form.subjects.support')}</Option>
              <Option value="Sales">{t('feedback.form.subjects.sales')}</Option>
              <Option value="Complaint">{t('feedback.form.subjects.complaint')}</Option>
              <Option value="Suggestion">{t('feedback.form.subjects.suggestion')}</Option>
              <Option value="Other">{t('feedback.form.subjects.other')}</Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item
          name="content"
          label={t('feedback.form.content')}
          rules={[{ required: true, message: t('feedback.form.contentRequired') }]}
        >
          <TextArea rows={5} placeholder={t('feedback.form.contentPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FeedbackModal;
