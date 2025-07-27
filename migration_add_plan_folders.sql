-- Миграция: Добавление системы папок для планов просмотра
-- Дата: 2025-01-27
-- Описание: Создание таблицы папок и добавление связи с планами

-- Создание таблицы папок планов
CREATE TABLE `plan_folders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `order_index` int DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Добавление поля folder_id в таблицу plans
ALTER TABLE `plans` ADD COLUMN `folder_id` int DEFAULT NULL;

-- Добавление внешнего ключа для целостности данных
ALTER TABLE `plans` ADD CONSTRAINT `fk_plans_folder` 
FOREIGN KEY (`folder_id`) REFERENCES `plan_folders` (`id`) ON DELETE SET NULL;

-- Добавление индекса для оптимизации запросов
CREATE INDEX `idx_plans_folder_id` ON `plans` (`folder_id`);

-- Примеры папок для тестирования (опционально)
-- INSERT INTO `plan_folders` (`name`, `order_index`) VALUES 
-- ('Комедии', 1),
-- ('Драмы', 2),
-- ('Фантастика', 3),
-- ('Ужасы', 4);