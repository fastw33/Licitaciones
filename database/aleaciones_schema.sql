CREATE DATABASE IF NOT EXISTS metal_harvest_aleaciones
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE metal_harvest_aleaciones;

CREATE TABLE IF NOT EXISTS alloy_materials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(60) NULL,
  description TEXT NULL,
  conversion_mode ENUM('usd_eur_cop', 'usd_cop') NOT NULL DEFAULT 'usd_eur_cop',
  default_weight_kg DECIMAL(18, 6) NOT NULL DEFAULT 1,
  default_client_payment_pct DECIMAL(18, 8) NOT NULL DEFAULT 0.925,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alloy_materials_code (code),
  KEY idx_alloy_materials_active (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alloy_material_components (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_id BIGINT UNSIGNED NOT NULL,
  metal_name VARCHAR(120) NOT NULL,
  symbol VARCHAR(20) NULL,
  lme_metal_key VARCHAR(80) NULL,
  spect_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  paid_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  lme_usd_t DECIMAL(18, 2) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_alloy_components_material
    FOREIGN KEY (material_id) REFERENCES alloy_materials(id)
    ON DELETE CASCADE,
  KEY idx_alloy_components_material (material_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alloy_exchange_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rate_date DATE NOT NULL,
  usd_to_cop DECIMAL(18, 2) NOT NULL,
  usd_to_eur DECIMAL(18, 2) NOT NULL,
  eur_usd DECIMAL(18, 2) NOT NULL,
  eur_cop DECIMAL(18, 2) NOT NULL,
  source VARCHAR(160) NOT NULL,
  rate_signature CHAR(64) NULL,
  fetched_at DATETIME NOT NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alloy_exchange_rates_signature (source, rate_signature),
  KEY idx_alloy_exchange_rates_latest (rate_date DESC, fetched_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alloy_liquidation_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_id BIGINT UNSIGNED NULL,
  material_name VARCHAR(160) NOT NULL,
  conversion_mode ENUM('usd_eur_cop', 'usd_cop') NOT NULL DEFAULT 'usd_eur_cop',
  calculation_origin ENUM('manual', 'auto') NOT NULL DEFAULT 'manual',
  input_signature CHAR(64) NULL,
  weight_kg DECIMAL(18, 6) NOT NULL DEFAULT 0,
  client_payment_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  usd_to_cop DECIMAL(18, 2) NOT NULL,
  usd_to_eur DECIMAL(18, 2) NOT NULL,
  eur_usd DECIMAL(18, 2) NOT NULL,
  eur_cop DECIMAL(18, 2) NOT NULL,
  subtotal_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  payment_price_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  lot_value_cop DECIMAL(18, 2) NOT NULL DEFAULT 0,
  total_spect_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  total_recognized_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_alloy_results_material
    FOREIGN KEY (material_id) REFERENCES alloy_materials(id)
    ON DELETE SET NULL,
  KEY idx_alloy_results_created (created_at DESC),
  KEY idx_alloy_results_material (material_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE alloy_materials
  ADD COLUMN IF NOT EXISTS conversion_mode ENUM('usd_eur_cop', 'usd_cop') NOT NULL DEFAULT 'usd_eur_cop'
  AFTER description;

ALTER TABLE alloy_materials
  ADD COLUMN IF NOT EXISTS default_weight_kg DECIMAL(18, 6) NOT NULL DEFAULT 1
  AFTER conversion_mode;

ALTER TABLE alloy_materials
  ADD COLUMN IF NOT EXISTS default_client_payment_pct DECIMAL(18, 8) NOT NULL DEFAULT 0.925
  AFTER default_weight_kg;

ALTER TABLE alloy_liquidation_results
  ADD COLUMN IF NOT EXISTS conversion_mode ENUM('usd_eur_cop', 'usd_cop') NOT NULL DEFAULT 'usd_eur_cop'
  AFTER material_name;

ALTER TABLE alloy_liquidation_results
  ADD COLUMN IF NOT EXISTS calculation_origin ENUM('manual', 'auto') NOT NULL DEFAULT 'manual'
  AFTER conversion_mode;

ALTER TABLE alloy_liquidation_results
  ADD COLUMN IF NOT EXISTS input_signature CHAR(64) NULL
  AFTER calculation_origin;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alloy_results_material_signature
  ON alloy_liquidation_results (material_id, input_signature);

ALTER TABLE alloy_exchange_rates
  ADD COLUMN IF NOT EXISTS rate_signature CHAR(64) NULL
  AFTER source;

DROP INDEX IF EXISTS uq_alloy_exchange_rates_day_source
  ON alloy_exchange_rates;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alloy_exchange_rates_signature
  ON alloy_exchange_rates (source, rate_signature);

CREATE TABLE IF NOT EXISTS alloy_liquidation_result_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  result_id BIGINT UNSIGNED NOT NULL,
  metal_name VARCHAR(120) NOT NULL,
  symbol VARCHAR(20) NULL,
  lme_metal_key VARCHAR(80) NULL,
  spect_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  paid_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  lme_usd_t DECIMAL(18, 2) NOT NULL DEFAULT 0,
  usd_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  eur_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  recognized_pct DECIMAL(18, 8) NOT NULL DEFAULT 0,
  base_value_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  recognized_value_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_alloy_result_items_result
    FOREIGN KEY (result_id) REFERENCES alloy_liquidation_results(id)
    ON DELETE CASCADE,
  KEY idx_alloy_result_items_result (result_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE alloy_material_components
  MODIFY COLUMN lme_usd_t DECIMAL(18, 2) NULL;

ALTER TABLE alloy_exchange_rates
  MODIFY COLUMN usd_to_cop DECIMAL(18, 2) NOT NULL,
  MODIFY COLUMN usd_to_eur DECIMAL(18, 2) NOT NULL,
  MODIFY COLUMN eur_usd DECIMAL(18, 2) NOT NULL,
  MODIFY COLUMN eur_cop DECIMAL(18, 2) NOT NULL;

ALTER TABLE alloy_liquidation_results
  MODIFY COLUMN usd_to_cop DECIMAL(18, 2) NOT NULL,
  MODIFY COLUMN usd_to_eur DECIMAL(18, 2) NOT NULL,
  MODIFY COLUMN eur_usd DECIMAL(18, 2) NOT NULL,
  MODIFY COLUMN eur_cop DECIMAL(18, 2) NOT NULL,
  MODIFY COLUMN subtotal_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN payment_price_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN lot_value_cop DECIMAL(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE alloy_liquidation_result_items
  MODIFY COLUMN lme_usd_t DECIMAL(18, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN usd_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN eur_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN base_value_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN recognized_value_cop_kg DECIMAL(18, 2) NOT NULL DEFAULT 0;
