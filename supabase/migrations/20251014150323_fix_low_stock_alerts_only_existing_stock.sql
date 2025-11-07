/*
  # Fix Low Stock Alerts to Only Show Existing Stock

  1. Changes
    - Update get_low_stock_products() function
    - Only show alerts for products that have actual stock records (not 0/null)
    - Only warn when existing stock is below minimum
    - Exclude products with no stock at all from warnings

  2. Logic
    - Use INNER JOIN instead of CROSS JOIN to only get existing stock records
    - Only show alerts where quantity > 0 AND quantity < minimum_stock
    - This prevents false alerts for products with no stock at locations
*/

-- Drop and recreate the function with corrected logic
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  sku text,
  category text,
  location_id uuid,
  location_name text,
  current_stock decimal,
  minimum_stock integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.category,
    l.id,
    l.name,
    s.quantity,
    p.minimum_stock
  FROM inventory_products p
  INNER JOIN inventory_stock s ON s.product_id = p.id
  INNER JOIN inventory_locations l ON l.id = s.location_id
  WHERE s.quantity > 0 AND s.quantity < p.minimum_stock
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;