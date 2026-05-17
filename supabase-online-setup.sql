-- ═══════ VOLTWAY — ATIVAR REPORTES ONLINE ═══════
-- Correr UMA VEZ no SQL Editor do Supabase (o mesmo projeto da app).
-- Depois disto, a app liga-se sozinha ao Realtime no arranque e os
-- reportes de outros utilizadores aparecem ao vivo. É re-executavel.

-- 1. Permitir reportes para qualquer posto (incl. Open Charge Map).
--    Remove a foreign key que exigia o posto na tabela `stations`.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_station_id_fkey;

-- 2. Guardar a reputacao de quem reporta (ponderacao entre utilizadores).
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_points INTEGER DEFAULT 0;

-- 3. Preencher reporter_points NO SERVIDOR a partir do perfil do utilizador,
--    para a reputacao nao poder ser falsificada pelo cliente.
CREATE OR REPLACE FUNCTION set_reporter_points()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(points, 0) INTO NEW.reporter_points
  FROM profiles WHERE id = NEW.user_id;
  NEW.reporter_points := COALESCE(NEW.reporter_points, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS reports_reporter_points ON reports;
CREATE TRIGGER reports_reporter_points
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION set_reporter_points();

-- 4. Ativar o Supabase Realtime na tabela `reports`.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reports;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- ja estava ativo
END $$;
