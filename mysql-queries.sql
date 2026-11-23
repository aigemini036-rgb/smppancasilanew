-- ============================================================================
-- KUMPULAN QUERY CRUD MYSQL SIAP PAKAI - SMP PANCASILA PONOKAWAN
-- Database: u637089879_db_pancasila
-- ============================================================================

-- 1. QUERY PROFIL & PENGATURAN SEKOLAH (school_settings)
SELECT * FROM `school_settings` WHERE `id` = 'set-001' LIMIT 1;

UPDATE `school_settings`
SET
    `school_name` = 'SMP Pancasila Ponokawan',
    `phone` = '(031) 8971234 / 0812-3456-7890',
    `email` = 'info@smppancasilaponokawan.sch.id',
    `accreditation` = 'Akreditasi A',
    `total_students` = '450+',
    `updated_at` = NOW()
WHERE `id` = 'set-001';

-- 2. QUERY DATA PERSONEL: KEPALA SEKOLAH, GURU & STAF (people)
-- Ambil semua personel aktif yang dipublikasikan
SELECT `id`, `name`, `slug`, `position`, `category`, `subject`, `education`, `contact`, `website`
FROM `people`
WHERE `status` = 'active' AND `published` = 1
ORDER BY FIELD(`category`, 'kepala_sekolah', 'guru', 'staff'), `name` ASC;

-- Tambah atau perbarui data guru
INSERT INTO `people` (
    `id`, `name`, `slug`, `position`, `category`, `nip_nuptk`, `education`, `subject`, `short_bio`, `status`, `published`
) VALUES (
    'p-baru-001', 'Budi Santoso, S.Pd.', 'budi-santoso-spd', 'Guru IPA', 'guru',
    '19900101 202001 1 001', 'S1 Pendidikan IPA (UNESA)', 'Ilmu Pengetahuan Alam',
    'Pengajar IPA aktif dan pembina Olimpiade Sains Nasional.', 'active', 1
)
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `position` = VALUES(`position`),
    `subject` = VALUES(`subject`),
    `updated_at` = NOW();

-- 3. QUERY BERITA & ARTIKEL SEKOLAH (news)
SELECT `id`, `title`, `slug`, `category`, `author_name`, `published_at`, `created_at`
FROM `news`
WHERE `status` = 'published'
ORDER BY `created_at` DESC
LIMIT 10;

INSERT INTO `news` (`id`, `title`, `slug`, `content`, `author_id`, `author_name`, `category`, `status`, `published_at`)
VALUES (
    'n-baru-001',
    'Penerimaan Siswa Baru SMP Pancasila Ponokawan Dibuka',
    'penerimaan-siswa-baru-smp-pancasila-ponokawan',
    'Pendaftaran peserta didik baru tahun ajaran 2026/2027 resmi dibuka secara daring dan luring.',
    'adm-001',
    'Humas SMP Pancasila',
    'Berita Sekolah',
    'published',
    '23 Nov 2026'
);

-- 4. QUERY PENGUMUMAN & AGENDA (announcements & agendas)
SELECT * FROM `announcements` WHERE `status` = 'active' ORDER BY `start_date` DESC;
SELECT * FROM `agendas` ORDER BY `created_at` DESC;

-- 5. QUERY PRESTASI SEKOLAH & SISWA (achievements)
SELECT `a`.*, `p`.`name` AS `pembina_name`
FROM `achievements` `a`
LEFT JOIN `people` `p` ON `a`.`recipient_id` = `p`.`id`
WHERE `a`.`status` = 'published'
ORDER BY `a`.`year` DESC, `a`.`created_at` DESC;

-- 6. QUERY ALBUM & FOTO GALERI (galleries + gallery_images)
SELECT `g`.`id`, `g`.`title`, `g`.`description`, `g`.`cover_image`, COUNT(`gi`.`id`) AS `total_foto`
FROM `galleries` `g`
LEFT JOIN `gallery_images` `gi` ON `gi`.`gallery_id` = `g`.`id` AND `gi`.`status` = 'published'
WHERE `g`.`status` = 'published'
GROUP BY `g`.`id`, `g`.`title`, `g`.`description`, `g`.`cover_image`
ORDER BY `g`.`created_at` DESC;

-- 7. QUERY SARANA & FASILITAS (facilities)
SELECT `id`, `name`, `location`, `condition`, `specifications`, `status`
FROM `facilities`
WHERE `status` = 'published' AND `published` = 1
ORDER BY `created_at` DESC;

-- 8. QUERY RINGKASAN STATISTIK DASHBOARD
SELECT
    (SELECT COUNT(*) FROM `people` WHERE `category` = 'guru' AND `status` = 'active') AS `total_guru`,
    (SELECT COUNT(*) FROM `people` WHERE `category` = 'staff' AND `status` = 'active') AS `total_staf`,
    (SELECT COUNT(*) FROM `news` WHERE `status` = 'published') AS `total_berita`,
    (SELECT COUNT(*) FROM `announcements` WHERE `status` = 'active') AS `total_pengumuman`,
    (SELECT COUNT(*) FROM `achievements` WHERE `status` = 'published') AS `total_prestasi`,
    (SELECT COUNT(*) FROM `galleries` WHERE `status` = 'published') AS `total_album`,
    (SELECT COUNT(*) FROM `facilities` WHERE `status` = 'published') AS `total_fasilitas`;
