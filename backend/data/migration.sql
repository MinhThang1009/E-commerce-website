/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `addresses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `company` varchar(255) DEFAULT NULL,
  `address1` varchar(255) NOT NULL,
  `address2` varchar(255) DEFAULT NULL,
  `city` varchar(255) NOT NULL,
  `state` varchar(255) NOT NULL,
  `zip` varchar(255) NOT NULL,
  `country` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_addresses_deleted_at` (`deleted_at`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attribute_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` varchar(255) NOT NULL DEFAULT 'custom',
  `is_required` tinyint(1) DEFAULT 0,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attribute_values` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `attribute_group_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` varchar(255) NOT NULL,
  `color_code` varchar(255) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `price_adjustment` decimal(15,2) DEFAULT 0.00,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `affects_name` tinyint(1) DEFAULT 0,
  `name_template` varchar(255) DEFAULT NULL COMMENT 'Template tên sản phẩm (ví dụ: "I9", "RTX 4080", "32GB")',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `attribute_group_id` (`attribute_group_id`),
  CONSTRAINT `attribute_values_ibfk_1` FOREIGN KEY (`attribute_group_id`) REFERENCES `attribute_groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `brand_categories` (
  `brand_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  PRIMARY KEY (`brand_id`,`category_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `brand_categories_ibfk_1` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `brand_categories_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `brands` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name_vi` varchar(100) NOT NULL,
  `name_en` varchar(100) DEFAULT NULL,
  `slug` varchar(255) NOT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `description_vi` text DEFAULT NULL,
  `description_en` text DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_brands_name` (`name_vi`),
  UNIQUE KEY `uq_brands_slug` (`slug`),
  UNIQUE KEY `name_vi` (`name_vi`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_brands_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=274 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cart_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cart_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `variant_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(15,2) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `cart_id` (`cart_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `cart_items_ibfk_4` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cart_items_ibfk_5` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `cart_items_ibfk_6` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=118 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `carts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `status` enum('active','merged','converted','abandoned') DEFAULT 'active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `carts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name_vi` varchar(100) NOT NULL,
  `name_en` varchar(100) DEFAULT NULL,
  `slug` varchar(255) NOT NULL,
  `description_vi` text DEFAULT NULL,
  `description_en` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `image` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `parent_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name_vi`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  UNIQUE KEY `name_vi` (`name_vi`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_categories_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=260 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `session_id` varchar(128) NOT NULL,
  `content` text NOT NULL,
  `role` enum('user','assistant') DEFAULT NULL,
  `message_type` enum('ai_chatbot','support_chat') NOT NULL DEFAULT 'ai_chatbot',
  `intent` varchar(50) DEFAULT NULL,
  `response_time_ms` int(10) unsigned DEFAULT NULL,
  `is_fallback` tinyint(1) NOT NULL DEFAULT 0,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `discount_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `type` enum('percent','fixed') NOT NULL DEFAULT 'fixed',
  `value` decimal(15,2) NOT NULL,
  `min_order_amount` decimal(15,2) DEFAULT 0.00,
  `max_discount_amount` decimal(15,2) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `usage_limit` int(11) DEFAULT NULL,
  `used_count` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_discount_codes_code` (`code`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_discount_codes_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `feedbacks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `status` enum('pending','reviewed','resolved') DEFAULT 'pending',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_name` varchar(255) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int(11) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `width` int(11) DEFAULT NULL,
  `height` int(11) DEFAULT NULL,
  `category` enum('product','thumbnail','user','review') NOT NULL DEFAULT 'product',
  `product_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_images_file_name` (`file_name`),
  KEY `idx_images_product_id` (`product_id`),
  KEY `idx_images_user_id` (`user_id`),
  KEY `idx_images_category` (`category`),
  KEY `idx_images_is_active` (`is_active`),
  CONSTRAINT `images_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `images_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `variant_id` int(11) DEFAULT NULL COMMENT 'null = sản phẩm không có variant; có giá trị = biến thể cụ thể',
  `change_type` enum('sale','restock','adjustment','return') NOT NULL,
  `change_amount` int(11) NOT NULL,
  `previous_stock` int(11) NOT NULL,
  `new_stock` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL COMMENT 'null = thay đổi không liên quan đơn hàng (nhập hàng, điều chỉnh)',
  `note` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL COMMENT 'null = hành động tự động bởi hệ thống',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_logs_product_id` (`product_id`),
  KEY `idx_inventory_logs_variant_id` (`variant_id`),
  KEY `idx_inventory_logs_order_id` (`order_id`),
  KEY `idx_inventory_logs_change_type` (`change_type`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `inventory_logs_ibfk_5` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventory_logs_ibfk_6` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_logs_ibfk_7` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_logs_ibfk_8` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `variant_id` int(11) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `sku` varchar(255) DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `quantity` int(11) NOT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `order_items_ibfk_4` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_items_ibfk_5` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `order_items_ibfk_6` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=127 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `number` varchar(50) NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  `shipping_first_name` varchar(255) NOT NULL,
  `shipping_last_name` varchar(255) NOT NULL,
  `shipping_company` varchar(255) DEFAULT NULL,
  `shipping_address1` varchar(255) NOT NULL,
  `shipping_address2` varchar(255) DEFAULT NULL,
  `shipping_city` varchar(255) NOT NULL,
  `shipping_state` varchar(255) DEFAULT '',
  `shipping_zip` varchar(255) DEFAULT NULL,
  `shipping_country` varchar(255) DEFAULT NULL,
  `shipping_phone` varchar(255) DEFAULT NULL,
  `billing_first_name` varchar(255) NOT NULL,
  `billing_last_name` varchar(255) NOT NULL,
  `billing_company` varchar(255) DEFAULT NULL,
  `billing_address1` varchar(255) NOT NULL,
  `billing_address2` varchar(255) DEFAULT NULL,
  `billing_city` varchar(255) NOT NULL,
  `billing_state` varchar(255) DEFAULT '',
  `billing_zip` varchar(255) DEFAULT NULL,
  `billing_country` varchar(255) DEFAULT NULL,
  `billing_phone` varchar(255) DEFAULT NULL,
  `payment_method` varchar(50) NOT NULL,
  `payment_status` enum('pending','paid','failed','refunded') DEFAULT 'pending',
  `payment_transaction_id` varchar(255) DEFAULT NULL,
  `payment_provider` varchar(255) DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  `tax` decimal(15,2) NOT NULL,
  `shipping_cost` decimal(15,2) NOT NULL,
  `discount` decimal(15,2) DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `tracking_number` varchar(255) DEFAULT NULL,
  `shipping_provider` varchar(255) DEFAULT NULL,
  `estimated_delivery` datetime DEFAULT NULL,
  `discount_code_id` int(11) DEFAULT NULL COMMENT 'FK tới discount_codes',
  `cancelled_at` datetime DEFAULT NULL,
  `refunded_at` datetime DEFAULT NULL,
  `refund_amount` decimal(15,2) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_number` (`number`),
  UNIQUE KEY `number` (`number`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_created_at` (`created_at`),
  KEY `idx_orders_payment_status` (`payment_status`),
  KEY `idx_orders_deleted_at` (`deleted_at`),
  KEY `user_id` (`user_id`),
  KEY `discount_code_id` (`discount_code_id`),
  CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `orders_ibfk_4` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=247 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_attribute_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `attribute_group_id` int(11) NOT NULL,
  `is_required` tinyint(1) DEFAULT 0,
  `sort_order` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_attribute_groups` (`product_id`,`attribute_group_id`),
  KEY `attribute_group_id` (`attribute_group_id`),
  CONSTRAINT `product_attribute_groups_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_attribute_groups_ibfk_4` FOREIGN KEY (`attribute_group_id`) REFERENCES `attribute_groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_attributes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('color','size','material','custom') NOT NULL DEFAULT 'custom',
  `values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`values`)),
  `required` tinyint(1) DEFAULT 0,
  `sort_order` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_attributes_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pcat_product_category` (`product_id`,`category_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `product_categories_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_categories_ibfk_4` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `variant_id` int(11) DEFAULT NULL,
  `image_url` varchar(512) NOT NULL,
  `is_thumbnail` tinyint(1) DEFAULT 0,
  `color` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_deleted_at` (`deleted_at`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `product_images_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_images_ibfk_4` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1314 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_reviews` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `variant_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `rating` int(11) NOT NULL,
  `content` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `likes` int(11) DEFAULT 0,
  `dislikes` int(11) DEFAULT 0,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  PRIMARY KEY (`id`),
  KEY `variant_id` (`variant_id`),
  KEY `product_id` (`product_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `product_reviews_ibfk_1` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `product_reviews_ibfk_4` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_reviews_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_specifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `category` varchar(255) DEFAULT 'General',
  `sort_order` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `value_en` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_specifications_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_variants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `variant_name` varchar(255) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `price` decimal(15,2) DEFAULT NULL,
  `compare_at_price` decimal(15,2) DEFAULT NULL,
  `stock_quantity` int(11) DEFAULT 0,
  `is_default` tinyint(1) DEFAULT 0,
  `attributes` longtext DEFAULT NULL,
  `weight` decimal(10,3) DEFAULT NULL,
  `dimensions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`dimensions`)),
  `sort_order` int(11) DEFAULT 0,
  `is_available` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `attributes_en` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_variants_sku` (`sku`),
  UNIQUE KEY `sku` (`sku`),
  KEY `idx_product_variants_deleted_at` (`deleted_at`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_variants_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=463 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) DEFAULT NULL,
  `brand_id` int(11) DEFAULT NULL,
  `name_vi` varchar(200) NOT NULL,
  `name_en` varchar(200) DEFAULT NULL,
  `slug` varchar(100) NOT NULL,
  `base_name` varchar(255) DEFAULT NULL,
  `model` varchar(255) DEFAULT NULL,
  `base_price` decimal(15,2) DEFAULT NULL,
  `compare_at_price` decimal(15,2) DEFAULT NULL,
  `short_description_vi` text DEFAULT NULL,
  `short_description_en` text DEFAULT NULL,
  `description_vi` text DEFAULT NULL,
  `description_en` text DEFAULT NULL,
  `status` enum('active','inactive','draft','archived') DEFAULT 'active',
  `is_featured` tinyint(1) DEFAULT 0,
  `condition` varchar(20) DEFAULT 'new',
  `visibility` varchar(20) DEFAULT 'public',
  `tags` longtext DEFAULT NULL,
  `specifications` longtext DEFAULT NULL,
  `attributes` longtext DEFAULT NULL,
  `sold_count` int(11) DEFAULT 0,
  `view_count` int(11) DEFAULT 0,
  `rating_average` decimal(3,2) DEFAULT 0.00,
  `stock_quantity` int(11) NOT NULL DEFAULT 0,
  `shipping_info` longtext DEFAULT NULL,
  `seo_title_vi` varchar(500) DEFAULT NULL,
  `seo_title_en` varchar(500) DEFAULT NULL,
  `seo_description_vi` text DEFAULT NULL,
  `seo_description_en` text DEFAULT NULL,
  `seo_keywords` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `faqs` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_products_status` (`status`),
  KEY `idx_products_is_featured` (`is_featured`),
  KEY `category_id` (`category_id`),
  KEY `brand_id` (`brand_id`),
  CONSTRAINT `products_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `products_ibfk_4` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=425 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recently_viewed` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `viewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recently_viewed_user_product` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  KEY `idx_rvp_user_product` (`user_id`,`product_id`),
  CONSTRAINT `recently_viewed_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recently_viewed_ibfk_4` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `search_histories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `keyword` varchar(255) NOT NULL,
  `results_count` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `search_histories_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `avatar` varchar(512) DEFAULT NULL,
  `role` enum('customer','admin','manager') DEFAULT 'customer',
  `is_email_verified` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `otp_code` varchar(6) DEFAULT NULL,
  `otp_expires` datetime DEFAULT NULL,
  `reset_password_token` varchar(255) DEFAULT NULL,
  `reset_password_expires` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_google_id` (`google_id`),
  UNIQUE KEY `google_id` (`google_id`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=503 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wishlists` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlists_user_product` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `wishlists_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `wishlists_ibfk_4` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
