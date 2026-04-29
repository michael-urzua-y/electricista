from django.db import connection


def next_quote_number() -> str:
    with connection.cursor() as cursor:
        cursor.execute("SELECT nextval('quote_number_seq')")
        seq = cursor.fetchone()[0]
    return f"COT-{seq:04d}"
