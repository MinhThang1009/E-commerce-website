-- =====================================================
-- MIGRATION_FULL.SQL - CƠ SỞ DỮ LIỆU E-COMMERCE HOÀN CHỈNH
-- Phiên bản: 3.0 (Phase 40 — MySQL Standard Compliance)
-- Ngày tạo: 2026-05-05
-- Mô tả: Schema đầy đủ cho 39 bảng + seed data cơ bản
-- Tương thích: Backend Sequelize models hiện tại
--
-- Phase 40 changes (so với v2.0):
--   - Toàn bộ column names đổi sang snake_case (Phase 40.1)
--   - Tất cả timestamps unified DATETIME (bỏ TIMESTAMP cho Group A)
--   - Tất cả DECIMAL monetary columns unified DECIMAL(15,2) (Phase 40.6)
--   - Drop column products.brand redundant (Phase 40.7)
--   - order_items.price → unit_price + thêm discount_amount
--   - cart_items.price → unit_price
--   - import_logs.id và admin_id: INT UNSIGNED → INT (Phase 40.4)
--   - Thêm 6 FK constraints (Phase 40.5: audit_logs, search_histories, chat_messages.sender_id, order_items.variant_id, cart_items.variant_id, product_reviews.user_id)
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
DROP TABLE IF EXISTS `inventory_logs`;
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
    `first_name` VARCHAR(255) NOT NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(255) NULL,
    `avatar` VARCHAR(255) NULL,
    `role` ENUM('customer', 'admin', 'manager') DEFAULT 'customer',
    `is_email_verified` TINYINT(1) DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `otp_code` VARCHAR(6) NULL,
    `otp_expires` DATETIME NULL,
    `reset_password_token` VARCHAR(255) NULL,
    `reset_password_expires` DATETIME NULL,
    `stripe_customer_id` VARCHAR(255) NULL,
    `loyalty_points` INT DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 2: addresses (Địa chỉ giao hàng) -----
CREATE TABLE IF NOT EXISTS `addresses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `name` VARCHAR(255) NULL,
    `first_name` VARCHAR(255) NOT NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `company` VARCHAR(255) NULL,
    `address1` VARCHAR(255) NOT NULL,
    `address2` VARCHAR(255) NULL,
    `city` VARCHAR(255) NOT NULL,
    `state` VARCHAR(255) NOT NULL,
    `zip` VARCHAR(255) NOT NULL,
    `country` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(255) NULL,
    `is_default` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    INDEX `idx_addresses_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 3: categories (Danh mục sản phẩm) -----
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    UNIQUE KEY `uq_categories_name` (`name`),
    UNIQUE KEY `uq_categories_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 4: brands (Thương hiệu) -----
CREATE TABLE IF NOT EXISTS `brands` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `logo_url` VARCHAR(500) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    UNIQUE KEY `uq_brands_name` (`name`),
    UNIQUE KEY `uq_brands_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 5: products (Sản phẩm) -----
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `category_id` INT NULL,
    `brand_id` INT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    `sku` VARCHAR(255) NULL,
    UNIQUE KEY `uq_products_slug` (`slug`),
    CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_products_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 6: product_variants (Biến thể sản phẩm) -----
