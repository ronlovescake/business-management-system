-- Create sorting_distributions table
CREATE TABLE IF NOT EXISTS sorting_distributions (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  product_code VARCHAR(100) NOT NULL,
  selected_quantity INTEGER,
  row_number INTEGER NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
  group_number VARCHAR(50) NOT NULL DEFAULT '',
  distribution DOUBLE PRECISION NOT NULL DEFAULT 0,
  checked BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT sorting_distributions_product_code_row_number_key UNIQUE (product_code, row_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sorting_distributions_product_code ON sorting_distributions(product_code);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sorting_distributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sorting_distributions_updated_at
  BEFORE UPDATE ON sorting_distributions
  FOR EACH ROW
  EXECUTE FUNCTION update_sorting_distributions_updated_at();
