-- 20261125b_catalogo_bolivia (sesión 8, 25 nov 2026)
-- Segunda revisión del catálogo con lo que más circula en Bolivia:
--   * nuevo tipo «Minibús y bus» (transporte público: minibuses, micros y buses), que antes no tenía
--     dónde registrarse;
--   * Honda CG (la moto de trabajo más común), Toyota Spacio, Nissan AD Van y Hino 300/500.
-- Solo AÑADE filas, igual que 20261124b. Idempotente (ON CONFLICT DO NOTHING).

CREATE TEMP TABLE seed_catalogo_bolivia (tipo text NOT NULL, marca text NOT NULL, modelos text[] NOT NULL) ON COMMIT DROP;

INSERT INTO seed_catalogo_bolivia (tipo, marca, modelos) VALUES
('Minibús y bus', 'Toyota', ARRAY['Hiace', 'Coaster', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Nissan', ARRAY['Civilian', 'Caravan', 'Urvan', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Mitsubishi', ARRAY['Rosa', 'L300', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Hyundai', ARRAY['County', 'H-1', 'H350', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Mercedes-Benz', ARRAY['Sprinter', 'OF 1721', 'O 500', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Isuzu', ARRAY['Journey', 'NQR Bus', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Volkswagen', ARRAY['Crafter', 'Volksbus 9.160', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Foton', ARRAY['View', 'AUV', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'JAC', ARRAY['Sunray', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'King Long', ARRAY['XMQ6900', 'Kingo', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Yutong', ARRAY['ZK6118', 'ZK6908', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Golden Dragon', ARRAY['XML6127', 'Otro modelo (indícalo en la descripción)']),
('Minibús y bus', 'Otra marca', ARRAY['Otro modelo (indícalo en la descripción)']),
('Motocicleta', 'Honda', ARRAY['CG 125 Fan', 'CG 150 Titan', 'CG 150 Fan', 'CG 160 Titan', 'CG 160 Fan', 'CB 1', 'CBF 150']),
('Vagoneta', 'Toyota', ARRAY['Spacio', 'Sienta']),
('Vagoneta', 'Nissan', ARRAY['AD Van']),
('Camión', 'Hino', ARRAY['300', '500', 'Dutro']);

INSERT INTO public.tipos_vehiculo (nombre)
SELECT DISTINCT tipo FROM seed_catalogo_bolivia
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.marcas (nombre)
SELECT DISTINCT marca FROM seed_catalogo_bolivia
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.modelos (marca_id, tipo_vehiculo_id, nombre)
SELECT ma.id, t.id, m.modelo
FROM seed_catalogo_bolivia s
CROSS JOIN LATERAL unnest(s.modelos) AS m(modelo)
JOIN public.marcas ma ON ma.nombre = s.marca
JOIN public.tipos_vehiculo t ON t.nombre = s.tipo
ON CONFLICT (marca_id, tipo_vehiculo_id, nombre) DO NOTHING;
