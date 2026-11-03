-- Read-only check: run as the project owner after applying migrations.
-- Every required RPC should have installed = true and its signature should
-- match the parameter names and types validated by tests/contracts.test.mjs.
WITH required(name) AS (
    VALUES
        ('admin_user_page'),
        ('get_dashboard_stats'),
        ('update_my_profile'),
        ('client_dashboard_stats'),
        ('store_dashboard_stats'),
        ('sprint3_admin_set_user_active'),
        ('sprint3_admin_get_system_settings'),
        ('guardar_configuracion_segura'),
        ('sprint3_admin_list_categories'),
        ('sprint3_admin_save_category'),
        ('sprint3_admin_list_requests'),
        ('sprint3_admin_list_promotions'),
        ('sprint3_admin_list_promotion_stores'),
        ('sprint3_admin_activity_report'),
        ('sprint3_admin_category_metrics'),
        ('catalog_names'),
        ('marcar_notificaciones_leidas'),
        ('promotion_page'),
        ('sprint2_crear_propuesta'),
        ('sprint2_seleccionar_propuesta'),
        ('retirar_propuesta'),
        ('my_review_page'),
        ('public_store_reviews'),
        ('sprint1_update_store_categories'),
        ('guardar_fotos_tienda'),
        ('queue_failed_uploads'),
        ('request_page'),
        ('confirmar_atencion'),
        ('sprint3_get_system_status'),
        ('sprint1_admin_review_store')
)
SELECT required.name,
       p.oid IS NOT NULL AS installed,
       CASE WHEN p.oid IS NULL THEN NULL
            ELSE pg_get_function_identity_arguments(p.oid)
       END AS actual_arguments
FROM required
LEFT JOIN LATERAL (
    SELECT proc.oid
    FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public'
      AND proc.proname = required.name
    ORDER BY proc.oid DESC
    LIMIT 1
) p ON TRUE
ORDER BY required.name;
