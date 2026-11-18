-- One-off: give today's pushes (recorded before file types were tracked) their file kinds.
-- Computed from git: the files added/modified between each push and the one before it.
update public.pushes set files = '{"css":1,"ts":4,"sql":1}'::jsonb where delivery_id = '12bfce3c-e315-11f1-841e-487903736182'; -- 5aa5097
update public.pushes set files = '{"css":1,"ts":2}'::jsonb where delivery_id = '2dca853c-e315-11f1-8a00-e84a11d49482'; -- d88c302
update public.pushes set files = '{"ts":4}'::jsonb where delivery_id = '976d9754-e315-11f1-86ef-c49a538491f6'; -- 6672924
update public.pushes set files = '{"ts":2}'::jsonb where delivery_id = '0f652326-e316-11f1-9617-36832726845f'; -- 525c0c3
update public.pushes set files = '{"ts":1}'::jsonb where delivery_id = '63bd0928-e318-11f1-82b8-ed40a9fc7337'; -- bf8ca25
update public.pushes set files = '{"ts":2,"sql":1}'::jsonb where delivery_id = '78d3d378-e318-11f1-98ff-b54f720c9795'; -- ef17628
update public.pushes set files = '{"ts":2}'::jsonb where delivery_id = '89e3eb58-e318-11f1-8367-e16576c25ea9'; -- 80a8efc
update public.pushes set files = '{"ts":2,"css":1}'::jsonb where delivery_id = '2fd198bc-e319-11f1-9a52-fd7559c7c758'; -- d2244e0
