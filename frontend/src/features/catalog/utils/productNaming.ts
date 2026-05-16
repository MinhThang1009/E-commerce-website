// Service đặt tên sản phẩm theo từng bước
export interface NameTemplate {
  baseName: string;
  selectedAttributes: Record<string, string>;
  attributePriority?: string[]; // Thứ tự ưu tiên trong tên
  separator?: string;
}

export interface SimpleNamingResponse {
  originalName: string;
  generatedName: string;
  hasChanges: boolean;
  addedParts: string[];
}

class SimpleNamingService {
  // Thứ tự ưu tiên mặc định của thuộc tính khi đặt tên
  private defaultPriority = ['CPU', 'GPU', 'RAM', 'Storage', 'Color', 'Size'];

  // Ánh xạ tên thuộc tính sang tên ngắn
  private nameTemplates: Record<string, Record<string, string>> = {
    CPU: {
      // Tên CPU đầy đủ
      'Intel Core i3-13100': 'i3',
      'Intel Core i5-13500H': 'i5',
      'Intel Core i7-13700H': 'i7',
      'Intel Core i9-13900H': 'i9',
      'AMD Ryzen 5 7600U': 'R5',
      'AMD Ryzen 7 7800U': 'R7',
      'AMD Ryzen 9 7900U': 'R9',
      // Mã CPU ngắn (giá trị chính xác từ API)
      i3: 'i3',
      i5: 'i5',
      i7: 'i7',
      i8: 'i8',
      i9: 'i9',
    },
    GPU: {
      'Integrated Graphics': '', // Không thêm vào tên sản phẩm
      'NVIDIA RTX 4050': 'RTX4050',
      'NVIDIA RTX 4060': 'RTX4060',
      'NVIDIA RTX 4070': 'RTX4070',
      'NVIDIA RTX 4080': 'RTX4080',
      'AMD Radeon RX 7600M': 'RX7600M',
      'AMD Radeon RX 7700M': 'RX7700M',
    },
    RAM: {
      '8GB DDR4': '8GB',
      '16GB DDR4': '16GB',
      '32GB DDR4': '32GB',
      '8GB DDR5': '8GB',
      '16GB DDR5': '16GB',
      '32GB DDR5': '32GB',
      '64GB DDR5': '64GB',
    },
    Storage: {
      '256GB SSD': '256GB',
      '512GB SSD': '512GB',
      '1TB SSD': '1TB',
      '2TB SSD': '2TB',
    },
  };

  /**
   * Tạo tên sản phẩm theo từng bước - Phương pháp đơn giản
   * Chỉ nối các giá trị thuộc tính đã chọn vào tên gốc
   */
  generateName(config: NameTemplate): SimpleNamingResponse {
    const { baseName, selectedAttributes, separator = ' ' } = config;

    const addedParts: string[] = [];
    const nameParts = [baseName];

    // Nối tất cả giá trị thuộc tính đã chọn vào tên
    Object.entries(selectedAttributes).forEach(([attrName, attrValue]) => {
      if (attrValue && attrValue.trim() !== '') {
        nameParts.push(attrValue);
        addedParts.push(`${attrName}: ${attrValue}`);
      }
    });

    const generatedName = nameParts.join(separator);

    return {
      originalName: baseName,
      generatedName,
      hasChanges: addedParts.length > 0,
      addedParts,
    };
  }

  /**
   * Thêm thuộc tính mới vào tên hiện có
   */
  addAttribute(
    currentName: string,
    baseName: string,
    newAttribute: { type: string; value: string },
    selectedAttributes: Record<string, string>
  ): SimpleNamingResponse {
    // Cập nhật các thuộc tính đã chọn
    const updatedAttributes = {
      ...selectedAttributes,
      [newAttribute.type]: newAttribute.value,
    };

    // Tạo lại tên đầy đủ để duy trì thứ tự ưu tiên
    return this.generateName({
      baseName,
      selectedAttributes: updatedAttributes,
    });
  }

  /**
   * Xóa thuộc tính khỏi tên sản phẩm
   */
  removeAttribute(
    currentName: string,
    baseName: string,
    attributeType: string,
    selectedAttributes: Record<string, string>
  ): SimpleNamingResponse {
    // Xóa thuộc tính khỏi danh sách đã chọn
    const updatedAttributes = { ...selectedAttributes };
    delete updatedAttributes[attributeType];

    // Tạo lại tên sản phẩm
    return this.generateName({
      baseName,
      selectedAttributes: updatedAttributes,
    });
  }

  /**
   * Lấy các template tên có sẵn cho loại thuộc tính
   */
  getNameTemplates(attributeType: string): Record<string, string> {
    return this.nameTemplates[attributeType] || {};
  }

  /**
   * Đăng ký template tên mới
   */
  registerNameTemplate(
    attributeType: string,
    valueToNameMap: Record<string, string>
  ) {
    this.nameTemplates[attributeType] = {
      ...this.nameTemplates[attributeType],
      ...valueToNameMap,
    };
  }

  /**
   * Xem trước tên mà không cập nhật state
   */
  previewName(
    baseName: string,
    potentialAttributes: Record<string, string>
  ): string {
    const result = this.generateName({
      baseName,
      selectedAttributes: potentialAttributes,
    });
    return result.generatedName;
  }
}

export const simpleNamingService = new SimpleNamingService();
export default simpleNamingService;

