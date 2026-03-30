BEGIN TRANSACTION;

UPDATE keychain
SET key = magic.hdr || key
FROM (SELECT decode('43525901','hex') AS hdr) AS magic;

UPDATE address
SET street_address = ARRAY(
    SELECT magic.hdr || elem
    FROM unnest(street_address) AS elem
)
FROM (SELECT decode('43525901','hex') AS hdr) AS magic
WHERE street_address IS NOT NULL;

UPDATE config
SET
    email = CASE WHEN email IS NOT NULL THEN magic.hdr || email ELSE NULL END,
    phone = CASE WHEN phone IS NOT NULL THEN magic.hdr || phone ELSE NULL END,
    header = CASE WHEN header IS NOT NULL THEN magic.hdr || header ELSE NULL END,
    payment_details = CASE WHEN payment_details IS NOT NULL THEN ARRAY(
        SELECT magic.hdr || elem
        FROM unnest(payment_details) AS elem
    ) ELSE NULL END,
    registration_number = CASE WHEN registration_number IS NOT NULL THEN ARRAY(
        SELECT magic.hdr || elem
        FROM unnest(registration_number) AS elem
    ) ELSE NULL END
FROM (SELECT decode('43525901','hex') AS hdr) AS magic
WHERE email IS NOT NULL
   OR phone IS NOT NULL
   OR header IS NOT NULL
   OR payment_details IS NOT NULL
   OR registration_number IS NOT NULL;

END TRANSACTION;