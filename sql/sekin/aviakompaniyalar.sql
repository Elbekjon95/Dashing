-- Aviakompaniyalar: aeroport kesimida, uch davr uchun
--   d30 = oxirgi 30 to'liq kun, ytd = yil boshidan kechagacha, ytdo = o'tgan yilning xuddi shu davri
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir,
                  (now() AT TIME ZONE 'UTC')::date AS bugun,
                  date_trunc('year', now() AT TIME ZONE 'UTC')::date AS yb),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt, coalesce(fl.aircompany, '-') AS ak,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor,
         -- reys turi (service_type): rp = muntazam yoʻlovchi (J, G, Q), rc = muntazam yuk/pochta (F, A, M, R),
         -- cp = charter yoʻlovchi (C, O), cc = charter yuk/pochta (H, L), bz = biznes/VIP/umumiy aviatsiya (N, E, D), ot = boshqa
         CASE WHEN upper(trim(fl.service_type)) IN ('J','G','Q') THEN 'rp'
              WHEN upper(trim(fl.service_type)) IN ('F','A','M','R') THEN 'rc'
              WHEN upper(trim(fl.service_type)) IN ('C','O') THEN 'cp'
              WHEN upper(trim(fl.service_type)) IN ('H','L') THEN 'cc'
              WHEN upper(trim(fl.service_type)) IN ('N','E','D') THEN 'bz' ELSE 'ot' END AS tp
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','SRS','COH','OQN','MOK','OMN','AFS','RBZ','IYO','CHI','TVT')
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.planned >= (p.yb - interval '1 year')
     AND fl.planned <  p.bugun
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.*, f.sch::date AS kun, p.bugun, p.yb,
         (NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir) AS ok,
         extract(epoch FROM f.fct - f.sch) / 60 AS kech,
         coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) AS pax,
         coalesce(ps.wgt_cargo, 0) + coalesce(ps.wgt_mail, 0) AS yuk
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
SELECT coalesce(json_agg(t ORDER BY t.ap, t.ak, t.tp), '[]'::json)
  FROM (
    SELECT ap, ak, tp,
           count(*) FILTER (WHERE d30 AND ok)              AS r_d30,
           coalesce(sum(pax) FILTER (WHERE d30 AND NOT bekor), 0) AS p_d30,
           count(*) FILTER (WHERE d30 AND ok AND tt = 1 AND kech > 15) AS k_d30,
           count(*) FILTER (WHERE d30 AND ok AND tt = 1)   AS u_d30,
           count(*) FILTER (WHERE d30 AND bekor)           AS b_d30,
           coalesce(sum(yuk) FILTER (WHERE d30 AND ok), 0) AS y_d30,
           count(*) FILTER (WHERE ytd AND ok)              AS r_ytd,
           coalesce(sum(pax) FILTER (WHERE ytd AND NOT bekor), 0) AS p_ytd,
           count(*) FILTER (WHERE ytd AND ok AND tt = 1 AND kech > 15) AS k_ytd,
           count(*) FILTER (WHERE ytd AND ok AND tt = 1)   AS u_ytd,
           count(*) FILTER (WHERE ytd AND bekor)           AS b_ytd,
           coalesce(sum(yuk) FILTER (WHERE ytd AND ok), 0) AS y_ytd,
           count(*) FILTER (WHERE ytdo AND ok)              AS r_ytdo,
           coalesce(sum(pax) FILTER (WHERE ytdo AND NOT bekor), 0) AS p_ytdo
      FROM h
     GROUP BY ap, ak, tp
    HAVING count(*) FILTER (WHERE (d30 OR ytd OR ytdo) AND ok) > 0
  ) t
