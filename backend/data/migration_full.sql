-- =====================================================
-- MIGRATION_FULL.SQL - CƠ SỞ DỮ LIỆU E-COMMERCE HOÀN CHỈNH
-- Phiên bản: 2.0 (INT AUTO_INCREMENT)
-- Ngày tạo: 2026-03-30
-- Mô tả: Schema đầy đủ cho 39 bảng + seed data cơ bản
-- Tương thích: Backend Sequelize models hiện tại
-- =====================================================
-- HƯỚNG DẪN SỬ DỤNG:
-- Bước 1: Tạo database mới trong phpMyAdmin (VD: techstore_db)
-- Bước 2: Import file migration_full.sql này (tạo schema + seed data)
-- Bước 3: Import file data_new.sql (thêm dữ liệu sản phẩm)
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+07:00';

-- =====================================================
-- PHẦN 1: XÓA CÁC BẢNG CŨ (nếu tồn tại)
-- Xóa theo thứ tự ngược lại để tránh lỗi FK
-- =====================================================

DROP TABLE IF EXISTS `product_reviews`;
DROP TABLE IF EXISTS `product_images`;
DROP TABLE IF EXISTS `product_variants`;
DROP TABLE IF EXISTS `product_warranties`;
DROP TABLE IF EXISTS `product_specifications`;
DROP TABLE IF EXISTS `product_attribute_groups`;
DROP TABLE IF EXISTS `product_attributes`;
DROP TABLE IF EXISTS `product_collections`;
DROP TABLE IF EXISTS `product_categories`;
DROP TABLE IF EXISTS `brand_categories`;
DROP TABLE IF EXISTS `review_feedbacks`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `carts`;
DROP TABLE IF EXISTS `wishlists`;
DROP TABLE IF EXISTS `recently_viewed`;
DROP TABLE IF EXISTS `search_histories`;
DROP TABLE IF EXISTS `loyalty_histories`;
DROP TABLE IF EXISTS `chat_messages`;
DROP TABLE IF EXISTS `newsletter_subscribers`;
DROP TABLE IF EXISTS `feedbacks`;
DROP TABLE IF EXISTS `email_campaigns`;
DROP TABLE IF EXISTS `news`;
DROP TABLE IF EXISTS `banners`;
DROP TABLE IF EXISTS `images`;
DROP TABLE IF EXISTS `addresses`;
DROP TABLE IF EXISTS `collections`;
DROP TABLE IF EXISTS `warranty_packages`;
DROP TABLE IF EXISTS `attribute_values`;
DROP TABLE IF EXISTS `attribute_groups`;
DROP TABLE IF EXISTS `discount_codes`;
DROP TABLE IF EXISTS `import_logs`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `brands`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

-- =====================================================
-- PHẦN 2: TẠO CÁC BẢNG (theo thứ tự dependency)
-- =====================================================

-- ----- BẢNG 1: users (Người dùng) -----
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NULL,
    `google_id` VARCHAR(255) NULL UNIQUE,
    `firstName` VARCHAR(255) NOT NULL,
    `lastName` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(255) NULL,
    `avatar` VARCHAR(255) NULL,
    `role` ENUM('customer', 'admin', 'manager') DEFAULT 'customer',
    `isEmailVerified` TINYINT(1) DEFAULT 0,
    `isActive` TINYINT(1) DEFAULT 1,
    `otpCode` VARCHAR(6) NULL,
    `otpExpires` DATETIME NULL,
    `resetPasswordToken` VARCHAR(255) NULL,
    `resetPasswordExpires` DATETIME NULL,
    `stripe_customer_id` VARCHAR(255) NULL,
    `loyaltyPoints` INT DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 2: addresses (Địa chỉ giao hàng) -----
