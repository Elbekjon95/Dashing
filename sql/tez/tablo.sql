-- Bugungi barcha reyslar (11 ta aeroport): tablo ko'rinishi, holati va kechikishi bilan
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt, fl.airport AS bosh, fl.aircompany AS ak, fl.number AS nr,
         fl.direction_type AS yon, fl.service_type AS st, fl.aircraft_type AS vs, fl.terminal AS ter,
         fl.delaytl AS kod, fl.delaytl_service AS xiz, fl.fids_status AS fids,
         fl.planned AS sch,
         fl.estimated AS est,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','SRS','COH','OQN','MOK','OMN','AFS','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.planned >= p.hozir::date
     AND fl.planned <  (p.hozir::date + 1)
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
)
SELECT coalesce(json_agg(t ORDER BY t.sch, t.ap), '[]'::json)
  FROM (
    SELECT f.ap, f.tt, f.bosh, f.ak, f.nr, f.yon, f.st, f.vs, f.ter, f.kod, f.xiz, f.fids,
           to_char(f.sch, 'HH24:MI') AS sch,
           to_char(f.est, 'HH24:MI') AS est,
           CASE WHEN f.fct <= p.hozir THEN to_char(f.fct, 'HH24:MI') END AS fct,
           CASE WHEN f.bekor THEN 'bekor'
                WHEN f.fct IS NOT NULL AND f.fct <= p.hozir THEN 'bajarildi'
                WHEN coalesce(f.est, f.sch) > f.sch + interval '15 minutes' OR p.hozir > f.sch + interval '15 minutes' THEN 'kechikmoqda'
                ELSE 'kutilmoqda' END AS holat,
           CASE WHEN f.fct IS NOT NULL AND f.fct <= p.hozir THEN round(extract(epoch FROM f.fct - f.sch) / 60)
                WHEN NOT f.bekor THEN greatest(round(extract(epoch FROM coalesce(f.est, f.sch) - f.sch) / 60),
                                               round(extract(epoch FROM p.hozir - f.sch) / 60)) END AS kech,
           coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) AS pax
      FROM f CROSS JOIN p
      LEFT JOIN passengers ps ON ps.flight_id = f.id
  ) t
