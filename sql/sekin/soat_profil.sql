-- Oxirgi 28 kun: soatlar bo'yicha o'rtacha kunlik harakatlar (eng band soatlarni ko'rish uchun)
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir,
                  (now() AT TIME ZONE 'UTC')::date AS bugun),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.base_airport AS ap, fl.trans_type AS tt,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','SRS','COH','OQN','MOK','OMN','AFS','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.planned >= (p.bugun - 28)
     AND fl.planned <  p.bugun
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
)
SELECT coalesce(json_agg(t ORDER BY t.ap, t.tt, t.s), '[]'::json)
  FROM (
    SELECT f.ap, f.tt, extract(hour FROM f.sch)::int AS s, round(count(*) / 28.0, 2) AS o
      FROM f CROSS JOIN p
     WHERE NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir
     GROUP BY 1, 2, 3
  ) t
