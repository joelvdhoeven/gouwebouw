/*
  # Voeg Financieel Dashboard Module toe

  1. Wijzigingen
    - Voeg `module_financial_dashboard` kolom toe aan system_settings
    - Default waarde: true (aan)
    
  2. Beschrijving
    - Module voor financieel dashboard met omzet, profit en statistieken
    - Bevat piecharts, lijngrafieken en KPI's
    - Tijd filters: 1 dag, 7 dagen, 1 maand, kwartaal, 1 jaar
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_settings' 
    AND column_name = 'module_financial_dashboard'
  ) THEN
    ALTER TABLE system_settings 
    ADD COLUMN module_financial_dashboard boolean DEFAULT true;
  END IF;
END $$;