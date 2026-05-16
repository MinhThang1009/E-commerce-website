/**
 * Fix image URLs cho products 46-60.
 * Thay thế URLs cũ bằng URLs mới từ TGDD CDN đã verify accessible (200 OK).
 *
 * Chạy: node scripts/fixProductImages46to60.js
 */

const { sequelize, ProductImage } = require('../src/models');

// Dữ liệu image mới cho từng product — đã verify 200 OK qua curl
const productImagesData = {
  // ===== P46: Apple Watch Series 11 GPS + Cellular 46mm Titanium Milan =====
  46: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-den-1-638931882687554734.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-den-2-638931882694440235.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-den-3-638931882703619452.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-46mm-vien-titanium-day-milan-40-638976224348394630.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-46mm-vien-titanium-day-milan-260925-113028-873.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-46mm-vien-titanium-day-milan-260925-113034-374.jpg',
    ],
  },

  // ===== P47: Apple Watch Ultra 3 GPS + Cellular 49mm Titanium Ocean =====
  47: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-1-638931950391226626.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-2-638931950398035319.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-3-638931950404919316.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-40-638976225649352842.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-sld-2-638944767673302755.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-sld-3-638944767684338176.jpg',
    ],
  },

  // ===== P48: Apple Watch SE 3 GPS 40mm nhôm thể thao =====
  48: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-trang-1-638931870568348659.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-trang-2-638931870575290841.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-trang-3-638931870581517623.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-40mm-vien-nhom-day-the-thao-240925-114207-147.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-40mm-vien-nhom-day-the-thao-240925-114208-810.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-40mm-vien-nhom-day-the-thao-240925-114213-655.jpg',
    ],
  },

  // ===== P49: Apple Watch SE 3 GPS 44mm nhôm thể thao =====
  49: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-trang-1-638931870612723737.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-trang-2-638931870618644243.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-trang-3-638931870605670944.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-44mm-day-the-thao-40-638976214820693071.jpg',
    ],
  },

  // ===== P50: Samsung Galaxy Watch8 40mm silicone =====
  50: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-1-639087500464157953.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-2-639087500471714490.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-3-639087500479804716.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-4-639087500485548189.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-5-639087500492382297.jpg',
    ],
  },

  // ===== P51: Samsung Galaxy Watch7 44mm silicone =====
  51: {
    thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-1.jpg',
    gallery: [
      'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-2.jpg',
      'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-3.jpg',
      'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-4.jpg',
      'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-5.jpg',
      'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-6.jpg',
    ],
  },

  // ===== P52: Samsung Galaxy Watch8 Classic 46mm da =====
  52: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-1-638888811617288837.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-2-638888811628233098.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-3-638888811635769308.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-4-638888811643437834.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-5-638888811649374451.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-sld-2-638889469797619783.jpg',
    ],
  },

  // ===== P53: Mi Band 10 viền nhôm =====
  53: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-1-638868969734558044.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-2-638868969742923184.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-3-638868969752387906.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-4-638868969759195288.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-7-638868969711433961.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-8-638868969720775394.jpg',
    ],
  },

  // ===== P54: Xiaomi Redmi Watch 5 47.5mm TPU =====
  54: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-1-638711561164855097.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-2-638711561172010526.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-3-638711561178032941.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-4-638711561184315180.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-5-638711561189601028.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-6-638711561195764894.jpg',
    ],
  },

  // ===== P55: Xiaomi Redmi Watch 5 Lite 48.2mm TPU =====
  55: {
    thumbnail: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-1-638629600197599153.jpg',
    gallery: [
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-2-638629600203164274.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-4-638629600215060479.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-5-638629600220766445.jpg',
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-7-638629600227013108.jpg',
    ],
  },

  // ===== P56: CASIO 30.2mm Unisex A158WA-1DF =====
  56: {
    thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-thumb-600x600.jpg',
    gallery: [
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-1-2-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-2-2-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-3-2-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-4-2-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-5-2-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-6-1-org.jpg',
    ],
  },

  // ===== P57: CASIO Timeless 36.8mm Nam W-800H-1AVDF =====
  57: {
    thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-avatar-1-600x600.jpg',
    gallery: [
      'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-1-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-2-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-3-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-20.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-040020-020005.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-040020-020017.jpg',
    ],
  },

  // ===== P58: CITIZEN 39mm Nam BI5006-81L =====
  58: {
    thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-304320-114308-600x600.jpg',
    gallery: [
      'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-3-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-1-1-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-2-1-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-013820-103837.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-013820-103845.jpg',
    ],
  },

  // ===== P59: CITIZEN 42mm Nam NH8350-08A =====
  59: {
    thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-thumb-fix-600x600.jpg',
    gallery: [
      'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-1-1-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-2-1-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-3-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-4-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-5-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-15.jpg',
    ],
  },

  // ===== P60: CITIZEN 39mm Nam BI5000-87A =====
  60: {
    thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/201737/dong-ho-nam-citizen-bi5000-87a-trang-600x600.jpg',
    gallery: [
      'https://cdn.tgdd.vn/Products/Images/7264/201737/dong-ho-nam-citizen-bi5000-87a-trang-1-org.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/201737/citizen-bi5000-87a-2.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/201737/citizen-bi5000-87a-3.jpg',
      'https://cdn.tgdd.vn/Products/Images/7264/201737/dong-ho-nam-citizen-bi5000-87a-trang-99.jpg',
    ],
  },
};

async function fixImages() {
  const t = await sequelize.transaction();

  try {
    for (const [productId, data] of Object.entries(productImagesData)) {
      const pid = parseInt(productId);

      // Xóa images cũ (soft delete vì model dùng paranoid)
      await ProductImage.destroy({
        where: { productId: pid },
        force: true, // Hard delete — URLs cũ bị 403 không cần giữ
        transaction: t,
      });

      // Insert thumbnail
      await ProductImage.create(
        {
          productId: pid,
          imageUrl: data.thumbnail,
          isThumbnail: true,
        },
        { transaction: t }
      );

      // Insert gallery images
      for (const url of data.gallery) {
        await ProductImage.create(
          {
            productId: pid,
            imageUrl: url,
            isThumbnail: false,
          },
          { transaction: t }
        );
      }

      const total = 1 + data.gallery.length;
      console.log(`[OK] Product ${pid}: 1 thumbnail + ${data.gallery.length} gallery = ${total} images`);
    }

    await t.commit();
    console.log('\n=== HOÀN TẤT: Đã update images cho 15 products (ID 46-60) ===');
  } catch (err) {
    await t.rollback();
    console.error('LỖI — đã rollback:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixImages();