CREATE TABLE IF NOT EXISTS `addresses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `userId` INT NOT NULL,
    `name` VARCHAR(255) NULL,
    `firstName` VARCHAR(255) NOT NULL,
    `lastName` VARCHAR(255) NOT NULL,
    `company` VARCHAR(255) NULL,
    `address1` VARCHAR(255) NOT NULL,
    `address2` VARCHAR(255) NULL,
    `city` VARCHAR(255) NOT NULL,
    `state` VARCHAR(255) NOT NULL,
    `zip` VARCHAR(255) NOT NULL,
    `country` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(255) NULL,
    `isDefault` TINYINT(1) DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_addresses_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 3: categories (Danh mục sản phẩm) -----
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) UNIQUE NOT NULL,
    `slug` VARCHAR(255) UNIQUE NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 4: brands (Thương hiệu) -----
CREATE TABLE IF NOT EXISTS `brands` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) UNIQUE NOT NULL,
    `slug` VARCHAR(255) UNIQUE NOT NULL,
    `logo_url` VARCHAR(500) NULL,
    `created_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NULL,
    `deleted_at` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Lưu ý: brand.js dùng underscored: true → Sequelize tự map createdAt→created_at

-- ----- BẢNG 5: products (Sản phẩm) -----
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `category_id` INT NULL,
    `brand_id` INT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) UNIQUE NOT NULL,
    `base_name` VARCHAR(255) NULL COMMENT 'Tên gốc sản phẩm (không bao gồm biến thể)',
    `model` VARCHAR(255) NULL,
    `base_price` DECIMAL(15,2) NULL,
    `compare_at_price` DECIMAL(15,2) NULL,
    `short_description` TEXT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(50) DEFAULT 'active',
    `is_featured` TINYINT(1) DEFAULT 0,
    `condition` VARCHAR(50) DEFAULT 'new',
    `visibility` VARCHAR(50) DEFAULT 'public',
    `warranty_months` INT DEFAULT 12,
    `tags` LONGTEXT NULL,
    `specifications` LONGTEXT NULL,
    `attributes` LONGTEXT NULL,
    `sold_count` INT DEFAULT 0,
    `view_count` INT DEFAULT 0,
    `rating_average` DECIMAL(3,2) DEFAULT 0.00,
    `stock_quantity` INT NOT NULL DEFAULT 0,
    `shipping_info` LONGTEXT NULL,
    `seo_title` VARCHAR(500) NULL COMMENT 'SEO title cho trang sản phẩm',
    `seo_description` TEXT NULL COMMENT 'SEO meta description',
    `seo_keywords` LONGTEXT NULL COMMENT 'SEO keywords (JSON array)',
    `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL,
    `brand` VARCHAR(255) NULL,
    `sku` VARCHAR(255) NULL,
    CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_products_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 6: product_variants (Biến thể sản phẩm) -----
CREATE TABLE IF NOT EXISTS `product_variants` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `sku` VARCHAR(100) UNIQUE NOT NULL,
    `variant_name` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(255) NULL,
    `price` DECIMAL(15,2) NULL,
    `compare_at_price` DECIMAL(15,2) NULL,
    `stock_quantity` INT DEFAULT 0,
    `is_default` TINYINT(1) DEFAULT 0,
    `attributes` LONGTEXT NULL,
    `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL,
    `sort_order` INT DEFAULT 0,
    `is_available` TINYINT(1) DEFAULT 1,
    CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 7: product_images (Ảnh sản phẩm) -----
CREATE TABLE IF NOT EXISTS `product_images` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `variant_id` INT NULL,
    `image_url` VARCHAR(1000) NOT NULL,
    `is_thumbnail` TINYINT(1) DEFAULT 0,
    `color` VARCHAR(100) NULL,
    `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL,
    CONSTRAINT `fk_product_images_products` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_product_images_variants` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 8: product_reviews (Đánh giá sản phẩm - theo data_new.sql) -----
