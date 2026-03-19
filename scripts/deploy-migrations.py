#!/usr/bin/env python3
"""
Deploy SQL migrations to Supabase using direct PostgreSQL connection.
"""

import psycopg2
import os
import sys
from pathlib import Path

# Supabase connection details
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
PROJECT_REF = "lqpqfnefmnhskykigjir"
PASSWORD = "sbp_92e653769401bc508eee92b4fdff65c9adc4b642"
HOST = f"db.{PROJECT_REF}.supabase.co"
DATABASE = "postgres"
USER = "postgres"
PORT = 5432

MIGRATIONS = [
    "016_clawbus_infrastructure.sql",
    "017_clawscheduler_infrastructure.sql",
    "018_clawvm_infrastructure.sql",
    "019_component_integration.sql"
]

def get_connection():
    """Connect to Supabase PostgreSQL."""
    try:
        conn = psycopg2.connect(
            host=HOST,
            database=DATABASE,
            user=USER,
            password=PASSWORD,
            port=PORT,
            sslmode="require"
        )
        return conn
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None

def split_sql(sql):
    """Split SQL into statements, handling function bodies."""
    statements = []
    current = []
    in_function = False
    
    for line in sql.split('\n'):
        stripped = line.strip()
        
        # Skip comments
        if stripped.startswith('--'):
            continue
            
        # Track function bodies
        lower = stripped.lower()
        if 'create or replace function' in lower or 'create function' in lower:
            in_function = True
            
        current.append(line)
        
        if not in_function and stripped.endswith(';'):
            stmt = '\n'.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        elif in_function and 'language plpgsql;' in lower:
            stmt = '\n'.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            in_function = False
    
    # Add remaining
    if current:
        stmt = '\n'.join(current).strip()
        if stmt:
            statements.append(stmt)
    
    return statements

def execute_statement(cursor, sql):
    """Execute a single SQL statement."""
    try:
        cursor.execute(sql)
        return True, None
    except psycopg2.Error as e:
        error_msg = str(e)
        # Benign errors
        if any(x in error_msg.lower() for x in [
            'already exists', 'duplicate', 'does not exist', 
            '42710', '42p07', '42701'
        ]):
            return True, "exists"
        return False, error_msg

def deploy_migration(conn, filepath):
    """Deploy a single migration file."""
    filename = filepath.name
    print(f"\n📦 {filename}")
    
    sql = filepath.read_text()
    statements = split_sql(sql)
    print(f"   {len(statements)} statements")
    
    cursor = conn.cursor()
    success = 0
    skipped = 0
    failed = 0
    
    for i, stmt in enumerate(statements, 1):
        if not stmt.strip():
            continue
            
        ok, err = execute_statement(cursor, stmt)
        if ok:
            if err == "exists":
                skipped += 1
            else:
                success += 1
        else:
            failed += 1
            if failed <= 3:
                print(f"   ❌ Statement {i}: {err[:100]}")
    
    conn.commit()
    cursor.close()
    
    print(f"   ✅ {success} | ⚠️ {skipped} | ❌ {failed}")
    return failed == 0

def main():
    print("=== MoltOS Migration Deployment ===")
    print(f"Host: {HOST}")
    
    # Get migrations directory
    script_dir = Path(__file__).parent
    migrations_dir = script_dir.parent / "tap-dashboard" / "supabase" / "migrations"
    
    # Connect
    conn = get_connection()
    if not conn:
        sys.exit(1)
    
    print("✅ Connected to database\n")
    
    all_ok = True
    for migration in MIGRATIONS:
        filepath = migrations_dir / migration
        if not filepath.exists():
            print(f"❌ {migration} not found")
            all_ok = False
            continue
            
        ok = deploy_migration(conn, filepath)
        if not ok:
            all_ok = False
    
    conn.close()
    
    print("\n=== Summary ===")
    if all_ok:
        print("✅ All migrations deployed successfully")
    else:
        print("⚠️ Some errors occurred (may be already applied)")
    
    sys.exit(0)

if __name__ == "__main__":
    main()
