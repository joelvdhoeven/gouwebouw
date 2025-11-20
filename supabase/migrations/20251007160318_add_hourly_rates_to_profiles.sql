/*
  # Voeg uurtarieven toe aan profiles

  1. Wijzigingen
    - Voeg `hourly_rate_purchase` kolom toe aan profiles (inkoop tarief)
    - Voeg `hourly_rate_sale` kolom toe aan profiles (verkoop tarief)
    
  2. Opmerkingen
    - Beide velden zijn optioneel (nullable)
    - Decimale waarden met 2 decimalen voor nauwkeurigheid
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'hourly_rate_purchase'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hourly_rate_purchase DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'hourly_rate_sale'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hourly_rate_sale DECIMAL(10,2);
  END IF;
END $$;