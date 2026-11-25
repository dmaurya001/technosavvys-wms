-- Migration: Persist certificate PDF bytes in MySQL so Hostinger redeploys never lose uploaded PDFs
ALTER TABLE `certificates`
  ADD COLUMN IF NOT EXISTS `pdf_data` LONGBLOB DEFAULT NULL AFTER `score`;