CREATE TABLE IF NOT EXISTS `product_reviews` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `variant_id` INT NULL,
    `user_id` INT NOT NULL,
    `rating_value` INT NULL CHECK (`rating_value` >= 1 AND `rating_value` <= 5),
    `content` TEXT NULL,
    `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL,
    CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_product_reviews_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 9: orders (Đơn hàng) -----
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `number` VARCHAR(255) NOT NULL,
    `userId` INT NOT NULL,
    `status` ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    `shippingFirstName` VARCHAR(255) NOT NULL,
    `shippingLastName` VARCHAR(255) NOT NULL,
    `shippingCompany` VARCHAR(255) NULL,
    `shippingAddress1` VARCHAR(255) NOT NULL,
    `shippingAddress2` VARCHAR(255) NULL,
    `shippingCity` VARCHAR(255) NOT NULL,
    `shippingState` VARCHAR(255) NOT NULL,
    `shippingZip` VARCHAR(255) NULL,
    `shippingCountry` VARCHAR(255) NULL,
    `shippingPhone` VARCHAR(255) NULL,
    `billingFirstName` VARCHAR(255) NOT NULL,
    `billingLastName` VARCHAR(255) NOT NULL,
    `billingCompany` VARCHAR(255) NULL,
    `billingAddress1` VARCHAR(255) NOT NULL,
    `billingAddress2` VARCHAR(255) NULL,
    `billingCity` VARCHAR(255) NOT NULL,
    `billingState` VARCHAR(255) NOT NULL,
    `billingZip` VARCHAR(255) NULL,
    `billingCountry` VARCHAR(255) NULL,
    `billingPhone` VARCHAR(255) NULL,
    `paymentMethod` VARCHAR(255) NOT NULL,
    `paymentStatus` ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    `paymentTransactionId` VARCHAR(255) NULL,
    `paymentProvider` VARCHAR(255) NULL,
    `subtotal` DECIMAL(19,2) NOT NULL,
    `tax` DECIMAL(19,2) NOT NULL,
    `shippingCost` DECIMAL(19,2) NOT NULL,
    `discount` DECIMAL(19,2) DEFAULT 0.00,
    `total` DECIMAL(19,2) NOT NULL,
    `notes` TEXT NULL,
    `trackingNumber` VARCHAR(255) NULL,
    `shippingProvider` VARCHAR(255) NULL,
    `estimatedDelivery` DATETIME NULL,
    `pointsEarned` INT DEFAULT 0,
    `pointsUsed` INT DEFAULT 0,
    `pointsDiscount` DECIMAL(19,2) DEFAULT 0.00,
    `warranty_cost` DECIMAL(19,2) DEFAULT 0.00,
    `discountCodeId` INT NULL COMMENT 'FK tới bảng discount_codes - Sequelize tạo qua association',
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_orders_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_orders_discount` FOREIGN KEY (`discountCodeId`) REFERENCES `discount_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 10: order_items (Chi tiết đơn hàng) -----
CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `orderId` INT NOT NULL,
    `productId` INT NOT NULL,
    `variantId` INT NULL,
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(255) NULL,
    `price` DECIMAL(19,2) NOT NULL,
    `quantity` INT NOT NULL,
    `subtotal` DECIMAL(19,2) NOT NULL,
    `image` VARCHAR(255) NULL,
    `attributes` JSON DEFAULT (JSON_OBJECT()),
    `warranty_package_ids` JSON NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_order_items_order` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_order_items_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 11: carts (Giỏ hàng) -----
