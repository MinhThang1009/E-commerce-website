'use strict';
/**
 * Seeder: brands — các thương hiệu điện tử.
 * Idempotent: INSERT IGNORE theo slug.
 */
const brands = [
  { slug: 'apple',   nameVi: 'Apple',   nameEn: 'Apple',   logo: '/images/brands/apple.png' },
  { slug: 'samsung', nameVi: 'Samsung', nameEn: 'Samsung', logo: '/images/brands/samsung.png' },
  { slug: 'xiaomi',  nameVi: 'Xiaomi',  nameEn: 'Xiaomi',  logo: '/images/brands/xiaomi.png' },
  { slug: 'oppo',    nameVi: 'OPPO',    nameEn: 'OPPO',    logo: '/images/brands/oppo.png' },
  { slug: 'vivo',    nameVi: 'Vivo',    nameEn: 'Vivo',    logo: '/images/brands/vivo.png' },
  { slug: 'realme',  nameVi: 'Realme',  nameEn: 'Realme',  logo: '/images/brands/realme.png' },
  { slug: 'nokia',   nameVi: 'Nokia',   nameEn: 'Nokia',   logo: '/images/brands/nokia.png' },
  { slug: 'huawei',  nameVi: 'Huawei',  nameEn: 'Huawei',  logo: '/images/brands/huawei.png' },
  { slug: 'lg',      nameVi: 'LG',      nameEn: 'LG',      logo: '/images/brands/lg.png' },
  { slug: 'asus',    nameVi: 'ASUS',    nameEn: 'ASUS',    logo: '/images/brands/asus.png' },
  { slug: 'acer',    nameVi: 'Acer',    nameEn: 'Acer',    logo: '/images/brands/acer.png' },
  { slug: 'citizen', nameVi: 'CITIZEN', nameEn: 'CITIZEN', logo: '/images/brands/citizen.png' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = brands.map(b => ({
      name_vi: b.nameVi, name_en: b.nameEn, slug: b.slug,
      logo_url: b.logo, created_at: now, updated_at: now,
    }));
    // INSERT IGNORE để tránh duplicate khi re-run
    for (const row of rows) {
      await queryInterface.sequelize.query(
        `INSERT IGNORE INTO brands (name_vi, name_en, slug, logo_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        { replacements: [row.name_vi, row.name_en, row.slug, row.logo_url, row.created_at, row.updated_at] }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('brands', {
      slug: brands.map(b => b.slug),
    });
  },
};
