import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

async function setupDatabase() {
  const db = new PGlite()
    // Minimal Supabase schemas; no Auth, PostgREST, or Storage HTTP is simulated.
    await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}',email text,email_confirmed_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal2'),'iss','https://example.supabase.co/auth/v1',
        'amr',CASE WHEN current_setting('request.jwt.claim.reauth',true)='no' THEN jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint))
          ELSE jsonb_build_array(jsonb_build_object('method','totp','timestamp',extract(epoch from now())::bigint)) END)$$;
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
      GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`)
    await db.exec(await readFile('BD_Sistema_Repuestos.sql', 'utf8'))
    // Model the broad grants that a project may inherit; migrations must close them.
    await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated')

  return db
}

test('clean installation, authorization, request lifecycle and public projections', async () => {
  const db = await setupDatabase()
  const id = Object.fromEntries(['customer', 'other', 'owner', 'category', 'type', 'brand', 'model', 'vehicle', 'store', 'request', 'second', 'proposal', 'promotion'].map(k => [k, randomUUID()]))
  const query = async sql => (await db.query(sql)).rows
  const actor = async (uid, role = 'authenticated') => db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE ${role}`)
  try {
    const migrations = (await readdir('database/migrations')).filter(f => f.endsWith('.sql')).sort()
    for (const file of migrations) {
      try { await db.exec(await readFile(`database/migrations/${file}`, 'utf8')) }
      catch (cause) { throw new Error(`Migration failed: ${file}`, { cause }) }
    }
    // Corrective migrations must be safely repeatable.
    for (const file of migrations.filter(f => f >= '20261027')) {
      await db.exec(await readFile(`database/migrations/${file}`, 'utf8'))
    }
    const rpcPreflight = await query(await readFile('database/preflight_rpc.sql', 'utf8'))
    assert.ok(rpcPreflight.every(item => item.installed), 'remote RPC preflight must find every frontend RPC')
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES
      ('${id.customer}','{"role":"cliente"}'),('${id.other}','{"role":"superAdministrador"}'),('${id.owner}','{"role":"tienda"}');
      INSERT INTO categorias_repuesto(id,nombre) VALUES ('${id.category}','Frenos');
      INSERT INTO tipos_vehiculo(id,nombre) VALUES ('${id.type}','Auto');
      INSERT INTO marcas(id,nombre) VALUES ('${id.brand}','Marca');
      INSERT INTO modelos(id,marca_id,tipo_vehiculo_id,nombre) VALUES ('${id.model}','${id.brand}','${id.type}','Modelo');
      INSERT INTO vehiculos(id,usuario_id,tipo_vehiculo_id,marca_id,modelo_id,anio) VALUES ('${id.vehicle}','${id.customer}','${id.type}','${id.brand}','${id.model}',2020);
      INSERT INTO tiendas(id,usuario_id,nombre,estado) VALUES ('${id.store}','${id.owner}','Tienda','aprobada');
      INSERT INTO tienda_categorias(tienda_id,categoria_id) VALUES ('${id.store}','${id.category}');
      INSERT INTO solicitudes(id,usuario_id,vehiculo_id,categoria_id,titulo,descripcion) VALUES
      ('${id.request}','${id.customer}','${id.vehicle}','${id.category}','Frenos','Dos repuestos'),
      ('${id.second}','${id.customer}','${id.vehicle}','${id.category}','Otra solicitud','Descripción');
      INSERT INTO promociones(id,tienda_id,categoria_id,titulo,precio_anterior,precio_oferta,fecha_inicio,fecha_fin)
      VALUES ('${id.promotion}','${id.store}','${id.category}','Oferta',100,80,now()-interval '1 day',now()+interval '1 day');`)
    await actor(id.owner)
    await db.exec('RESET ROLE')
    assert.equal((await query(`SELECT rol::text AS role FROM usuarios WHERE id='${id.other}'`))[0].role,'cliente','signup metadata cannot grant admin roles')
    await actor(id.owner)
    await db.exec('RESET ROLE')
    await db.exec(`INSERT INTO storage.objects(bucket_id,name) VALUES('tiendas','${id.owner}/photo.jpg')`)
    await actor(id.owner)
    const url = `https://example.supabase.co/storage/v1/object/public/tiendas/${id.owner}/photo.jpg`
    await query(`SELECT guardar_fotos_tienda(ARRAY['${url}'],0)`)
    await assert.rejects(() => query(`SELECT guardar_fotos_tienda(ARRAY['${url.replace('example.supabase.co','other.test')}'],1)`), /no válida/)
    await assert.rejects(() => query(`SELECT guardar_fotos_tienda(ARRAY['${url}'],0)`), /otra sesión/)
    await assert.rejects(() => query(`SELECT guardar_fotos_tienda(ARRAY['https://other.test/file.jpg'],1)`), /no válida/)
    await query('SELECT guardar_fotos_tienda(ARRAY[]::text[],1)')
    await actor('', 'anon')
    await assert.rejects(() => query('SELECT * FROM storage_cleanup_jobs'), /permission denied/)
    await actor(id.owner)
    assert.equal((await query(`SELECT id FROM vehiculos WHERE id='${id.vehicle}'`)).length, 1, 'store sees only associated vehicle')
    await assert.rejects(() => query(`SELECT sprint2_crear_propuesta('${id.request}','NaN'::numeric,'Marca','Hoy')`), /precio/)
    const [created] = await query(`SELECT sprint2_crear_propuesta('${id.request}',120,'Marca','Hoy') AS id`)
    id.proposal = created.id
    await actor(id.customer)
    assert.equal((await query("SELECT id FROM request_page(false,'Dos repuestos')")).length, 1)
    await assert.rejects(() => query('SELECT id FROM request_page(true)'), /disponible/)
    await assert.rejects(() => query(`UPDATE solicitudes SET cantidad=3 WHERE id='${id.request}'`), /recibió propuestas/)
    await assert.rejects(() => query(`UPDATE vehiculos SET anio=2021 WHERE id='${id.vehicle}'`), /no se pueden cambiar/)
    await query(`UPDATE vehiculos SET descripcion='Color rojo' WHERE id='${id.vehicle}'`)
    const ownPhoto = `https://example.supabase.co/storage/v1/object/public/vehiculos/${id.customer}/${id.vehicle}.webp`
    await db.exec(`RESET ROLE; INSERT INTO storage.objects(bucket_id,name) VALUES('vehiculos','${id.customer}/${id.vehicle}.webp')`)
    await actor(id.customer)
    await query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['${ownPhoto}'],0)`)
    await assert.rejects(() => query(`UPDATE vehiculos SET fotos=ARRAY['https://evil.example/x.webp'] WHERE id='${id.vehicle}'`), /permission denied/, 'photos change only through the RPC')
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['https://evil.example/storage/v1/object/public/vehiculos/${id.customer}/${id.vehicle}.webp'],1)`), /no válida/)
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['${ownPhoto}','${ownPhoto}','${ownPhoto}','${ownPhoto}','${ownPhoto}'],1)`), /hasta 4/)
    await assert.rejects(() => query(`INSERT INTO solicitudes(usuario_id,vehiculo_id,categoria_id,titulo,descripcion) VALUES ('${id.customer}','${id.vehicle}','${id.category}','','')`), /request_text_valid/)
    await assert.rejects(() => query('SELECT sprint3_admin_list_users()'), /administrador/)
    await actor(id.other)
    await db.exec("SELECT set_config('request.jwt.claim.aal','aal1',false)")
    await assert.rejects(() => query('SELECT sprint3_admin_list_users()'), /administrador/)
    await assert.rejects(() => query(`SELECT sprint3_admin_set_user_active('${id.customer}',false)`), /segundo factor/)
    await db.exec("SELECT set_config('request.jwt.claim.aal','aal2',false)")
    assert.equal((await query(`SELECT id FROM solicitudes WHERE id='${id.request}'`)).length, 0)
    await assert.rejects(() => query(`SELECT confirmar_atencion('${id.request}')`), /disponible/)
    await db.exec('RESET ROLE')
    await db.exec(`UPDATE usuarios SET activo=false, motivo_estado='Cuenta de prueba suspendida' WHERE id='${id.owner}'`)
    await actor(id.owner)
    assert.equal((await query('SELECT id FROM propuestas')).length, 0)
    await assert.rejects(() => query(`SELECT sprint2_crear_propuesta('${id.second}',120,'Marca','Hoy')`), /activa/)
    await actor('', 'anon')
    assert.equal((await query('SELECT id FROM sprint2_tiendas_publicas')).length, 0)
    await assert.rejects(() => query('SELECT * FROM reportes'), /permission denied/)
    await db.exec('RESET ROLE')
    await db.exec(`UPDATE usuarios SET activo=true WHERE id='${id.owner}'; UPDATE tiendas SET estado='suspendida',activa=false WHERE id='${id.store}'`)
    await actor(id.customer)
    assert.equal((await query('SELECT id FROM promociones')).length, 0)
    await assert.rejects(() => query(`SELECT sprint2_seleccionar_propuesta('${id.request}','${id.proposal}')`), /disponible/)
    await actor(id.owner)
    assert.equal((await query(`UPDATE promociones SET titulo='Otra' WHERE id='${id.promotion}' RETURNING id`)).length, 0)
    await db.exec('RESET ROLE')
    await db.exec(`UPDATE tiendas SET estado='aprobada',activa=true WHERE id='${id.store}'`)
    await actor(id.customer)
    await query(`SELECT sprint2_seleccionar_propuesta('${id.request}','${id.proposal}')`)
    await assert.rejects(() => query(`INSERT INTO resenas(usuario_id,tienda_id,propuesta_id,calificacion) VALUES ('${id.customer}','${id.store}','${id.proposal}',5)`), /seleccionada|atendi/)
    await query(`SELECT confirmar_atencion('${id.request}')`)
    await query(`SELECT confirmar_atencion('${id.request}')`) // idempotent retry
    await query(`INSERT INTO resenas(usuario_id,tienda_id,propuesta_id,calificacion) VALUES ('${id.customer}','${id.store}','${id.proposal}',5)`)
    await actor(id.owner)
    assert.equal((await query(`SELECT id FROM solicitudes WHERE id='${id.request}'`)).length, 1, 'store retains its proposal history')
    await actor('', 'anon')
    await assert.rejects(() => query('SELECT usuario_id FROM resenas'), /permission denied/)
    await assert.rejects(() => query('SELECT sprint3_admin_list_users()'), /permission denied/, 'anonymous visitors cannot reach admin RPCs')
    await assert.rejects(() => query('SELECT registrar_historial_solicitud()'), /permission denied/, 'trigger functions are not RPCs')
    await actor(id.customer)
    await assert.rejects(() => query(`UPDATE sprint2_tienda_contacto SET telefono='70000000' WHERE id='${id.store}'`), /permission denied|cannot update view/, 'public views are read-only')
    await assert.rejects(() => query(`DELETE FROM sprint2_tienda_contacto WHERE id='${id.store}'`), /permission denied|cannot delete from view/)
    // Sesión 8: las 5 vistas son security_invoker y leen de funciones SECURITY DEFINER con los mismos filtros.
    const invokerViews = await query(`SELECT relname FROM pg_class WHERE relname IN ('sprint2_tiendas_publicas','sprint2_tienda_contacto','resenas_publicas','resenas_resumen','sprint3_resenas_tienda') AND 'security_invoker=true' = ANY(reloptions)`)
    assert.equal(invokerViews.length, 5, 'public views run with the caller permissions (no security_definer_view)')
    const contact = await query(`SELECT telefono, direccion FROM sprint2_tienda_contacto WHERE id='${id.store}'`)
    assert.equal(contact.length, 1, 'the client who selected the store sees its contact')
    assert.equal((await query('SELECT id FROM sprint3_resenas_tienda')).length, 0, 'clients do not see the store review inbox')
    await actor(id.owner)
    assert.equal((await query(`SELECT id FROM sprint2_tienda_contacto WHERE id='${id.store}'`)).length, 0, 'stores never read contacts through the client view')
    const inbox = await query('SELECT nombre_cliente FROM sprint3_resenas_tienda')
    assert.equal(inbox.length, 1, 'the owner store sees its reviews with the client name')
    await db.exec('RESET ROLE')
    const outsider = randomUUID()
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES ('${outsider}','{"role":"cliente"}')`)
    await actor(outsider)
    assert.equal((await query(`SELECT id FROM sprint2_tienda_contacto WHERE id='${id.store}'`)).length, 0, 'a client who did not select the store cannot see its contact')
    assert.equal((await query('SELECT id FROM sprint3_resenas_tienda')).length, 0)
    assert.equal((await query(`SELECT id FROM sprint2_tiendas_publicas WHERE id='${id.store}'`)).length, 1, 'approved stores stay public')
    await actor('', 'anon')
    await assert.rejects(() => query('SELECT id FROM sprint2_tienda_contacto'), /permission denied/, 'visitors never read store contacts')
    await assert.rejects(() => query('SELECT * FROM drivefix_tienda_contacto()'), /permission denied/)
    await assert.rejects(() => query('SELECT id FROM sprint3_resenas_tienda'), /permission denied/)
    await assert.rejects(() => query('SELECT * FROM drivefix_resenas_tienda_propia()'), /permission denied/)
    assert.deepEqual(Object.keys((await query('SELECT * FROM sprint2_tiendas_publicas'))[0]).sort(), ['descripcion', 'fotografias', 'horario', 'id', 'nombre', 'telefono'], 'only public store columns')
    await actor(id.customer)
    assert.equal((await query(`SELECT update_my_profile('Ana','Pérez','+591 70000000') AS ok`))[0].ok, true)
    await assert.rejects(() => query(`SELECT update_my_profile('','Pérez',NULL)`), /obligatorios/)
    await assert.rejects(() => query('SELECT get_dashboard_stats()'), /administrador/)
    const clientStats = (await query('SELECT * FROM client_dashboard_stats()'))[0]
    assert.equal(Number(clientStats.vehiculos), 1, 'client dashboard counts only own vehicles')
    await assert.rejects(() => query('SELECT * FROM store_dashboard_stats()'), /Cuenta no disponible/)
    await assert.rejects(() => query('SELECT claim_storage_cleanup(1)'), /permission denied/, 'cleanup queue is server-only')
    await actor('', 'anon')
    assert.equal((await query('SELECT id FROM resenas_publicas')).length, 1)
    assert.equal((await query(`SELECT total FROM public_store_reviews(ARRAY['${id.store}'::uuid])`))[0].total, '1')
    assert.equal((await query('SELECT total FROM resenas_resumen'))[0].total, 1)
    await db.exec('RESET ROLE')
    await db.exec(`UPDATE usuarios SET rol='administrador' WHERE id='${id.other}'`)
    await actor(id.other)
    await db.exec("SELECT set_config('request.jwt.claim.aal','aal1',false)")
    await assert.rejects(() => query('SELECT sprint3_admin_list_users()'), /administrador/)
    await assert.rejects(() => query(`SELECT sprint3_admin_set_user_active('${id.customer}',false)`), /segundo factor/)
    await assert.rejects(() => query(`SELECT sprint1_admin_review_store('${id.store}','aprobar',NULL)`), /segundo factor/)
    await db.exec("SELECT set_config('request.jwt.claim.aal','aal2',false)")
    await query(`SELECT sprint1_admin_review_store('${id.store}','aprobar',NULL)`)
    assert.equal((await query(`SELECT estado::text AS status FROM tiendas WHERE id='${id.store}'`))[0].status,'aprobada')
    // Sesión 8: desactivar exige motivo y una verificación reciente (huella, passkey o código).
    await assert.rejects(() => query(`SELECT sprint3_admin_set_user_active('${id.customer}',false)`), /motivo/)
    await db.exec("SELECT set_config('request.jwt.claim.reauth','no',false)")
    await assert.rejects(() => query(`SELECT drivefix_admin_set_user_active('${id.customer}',false,'Publica solicitudes falsas')`), /Confirma tu identidad/)
    await assert.rejects(() => query(`SELECT sprint1_admin_review_store('${id.store}','suspender','Prueba')`), /Confirma tu identidad/)
    // Una passkey usada hace poco (Supabase Auth → Passkeys) también vale; una antigua, no.
    await db.exec('RESET ROLE')
    await db.exec(`CREATE TABLE IF NOT EXISTS auth.webauthn_credentials (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, last_used_at timestamptz)`)
    await db.exec(`INSERT INTO auth.webauthn_credentials (user_id, last_used_at) VALUES ('${id.other}', now() - interval '10 minutes')`)
    await actor(id.other)
    assert.equal((await query('SELECT drivefix_reverificacion_reciente() AS ok'))[0].ok, false)
    await db.exec('RESET ROLE')
    await db.exec(`UPDATE auth.webauthn_credentials SET last_used_at = now() WHERE user_id = '${id.other}'`)
    await actor(id.other)
    assert.equal((await query('SELECT drivefix_reverificacion_reciente() AS ok'))[0].ok, true)
    await db.exec('RESET ROLE')
    await db.exec('DROP TABLE auth.webauthn_credentials')
    await actor(id.other)
    await db.exec("SELECT set_config('request.jwt.claim.reauth','',false)")
    await query(`SELECT drivefix_admin_set_user_active('${id.customer}',false,'Publica solicitudes falsas')`)
    assert.deepEqual((await query(`SELECT activo, motivo_estado FROM usuarios WHERE id='${id.customer}'`))[0], { activo: false, motivo_estado: 'Publica solicitudes falsas' })
    await query(`SELECT drivefix_admin_set_user_active('${id.customer}',true)`)
    assert.deepEqual((await query(`SELECT activo, motivo_estado FROM usuarios WHERE id='${id.customer}'`))[0], { activo: true, motivo_estado: null })
    const metrics = await query("SELECT sprint3_admin_category_metrics('2026-01-01','2026-12-31') AS data")
    assert.equal(metrics[0].data.categorias.total, '1')
    await assert.rejects(() => query("SELECT sprint3_admin_category_metrics('2026-12-31','2026-01-01')"), /periodo/)
    await assert.rejects(() => query("SELECT sprint3_admin_activity_report('2000-01-01','2026-01-01')"), /fecha/)
    assert.equal((await query('SELECT id FROM admin_user_page(NULL,0,2)')).length,2)
    const [settings] = await query('SELECT actualizado_en::text AS version FROM sprint3_admin_get_system_settings()')
    await query(`SELECT guardar_configuracion_segura('support@example.com',NULL,false,'Disponible','${settings.version}'::timestamptz)`)
    await assert.rejects(() => query(`SELECT guardar_configuracion_segura(NULL,NULL,true,'Mantenimiento','${settings.version}'::timestamptz)`), /cambió/)

    await actor(id.owner)
    assert.equal((await query('SELECT my_review_page() AS data'))[0].data.total,'1')
    await assert.rejects(() => query(`SELECT app_private.sprint2_crear_propuesta('${id.second}',1,'Marca','Hoy')`), /permission denied/)
    const [withdrawn] = await query(`SELECT sprint2_crear_propuesta('${id.second}',200,'Marca','Hoy') AS id`)
    await query(`SELECT retirar_propuesta('${withdrawn.id}')`)
    await query(`SELECT retirar_propuesta('${withdrawn.id}')`)
    assert.equal((await query(`SELECT estado FROM propuestas WHERE id='${withdrawn.id}'`))[0].estado,'retirada')

    // Even an unexpected permissive policy must not expose another profile.
    await db.exec(`RESET ROLE; CREATE POLICY unexpected_read ON public.usuarios FOR SELECT TO authenticated USING(true)`)
    await actor(id.owner)
    assert.equal((await query(`SELECT id FROM usuarios WHERE id='${id.customer}'`)).length,0)
    await db.exec(`RESET ROLE; UPDATE configuracion_sistema SET mantenimiento_activo=true WHERE id=1`)
    await actor(id.customer)
    await assert.rejects(() => query(`INSERT INTO solicitudes(usuario_id,vehiculo_id,categoria_id,titulo,descripcion) VALUES('${id.customer}','${id.vehicle}','${id.category}','Prueba','Descripción')`), /mantenimiento/)
    await db.exec(`RESET ROLE; UPDATE configuracion_sistema SET mantenimiento_activo=false WHERE id=1`)

    await db.exec(`INSERT INTO storage.objects(bucket_id,name) SELECT 'tiendas','${id.owner}/extra-'||n FROM generate_series(1,23) n`)
    await actor(id.owner)
    assert.equal((await query('SELECT store_upload_allowed() AS allowed'))[0].allowed,false)
    await db.exec(`RESET ROLE; DELETE FROM storage.objects WHERE name LIKE '${id.owner}/extra-%'`)
    await actor(id.owner)
    assert.equal((await query('SELECT store_upload_allowed() AS allowed'))[0].allowed,true)
    await query(`SELECT guardar_fotos_tienda(ARRAY['${url}'],2)`)
    await query(`SELECT queue_failed_uploads(ARRAY['${id.owner}/photo.jpg'])`)
    await actor('', 'service_role')
    assert.equal((await query('SELECT * FROM claim_storage_cleanup()')).length,0,'cleanup must preserve an attached photo')
    await actor(id.owner)
    await query('SELECT guardar_fotos_tienda(ARRAY[]::text[],3)')
    await query(`SELECT queue_failed_uploads(ARRAY['${id.owner}/photo.jpg'])`)
    await actor('', 'service_role')
    assert.equal((await query('SELECT * FROM claim_storage_cleanup()')).length,1)
    await actor(id.owner)
    await assert.rejects(() => query(`SELECT guardar_fotos_tienda(ARRAY['${url}'],4)`), /eliminación/)
  } finally { await db.close() }
})

