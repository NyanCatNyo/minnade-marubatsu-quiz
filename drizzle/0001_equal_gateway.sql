ALTER TABLE `events` ADD `question_count` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `correct_choice` text;--> statement-breakpoint
UPDATE `questions` SET `correct_choice` = CASE WHEN `number` IN (5, 6, 9) THEN 'o' ELSE 'x' END WHERE `number` BETWEEN 1 AND 10;
