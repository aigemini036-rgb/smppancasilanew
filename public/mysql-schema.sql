-- ============================================================================
-- SKRIP SKEMA DATABASE MYSQL / MARIADB UNTUK SMP PANCASILA PONOKAWAN
-- Target Database: u637089879_db_pancasila (phpMyAdmin Hostinger / MySQL 8 / MariaDB)
-- Cara Pakai:
--   1. Buka phpMyAdmin -> pilih database "u637089879_db_pancasila"
--   2. Klik tab "SQL"
--   3. Tempel (Paste) seluruh isi skrip ini lalu klik "Go" / "Kirim"
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. TABEL PENGATURAN SEKOLAH (school_settings)
CREATE TABLE IF NOT EXISTS `school_settings` (
    `id` VARCHAR(64) NOT NULL DEFAULT 'set-001',
    `school_name` VARCHAR(255) NOT NULL DEFAULT 'SMP Pancasila Ponokawan',
    `logo` LONGTEXT NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `vision` TEXT NULL,
    `mission` TEXT NULL,
    `history` TEXT NULL,
    `operating_hours` VARCHAR(255) NULL,
    `npsn` VARCHAR(50) NULL,
    `accreditation` VARCHAR(100) NULL,
    `accreditation_label` VARCHAR(150) NULL,
    `total_students` VARCHAR(50) NULL,
    `stat_students_label` VARCHAR(150) NULL,
    `total_teachers` VARCHAR(50) NULL,
    `stat_teachers_label` VARCHAR(150) NULL,
    `total_achievements` VARCHAR(50) NULL,
    `stat_achievements_label` VARCHAR(150) NULL,
    `social_links` LONGTEXT NULL COMMENT 'JSON object: facebook, instagram, youtube, tiktok',
    `contact_other` TEXT NULL,
    `headmaster_section_background` LONGTEXT NULL,
    `headmaster_background_position` VARCHAR(32) NOT NULL DEFAULT 'center',
    `headmaster_background_opacity` DECIMAL(4,2) NOT NULL DEFAULT 0.15,
    `website_title` VARCHAR(255) NULL,
    `website_tagline` VARCHAR(255) NULL,
    `meta_description` TEXT NULL,
    `meta_keywords` TEXT NULL,
    `banner_announcement_enabled` TINYINT(1) NOT NULL DEFAULT 0,
    `banner_announcement_text` TEXT NULL,
    `banner_announcement_link` VARCHAR(500) NULL,
    `whatsapp_number` VARCHAR(50) NULL,
    `whatsapp_chat_widget_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `google_maps_embed` TEXT NULL,
    `footer_copyright` VARCHAR(255) NULL,
    `maintenance_mode` TINYINT(1) NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABEL PERSONEL (Kepala Sekolah, Guru, Staf TU)
CREATE TABLE IF NOT EXISTS `people` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `photo` LONGTEXT NULL,
    `position` VARCHAR(255) NOT NULL,
    `category` ENUM('kepala_sekolah', 'guru', 'staff') NOT NULL DEFAULT 'guru',
    `nip_nuptk` VARCHAR(100) NULL,
    `education` VARCHAR(255) NULL,
    `subject` VARCHAR(255) NULL,
    `education_history` TEXT NULL,
    `work_history` TEXT NULL,
    `short_bio` TEXT NULL,
    `contact` VARCHAR(255) NULL,
    `website` VARCHAR(500) NULL,
    `achievements_note` TEXT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `published` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_people_slug` (`slug`),
    KEY `idx_people_category_status` (`category`, `status`, `published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABEL BERITA / ARTIKEL (news)
CREATE TABLE IF NOT EXISTS `news` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `thumbnail` LONGTEXT NULL,
    `content` LONGTEXT NOT NULL,
    `author_id` VARCHAR(64) NOT NULL DEFAULT 'adm-001',
    `author_name` VARCHAR(255) NOT NULL DEFAULT 'Humas SMP Pancasila',
    `category` VARCHAR(100) NOT NULL DEFAULT 'Berita Sekolah',
    `status` ENUM('draft', 'published') NOT NULL DEFAULT 'published',
    `published_at` VARCHAR(100) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_news_slug` (`slug`),
    KEY `idx_news_status_category` (`status`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABEL PENGUMUMAN (announcements)
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `start_date` VARCHAR(50) NOT NULL,
    `end_date` VARCHAR(50) NULL,
    `attachment_url` LONGTEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_announcements_slug` (`slug`),
    KEY `idx_announcements_status` (`status`, `start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABEL AGENDA KEGIATAN (agendas)
CREATE TABLE IF NOT EXISTS `agendas` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `date` VARCHAR(100) NOT NULL,
    `location` VARCHAR(255) NULL,
    `status` VARCHAR(100) NOT NULL DEFAULT 'Akan Datang',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agendas_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABEL PRESTASI (achievements)
CREATE TABLE IF NOT EXISTS `achievements` (
    `id` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(150) NOT NULL,
    `level` ENUM('sekolah', 'individu') NOT NULL DEFAULT 'sekolah',
    `recipient_name` VARCHAR(255) NULL,
    `recipient_id` VARCHAR(64) NULL,
    `year` INT NOT NULL DEFAULT 2026,
    `documentation` LONGTEXT NULL,
    `status` ENUM('draft', 'published') NOT NULL DEFAULT 'published',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_achievements_slug` (`slug`),
    KEY `idx_achievements_year_level` (`year`, `level`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TABEL ALBUM GALERI (galleries)
CREATE TABLE IF NOT EXISTS `galleries` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `cover_image` LONGTEXT NULL,
    `status` ENUM('draft', 'published') NOT NULL DEFAULT 'published',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_galleries_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TABEL FOTO GALERI (gallery_images)
CREATE TABLE IF NOT EXISTS `gallery_images` (
    `id` VARCHAR(64) NOT NULL,
    `gallery_id` VARCHAR(64) NOT NULL,
    `image` LONGTEXT NOT NULL,
    `caption` TEXT NULL,
    `date` VARCHAR(100) NULL,
    `status` ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_gallery_images_gallery_id` (`gallery_id`, `status`),
    CONSTRAINT `fk_gallery_images_gallery`
        FOREIGN KEY (`gallery_id`) REFERENCES `galleries` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TABEL SARANA & FASILITAS (facilities)
CREATE TABLE IF NOT EXISTS `facilities` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `photo` LONGTEXT NULL,
    `image` LONGTEXT NULL,
    `location` VARCHAR(255) NULL,
    `condition` VARCHAR(255) NULL,
    `specifications` TEXT NULL,
    `status` ENUM('draft', 'published') NOT NULL DEFAULT 'published',
    `published` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_facilities_status` (`status`, `published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TABEL AKUN PENGGUNA ADMIN (admin_users)
CREATE TABLE IF NOT EXISTS `admin_users` (
    `id` VARCHAR(64) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NULL,
    `role` ENUM('superadmin', 'admin', 'editor', 'operator') NOT NULL DEFAULT 'editor',
    `avatar` LONGTEXT NULL,
    `phone` VARCHAR(50) NULL,
    `linked_person_id` VARCHAR(64) NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `last_login` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_admin_users_email` (`email`),
    KEY `idx_admin_users_role_status` (`role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. TABEL FILE MEDIA (media_files)
CREATE TABLE IF NOT EXISTS `media_files` (
    `id` VARCHAR(64) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` LONGTEXT NOT NULL,
    `file_type` VARCHAR(100) NOT NULL,
    `file_size` INT NOT NULL DEFAULT 0,
    `alt_text` VARCHAR(255) NULL,
    `uploaded_by` VARCHAR(100) NOT NULL DEFAULT 'Admin',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- DATA AWAL (SEED DATA) - AMAN DIJALANKAN BERULANG (INSERT IGNORE)
-- ============================================================================

INSERT IGNORE INTO `school_settings` (
    `id`, `school_name`, `logo`, `address`, `phone`, `email`,
    `operating_hours`, `npsn`, `accreditation`, `accreditation_label`,
    `total_students`, `stat_students_label`, `total_teachers`, `stat_teachers_label`,
    `total_achievements`, `stat_achievements_label`, `social_links`,
    `website_title`, `website_tagline`, `meta_description`, `whatsapp_number`,
    `footer_copyright`
) VALUES (
    'set-001',
    'SMP Pancasila Ponokawan',
    '/logo-smp-pancasila.png',
    'Jl. Raya Ponokawan No. 45, Desa Ponokawan, Kec. Krian, Kabupaten Sidoarjo, Jawa Timur 61262',
    '(031) 8971234 / 0812-3456-7890',
    'info@smppancasilaponokawan.sch.id',
    'Senin - Jumat: 07.00 - 15.15 WIB | Sabtu: 07.00 - 12.30 WIB',
    '20501234',
    'Akreditasi A',
    'Unggul & Terpuji',
    '450+',
    'Peserta Didik Aktif',
    '28+',
    'Guru & Tenaga Kependidikan',
    '50+',
    'Prestasi & Kejuaraan',
    '{"facebook":"https://facebook.com/smppancasilaponokawan","instagram":"https://instagram.com/smp_pancasila_ponokawan","youtube":"https://youtube.com/@smppancasilaponokawan","tiktok":""}',
    'SMP Pancasila Ponokawan - Krian, Sidoarjo',
    'Membentuk Generasi Berkarakter Pancasila & Unggul Prestasi',
    'Website resmi SMP Pancasila Ponokawan, Krian, Sidoarjo. Lembaga pendidikan menengah terakreditasi.',
    '6281234567890',
    'SMP Pancasila Ponokawan. Seluruh Hak Cipta Dilindungi.'
);

INSERT IGNORE INTO `admin_users` (`id`, `full_name`, `email`, `role`, `status`)
VALUES ('adm-001', 'Administrator Utama (Super Admin)', 'admin@smppancasilaponokawan.sch.id', 'superadmin', 'active');

INSERT IGNORE INTO `agendas` (`id`, `title`, `date`, `location`, `status`) VALUES
('ag-1', 'Ujian Tengah Semester (UTS) Genap', '02 - 07 Maret 2026', 'Ruang Kelas & Lab CBT', 'Akan Datang'),
('ag-2', 'Pondok Ramadhan 1447 H', '16 - 20 Maret 2026', 'Musholla Al-Hikmah', 'Akan Datang');