CREATE TABLE IF NOT EXISTS `product_variants` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `sku` VARCHAR(100) NOT NULL,
    `variant_name` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(255) NULL,
    `price` DECIMAL(15,2) NULL,
    `compare_at_price` DECIMAL(15,2) NULL,
    `stock_quantity` INT DEFAULT 0,
    `is_default` TINYINT(1) DEFAULT 0,
    `attributes` LONGTEXT NULL,
    `weight` DECIMAL(10,3) NULL,
    `dimensions` JSON NULL,
    `sort_order` INT DEFAULT 0,
    `is_available` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    INDEX `idx_product_variants_deleted_at` (`deleted_at`),
    UNIQUE KEY `uq_product_variants_sku` (`sku`),
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    CONSTRAINT `fk_product_images_products` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_product_images_variants` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 8: product_reviews (Đánh giá sản phẩm) -----
CREATE TABLE IF NOT EXISTS `product_reviews` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `variant_id` INT NULL,
    `user_id` INT NOT NULL,
    `rating_value` INT NULL CHECK (`rating_value` >= 1 AND `rating_value` <= 5),
    `content` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_product_reviews_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_product_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 9: discount_codes (Mã giảm giá) — đặt trước orders vì orders FK tới đây -----
CREATE TABLE IF NOT EXISTS `discount_codes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) NOT NULL,
    `type` ENUM('percent', 'fixed') NOT NULL DEFAULT 'fixed',
    `value` DECIMAL(15,2) NOT NULL,
    `min_order_amount` DECIMAL(15,2) NULL DEFAULT 0.00,
    `max_discount_amount` DECIMAL(15,2) NULL,
    `start_date` DATETIME NULL,
    `end_date` DATETIME NULL,
    `usage_limit` INT NULL,
    `used_count` INT DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    UNIQUE KEY `uq_discount_codes_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 10: orders (Đơn hàng) -----
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `number` VARCHAR(255) NOT NULL,
    `user_id` INT NOT NULL,
    `status` ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    `shipping_first_name` VARCHAR(255) NOT NULL,
    `shipping_last_name` VARCHAR(255) NOT NULL,
    `shipping_company` VARCHAR(255) NULL,
    `shipping_address1` VARCHAR(255) NOT NULL,
    `shipping_address2` VARCHAR(255) NULL,
    `shipping_city` VARCHAR(255) NOT NULL,
    `shipping_state` VARCHAR(255) NOT NULL,
    `shipping_zip` VARCHAR(255) NULL,
    `shipping_country` VARCHAR(255) NULL,
    `shipping_phone` VARCHAR(255) NULL,
    `billing_first_name` VARCHAR(255) NOT NULL,
    `billing_last_name` VARCHAR(255) NOT NULL,
    `billing_company` VARCHAR(255) NULL,
    `billing_address1` VARCHAR(255) NOT NULL,
    `billing_address2` VARCHAR(255) NULL,
    `billing_city` VARCHAR(255) NOT NULL,
    `billing_state` VARCHAR(255) NOT NULL,
    `billing_zip` VARCHAR(255) NULL,
    `billing_country` VARCHAR(255) NULL,
    `billing_phone` VARCHAR(255) NULL,
    `payment_method` VARCHAR(255) NOT NULL,
    `payment_status` ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    `payment_transaction_id` VARCHAR(255) NULL,
    `payment_provider` VARCHAR(255) NULL,
    `subtotal` DECIMAL(15,2) NOT NULL,
    `tax` DECIMAL(15,2) NOT NULL,
    `shipping_cost` DECIMAL(15,2) NOT NULL,
    `discount` DECIMAL(15,2) DEFAULT 0.00,
    `total` DECIMAL(15,2) NOT NULL,
    `notes` TEXT NULL,
    `tracking_number` VARCHAR(255) NULL,
    `shipping_provider` VARCHAR(255) NULL,
    `estimated_delivery` DATETIME NULL,
    `points_earned` INT DEFAULT 0,
    `points_used` INT DEFAULT 0,
    `points_discount` DECIMAL(15,2) DEFAULT 0.00,
    `warranty_cost` DECIMAL(15,2) DEFAULT 0.00,
    `discount_code_id` INT NULL COMMENT 'FK tới discount_codes',
    `cancelled_at` DATETIME NULL DEFAULT NULL,
    `refunded_at` DATETIME NULL DEFAULT NULL,
    `refund_amount` DECIMAL(15,2) NULL DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_orders_discount` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 11: order_items (Chi tiết đơn hàng) -----
CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `variant_id` INT NULL,
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(255) NULL,
    `unit_price` DECIMAL(15,2) NOT NULL,
    `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Giảm giá áp dụng riêng cho item này',
    `quantity` INT NOT NULL,
    `subtotal` DECIMAL(15,2) NOT NULL,
    `image` VARCHAR(255) NULL,
    `attributes` JSON DEFAULT (JSON_OBJECT()),
    `warranty_package_ids` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_order_items_orders` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_order_items_products` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_order_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 12: carts (Giỏ hàng) -----
CREATE TABLE IF NOT EXISTS `carts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `session_id` VARCHAR(255) NULL,
    `status` ENUM('active', 'merged', 'converted', 'abandoned') DEFAULT 'active',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_carts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 13: cart_items (Items trong giỏ hàng) -----
