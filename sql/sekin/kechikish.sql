-- Kechikish sabablari (IATA kodi va mas'ul xizmat): uchishlar bo'yicha, aeroport kesimida, d30 va ytd davrlari
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir,
                  (now() AT TIME ZONE 'UTC')::date AS bugun,
                  date_trunc('year', now() AT TIME ZONE 'UTC')::date AS yb),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.base_airport AS ap, fl.trans_type AS tt,
         coalesce(nullif(trim(fl.delaytl), ''), '-') AS kod,
         coalesce(nullif(trim(fl.delaytl_service), ''), '-') AS xiz,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','SRS','COH','OQN','MOK','OMN','AFS','RBZ','IYO','CHI','TVT')
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.trans_type = 1
     AND fl.planned >= least(p.yb, p.bugun - 30)
     AND fl.planned <  p.bugun
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.*, f.sch::date >= p.bugun - 30 AS d30, f.sch::date >= p.yb AS ytd,
         extract(epoch FROM f.fct - f.sch) / 60 AS kech
    FROM f CROSS JOIN p
   WHERE NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir
)
SELECT coalesce(json_agg(t ORDER BY t.ap, t.kod), '[]'::json)
  FROM (
    SELECT ap, kod, xiz,
           count(*) FILTER (WHERE d30 AND kech > 15) AS n_d30,
           coalesce(round(sum(kech) FILTER (WHERE d30 AND kech > 15 AND kech < 1440)), 0) AS m_d30,
           count(*) FILTER (WHERE ytd AND kech > 15) AS n_ytd,
           coalesce(round(sum(kech) FILTER (WHERE ytd AND kech > 15 AND kech < 1440)), 0) AS m_ytd
      FROM g
     GROUP BY ap, kod, xiz
    HAVING count(*) FILTER (WHERE kech > 15) > 0
  ) t
