-- Reys turlari (IATA service type) va samolyot turlari: aeroport kesimida, d30 va ytd davrlari
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir,
                  (now() AT TIME ZONE 'UTC')::date AS bugun,
                  date_trunc('year', now() AT TIME ZONE 'UTC')::date AS yb),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.base_airport AS ap,
         coalesce(nullif(trim(fl.service_type), ''), '-') AS st,
         coalesce(nullif(trim(fl.aircraft_type), ''), '-') AS vs,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','TVT','SRS','COH','OQN','MOK','OMN','AFS','CHI','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND fl.planned >= least(p.yb, p.bugun - 30)
     AND fl.planned <  p.bugun
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.*, f.sch::date >= p.bugun - 30 AS d30, f.sch::date >= p.yb AS ytd
    FROM f CROSS JOIN p
   WHERE NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir
)
SELECT json_build_object(
  'st', (SELECT coalesce(json_agg(t ORDER BY t.ap, t.k), '[]'::json) FROM (
           SELECT ap, st AS k, count(*) FILTER (WHERE d30) AS d30, count(*) FILTER (WHERE ytd) AS ytd
             FROM g GROUP BY ap, st) t),
  'vs', (SELECT coalesce(json_agg(t ORDER BY t.ap, t.k), '[]'::json) FROM (
           SELECT ap, vs AS k, count(*) FILTER (WHERE d30) AS d30, count(*) FILTER (WHERE ytd) AS ytd
             FROM g GROUP BY ap, vs) t)
)
