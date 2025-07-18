#!/usr/bin/env python3
"""Test script to verify database connectivity and schema initialization."""

import asyncio
import asyncpg
import sys
from typing import Dict, List, Tuple

# Database configurations
DATABASES = {
    'sample_db': {
        'host': 'localhost',
        'port': 5432,
        'user': 'postgres',
        'password': 'password',
        'database': 'sample_db'
    },
    'auth_db': {
        'host': 'localhost',
        'port': 5433,
        'user': 'postgres',
        'password': 'password',
        'database': 'auth_db'
    },
    'ai_db': {
        'host': 'localhost',
        'port': 5434,
        'user': 'postgres',
        'password': 'password',
        'database': 'ai_db'
    },
    'file_db': {
        'host': 'localhost',
        'port': 5435,
        'user': 'postgres',
        'password': 'password',
        'database': 'file_db'
    },
    'audit_db': {
        'host': 'localhost',
        'port': 5436,
        'user': 'postgres',
        'password': 'password',
        'database': 'audit_db'
    }
}

# Expected tables for each database
EXPECTED_TABLES = {
    'sample_db': ['samples', 'workflow_history', 'sample_assignments'],
    'auth_db': ['users', 'refresh_tokens', 'auth_audit_logs'],
    'ai_db': ['processing_jobs', 'job_results', 'model_configurations'],
    'file_db': ['files', 'file_shares', 'file_versions'],
    'audit_db': ['audit_logs', 'compliance_reports', 'data_retention_policies']
}

async def test_database_connection(db_name: str, config: Dict) -> Tuple[bool, str]:
    """Test database connectivity."""
    try:
        conn = await asyncpg.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database']
        )
        
        # Test basic query
        result = await conn.fetchval('SELECT 1')
        await conn.close()
        
        if result == 1:
            return True, "✅ Connection successful"
        else:
            return False, "❌ Connection failed - unexpected result"
            
    except Exception as e:
        return False, f"❌ Connection failed: {str(e)}"

async def test_database_schema(db_name: str, config: Dict) -> Tuple[bool, str, List[str]]:
    """Test database schema by checking for expected tables."""
    try:
        conn = await asyncpg.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database']
        )
        
        # Get all tables
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        table_names = [row['table_name'] for row in tables]
        expected_tables = EXPECTED_TABLES.get(db_name, [])
        
        missing_tables = [table for table in expected_tables if table not in table_names]
        
        await conn.close()
        
        if not missing_tables:
            return True, f"✅ Schema complete - {len(table_names)} tables found", table_names
        else:
            return False, f"❌ Schema incomplete - missing tables: {missing_tables}", table_names
            
    except Exception as e:
        return False, f"❌ Schema check failed: {str(e)}", []

async def test_admin_user(config: Dict) -> Tuple[bool, str]:
    """Test if admin user exists in auth database."""
    try:
        conn = await asyncpg.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database']
        )
        
        # Check for admin user
        admin_user = await conn.fetchrow("""
            SELECT id, username, email, role 
            FROM users 
            WHERE role = 'admin' 
            LIMIT 1
        """)
        
        await conn.close()
        
        if admin_user:
            return True, f"✅ Admin user found: {admin_user['username']} ({admin_user['email']})"
        else:
            return False, "❌ No admin user found"
            
    except Exception as e:
        return False, f"❌ Admin user check failed: {str(e)}"

async def main():
    """Run all database tests."""
    print("🔍 Testing Python Microservices Database Configuration")
    print("=" * 60)
    
    all_passed = True
    
    for db_name, config in DATABASES.items():
        print(f"\n📊 Testing {db_name}:")
        print("-" * 40)
        
        # Test connection
        conn_success, conn_msg = await test_database_connection(db_name, config)
        print(f"Connection: {conn_msg}")
        
        if not conn_success:
            all_passed = False
            continue
        
        # Test schema
        schema_success, schema_msg, tables = await test_database_schema(db_name, config)
        print(f"Schema: {schema_msg}")
        
        if tables:
            print(f"Tables: {', '.join(tables)}")
        
        if not schema_success:
            all_passed = False
        
        # Special test for auth database
        if db_name == 'auth_db' and conn_success:
            admin_success, admin_msg = await test_admin_user(config)
            print(f"Admin User: {admin_msg}")
            
            if not admin_success:
                all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All database tests passed!")
        sys.exit(0)
    else:
        print("❌ Some database tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 