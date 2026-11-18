-- Yo'nalishlar (reysning ikkinchi uchidagi aeroport): aeroport kesimida, uch davr uchun (d30, ytd, ytdo)
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir,
                  (now() AT TIME ZONE 'UTC')::date AS bugun,
                  date_trunc('year', now() AT TIME ZONE 'UTC')::date AS yb),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt, coalesce(fl.airport, '-') AS bosh, coalesce(fl.direction_type, '-') AS yon,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','TVT','SRS','COH','OQN','MOK','OMN','AFS','CHI','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND fl.planned >= (p.yb - interval '1 year')
     AND fl.planned <  p.bugun
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.*, f.sch::date AS kun, p.bugun, p.yb,
         (NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir) AS ok,
         CASE WHEN coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) + coalesce(ps.ldm_pax_in,0) > 0
              THEN coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) + coalesce(ps.ldm_pax_in,0)
              ELSE coalesce(ps.pax_reg_ad,0) + coalesce(ps.pax_reg_ch,0) + coalesce(ps.pax_reg_in,0) END AS pax
    FROM f CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = f.id
),
h AS (
  SELECT g.*,
         kun >= bugun - 30 AS d30,
         kun >= yb AS ytd,
         kun >= (yb - interval '1 year')::date AND kun < (bugun - interval '1 year')::date AS ytdo
    FROM g
)
SELECT coalesce(json_agg(t ORDER BY t.ap, t.bosh), '[]'::json)
  FROM (
    SELECT ap, bosh, min(yon) AS yon,
           count(*) FILTER (WHERE d30 AND ok)               AS r_d30,
           coalesce(sum(pax) FILTER (WHERE d30 AND ok), 0)  AS p_d30,
           count(*) FILTER (WHERE ytd AND ok)               AS r_ytd,
           coalesce(sum(pax) FILTER (WHERE ytd AND ok), 0)  AS p_ytd,
           count(*) FILTER (WHERE ytdo AND ok)              AS r_ytdo,
           coalesce(sum(pax) FILTER (WHERE ytdo AND ok), 0) AS p_ytdo
      FROM h
     GROUP BY ap, bosh
    HAVING count(*) FILTER (WHERE (d30 OR ytd OR ytdo) AND ok) > 0
  ) t
