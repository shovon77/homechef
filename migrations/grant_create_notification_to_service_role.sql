-- Allow service_role (used by Edge Functions) to call create_notification_for_user
GRANT EXECUTE ON FUNCTION create_notification_for_user(uuid, text, text, text, bigint, text) TO service_role;
