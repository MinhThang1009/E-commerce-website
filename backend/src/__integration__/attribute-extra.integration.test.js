require('module-alias/register');
const sequelize = require('@config/sequelize');
const { AttributeGroup, AttributeValue } = require('@models');

const TS = Date.now();
let groupWithValue, groupToDeactivate;

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  if (groupWithValue) {
    await AttributeValue.destroy({ where: { attributeGroupId: groupWithValue.id }, force: true });
    await groupWithValue.destroy({ force: true });
  }
  if (groupToDeactivate) {
    await AttributeValue.destroy({
      where: { attributeGroupId: groupToDeactivate.id },
      force: true,
    });
    await groupToDeactivate.destroy({ force: true });
  }
});

describe('Attribute Integration — Extra', () => {
  test('Tạo attribute value → gắn đúng vào group', async () => {
    groupWithValue = await AttributeGroup.create({
      name: `__INT_AttrX_GPU_${TS}`,
      description: 'Card đồ họa',
      isActive: true,
    });

    const val = await AttributeValue.create({
      attributeGroupId: groupWithValue.id,
      name: 'NVIDIA RTX 4060',
      value: 'NVIDIA RTX 4060',
    });

    expect(val.id).toBeDefined();
    expect(val.attributeGroupId).toBe(groupWithValue.id);

    // Lấy tất cả values của group → phải có đúng value vừa tạo
    const values = await AttributeValue.findAll({
      where: { attributeGroupId: groupWithValue.id },
    });
    expect(values).toHaveLength(1);
    expect(values[0].name).toBe('NVIDIA RTX 4060');
  });

  test('Xóa attribute group → group.isActive=false', async () => {
    groupToDeactivate = await AttributeGroup.create({
      name: `__INT_AttrX_SSD_${TS}`,
      description: 'Ổ cứng SSD',
      isActive: true,
    });

    // Soft-delete bằng cách set isActive=false (không xóa hard ở đây)
    await groupToDeactivate.update({ isActive: false });
    await groupToDeactivate.reload();

    expect(groupToDeactivate.isActive).toBe(false);

    // Query chỉ lấy groups active → group này không xuất hiện
    const activeGroups = await AttributeGroup.findAll({
      where: {
        name: `__INT_AttrX_SSD_${TS}`,
        isActive: true,
      },
    });
    expect(activeGroups).toHaveLength(0);
  });
});
