-- One-time migration: unify Flow's till menu (menu_items) with the shop's
-- product catalog (products) into a single shared table.
--
-- Run once against an existing database that predates this change:
--   psql -d <your db> -f migrate_menu_to_products.sql
-- A brand-new database created via `python -m app.seed` needs this too if
-- it was ever seeded under the old two-catalog schema; a truly fresh
-- database (never seeded) doesn't need this file at all.

BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(30) UNIQUE;

-- Detach any existing test/demo products from orders rather than deleting
-- order history; order_items already snapshots name/price for its own display.
UPDATE order_items SET product_id = NULL WHERE product_id IN (SELECT id FROM products);
DELETE FROM product_photos WHERE product_id IN (SELECT id FROM products);
DELETE FROM products;

INSERT INTO products (id, slug, name, description, category, price, stock_qty, is_active, sort_order, created_at)
SELECT id, slug, name, description, category, price, stock_qty, true, sort_order, now()
FROM menu_items;

SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT COALESCE(MAX(id), 1) FROM products));

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_menu_item_id_fkey;
ALTER TABLE recipes ADD CONSTRAINT recipes_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES products(id);

ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_menu_item_id_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES products(id);

DROP TABLE menu_items;

COMMIT;
