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
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal2'),'iss','https://example.supabase.co/auth/v1')$$;
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
    await assert.rejects(() => query(`UPDATE vehiculos SET anio=2021 WHERE id='${id.vehicle}'`), /historial/)
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
    await db.exec(`UPDATE usuarios SET activo=false WHERE id='${id.owner}'`)
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
