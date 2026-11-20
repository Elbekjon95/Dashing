-- 2024-yil yanvardan beri: oylar bo'yicha aeroport, uchish-qo'nish va yo'nalish turi (MVL/CIS/VVL) kesimida
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt, coalesce(fl.direction_type, '-') AS yon,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','SRS','COH','OQN','MOK','OMN','AFS','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.planned >= timestamp '2024-01-01'
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
         coalesce(ps.wgt_cargo, 0) AS yuk, coalesce(ps.wgt_mail, 0) AS pochta, coalesce(ps.wgt_baggage, 0) AS bagaj
    FROM f CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = f.id
)
SELECT coalesce(json_agg(t ORDER BY t.oy, t.ap, t.tt, t.yon), '[]'::json)
  FROM (
    SELECT to_char(sch, 'YYYY-MM') AS oy, ap, tt, yon,
           count(*)                                    AS rej,
           count(*) FILTER (WHERE bekor)               AS bek,
           count(*) FILTER (WHERE ok)                  AS baj,
           count(*) FILTER (WHERE ok AND kech > 15)    AS k15,
           coalesce(round(sum(kech) FILTER (WHERE ok AND kech > 15 AND kech < 1440)), 0) AS kd,
           coalesce(sum(pax) FILTER (WHERE ok), 0)     AS pax,
           coalesce(sum(yuk) FILTER (WHERE ok), 0)     AS yuk,
           coalesce(sum(pochta) FILTER (WHERE ok), 0)  AS poc,
           coalesce(sum(bagaj) FILTER (WHERE ok), 0)   AS bag
      FROM g
     GROUP BY 1, ap, tt, yon
  ) t
