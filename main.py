import os
import psycopg2

database_url = 'postgresql://neondb_owner:npg_M3vNHcLF0Yew@ep-weathered-morning-aqyrfz91-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

conn = psycopg2.connect(database_url)

with conn.cursor() as cur:
  cur.execute("SELECT version()")
  print(cur.fetchone())


temp_manual = 22.5
umid_manual = 60.0
part_manual = 100.2
gas_manual = 17.0

# 2. Bloco de INSERÇÃO
with conn.cursor() as cur:
    comando_sql = """
        INSERT INTO monitorador_ambiente (TEMPERATURA, UMIDADE, PARTICULAS, GAS)
        VALUES (%s, %s, %s, %s)
    """
    cur.execute(comando_sql, (temp_manual, umid_manual, part_manual, gas_manual))
    conn.commit()
    print("Dado manual enviado com sucesso!")


with conn.cursor() as cur:
    # 1. Deleta a tabela antiga para resetar a estrutura

    cur.execute("SELECT * FROM monitorador_ambiente;")
    linhas = cur.fetchall()
    print("\n--- Dados atuais no Banco Neon ---")
    for linha in linhas:
        print(linha)
# Agora sim, se quiser fechar no final de TUDO:
conn.close()