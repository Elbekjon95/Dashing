-- Oxirgi 120 kun: kunlar bo'yicha aeroport va uchish-qo'nish kesimida
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','TVT','SRS','COH','OQN','MOK','OMN','AFS','CHI','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND fl.planned >= (p.hozir::date - 120)
     AND fl.planned <  (p.hozir::date + 1)
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.*,
         (NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir) AS ok,
         extract(epoch FROM f.fct - f.sch) / 60 AS kech,
         CASE WHEN coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) + coalesce(ps.ldm_pax_in,0) > 0
              THEN coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) + coalesce(ps.ldm_pax_in,0)
              ELSE coalesce(ps.pax_reg_ad,0) + coalesce(ps.pax_reg_ch,0) + coalesce(ps.pax_reg_in,0) END AS pax,
         coalesce(ps.wgt_cargo, 0) AS yuk, coalesce(ps.wgt_mail, 0) AS pochta
    FROM f CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = f.id
)
SELECT coalesce(json_agg(t ORDER BY t.kun, t.ap, t.tt), '[]'::json)
  FROM (
    SELECT to_char(sch::date, 'YYYY-MM-DD') AS kun, ap, tt,
           count(*)                                    AS rej,
           count(*) FILTER (WHERE bekor)               AS bek,
           count(*) FILTER (WHERE ok)                  AS baj,
           count(*) FILTER (WHERE ok AND kech > 15)    AS k15,
           coalesce(sum(pax) FILTER (WHERE ok), 0)     AS pax,
           coalesce(sum(yuk) FILTER (WHERE ok), 0)     AS yuk,
           coalesce(sum(pochta) FILTER (WHERE ok), 0)  AS poc
      FROM g
     GROUP BY sch::date, ap, tt
  ) t
