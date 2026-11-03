-- Defense in depth: permissive legacy policies cannot widen these boundaries.
BEGIN;
DO $$
DECLARE item record; op text;
BEGIN
    FOR item IN SELECT * FROM (VALUES
      ('usuarios','id=auth.uid() OR public.is_admin()'),
      ('tiendas','usuario_id=auth.uid() OR public.is_admin()'),
      ('vehiculos','usuario_id=auth.uid() OR public.store_can_read_vehicle(id) OR public.is_admin()'),
      ('solicitudes','usuario_id=auth.uid() OR public.store_can_read_request(id) OR public.is_admin()'),
      ('propuestas','tienda_id=public.get_my_store_id() OR EXISTS(SELECT 1 FROM public.solicitudes s WHERE s.id=solicitud_id AND s.usuario_id=auth.uid()) OR public.is_admin()'),
      ('promociones','(estado=''activa'' AND fecha_inicio<=now() AND fecha_fin>now() AND public.store_is_eligible(tienda_id)) OR tienda_id=public.get_my_store_id() OR public.is_admin()'),
      ('resenas','usuario_id=auth.uid() OR EXISTS(SELECT 1 FROM public.tiendas t WHERE t.id=tienda_id AND t.usuario_id=auth.uid()) OR public.is_admin()'),
      ('notificaciones','usuario_id=auth.uid()'),('favoritos_tienda','usuario_id=auth.uid()'),
      ('favoritos_solicitud','usuario_id=auth.uid()'),('favoritos_promocion','usuario_id=auth.uid()')
    ) AS boundaries(tab,predicate) LOOP
      EXECUTE format('DROP POLICY IF EXISTS production_read_boundary ON public.%I',item.tab);
      EXECUTE format('CREATE POLICY production_read_boundary ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING(%s)',item.tab,item.predicate);
    END LOOP;
    FOR item IN SELECT * FROM (VALUES
      ('vehiculos','usuario_id=auth.uid() AND public.sprint1_role()=''cliente'''),
      ('solicitudes','usuario_id=auth.uid() AND public.sprint1_role()=''cliente'''),
      ('tiendas','usuario_id=auth.uid() AND public.sprint1_role()=''tienda'''),
      ('promociones','tienda_id=public.get_my_store_id() AND public.store_is_eligible(tienda_id)'),
      ('favoritos_tienda','usuario_id=auth.uid()'),('favoritos_solicitud','usuario_id=auth.uid()'),
      ('favoritos_promocion','usuario_id=auth.uid()')
    ) AS boundaries(tab,predicate) LOOP
      FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS production_%s_boundary ON public.%I',lower(op),item.tab);
        EXECUTE format('CREATE POLICY production_%s_boundary ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
          lower(op),item.tab,op,CASE WHEN op<>'INSERT' THEN 'USING('||item.predicate||')' ELSE '' END,
          CASE WHEN op<>'DELETE' THEN 'WITH CHECK('||item.predicate||')' ELSE '' END);
      END LOOP;
    END LOOP;
    FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      FOR item IN SELECT tab FROM unnest(ARRAY['usuarios','propuestas','tienda_categorias']) AS tab LOOP
        EXECUTE format('DROP POLICY IF EXISTS rpc_only_%s ON public.%I',lower(op),item.tab);
        EXECUTE format('CREATE POLICY rpc_only_%s ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
          lower(op),item.tab,op,CASE WHEN op<>'INSERT' THEN 'USING(false)' ELSE '' END,
          CASE WHEN op<>'DELETE' THEN 'WITH CHECK(false)' ELSE '' END);
      END LOOP;
    END LOOP;
END;
$$;
DROP POLICY IF EXISTS reportes_closed ON public.reportes;
CREATE POLICY reportes_closed ON public.reportes AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
COMMIT;
