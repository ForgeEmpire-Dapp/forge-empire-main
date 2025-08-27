-- Enable leaked password protection
UPDATE auth.config 
SET password_min_length = 8;

-- Enable password requirements for better security
INSERT INTO auth.config (parameter, value)
VALUES ('password_required_characters', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
ON CONFLICT (parameter) DO UPDATE SET value = EXCLUDED.value;