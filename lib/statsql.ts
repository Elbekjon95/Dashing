// Maxsus davr statistikasi: ikki davr (joriy va solishtiriladigan) — bitta so'rovda.
// Parametrlar: $1=joriy davr boshi, $2=oxiri, $3=solishtirish boshi, $4=oxiri (YYYY-MM-DD, UTC kuni), $5=aeroport kodi yoki 'ALL'.
// Hisob qoidalari bugungi dashboard bilan bir xil: UTC kuni, `planned` bo'yicha, o'chirilgan va takroriy yozuvlarsiz;
// "bajarilgan" = bekor qilinmagan va factual <= hozir; yo'lovchi = LDM bo'yicha, bo'lmasa ro'yxatdan o'tganlar.
export const AIRPORTS = ["TAS", "SKD", "UGC", "BHK", "NMA", "FEG", "NVI", "TMJ", "NCU", "KSQ", "AZN", "SRS", "COH", "OQN", "MOK", "OMN", "AFS", "RBZ", "IYO"];

export const STAT_SQL = `
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir, $1::date AS af, $2::date AS at, $3::date AS bf, $4::date AS bt, $5::text AS ap),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt, fl.airport AS bosh, nullif(trim(fl.aircompany), '') AS ak,
         coalesce(fl.direction_type, '-') AS dt, fl.planned::date AS kun, fl.planned, fl.factual,
         coalesce(fl.is_canceled, 0) = 1 AS bekor,
         nullif(trim(coalesce(fl.delaytl::text, '')), '') AS kod
    FROM flights fl, p
   WHERE fl.base_airport IN ('${AIRPORTS.join("','")}')
     AND (p.ap = 'ALL' OR fl.base_airport = p.ap)
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.trans_type IN (1, 2)
     AND ((fl.planned >= p.af AND fl.planned < p.at + 1) OR (fl.planned >= p.bf AND fl.planned < p.bt + 1))
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.kun, f.ap, f.tt, f.bosh, f.ak, f.dt, f.bekor, f.kod,
         (NOT f.bekor AND f.factual IS NOT NULL AND f.factual <= p.hozir) AS ok,
         extract(epoch FROM f.factual - f.planned) / 60 AS kech,
         coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) AS pax,
         coalesce(ps.wgt_cargo, 0) AS yuk, coalesce(ps.wgt_mail, 0) AS poc, coalesce(ps.wgt_baggage, 0) AS bag,
         CASE WHEN f.tt = 1 THEN coalesce(ps.total_fuel, 0) ELSE 0 END AS yoq,
         (f.kun BETWEEN p.af AND p.at) AS ina, (f.kun BETWEEN p.bf AND p.bt) AS inb
    FROM f CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = f.id
),
g2 AS (SELECT 'a'::text AS per, g.* FROM g WHERE ina UNION ALL SELECT 'b'::text, g.* FROM g WHERE inb),
m AS (
  SELECT per,
         count(*) FILTER (WHERE NOT bekor)                              AS rej,
         count(*) FILTER (WHERE ok)                                     AS baj,
         count(*) FILTER (WHERE bekor)                                  AS bek,
         coalesce(sum(pax) FILTER (WHERE NOT bekor), 0)                        AS pax,
         coalesce(sum(pax) FILTER (WHERE NOT bekor AND tt = 1), 0)             AS pax_dep,
         coalesce(sum(pax) FILTER (WHERE NOT bekor AND tt = 2), 0)             AS pax_arr,
         coalesce(sum(yuk) FILTER (WHERE ok), 0)                        AS yuk,
         coalesce(sum(poc) FILTER (WHERE ok), 0)                        AS poc,
         coalesce(sum(bag) FILTER (WHERE ok), 0)                        AS bag,
         coalesce(sum(yoq) FILTER (WHERE ok), 0)                        AS yoq,
         count(*) FILTER (WHERE ok AND tt = 1)                          AS ms,
         count(*) FILTER (WHERE ok AND tt = 1 AND kech <= 15)           AS ot,
         count(*) FILTER (WHERE ok AND tt = 1 AND kech > 15)            AS dl,
         coalesce(round(sum(kech) FILTER (WHERE ok AND tt = 1 AND kech > 15 AND kech < 1440)), 0) AS dm,
         count(*) FILTER (WHERE ok AND dt = 'VVL')                      AS ichki,
         count(*) FILTER (WHERE ok AND dt <> 'VVL')                     AS xalqaro
    FROM g2 GROUP BY per
)
SELECT json_build_object(
  'a', (SELECT row_to_json(m) FROM m WHERE per = 'a'),
  'b', (SELECT row_to_json(m) FROM m WHERE per = 'b'),
  'kunlar', json_build_object(
    'a', (SELECT coalesce(json_agg(json_build_array(to_char(kun, 'YYYY-MM-DD'), baj, pax, yk) ORDER BY kun), '[]'::json)
            FROM (SELECT kun, count(*) FILTER (WHERE ok) AS baj, coalesce(sum(pax) FILTER (WHERE NOT bekor), 0) AS pax, coalesce(sum(yuk + poc) FILTER (WHERE ok), 0) AS yk FROM g2 WHERE per = 'a' GROUP BY kun) d),
    'b', (SELECT coalesce(json_agg(json_build_array(to_char(kun, 'YYYY-MM-DD'), baj, pax, yk) ORDER BY kun), '[]'::json)
            FROM (SELECT kun, count(*) FILTER (WHERE ok) AS baj, coalesce(sum(pax) FILTER (WHERE NOT bekor), 0) AS pax, coalesce(sum(yuk + poc) FILTER (WHERE ok), 0) AS yk FROM g2 WHERE per = 'b' GROUP BY kun) d)),
  'ak', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
           SELECT ak AS k,
                  count(*) FILTER (WHERE ok AND per = 'a') AS a_baj, count(*) FILTER (WHERE ok AND per = 'b') AS b_baj,
                  coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'a'), 0) AS a_pax, coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'b'), 0) AS b_pax
             FROM g2 WHERE ak IS NOT NULL GROUP BY ak
            ORDER BY greatest(count(*) FILTER (WHERE ok AND per = 'a'), count(*) FILTER (WHERE ok AND per = 'b')) DESC, ak LIMIT 15) t),
  'yon', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
           SELECT bosh AS k,
                  count(*) FILTER (WHERE ok AND per = 'a') AS a_baj, count(*) FILTER (WHERE ok AND per = 'b') AS b_baj,
                  coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'a'), 0) AS a_pax, coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'b'), 0) AS b_pax
             FROM g2 WHERE bosh IS NOT NULL GROUP BY bosh
            ORDER BY greatest(coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'a'), 0), coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'b'), 0)) DESC, bosh LIMIT 15) t),
  'ap', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
           SELECT ap AS k,
                  count(*) FILTER (WHERE ok AND per = 'a') AS a_baj, count(*) FILTER (WHERE ok AND per = 'b') AS b_baj,
                  coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'a'), 0) AS a_pax, coalesce(sum(pax) FILTER (WHERE NOT bekor AND per = 'b'), 0) AS b_pax
             FROM g2 GROUP BY ap
            ORDER BY greatest(count(*) FILTER (WHERE ok AND per = 'a'), count(*) FILTER (WHERE ok AND per = 'b')) DESC, ap) t),
  'sabab', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
           SELECT kod AS k, count(*) FILTER (WHERE per = 'a') AS a_n, count(*) FILTER (WHERE per = 'b') AS b_n
             FROM g2 WHERE kod IS NOT NULL AND NOT bekor GROUP BY kod
            ORDER BY greatest(count(*) FILTER (WHERE per = 'a'), count(*) FILTER (WHERE per = 'b')) DESC, kod LIMIT 10) t),
  'hozir', to_char((SELECT hozir FROM p), 'YYYY-MM-DD HH24:MI')
)
`;