CREATE TABLE IF NOT EXISTS `cart_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `cart_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `variant_id` INT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(15,2) NOT NULL,
    `warranty_package_ids` JSON NULL DEFAULT (JSON_ARRAY()),
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_cart_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_cart_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 14: reviews (Đánh giá - bảng cũ) -----
CREATE TABLE IF NOT EXISTS `reviews` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    `rating` INT NOT NULL,
    `title` VARCHAR(255) NULL,
    `content` TEXT NOT NULL,
    `is_verified` TINYINT(1) DEFAULT 0,
    `likes` INT DEFAULT 0,
    `dislikes` INT DEFAULT 0,
    `images` JSON DEFAULT (JSON_ARRAY()),
    `variant_id` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    INDEX `idx_reviews_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_reviews_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 15: review_feedbacks (Phản hồi đánh giá) -----
CREATE TABLE IF NOT EXISTS `review_feedbacks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `review_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    `is_helpful` TINYINT(1) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_review_feedbacks_review` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_review_feedbacks_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 16: wishlists (Danh sách yêu thích) -----
CREATE TABLE IF NOT EXISTS `wishlists` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_wishlists_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_wishlists_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 17: images (Quản lý ảnh hệ thống) -----
CREATE TABLE IF NOT EXISTS `images` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `original_name` VARCHAR(255) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
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
    UNIQUE KEY `uq_images_file_name` (`file_name`),
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
    `view_count` INT DEFAULT 0,
    `tags` VARCHAR(255) NULL,
    `is_published` TINYINT(1) DEFAULT 1,
    `user_id` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    INDEX `idx_news_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_news_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 19: newsletter_subscribers (Đăng ký nhận tin) -----
CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL,
    `status` ENUM('active', 'unsubscribed') DEFAULT 'active',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 21: chat_messages (Tin nhắn chat) -----
CREATE TABLE IF NOT EXISTS `chat_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `session_id` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `role` ENUM('user', 'assistant') NULL,
    `message_type` ENUM('ai_chatbot', 'support_chat') NOT NULL DEFAULT 'ai_chatbot',
    `intent` VARCHAR(50) NULL,
    `response_time_ms` INT UNSIGNED NULL,
    `is_fallback` TINYINT(1) NOT NULL DEFAULT 0,
    `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_chat_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    INDEX `idx_banners_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 23: email_campaigns (Chiến dịch email) -----
CREATE TABLE IF NOT EXISTS `email_campaigns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `subject` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('draft', 'sent') DEFAULT 'draft',
    `sent_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 24: collections (Bộ sưu tập) -----
