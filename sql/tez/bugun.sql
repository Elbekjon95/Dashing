-- Bugun / kecha / bir hafta oldin / bir yil oldin (o'sha hafta kuni): aeroport va uchish-qo'nish kesimida
-- Kun = UTC kuni, `planned` ustuni bo'yicha (rahbariyatning Grafana dashboardi bilan bir xil). rej = jami reja, bekor qilinganlarsiz.
-- hz_* = kunning "hozirgi soatigacha" bo'lgan qismi (bugun bilan adolatli solishtirish uchun)
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir),
d AS (
  SELECT v.k, v.kun FROM p,
  LATERAL (VALUES ('bugun', p.hozir::date), ('kecha', p.hozir::date - 1), ('hafta', p.hozir::date - 7), ('yil', p.hozir::date - 364)) AS v(k, kun)
),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','TVT','SRS','COH','OQN','MOK','OMN','AFS','CHI','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND (fl.planned)::date IN (SELECT kun FROM d)
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.*, d.k, p.hozir,
         (NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir) AS ok,
         extract(epoch FROM f.fct - f.sch) / 60 AS kech,
         CASE WHEN coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) + coalesce(ps.ldm_pax_in,0) > 0
              THEN coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) + coalesce(ps.ldm_pax_in,0)
              ELSE coalesce(ps.pax_reg_ad,0) + coalesce(ps.pax_reg_ch,0) + coalesce(ps.pax_reg_in,0) END AS pax,
         coalesce(ps.wgt_cargo, 0) AS yuk, coalesce(ps.wgt_mail, 0) AS pochta, coalesce(ps.wgt_baggage, 0) AS bagaj
    FROM f
    JOIN d ON d.kun = f.sch::date
    CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = f.id
)
SELECT coalesce(json_agg(t ORDER BY t.k, t.ap, t.tt), '[]'::json)
  FROM (
    SELECT k, ap, tt,
           count(*) FILTER (WHERE NOT bekor)                AS rej,
           count(*) FILTER (WHERE bekor)                    AS bek,
           count(*) FILTER (WHERE ok)                       AS baj,
           count(*) FILTER (WHERE ok AND kech > 15)         AS k15,
           coalesce(round(sum(kech) FILTER (WHERE ok AND kech > 15 AND kech < 1440)), 0) AS kd,
           coalesce(sum(pax) FILTER (WHERE ok), 0)          AS pax,
           coalesce(sum(yuk) FILTER (WHERE ok), 0)          AS yuk,
           coalesce(sum(pochta) FILTER (WHERE ok), 0)       AS poc,
           coalesce(sum(bagaj) FILTER (WHERE ok), 0)        AS bag,
           count(*) FILTER (WHERE ok AND fct::time <= hozir::time AND fct::date = sch::date)  AS hz_baj,
           coalesce(sum(pax) FILTER (WHERE ok AND fct::time <= hozir::time AND fct::date = sch::date), 0) AS hz_pax
      FROM g
     GROUP BY k, ap, tt
  ) t