test('upgrade preserves legacy data and selected reviews without rerunning the base schema', async () => {
  const db = await setupDatabase()
  const id = Object.fromEntries(['customer','owner','category','type','brand','model','vehicle','store','request','proposal','review'].map(key => [key,randomUUID()]))
  const files = (await readdir('database/migrations')).filter(file => file.endsWith('.sql')).sort()
  try {
    for (const file of files.filter(file => file < '20261027')) await db.exec(await readFile(`database/migrations/${file}`, 'utf8'))
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES ('${id.customer}','{"role":"cliente"}'),('${id.owner}','{"role":"tienda"}');
      INSERT INTO categorias_repuesto(id,nombre) VALUES ('${id.category}','Legacy');
      INSERT INTO tipos_vehiculo(id,nombre) VALUES ('${id.type}','Auto'); INSERT INTO marcas(id,nombre) VALUES ('${id.brand}','Marca');
      INSERT INTO modelos(id,marca_id,tipo_vehiculo_id,nombre) VALUES ('${id.model}','${id.brand}','${id.type}','Modelo');
      INSERT INTO vehiculos(id,usuario_id,tipo_vehiculo_id,marca_id,modelo_id,anio) VALUES ('${id.vehicle}','${id.customer}','${id.type}','${id.brand}','${id.model}',2020);
      INSERT INTO tiendas(id,usuario_id,nombre,estado) VALUES ('${id.store}','${id.owner}','','aprobada');
      INSERT INTO solicitudes(id,usuario_id,vehiculo_id,categoria_id,titulo,descripcion,estado) VALUES ('${id.request}','${id.customer}','${id.vehicle}','${id.category}','','Legacy request','propuesta_seleccionada');
      INSERT INTO propuestas(id,solicitud_id,tienda_id,precio,marca,disponibilidad,estado) VALUES ('${id.proposal}','${id.request}','${id.store}',120,'Marca','Hoy','aceptada');
      UPDATE solicitudes SET propuesta_seleccionada_id='${id.proposal}' WHERE id='${id.request}';
      SELECT set_config('request.jwt.claim.sub','${id.customer}',false);
      INSERT INTO resenas(id,usuario_id,tienda_id,propuesta_id,calificacion) VALUES ('${id.review}','${id.customer}','${id.store}','${id.proposal}',5);
      SELECT set_config('request.jwt.claim.sub','',false);`)
    for (const file of files.filter(file => file >= '20261027')) await db.exec(await readFile(`database/migrations/${file}`, 'utf8'))
    const request = (await db.query(`SELECT titulo,estado,propuesta_seleccionada_id FROM solicitudes WHERE id='${id.request}'`)).rows[0]
    assert.equal(request.titulo, '')
    assert.equal(request.estado, 'propuesta_seleccionada')
    assert.equal(request.propuesta_seleccionada_id,id.proposal)
    assert.equal((await db.query(`SELECT calificacion FROM resenas WHERE id='${id.review}'`)).rows[0].calificacion,5)
    assert.equal((await db.query(`SELECT fotografias_version FROM tiendas WHERE id='${id.store}'`)).rows[0].fotografias_version,0)
  } finally { await db.close() }
})

// Sesión 3b: E04+E44, E12, E15, E07+E42, E17, E37, E38 y E13 (filtro «Sin responder»).
test('session 3b: store review, cancelled selection, prices, vehicle photos, promotions and searches', async () => {
  const db = await setupDatabase()
  const keys = ['customer', 'customer2', 'admin', 'ownerA', 'ownerB', 'ownerC', 'ownerNew', 'category', 'type', 'brand', 'model',
    'vehicle', 'vehicle2', 'spare', 'storeA', 'storeB', 'storeC', 'request', 'request2', 'request3', 'promotion']
  const id = Object.fromEntries(keys.map(k => [k, randomUUID()]))
  const query = async sql => (await db.query(sql)).rows
  const actor = async (uid, role = 'authenticated') => db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE ${role}`)
  const asAdmin = async sql => { await db.exec('RESET ROLE'); return query(sql) }
  const state = async (table, rowId) => (await asAdmin(`SELECT estado::text AS s FROM ${table} WHERE id='${rowId}'`))[0].s
  const notes = async (uid, pattern) => (await asAdmin(`SELECT titulo, mensaje FROM notificaciones WHERE usuario_id='${uid}' AND tipo::text='${pattern}' ORDER BY fecha_creacion`))
  try {
    const migrations = (await readdir('database/migrations')).filter(f => f.endsWith('.sql')).sort()
    for (const file of migrations) await db.exec(await readFile(`database/migrations/${file}`, 'utf8'))
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES
      ('${id.customer}','{"role":"cliente"}'),('${id.customer2}','{"role":"cliente"}'),('${id.admin}','{"role":"cliente"}'),
      ('${id.ownerA}','{"role":"tienda"}'),('${id.ownerB}','{"role":"tienda"}'),('${id.ownerC}','{"role":"tienda"}'),('${id.ownerNew}','{"role":"tienda"}');
      UPDATE usuarios SET rol='superAdministrador' WHERE id='${id.admin}';
      INSERT INTO categorias_repuesto(id,nombre) VALUES ('${id.category}','Frenos');
      INSERT INTO tipos_vehiculo(id,nombre) VALUES ('${id.type}','Auto');
      INSERT INTO marcas(id,nombre) VALUES ('${id.brand}','Marca');
      INSERT INTO modelos(id,marca_id,tipo_vehiculo_id,nombre) VALUES ('${id.model}','${id.brand}','${id.type}','Modelo');
      INSERT INTO vehiculos(id,usuario_id,tipo_vehiculo_id,marca_id,modelo_id,anio) VALUES
        ('${id.vehicle}','${id.customer}','${id.type}','${id.brand}','${id.model}',2020),
        ('${id.vehicle2}','${id.customer2}','${id.type}','${id.brand}','${id.model}',2018),
        ('${id.spare}','${id.customer}','${id.type}','${id.brand}','${id.model}',2015);
      INSERT INTO tiendas(id,usuario_id,nombre,estado) VALUES ('${id.storeA}','${id.ownerA}','Tienda A','aprobada'),
        ('${id.storeB}','${id.ownerB}','Tienda B','aprobada'),('${id.storeC}','${id.ownerC}','Tienda C','aprobada');
      INSERT INTO tienda_categorias(tienda_id,categoria_id) VALUES ('${id.storeA}','${id.category}'),('${id.storeB}','${id.category}');
      INSERT INTO solicitudes(id,usuario_id,vehiculo_id,categoria_id,titulo,descripcion) VALUES
        ('${id.request}','${id.customer}','${id.vehicle}','${id.category}','Pastillas','Delanteras'),
        ('${id.request2}','${id.customer}','${id.vehicle}','${id.category}','Discos','Traseros'),
        ('${id.request3}','${id.customer2}','${id.vehicle2}','${id.category}','Zapatas','Cliente que se desactivará');
      INSERT INTO promociones(id,tienda_id,categoria_id,titulo,precio_anterior,precio_oferta,fecha_inicio,fecha_fin)
        VALUES ('${id.promotion}','${id.storeA}','${id.category}','Oferta',100,80,now()-interval '1 day',now()+interval '1 day');`)

    // E04 + E44: the admin rejects; the owner fixes the profile and the store goes back to review.
    await actor(id.admin)
    await query(`SELECT sprint1_admin_review_store('${id.storeC}','rechazar','Falta la dirección')`)
    assert.match((await notes(id.ownerC, 'cambio_estado_tienda')).at(-1).mensaje, /Falta la dirección/)
    await actor(id.ownerC)
    await query(`UPDATE tiendas SET direccion='Av. Siempre Viva 123' WHERE id='${id.storeC}'`)
    const resubmitted = (await asAdmin(`SELECT estado::text AS s, motivo_estado FROM tiendas WHERE id='${id.storeC}'`))[0]
    assert.deepEqual(resubmitted, { s: 'pendiente', motivo_estado: null }, 'a corrected rejected store returns to review')
    assert.equal((await notes(id.admin, 'cambio_estado_tienda')).at(-1).titulo, 'Tienda enviada a revisión')
    await actor(id.ownerC)
    await assert.rejects(() => query(`UPDATE tiendas SET estado='aprobada' WHERE id='${id.storeC}'`), /permission denied/)
    await actor(id.ownerNew)
    await query(`INSERT INTO tiendas(usuario_id,nombre) VALUES ('${id.ownerNew}','Tienda nueva')`)
    assert.ok((await notes(id.admin, 'cambio_estado_tienda')).some(n => n.titulo === 'Nueva tienda por revisar'))
    await actor(id.admin)
    await query(`SELECT sprint1_admin_review_store('${id.storeC}','aprobar',NULL)`)
    assert.equal((await notes(id.ownerC, 'cambio_estado_tienda')).at(-1).titulo, 'Tu tienda fue aprobada')

    // E15: an open proposal must cost more than 0 Bs.
    await actor(id.ownerA)
    await assert.rejects(() => query(`SELECT sprint2_crear_propuesta('${id.request}',0,'Bosch','Hoy')`), /mayor que 0/)
    await assert.rejects(() => query(`SELECT sprint2_crear_propuesta('${id.request}',-5,'Bosch','Hoy')`), /mayor que 0/)
    await assert.rejects(() => asAdmin(`INSERT INTO propuestas(solicitud_id,tienda_id,precio,marca,disponibilidad) VALUES ('${id.request2}','${id.storeB}',0,'X','Hoy')`), /propuestas_precio_positivo/)

    // E13: the "unanswered" filter runs in the server.
    await actor(id.ownerA)
    const [pa] = await query(`SELECT sprint2_crear_propuesta('${id.request}',150,'Bosch','Hoy') AS id`)
    const unanswered = (await query('SELECT id FROM request_page(p_available=>true,p_unanswered=>true)')).map(r => r.id)
    assert.ok(!unanswered.includes(id.request) && unanswered.includes(id.request2), 'answered requests leave the unanswered filter')
    assert.equal((await query('SELECT id FROM request_page(p_available=>true)')).length, 3)

    // E12: cancel a selection, choose again, and close from propuesta_seleccionada.
    await actor(id.ownerB)
    const [pb] = await query(`SELECT sprint2_crear_propuesta('${id.request}',140,'Brembo','Mañana') AS id`)
    await actor(id.customer)
    await assert.rejects(() => query(`SELECT cancelar_seleccion('${id.request}')`), /no tiene una propuesta seleccionada/)
    await query(`SELECT sprint2_seleccionar_propuesta('${id.request}','${pa.id}')`)
    assert.equal(await state('propuestas', pb.id), 'rechazada')
    await actor(id.ownerA)
    await assert.rejects(() => query(`SELECT cancelar_seleccion('${id.request}')`), /cuenta cliente/)
    await actor(id.customer2)
    await assert.rejects(() => query(`SELECT cancelar_seleccion('${id.request}')`), /no disponible/, 'only the owner cancels')
    await actor(id.customer)
    await query(`SELECT cancelar_seleccion('${id.request}')`)
    const reopened = (await asAdmin(`SELECT estado::text AS s, propuesta_seleccionada_id AS sel FROM solicitudes WHERE id='${id.request}'`))[0]
    assert.deepEqual(reopened, { s: 'recibiendo_propuestas', sel: null })
    assert.equal(await state('propuestas', pa.id), 'rechazada', 'the cancelled selection is rejected')
    assert.equal(await state('propuestas', pb.id), 'enviada', 'the other proposals compete again')
    assert.equal((await notes(id.ownerA, 'cambio_estado_propuesta')).at(-1).titulo, 'Selección cancelada')
    assert.equal((await notes(id.ownerB, 'cambio_estado_propuesta')).at(-1).titulo, 'Tu propuesta vuelve a competir')
    await actor(id.customer)
    assert.equal((await query(`SELECT id FROM sprint2_tienda_contacto WHERE id='${id.storeA}'`)).length, 0, 'contact access ends with the selection')
    await assert.rejects(() => query(`SELECT sprint2_seleccionar_propuesta('${id.request}','${pa.id}')`), /ya no está disponible/)
    await query(`SELECT sprint2_seleccionar_propuesta('${id.request}','${pb.id}')`)
    assert.equal((await query(`UPDATE solicitudes SET estado='cerrada' WHERE id='${id.request}' RETURNING id`)).length, 1, 'a selected request can be closed')
    assert.equal(await state('solicitudes', id.request), 'cerrada')
    assert.equal(await state('propuestas', pb.id), 'rechazada')
    assert.equal((await asAdmin(`SELECT count(*)::int AS n FROM selecciones_canceladas WHERE solicitud_id='${id.request}'`))[0].n, 2)
    await actor(id.customer)
    await assert.rejects(() => query('SELECT * FROM selecciones_canceladas'), /permission denied/)
    await assert.rejects(() => query(`UPDATE solicitudes SET estado='atendida' WHERE id='${id.request2}'`), /Transición/)

    // E07 + E42: vehicle photos (project host, ownership, version, quota, cleanup) and short notes.
    const base = `https://example.supabase.co/storage/v1/object/public/vehiculos/${id.customer}/`
    const files = [randomUUID(), randomUUID()]
    await actor(id.customer)
    for (const file of files) await query(`INSERT INTO storage.objects(bucket_id,name) VALUES('vehiculos','${id.customer}/${file}.webp')`)
    await assert.rejects(() => query(`INSERT INTO storage.objects(bucket_id,name) VALUES('vehiculos','${id.customer2}/${randomUUID()}.webp')`), /row-level security/)
    const [saved] = await query(`SELECT fotos_version FROM guardar_fotos_vehiculo('${id.vehicle}',ARRAY['${base}${files[0]}.webp'],0)`)
    assert.equal(saved.fotos_version, 1)
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['${base}${files[0]}.webp','${base}${files[1]}.webp'],0)`), /otra sesión/)
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['https://evil.example/storage/v1/object/public/vehiculos/${id.customer}/${files[1]}.webp'],1)`), /no válida/)
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['${base}${randomUUID()}.webp'],1)`), /no pertenece/)
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.spare}',ARRAY['${base}${files[0]}.webp'],0)`), /otro vehículo/)
    await actor(id.customer2)
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY[]::text[],1)`), /no pertenece/)
    await actor(id.customer)
    await assert.rejects(() => query(`UPDATE vehiculos SET descripcion=repeat('x',1001) WHERE id='${id.vehicle}'`), /vehicle_notes_length/)
    await query(`UPDATE vehiculos SET descripcion=repeat('x',1000) WHERE id='${id.vehicle}'`)
    await query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['${base}${files[1]}.webp'],1)`)
    await asAdmin(`UPDATE storage_cleanup_jobs SET available_after=now()-interval '1 minute'`)
    await actor('', 'service_role')
    const claimed = await query('SELECT bucket_id, path FROM claim_storage_cleanup(100)')
    assert.deepEqual(claimed.filter(job => job.bucket_id === 'vehiculos').map(job => job.path), [`${id.customer}/${files[0]}.webp`], 'only the detached photo is cleaned')
    await actor(id.customer)
    await assert.rejects(() => query(`SELECT guardar_fotos_vehiculo('${id.vehicle}',ARRAY['${base}${files[0]}.webp','${base}${files[1]}.webp'],2)`), /pendiente de eliminación/)
    await asAdmin(`INSERT INTO storage.objects(bucket_id,name) SELECT 'vehiculos','${id.customer}/extra-'||n FROM generate_series(1,13) n`)
    await actor(id.customer)
    assert.equal((await query('SELECT vehicle_upload_allowed() AS ok'))[0].ok, false, 'per-customer upload quota')
    await assert.rejects(() => query(`INSERT INTO storage.objects(bucket_id,name) VALUES('vehiculos','${id.customer}/${randomUUID()}.webp')`), /row-level security/)
    // E45: a vehicle without requests can be deleted and its photos are queued; one with requests stays.
    const spareFile = randomUUID()
    await actor(id.customer)
    await asAdmin(`DELETE FROM storage.objects WHERE name LIKE '${id.customer}/extra-%'`)
    await actor(id.customer)
    await query(`INSERT INTO storage.objects(bucket_id,name) VALUES('vehiculos','${id.customer}/${spareFile}.webp')`)
    await query(`SELECT guardar_fotos_vehiculo('${id.spare}',ARRAY['${base}${spareFile}.webp'],0)`)
    assert.equal((await query(`DELETE FROM vehiculos WHERE id='${id.vehicle}' RETURNING id`)).length, 0, 'vehicles with requests are kept')
    assert.equal((await query(`DELETE FROM vehiculos WHERE id='${id.spare}' RETURNING id`)).length, 1)
    const queued = (await asAdmin(`SELECT bucket_id, available_after<=now() AS ready FROM storage_cleanup_jobs WHERE path='${id.customer}/${spareFile}.webp'`))[0]
    assert.deepEqual(queued, { bucket_id: 'vehiculos', ready: true })

    // E17: promotion photos are not writable by stores, and any write path must use project URLs.
    await actor(id.ownerA)
    await assert.rejects(() => query(`UPDATE promociones SET fotografias=ARRAY['javascript:alert(1)'] WHERE id='${id.promotion}'`), /permission denied/)
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id.ownerA}',false)`)
    await assert.rejects(() => query(`UPDATE promociones SET fotografias=ARRAY['https://phishing.example/login'] WHERE id='${id.promotion}'`), /subirse desde la aplicación/)
    await query(`UPDATE promociones SET fotografias=ARRAY['https://example.supabase.co/storage/v1/object/public/tiendas/${id.ownerA}/a.webp'] WHERE id='${id.promotion}'`)
    await db.exec(`SELECT set_config('request.jwt.claim.sub','',false)`)

    // E37: % and _ are literal characters in searches.
    await actor(id.customer)
    assert.equal((await query(`SELECT id FROM request_page(false,'%')`)).length, 0)
    assert.equal((await query(`SELECT id FROM request_page(false,'_')`)).length, 0)
    assert.equal((await query(`SELECT id FROM request_page(false,'Disc')`)).length, 1)
    assert.equal((await query(`SELECT id FROM promotion_page(false,'%')`)).length, 0)
    assert.equal((await query(`SELECT id FROM promotion_page(false,'Ofer')`)).length, 1)
    await actor(id.admin)
    assert.equal((await query(`SELECT id FROM admin_user_page('%',0,26)`)).length, 0)
    assert.equal((await query(`SELECT id FROM sprint3_admin_list_requests(NULL,NULL,NULL,NULL,'_',25,0)`)).length, 0)

    // E38: a deactivated customer's open requests disappear for stores and cannot be quoted.
    await actor(id.ownerA)
    assert.ok((await query('SELECT id FROM request_page(true)')).some(r => r.id === id.request3))
    await asAdmin(`UPDATE usuarios SET activo=false, motivo_estado='Prueba de cuenta desactivada' WHERE id='${id.customer2}'`)
    await actor(id.ownerA)
    assert.ok(!(await query('SELECT id FROM request_page(true)')).some(r => r.id === id.request3))
    assert.equal((await query(`SELECT id FROM solicitudes WHERE id='${id.request3}'`)).length, 0)
    await assert.rejects(() => query(`SELECT sprint2_crear_propuesta('${id.request3}',100,'Bosch','Hoy')`), /ya no acepta propuestas/)
  } finally { await db.close() }
})

