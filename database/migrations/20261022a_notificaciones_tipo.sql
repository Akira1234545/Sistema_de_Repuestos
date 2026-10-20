-- Add a notification type for relevant proposal-state transitions.
-- Run this migration separately before 20261022b_notificaciones.sql.
ALTER TYPE public.notification_type
    ADD VALUE IF NOT EXISTS 'cambio_estado_propuesta';
