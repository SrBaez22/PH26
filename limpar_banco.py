"""
Script de limpeza do banco de dados.
Execute: .venv\Scripts\python.exe limpar_banco.py
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def conectar():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"[ERRO] Nao foi possivel conectar ao banco: {e}")
        return None

def contar_registros(cur):
    cur.execute("SELECT COUNT(*) FROM monitorador_ambiente")
    return cur.fetchone()[0]

def main():
    conn = conectar()
    if not conn:
        return

    with conn.cursor() as cur:
        total = contar_registros(cur)
        print(f"\n{'='*45}")
        print(f"  Banco de Dados — monitorador_ambiente")
        print(f"{'='*45}")
        print(f"  Total de registros atual: {total:,}")
        print(f"{'='*45}")
        print("\nOpcoes de limpeza:")
        print("  1 - Deletar registros mais antigos que 7 dias")
        print("  2 - Deletar registros mais antigos que 30 dias")
        print("  3 - Manter apenas os ultimos 1.000 registros")
        print("  4 - Manter apenas os ultimos 500 registros")
        print("  5 - Apagar TODOS os registros (irreversivel)")
        print("  0 - Cancelar")
        print()

        opcao = input("Escolha uma opcao: ").strip()

        if opcao == "0":
            print("Cancelado.")
            return

        elif opcao == "1":
            cur.execute("DELETE FROM monitorador_ambiente WHERE created_at < NOW() - INTERVAL '7 days'")
            print("Deletando registros com mais de 7 dias...")

        elif opcao == "2":
            cur.execute("DELETE FROM monitorador_ambiente WHERE created_at < NOW() - INTERVAL '30 days'")
            print("Deletando registros com mais de 30 dias...")

        elif opcao == "3":
            cur.execute("""
                DELETE FROM monitorador_ambiente
                WHERE id NOT IN (
                    SELECT id FROM monitorador_ambiente ORDER BY id DESC LIMIT 1000
                )
            """)
            print("Mantendo apenas os ultimos 1.000 registros...")

        elif opcao == "4":
            cur.execute("""
                DELETE FROM monitorador_ambiente
                WHERE id NOT IN (
                    SELECT id FROM monitorador_ambiente ORDER BY id DESC LIMIT 500
                )
            """)
            print("Mantendo apenas os ultimos 500 registros...")

        elif opcao == "5":
            print("\n[ATENCAO] Esta acao apagara TODOS os registros e nao pode ser desfeita.")
            confirma = input("Digite 'CONFIRMAR' para prosseguir: ").strip()
            if confirma != "CONFIRMAR":
                print("Cancelado.")
                return
            cur.execute("TRUNCATE TABLE monitorador_ambiente RESTART IDENTITY")
            print("Tabela limpa.")

        else:
            print("Opcao invalida.")
            return

        conn.commit()
        restantes = contar_registros(cur)
        deletados = total - restantes
        print(f"\n[OK] Limpeza concluida!")
        print(f"     Registros deletados : {deletados:,}")
        print(f"     Registros restantes : {restantes:,}")

    conn.close()

if __name__ == "__main__":
    main()