test('session 7: dashboard_series returns real daily counts per role, with zeros and the previous period', async () => {
  const db = await setupDatabase()
  const keys = ['customer', 'customer2', 'admin', 'owner', 'ownerIdle', 'category', 'other', 'type', 'brand', 'model', 'vehicle', 'vehicle2',
    'store', 'storeIdle', 'request', 'request2', 'old', 'foreign']
  const id = Object.fromEntries(keys.map(k => [k, randomUUID()]))
  const query = async sql => (await db.query(sql)).rows
  const actor = async (uid, role = 'authenticated') => db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE ${role}`)
  const series = async (uid, days) => { await actor(uid); return query(`SELECT serie, dia::text AS dia, total FROM dashboard_series(${days})`) }
  const today = async () => (await query(`SELECT (now() AT TIME ZONE 'America/La_Paz')::date::text AS d`))[0].d
  const at = (rows, name, day) => rows.find(r => r.serie === name && r.dia === day)?.total
  try {
    const migrations = (await readdir('database/migrations')).filter(f => f.endsWith('.sql')).sort()
    for (const file of migrations) await db.exec(await readFile(`database/migrations/${file}`, 'utf8'))
    await db.exec(await readFile('database/migrations/20261117_dashboard_series.sql', 'utf8')) // repeatable
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES
      ('${id.customer}','{"role":"cliente"}'),('${id.customer2}','{"role":"cliente"}'),('${id.admin}','{"role":"cliente"}'),
      ('${id.owner}','{"role":"tienda"}'),('${id.ownerIdle}','{"role":"tienda"}');
      UPDATE usuarios SET rol='administrador' WHERE id='${id.admin}';
      INSERT INTO categorias_repuesto(id,nombre) VALUES ('${id.category}','Frenos'),('${id.other}','Motor');
      INSERT INTO tipos_vehiculo(id,nombre) VALUES ('${id.type}','Auto');
      INSERT INTO marcas(id,nombre) VALUES ('${id.brand}','Marca');
      INSERT INTO modelos(id,marca_id,tipo_vehiculo_id,nombre) VALUES ('${id.model}','${id.brand}','${id.type}','Modelo');
      INSERT INTO vehiculos(id,usuario_id,tipo_vehiculo_id,marca_id,modelo_id,anio) VALUES
        ('${id.vehicle}','${id.customer}','${id.type}','${id.brand}','${id.model}',2020),
        ('${id.vehicle2}','${id.customer2}','${id.type}','${id.brand}','${id.model}',2019);
      INSERT INTO tiendas(id,usuario_id,nombre,estado) VALUES ('${id.store}','${id.owner}','Tienda','aprobada'),('${id.storeIdle}','${id.ownerIdle}','Pendiente','pendiente');
      INSERT INTO tienda_categorias(tienda_id,categoria_id) VALUES ('${id.store}','${id.category}'),('${id.storeIdle}','${id.category}');
      INSERT INTO solicitudes(id,usuario_id,vehiculo_id,categoria_id,titulo,descripcion) VALUES
        ('${id.request}','${id.customer}','${id.vehicle}','${id.category}','Pastillas','Delanteras'),
        ('${id.request2}','${id.customer}','${id.vehicle}','${id.category}','Discos','Traseros'),
        ('${id.foreign}','${id.customer2}','${id.vehicle2}','${id.other}','Bujías','Otra categoría');
      INSERT INTO solicitudes(id,usuario_id,vehiculo_id,categoria_id,titulo,descripcion,fecha_creacion) VALUES
        ('${id.old}','${id.customer}','${id.vehicle}','${id.category}','Filtro','Hace 10 días',now()-interval '10 days');`)
    await actor(id.owner)
    await query(`SELECT sprint2_crear_propuesta('${id.request}',150,'Bosch','Hoy')`)
    await query(`SELECT sprint2_crear_propuesta('${id.request2}',90,'Bosch','Mañana')`)
    const [chosen] = await query(`SELECT id FROM propuestas WHERE solicitud_id='${id.request}'`)
    await actor(id.customer)
    await query(`SELECT sprint2_seleccionar_propuesta('${id.request}','${chosen.id}')`)
    const day = await today()
    const oldDay = (await query(`SELECT ((now()-interval '10 days') AT TIME ZONE 'America/La_Paz')::date::text AS d`))[0].d

    // Validation and access.
    await actor(id.customer)
    await assert.rejects(() => query('SELECT * FROM dashboard_series(5)'), /7 o 30/)
    await assert.rejects(() => query('SELECT * FROM dashboard_series(NULL)'), /7 o 30/)
    await actor('', 'anon')
    await assert.rejects(() => query('SELECT * FROM dashboard_series(7)'), /permission denied/)

    // Client: 3 series × 14 days (this week and the previous one), only its own data.
    const client = await series(id.customer, 7)
    assert.equal(client.length, 3 * 14)
    assert.deepEqual([...new Set(client.map(r => r.serie))].sort(), ['propuestas_recibidas', 'solicitudes_atendidas', 'solicitudes_creadas'])
    assert.equal(at(client, 'solicitudes_creadas', day), 2)
    assert.equal(at(client, 'solicitudes_creadas', oldDay), 1, 'the previous period is included for the % change')
    assert.equal(at(client, 'propuestas_recibidas', day), 2)
    assert.equal(client.filter(r => r.dia !== day && r.dia !== oldDay).every(r => r.total === 0), true, 'days without events are 0')
    assert.equal((await series(id.customer2, 7)).find(r => r.serie === 'propuestas_recibidas' && r.dia === day).total, 0)

    // Store: requests in its categories, proposals sent and selected (dated by the history).
    const store = await series(id.owner, 30)
    assert.equal(store.length, 3 * 60)
    assert.equal(at(store, 'solicitudes_publicadas', day), 2, 'requests from other categories are not counted')
    assert.equal(at(store, 'solicitudes_publicadas', oldDay), 1)
    assert.equal(at(store, 'propuestas_enviadas', day), 2)
    assert.equal(at(store, 'propuestas_seleccionadas', day), 1)
    const idle = await series(id.ownerIdle, 7)
    assert.equal(idle.reduce((sum, r) => sum + r.total, 0), 0, 'a store under review sees no published requests')

    // Admin (aal2): platform-wide counts.
    const admin = await series(id.admin, 7)
    assert.deepEqual([...new Set(admin.map(r => r.serie))].sort(), ['propuestas_enviadas', 'solicitudes_creadas', 'tiendas_nuevas', 'usuarios_nuevos'])
    assert.equal(at(admin, 'usuarios_nuevos', day), 5)
    assert.equal(at(admin, 'tiendas_nuevas', day), 2)
    assert.equal(at(admin, 'solicitudes_creadas', day), 3)
    assert.equal(at(admin, 'propuestas_enviadas', day), 2)
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id.admin}',false); SELECT set_config('request.jwt.claim.aal','aal1',false); SET ROLE authenticated`)
    await assert.rejects(() => query('SELECT * FROM dashboard_series(7)'), /Cuenta no disponible/, 'admins need MFA (aal2)')
  } finally { await db.close() }
})