CREATE TABLE IF NOT EXISTS `collections` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `thumbnail` VARCHAR(255) NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    INDEX `idx_collections_deleted_at` (`deleted_at`),
    UNIQUE KEY `uq_collections_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 25: product_collections (Liên kết sản phẩm - bộ sưu tập) -----
CREATE TABLE IF NOT EXISTS `product_collections` (
    `product_id` INT NOT NULL,
    `collection_id` INT NOT NULL,
    PRIMARY KEY (`product_id`, `collection_id`),
    CONSTRAINT `fk_pc_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pc_collection` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 26: product_categories (Liên kết sản phẩm - danh mục) -----
CREATE TABLE IF NOT EXISTS `product_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `category_id` INT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_pcat_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pcat_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 29: attribute_values (Giá trị thuộc tính) -----
CREATE TABLE IF NOT EXISTS `attribute_values` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `attribute_group_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `color_code` VARCHAR(255) NULL,
    `image_url` TEXT NULL,
    `price_adjustment` DECIMAL(15,2) DEFAULT 0.00,
    `sort_order` INT DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `affects_name` TINYINT(1) DEFAULT 0,
    `name_template` VARCHAR(255) NULL COMMENT 'Template cho tên sản phẩm (VD: I9, RTX 4080, 32GB)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_attr_val_group` FOREIGN KEY (`attribute_group_id`) REFERENCES `attribute_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 30: product_attribute_groups (Liên kết SP - nhóm thuộc tính) -----
CREATE TABLE IF NOT EXISTS `product_attribute_groups` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `attribute_group_id` INT NOT NULL,
    `is_required` TINYINT(1) DEFAULT 0,
    `sort_order` INT DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_ps_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 33: warranty_packages (Gói bảo hành) -----
CREATE TABLE IF NOT EXISTS `warranty_packages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `duration_months` INT NOT NULL,
    `price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `terms` JSON DEFAULT (JSON_OBJECT()),
    `coverage` JSON DEFAULT (JSON_ARRAY()),
    `is_active` TINYINT(1) DEFAULT 1,
    `sort_order` INT DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 34: product_warranties (Liên kết SP - gói bảo hành) -----
CREATE TABLE IF NOT EXISTS `product_warranties` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `warranty_package_id` INT NOT NULL,
    `is_default` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_search_histories_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
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

-- ----- BẢNG 38: import_logs (Lịch sử import sản phẩm) -----
CREATE TABLE IF NOT EXISTS `import_logs` (
    `id`           INT           NOT NULL AUTO_INCREMENT,
    `admin_id`     INT           NOT NULL,
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

-- ----- BẢNG 39: audit_logs (Nhật ký kiểm toán admin) -----
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
    INDEX `idx_audit_created_at` (`created_at`),
    CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- BẢNG 40: inventory_logs (Lịch sử thay đổi tồn kho) -----
CREATE TABLE IF NOT EXISTS `inventory_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `variant_id` INT NULL COMMENT 'null = sản phẩm không có variant; có giá trị = biến thể cụ thể',
    `change_type` ENUM('sale', 'restock', 'adjustment', 'return') NOT NULL,
    `change_amount` INT NOT NULL COMMENT 'Số lượng thay đổi (dương = tăng, âm = giảm)',
    `previous_stock` INT NOT NULL,
    `new_stock` INT NOT NULL,
    `order_id` INT NULL COMMENT 'null = thay đổi không liên quan đơn hàng (nhập hàng, điều chỉnh)',
    `note` VARCHAR(500) NULL,
    `created_by` INT NULL COMMENT 'null = hành động tự động bởi hệ thống',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_inventory_logs_product_id` (`product_id`),
    INDEX `idx_inventory_logs_variant_id` (`variant_id`),
    INDEX `idx_inventory_logs_order_id` (`order_id`),
    INDEX `idx_inventory_logs_change_type` (`change_type`),
    CONSTRAINT `fk_inventory_logs_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_inventory_logs_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_inventory_logs_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_inventory_logs_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PHẦN 3: SEED DATA CƠ BẢN
-- =====================================================

-- ----- 3.1: Tài khoản Admin & Customer mẫu -----
-- Mật khẩu: admin123 (đã hash bằng bcrypt)
INSERT INTO `users` (`id`, `email`, `password`, `first_name`, `last_name`, `phone`, `role`, `is_email_verified`, `is_active`, `loyalty_points`, `created_at`, `updated_at`) VALUES
(1, 'admin@techstore.vn', '$2b$10$8K1p/a0dR1xqM/wWFN.JnOFuB9p6J0N6U6IALj3eAeLz9Y2wVXJSq', 'Admin', 'TechStore', '0901234567', 'admin', 1, 1, 0, NOW(), NOW()),
(2, 'customer@techstore.vn', '$2b$10$8K1p/a0dR1xqM/wWFN.JnOFuB9p6J0N6U6IALj3eAeLz9Y2wVXJSq', 'Nguyễn', 'Văn A', '0912345678', 'customer', 1, 1, 500, NOW(), NOW());

-- ----- 3.2: Địa chỉ mẫu cho customer -----
INSERT INTO `addresses` (`user_id`, `name`, `first_name`, `last_name`, `address1`, `city`, `state`, `zip`, `country`, `phone`, `is_default`) VALUES
(2, 'Nhà riêng', 'Nguyễn', 'Văn A', '123 Nguyễn Huệ', 'Hồ Chí Minh', 'Quận 1', '700000', 'Việt Nam', '0912345678', 1);

-- ----- 3.3: Mã giảm giá mẫu -----
INSERT INTO `discount_codes` (`code`, `type`, `value`, `min_order_amount`, `max_discount_amount`, `start_date`, `end_date`, `usage_limit`, `used_count`, `is_active`, `description`) VALUES
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
