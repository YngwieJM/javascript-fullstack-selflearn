BEGIN;

INSERT INTO staff (name, email, password, role)
VALUES
  ('Manager', 'manager@example.com', '$2b$10$hGihKfWL1x9TgZ1kNGE8yutiTqSR7y8AbwEwILfa5V2nMLA0xJaKC', 'MANAGER'),
  ('John', 'john@example.com', '$2b$10$hGihKfWL1x9TgZ1kNGE8yutiTqSR7y8AbwEwILfa5V2nMLA0xJaKC', 'WAITER'),
  ('Anna', 'anna@example.com', '$2b$10$hGihKfWL1x9TgZ1kNGE8yutiTqSR7y8AbwEwILfa5V2nMLA0xJaKC', 'BARTENDER')
ON CONFLICT (email) DO NOTHING;

INSERT INTO restaurant_tables (table_number, capacity)
VALUES
  ('VIP1', 4),
  ('T1', 2)
ON CONFLICT (table_number) DO NOTHING;

INSERT INTO menu_items (name, category, price, is_available)
VALUES
  ('Burger', 'FOOD', 80, TRUE),
  ('Beer', 'DRINK', 35, TRUE)
ON CONFLICT (name) DO NOTHING;

COMMIT;