CREATE TABLE IF NOT EXISTS `carts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `userId` INT NULL,
    `sessionId` VARCHAR(255) NULL,
    `status` ENUM('active', 'merged', 'converted', 'abandoned') DEFAULT 'active',
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_carts_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 12: cart_items (Items trong giỏ hàng) -----
CREATE TABLE IF NOT EXISTS `cart_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `cartId` INT NOT NULL,
    `productId` INT NOT NULL,
    `variantId` INT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `price` DECIMAL(19,2) NOT NULL,
    `warranty_package_ids` JSON NULL DEFAULT (JSON_ARRAY()),
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_cart_items_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 13: discount_codes (Mã giảm giá) -----
CREATE TABLE IF NOT EXISTS `discount_codes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) NOT NULL UNIQUE,
    `type` ENUM('percent', 'fixed') NOT NULL DEFAULT 'fixed',
    `value` DECIMAL(19,2) NOT NULL,
    `minOrderAmount` DECIMAL(19,2) NULL DEFAULT 0.00,
    `maxDiscountAmount` DECIMAL(19,2) NULL,
    `startDate` DATETIME NULL,
    `endDate` DATETIME NULL,
    `usageLimit` INT NULL,
    `usedCount` INT DEFAULT 0,
    `isActive` TINYINT(1) DEFAULT 1,
    `description` VARCHAR(255) NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 14: reviews (Đánh giá - bảng cũ) -----
CREATE TABLE IF NOT EXISTS `reviews` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `productId` INT NOT NULL,
    `userId` INT NOT NULL,
    `rating` INT NOT NULL,
    `title` VARCHAR(255) NULL,
    `content` TEXT NOT NULL,
    `isVerified` TINYINT(1) DEFAULT 0,
    `likes` INT DEFAULT 0,
    `dislikes` INT DEFAULT 0,
    `images` JSON DEFAULT (JSON_ARRAY()),
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_reviews_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_reviews_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 15: review_feedbacks (Phản hồi đánh giá) -----
CREATE TABLE IF NOT EXISTS `review_feedbacks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `reviewId` INT NOT NULL,
    `userId` INT NOT NULL,
    `isHelpful` TINYINT(1) NOT NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_review_feedbacks_review` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_review_feedbacks_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 16: wishlists (Danh sách yêu thích) -----
CREATE TABLE IF NOT EXISTS `wishlists` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `userId` INT NOT NULL,
    `productId` INT NOT NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_wishlists_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_wishlists_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 17: images (Quản lý ảnh hệ thống) -----
CREATE TABLE IF NOT EXISTS `images` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `original_name` VARCHAR(255) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL UNIQUE,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size` INT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `width` INT NULL,
    `height` INT NULL,
    `category` ENUM('product', 'thumbnail', 'user', 'review') NOT NULL DEFAULT 'product',
    `product_id` INT NULL,
    `user_id` INT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_images_product_id` (`product_id`),
    INDEX `idx_images_user_id` (`user_id`),
    INDEX `idx_images_category` (`category`),
    INDEX `idx_images_is_active` (`is_active`),
    CONSTRAINT `fk_images_products` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_images_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 18: news (Tin tức / Blog) -----
CREATE TABLE IF NOT EXISTS `news` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `thumbnail` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `category` VARCHAR(255) NULL DEFAULT 'Tin tức',
    `viewCount` INT DEFAULT 0,
    `tags` VARCHAR(255) NULL,
    `isPublished` TINYINT(1) DEFAULT 1,
    `userId` INT NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_news_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 19: newsletter_subscribers (Đăng ký nhận tin) -----
CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL,
    `status` ENUM('active', 'unsubscribed') DEFAULT 'active',
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 20: feedbacks (Phản hồi liên hệ) -----
CREATE TABLE IF NOT EXISTS `feedbacks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(255) NULL,
    `subject` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 21: chat_messages (Tin nhắn chat) -----
CREATE TABLE IF NOT EXISTS `chat_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `userId` INT NULL,
    `sessionId` VARCHAR(255) NOT NULL,
    `senderId` INT NULL,
    `content` TEXT NOT NULL,
    `isFromAdmin` TINYINT(1) DEFAULT 0,
    `isRead` TINYINT(1) DEFAULT 0,
    -- Trạng thái gửi/nhận (sent → delivered → read)
    `status` ENUM('sent', 'delivered', 'read') NOT NULL DEFAULT 'sent',
    -- Loại nội dung tin nhắn
    `content_type` ENUM('text', 'image', 'product_card') NOT NULL DEFAULT 'text',
    -- URL đính kèm khi content_type = 'image'
    `attachment_url` VARCHAR(255) NULL,
    -- FK tới products khi content_type = 'product_card'
    `product_id` INT NULL,
    -- Thời điểm tin nhắn được đọc
    `read_at` DATETIME NULL,
    -- Phân biệt tin nhắn user hay AI assistant
    `role` ENUM('user', 'assistant') NULL,
    -- Phân biệt AI chatbot vs support chat
    `message_type` ENUM('ai_chatbot', 'support_chat') NOT NULL DEFAULT 'support_chat',
    -- Intent phân loại từ user message (product_search, general, off_topic...)
    `intent` VARCHAR(50) NULL,
    -- Thời gian xử lý RAG pipeline (ms)
    `response_time_ms` INT UNSIGNED NULL,
    -- Đánh dấu fallback mode thay vì dùng LLM
    `is_fallback` TINYINT(1) NOT NULL DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_chat_messages_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_chat_messages_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 22: banners (Banner quảng cáo) -----
CREATE TABLE IF NOT EXISTS `banners` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `link_url` VARCHAR(255) NULL,
    `position` ENUM('home_hero', 'home_middle', 'sidebar') DEFAULT 'home_hero',
    `is_active` TINYINT(1) DEFAULT 1,
    `priority` INT DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 23: email_campaigns (Chiến dịch email) -----
CREATE TABLE IF NOT EXISTS `email_campaigns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `subject` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('draft', 'sent') DEFAULT 'draft',
    `sent_at` DATETIME NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 24: collections (Bộ sưu tập) -----
