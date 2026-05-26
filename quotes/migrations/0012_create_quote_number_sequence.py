from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('quotes', '0011_rename_smtp_password_field'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE SEQUENCE IF NOT EXISTS quote_number_seq;

            DO $$
            DECLARE
                max_quote_number bigint;
            BEGIN
                SELECT COALESCE(
                    MAX(substring(quote_number FROM '^COT-([0-9]+)$')::bigint),
                    0
                )
                INTO max_quote_number
                FROM quotes_quote
                WHERE quote_number ~ '^COT-[0-9]+$';

                IF max_quote_number > 0 THEN
                    PERFORM setval('quote_number_seq', max_quote_number, true);
                ELSE
                    PERFORM setval('quote_number_seq', 1, false);
                END IF;
            END $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
