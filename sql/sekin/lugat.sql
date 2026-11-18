-- Lug'atlar: aviakompaniya nomlari, aeroport nomlari va davlatlari, kechikish xizmatlari
-- Faqat oxirgi 2 yilda reyslarda uchragan kodlar olinadi
WITH ishlatilgan AS (
  SELECT DISTINCT airport AS k FROM flights WHERE schedule >= now() - interval '2 years' AND airport IS NOT NULL
  UNION
  SELECT DISTINCT base_airport FROM flights WHERE schedule >= now() - interval '2 years' AND base_airport IS NOT NULL
),
ak AS (
  SELECT DISTINCT ON (code) code, name
    FROM aircompanies
   WHERE code IS NOT NULL AND code <> '' AND code IN (SELECT DISTINCT aircompany FROM flights WHERE schedule >= now() - interval '2 years')
   ORDER BY code, updated_at DESC NULLS LAST, id DESC
),
ap AS (
  SELECT DISTINCT ON (k) k, name, name_eng, country_name
    FROM (SELECT a.code_iata AS k, a.name, a.name_eng, a.country_name, a.updated_at, a.id, 1 AS ustuvor FROM airports a
          UNION ALL
          SELECT a.code, a.name, a.name_eng, a.country_name, a.updated_at, a.id, 2 FROM airports a
          UNION ALL
          SELECT a.code_icao, a.name, a.name_eng, a.country_name, a.updated_at, a.id, 3 FROM airports a) x
   WHERE k IS NOT NULL AND k <> '' AND k IN (SELECT k FROM ishlatilgan)
   ORDER BY k, ustuvor, updated_at DESC NULLS LAST, id DESC
),
ks AS (
  SELECT DISTINCT ON (code) code, service
    FROM delay_services
   WHERE code IS NOT NULL AND code <> ''
   ORDER BY code, updated_at DESC NULLS LAST, id DESC
)
SELECT json_build_object(
  'ak', (SELECT coalesce(json_object_agg(code, name), '{}'::json) FROM ak),
  'ap', (SELECT coalesce(json_object_agg(k, json_build_object('n', name, 'e', name_eng, 'c', country_name)), '{}'::json) FROM ap),
  'ks', (SELECT coalesce(json_object_agg(code, service), '{}'::json) FROM ks)
)