CREATE TABLE IF NOT EXISTS `collections` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `thumbnail` VARCHAR(255) NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 25: product_collections (Liên kết sản phẩm - bộ sưu tập) -----
CREATE TABLE IF NOT EXISTS `product_collections` (
    `productId` INT NOT NULL,
    `collectionId` INT NOT NULL,
    PRIMARY KEY (`productId`, `collectionId`),
    CONSTRAINT `fk_pc_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pc_collection` FOREIGN KEY (`collectionId`) REFERENCES `collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 26: product_categories (Liên kết sản phẩm - danh mục) -----
CREATE TABLE IF NOT EXISTS `product_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `productId` INT NOT NULL,
    `categoryId` INT NOT NULL,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_pcat_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pcat_category` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 27: brand_categories (Liên kết thương hiệu - danh mục) -----
CREATE TABLE IF NOT EXISTS `brand_categories` (
    `brand_id` INT NOT NULL,
    `category_id` INT NOT NULL,
    PRIMARY KEY (`brand_id`, `category_id`),
    CONSTRAINT `fk_bc_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bc_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 28: attribute_groups (Nhóm thuộc tính) -----
CREATE TABLE IF NOT EXISTS `attribute_groups` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(255) NOT NULL DEFAULT 'custom',
    `is_required` TINYINT(1) DEFAULT 0,
    `sort_order` INT DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 29: attribute_values (Giá trị thuộc tính) -----
CREATE TABLE IF NOT EXISTS `attribute_values` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `attribute_group_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `color_code` VARCHAR(255) NULL,
    `image_url` TEXT NULL,
    `price_adjustment` DECIMAL(12,2) DEFAULT 0.00,
    `sort_order` INT DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `affects_name` TINYINT(1) DEFAULT 0,
    `name_template` VARCHAR(255) NULL COMMENT 'Template cho tên sản phẩm (VD: I9, RTX 4080, 32GB)',
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_attr_val_group` FOREIGN KEY (`attribute_group_id`) REFERENCES `attribute_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 30: product_attribute_groups (Liên kết SP - nhóm thuộc tính) -----
CREATE TABLE IF NOT EXISTS `product_attribute_groups` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `attribute_group_id` INT NOT NULL,
    `is_required` TINYINT(1) DEFAULT 0,
    `sort_order` INT DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_pag_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pag_group` FOREIGN KEY (`attribute_group_id`) REFERENCES `attribute_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 31: product_attributes (Thuộc tính sản phẩm) -----
CREATE TABLE IF NOT EXISTS `product_attributes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('color', 'size', 'material', 'custom') NOT NULL DEFAULT 'custom',
    `values` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `required` TINYINT(1) DEFAULT 0,
    `sort_order` INT DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_pa_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 32: product_specifications (Thông số kỹ thuật) -----
CREATE TABLE IF NOT EXISTS `product_specifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,
    `category` VARCHAR(255) NULL DEFAULT 'General',
    `sort_order` INT DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_ps_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 33: warranty_packages (Gói bảo hành) -----
CREATE TABLE IF NOT EXISTS `warranty_packages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `duration_months` INT NOT NULL,
    `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `terms` JSON DEFAULT (JSON_OBJECT()),
    `coverage` JSON DEFAULT (JSON_ARRAY()),
    `is_active` TINYINT(1) DEFAULT 1,
    `sort_order` INT DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 34: product_warranties (Liên kết SP - gói bảo hành) -----
CREATE TABLE IF NOT EXISTS `product_warranties` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `warranty_package_id` INT NOT NULL,
    `is_default` TINYINT(1) DEFAULT 0,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_pw_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pw_warranty` FOREIGN KEY (`warranty_package_id`) REFERENCES `warranty_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 35: loyalty_histories (Lịch sử điểm thưởng) -----
CREATE TABLE IF NOT EXISTS `loyalty_histories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `order_id` INT NULL,
    `points` INT NOT NULL,
    `type` ENUM('earn', 'spend', 'refund', 'adjustment') NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_lh_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_lh_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 36: search_histories (Lịch sử tìm kiếm) -----
CREATE TABLE IF NOT EXISTS `search_histories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `session_id` VARCHAR(255) NULL,
    `keyword` VARCHAR(255) NOT NULL,
    `results_count` INT DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 37: recently_viewed (Sản phẩm xem gần đây) -----
CREATE TABLE IF NOT EXISTS `recently_viewed` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `viewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_rv_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_rv_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 38: audit_logs (Nhật ký kiểm toán admin) -----
-- ----- BẢNG 39: import_logs (Lịch sử import sản phẩm) -----
CREATE TABLE IF NOT EXISTS `import_logs` (
    `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `admin_id`     INT UNSIGNED  NOT NULL,
    `filename`     VARCHAR(255)  NOT NULL,
    `total_rows`   INT           NOT NULL DEFAULT 0,
    `success_rows` INT           NOT NULL DEFAULT 0,
    `failed_rows`  INT           NOT NULL DEFAULT 0,
    `error_detail` JSON          NULL,
    `imported_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_import_logs_admin_id` (`admin_id`),
    INDEX `idx_import_logs_imported_at` (`imported_at`),
    CONSTRAINT `fk_import_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `admin_id` INT NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` INT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_audit_admin_id` (`admin_id`),
    INDEX `idx_audit_entity` (`entity_type`, `entity_id`),
    INDEX `idx_audit_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PHẦN 3: SEED DATA CƠ BẢN
-- =====================================================

-- ----- 3.1: Tài khoản Admin & Customer mẫu -----
-- Mật khẩu: admin123 (đã hash bằng bcrypt)
INSERT INTO `users` (`id`, `email`, `password`, `firstName`, `lastName`, `phone`, `role`, `isEmailVerified`, `isActive`, `loyaltyPoints`, `createdAt`, `updatedAt`) VALUES
(1, 'admin@techstore.vn', '$2b$10$8K1p/a0dR1xqM/wWFN.JnOFuB9p6J0N6U6IALj3eAeLz9Y2wVXJSq', 'Admin', 'TechStore', '0901234567', 'admin', 1, 1, 0, NOW(), NOW()),
(2, 'customer@techstore.vn', '$2b$10$8K1p/a0dR1xqM/wWFN.JnOFuB9p6J0N6U6IALj3eAeLz9Y2wVXJSq', 'Nguyễn', 'Văn A', '0912345678', 'customer', 1, 1, 500, NOW(), NOW());

-- ----- 3.2: Địa chỉ mẫu cho customer -----
INSERT INTO `addresses` (`userId`, `name`, `firstName`, `lastName`, `address1`, `city`, `state`, `zip`, `country`, `phone`, `isDefault`) VALUES
(2, 'Nhà riêng', 'Nguyễn', 'Văn A', '123 Nguyễn Huệ', 'Hồ Chí Minh', 'Quận 1', '700000', 'Việt Nam', '0912345678', 1);

-- ----- 3.3: Mã giảm giá mẫu -----
INSERT INTO `discount_codes` (`code`, `type`, `value`, `minOrderAmount`, `maxDiscountAmount`, `startDate`, `endDate`, `usageLimit`, `usedCount`, `isActive`, `description`) VALUES
('WELCOME10', 'percent', 10.00, 500000.00, 2000000.00, NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY), 1000, 0, 1, 'Giảm 10% cho khách hàng mới, tối đa 2 triệu'),
('TECHSTORE50K', 'fixed', 50000.00, 200000.00, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 180 DAY), 500, 0, 1, 'Giảm 50,000đ cho đơn từ 200,000đ'),
('SUMMER2026', 'percent', 15.00, 1000000.00, 5000000.00, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 200, 0, 1, 'Khuyến mãi hè 2026 - Giảm 15% tối đa 5 triệu');

-- ----- 3.4: Banner mẫu -----
INSERT INTO `banners` (`title`, `image_url`, `link_url`, `position`, `is_active`, `priority`) VALUES
('iPhone 17 Series - Đặt hàng ngay', '/uploads/banners/iphone17-banner.jpg', '/products?category=dien-thoai&brand=apple', 'home_hero', 1, 1),
('Samsung Galaxy Tab S11 - Siêu phẩm mới', '/uploads/banners/tab-s11-banner.jpg', '/products?category=tablet&brand=samsung', 'home_hero', 1, 2),
('MacBook Pro M5 - Sức mạnh đỉnh cao', '/uploads/banners/macbook-m5-banner.jpg', '/products?category=laptop&brand=apple', 'home_hero', 1, 3);

-- ----- 3.5: Bộ sưu tập mẫu -----
INSERT INTO `collections` (`name`, `slug`, `description`, `is_active`) VALUES
('Sản phẩm nổi bật', 'san-pham-noi-bat', 'Những sản phẩm công nghệ được yêu thích nhất', 1),
('Điện thoại mới nhất', 'dien-thoai-moi-nhat', 'Các dòng điện thoại mới ra mắt 2026', 1),
('Laptop cho sinh viên', 'laptop-cho-sinh-vien', 'Laptop giá tốt phù hợp cho sinh viên', 1),
('Tablet đáng mua nhất', 'tablet-dang-mua-nhat', 'Máy tính bảng chất lượng, giá hợp lý', 1);

-- ----- 3.6: Gói bảo hành mẫu -----
INSERT INTO `warranty_packages` (`name`, `description`, `duration_months`, `price`, `terms`, `coverage`, `is_active`, `sort_order`) VALUES
('Bảo hành mở rộng 6 tháng', 'Gia hạn thêm 6 tháng bảo hành chính hãng', 6, 500000.00, '{"max_claims": 2, "deductible": 0}', '["Lỗi phần cứng", "Lỗi phần mềm"]', 1, 1),
('Bảo hành mở rộng 12 tháng', 'Gia hạn thêm 12 tháng bảo hành chính hãng', 12, 900000.00, '{"max_claims": 3, "deductible": 0}', '["Lỗi phần cứng", "Lỗi phần mềm", "Pin chai"]', 1, 2),
('Bảo hành VIP - Rơi vỡ', 'Bảo hành cả trường hợp rơi vỡ, vào nước', 12, 1500000.00, '{"max_claims": 1, "deductible": 500000}', '["Lỗi phần cứng", "Lỗi phần mềm", "Rơi vỡ", "Vào nước", "Pin chai"]', 1, 3);

-- ----- 3.7: Nhóm thuộc tính mẫu -----
INSERT INTO `attribute_groups` (`name`, `description`, `type`, `is_required`, `sort_order`, `is_active`) VALUES
('Màu sắc', 'Các tùy chọn màu sắc sản phẩm', 'color', 1, 1, 1),
('Dung lượng', 'Các tùy chọn bộ nhớ trong', 'storage', 1, 2, 1),
('RAM', 'Các tùy chọn bộ nhớ RAM', 'config', 0, 3, 1);

-- ----- 3.8: Liên kết thương hiệu - danh mục -----
-- (Sẽ được thêm sau khi import data_new.sql có categories và brands)
-- INSERT INTO brand_categories sẽ thực hiện ở bước sau

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- HOÀN TẤT!
-- Tiếp theo: Import file data_new.sql để thêm dữ liệu sản phẩm
-- =====================================================
