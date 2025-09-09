import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import json
import logging

DB_FILE = "mindgarden.db"
PG_ENABLED = True
PG_CONFIG = {
    'host': os.getenv('PG_HOST', 'postgres'),
    'port': int(os.getenv('PG_PORT', '5432')),
    'dbname': os.getenv('PG_DB', 'mindgarden'),
    'user': os.getenv('PG_USER', 'mg'),
    'password': os.getenv('PG_PASSWORD', 'mgpassword')
}

def pg_conn():
    if not PG_ENABLED:
        return None
    try:
        return psycopg2.connect(
            host=PG_CONFIG['host'],
            port=PG_CONFIG['port'],
            dbname=PG_CONFIG['dbname'],
            user=PG_CONFIG['user'],
            password=PG_CONFIG['password']
        )
    except Exception:
        # Return None so callers can gracefully downgrade
        return None

def migrate_sqlite_to_postgres():
    """One-time migration: if sqlite file exists and PG tables are empty, copy records.
    Safe to run multiple times (will no-op if already migrated or sqlite missing)."""
    if not os.path.exists(DB_FILE):
        return
    pg = pg_conn()
    if not pg:
        return
    cur = pg.cursor()
    # Check if any rows already exist to avoid duplicates
    cur.execute("SELECT COUNT(1) FROM participants")
    if cur.fetchone()[0] > 0:
        pg.close()
        return
    # Open sqlite read-only
    sconn = sqlite3.connect(DB_FILE)
    sconn.row_factory = sqlite3.Row
    scur = sconn.cursor()

    def copy_table(select_sql, insert_sql, transform=lambda r: r):
        try:
            scur.execute(select_sql)
            rows = scur.fetchall()
            for row in rows:
                data = transform(dict(row))
                cur.execute(insert_sql, data)
        except Exception:
            pass

    # Participants
    copy_table(
        "SELECT user_id,name,email,age,gender,shared_with,studies FROM participants",
        """INSERT INTO participants (user_id,name,email,age,gender,shared_with,studies)
            VALUES (%(user_id)s,%(name)s,%(email)s,%(age)s,%(gender)s,%(shared_with)s,%(studies)s)""",
        lambda d: {
            'user_id': d.get('user_id'),
            'name': d.get('name'),
            'email': d.get('email'),
            'age': d.get('age'),
            'gender': d.get('gender'),
            'shared_with': d.get('shared_with'),
            'studies': d.get('studies')
        }
    )

    # Transforms
    copy_table(
        "SELECT user_id,name,description,transform_type,parameters,shared_with,studies FROM transforms",
        """INSERT INTO transforms (user_id,name,description,transform_type,parameters,shared_with,studies)
            VALUES (%(user_id)s,%(name)s,%(description)s,%(transform_type)s,%(parameters)s,%(shared_with)s,%(studies)s)""",
        lambda d: d
    )

    # Storage
    copy_table(
        "SELECT user_id,file_name,file_type,file_size,file_path,shared_with,studies FROM storage",
        """INSERT INTO storage (user_id,file_name,file_type,file_size,file_path,shared_with,studies)
            VALUES (%(user_id)s,%(file_name)s,%(file_type)s,%(file_size)s,%(file_path)s,%(shared_with)s,%(studies)s)""",
        lambda d: d
    )

    # Models
    copy_table(
        "SELECT user_id,name,description,model_type,parameters,shared_with,studies FROM models",
        """INSERT INTO models (user_id,name,description,model_type,parameters,shared_with,studies)
            VALUES (%(user_id)s,%(name)s,%(description)s,%(model_type)s,%(parameters)s,%(shared_with)s,%(studies)s)""",
        lambda d: d
    )

    # Analytics
    copy_table(
        "SELECT user_id,name,description,analysis_type,parameters,results,shared_with,studies FROM analytics",
        """INSERT INTO analytics (user_id,name,description,analysis_type,parameters,results,shared_with,studies)
            VALUES (%(user_id)s,%(name)s,%(description)s,%(analysis_type)s,%(parameters)s,%(results)s,%(shared_with)s,%(studies)s)""",
        lambda d: d
    )

    # MGFlows
    copy_table(
        "SELECT user_id,name,description,mgflow_flow,shared_with FROM mgflows",
        """INSERT INTO mgflows (user_id,name,description,mgflow_flow,shared_with)
            VALUES (%(user_id)s,%(name)s,%(description)s,%(mgflow_flow)s,%(shared_with)s)""",
        lambda d: d
    )

    # Files
    copy_table(
        "SELECT user_id,file_name,file_type,file_size,file_path,metadata FROM files",
        """INSERT INTO files (user_id,file_name,file_type,file_size,file_path,metadata)
            VALUES (%(user_id)s,%(file_name)s,%(file_type)s,%(file_size)s,%(file_path)s,%(metadata)s)""",
        lambda d: d
    )

    # User settings
    copy_table(
        "SELECT user_id,settings FROM user_settings",
        """INSERT INTO user_settings (user_id,settings)
            VALUES (%(user_id)s,%(settings)s)
            ON CONFLICT (user_id) DO UPDATE SET settings=excluded.settings""",
        lambda d: d
    )

    # API connections
    copy_table(
        "SELECT id,user_id,name,description,api_type,base_url,api_token,endpoints_available,openapi_info,status FROM api_connections",
        """INSERT INTO api_connections (id,user_id,name,description,api_type,base_url,api_token,endpoints_available,openapi_info,status)
            VALUES (%(id)s,%(user_id)s,%(name)s,%(description)s,%(api_type)s,%(base_url)s,%(api_token)s,%(endpoints_available)s,%(openapi_info)s,%(status)s)
            ON CONFLICT (id) DO NOTHING""",
        lambda d: d
    )

    pg.commit()
    sconn.close()
    pg.close()
    try:
        return psycopg2.connect(
            host=PG_CONFIG['host'],
            port=PG_CONFIG['port'],
            dbname=PG_CONFIG['dbname'],
            user=PG_CONFIG['user'],
            password=PG_CONFIG['password']
        )
    except Exception:
        return None

def init_db():
    # Try postgres first
    pg = pg_conn()
    if pg:
        cur = pg.cursor()
        cur.execute('''CREATE TABLE IF NOT EXISTS participants (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            age INTEGER,
            gender TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            shared_with TEXT,
            studies TEXT
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS transforms (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            transform_type TEXT NOT NULL,
            parameters TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            shared_with TEXT,
            studies TEXT
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS storage (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER,
            file_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            shared_with TEXT,
            studies TEXT
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS models (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            model_type TEXT NOT NULL,
            parameters TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            shared_with TEXT,
            studies TEXT
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS analytics (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            analysis_type TEXT NOT NULL,
            parameters TEXT,
            results TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            shared_with TEXT,
            studies TEXT
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS mgflows (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            mgflow_flow TEXT,
            shared_with TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER,
            file_path TEXT NOT NULL,
            metadata TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT PRIMARY KEY,
            settings TEXT
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS api_connections (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            api_type TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_token TEXT,
            endpoints_available TEXT,
            openapi_info TEXT,
            status TEXT DEFAULT 'configured',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS devices (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            device_name TEXT NOT NULL,
            device_type TEXT,
            device_model TEXT,
            device_settings TEXT,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            shared_with TEXT
        )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS experiments (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            code TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        pg.commit()
        pg.close()
        # Optional one-time migration from local sqlite
        try:
            migrate_sqlite_to_postgres()
        except Exception as e:
            logging.warning(f"SQLite→Postgres migration skipped/failed: {e}")
        return
    if not os.path.exists(DB_FILE):
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS participants (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            email TEXT,
                            age INTEGER,
                            gender TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            shared_with TEXT,
                            studies TEXT
                        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS transforms (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            description TEXT,
                            transform_type TEXT NOT NULL,
                            parameters TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            shared_with TEXT,
                            studies TEXT
                        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS storage (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            file_name TEXT NOT NULL,
                            file_type TEXT NOT NULL,
                            file_size INTEGER,
                            file_path TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            shared_with TEXT,
                            studies TEXT
                        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS models (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            description TEXT,
                            model_type TEXT NOT NULL,
                            parameters TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            shared_with TEXT,
                            studies TEXT
                        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS analytics (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            description TEXT,
                            analysis_type TEXT NOT NULL,
                            parameters TEXT,
                            results TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            shared_with TEXT,
                            studies TEXT
                        )''')
        
        # New tables for mgflow assistant
        cursor.execute('''CREATE TABLE IF NOT EXISTS mgflows (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            description TEXT,
                            mgflow_flow TEXT,
                            shared_with TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS files (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            file_name TEXT NOT NULL,
                            file_type TEXT NOT NULL,
                            file_size INTEGER,
                            file_path TEXT NOT NULL,
                            metadata TEXT,
                            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )''')
        cursor.execute('''CREATE TABLE IF NOT EXISTS user_settings (
                            user_id TEXT PRIMARY KEY,
                            settings TEXT
                        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS api_connections (
                            id TEXT PRIMARY KEY,
                            user_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            description TEXT,
                            api_type TEXT NOT NULL,
                            base_url TEXT NOT NULL,
                            api_token TEXT,
                            endpoints_available TEXT,
                            openapi_info TEXT,
                            status TEXT DEFAULT 'configured',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS devices (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            device_id TEXT NOT NULL,
                            device_name TEXT NOT NULL,
                            device_type TEXT,
                            device_model TEXT,
                            device_settings TEXT,
                            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            shared_with TEXT
                        )''')
        cursor.execute('''CREATE TABLE IF NOT EXISTS experiments (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            description TEXT,
                            code TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )''')
        
        conn.commit()
        conn.close()

# CRUD functions for participants
def add_participant(user_id, name, email, age, gender, shared_with=None, studies=None):
    pg = pg_conn()
    if pg:
        cur = pg.cursor()
        cur.execute("""
            INSERT INTO participants (user_id, name, email, age, gender, shared_with, studies)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, name, email, age, gender, json.dumps(shared_with), json.dumps(studies)))
        pg.commit()
        pg.close()
        return
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO participants (user_id, name, email, age, gender, shared_with, studies)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, name, email, age, gender, json.dumps(shared_with), json.dumps(studies)))
    conn.commit()
    conn.close()

def get_participants(user_id):
    pg = pg_conn()
    if pg:
        cur = pg.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM participants WHERE user_id = %s", (user_id,))
        rows = cur.fetchall()
        pg.close()
        return [dict(r) for r in rows]
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM participants WHERE user_id = ?", (user_id,))
    participants = cursor.fetchall()
    conn.close()
    return [dict(row) for row in participants]

def update_participant(id, user_id, first_name, last_name, email, date_of_birth, gender, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE participants
        SET first_name = ?, last_name = ?, email = ?, date_of_birth = ?, gender = ?, shared_with = ?, studies = ?
        WHERE id = ? AND user_id = ?
    """, (first_name, last_name, email, date_of_birth, gender, json.dumps(shared_with), json.dumps(studies), id, user_id))
    conn.commit()
    conn.close()

def delete_participant(id, user_id):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM participants WHERE id = ? AND user_id = ?", (id, user_id))
    conn.commit()
    conn.close()

# CRUD functions for transforms
def add_transform(user_id, name, description, transform_type, parameters, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO transforms (user_id, name, description, transform_type, parameters, shared_with, studies)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, name, description, transform_type, parameters, json.dumps(shared_with), json.dumps(studies)))
    conn.commit()
    conn.close()

def get_transforms(user_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # This makes rows accessible by column name
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transforms WHERE user_id = ?", (user_id,))
    transforms = cursor.fetchall()
    conn.close()
    # Convert sqlite3.Row objects to dictionaries
    return [dict(row) for row in transforms]

def update_transform(id, user_id, name, description, transform_type, parameters, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE transforms
        SET name = ?, description = ?, transform_type = ?, parameters = ?, shared_with = ?, studies = ?
        WHERE id = ? AND user_id = ?
    """, (name, description, transform_type, parameters, json.dumps(shared_with), json.dumps(studies), id, user_id))
    conn.commit()
    conn.close()

def delete_transform(id, user_id):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transforms WHERE id = ? AND user_id = ?", (id, user_id))
    conn.commit()
    conn.close()

# CRUD functions for storage
def add_storage_item(user_id, file_name, file_type, file_size, file_path, shared_with=None, studies=None):
    print(f"💾 Saving storage item - file_name: {file_name}, file_type: {file_type}, file_size: {file_size}")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO storage (user_id, file_name, file_type, file_size, file_path, shared_with, studies)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, file_name, file_type, file_size, file_path, json.dumps(shared_with), json.dumps(studies)))
    conn.commit()
    conn.close()
    print(f"✅ Storage item saved successfully")

def get_storage_items(user_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # This makes rows accessible by column name
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM storage WHERE user_id = ?", (user_id,))
    storage_items = cursor.fetchall()
    conn.close()
    # Convert sqlite3.Row objects to dictionaries
    result = [dict(row) for row in storage_items]
    print(f"📋 Retrieved {len(result)} storage items for user {user_id}")
    for item in result:
        print(f"   - {item['file_name']} (file_type: {item['file_type']})")
    return result

def update_storage_item(id, user_id, file_name, file_type, file_size, file_path, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE storage
        SET file_name = ?, file_type = ?, file_size = ?, file_path = ?, shared_with = ?, studies = ?
        WHERE id = ? AND user_id = ?
    """, (file_name, file_type, file_size, file_path, json.dumps(shared_with), json.dumps(studies), id, user_id))
    conn.commit()
    conn.close()

def delete_storage_item(id, user_id):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM storage WHERE id = ? AND user_id = ?", (id, user_id))
    conn.commit()
    conn.close()

# CRUD functions for models
def add_model(user_id, name, description, model_type, parameters, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO models (user_id, name, description, model_type, parameters, shared_with, studies)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, name, description, model_type, json.dumps(parameters), json.dumps(shared_with), json.dumps(studies)))
    conn.commit()
    conn.close()

def get_models(user_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # This makes rows accessible by column name
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM models WHERE user_id = ?", (user_id,))
    models = cursor.fetchall()
    conn.close()
    # Convert sqlite3.Row objects to dictionaries
    return [dict(row) for row in models]

def update_model(id, user_id, name, description, model_type, parameters, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE models
        SET name = ?, description = ?, model_type = ?, parameters = ?, shared_with = ?, studies = ?
        WHERE id = ? AND user_id = ?
    """, (name, description, model_type, json.dumps(parameters), json.dumps(shared_with), json.dumps(studies), id, user_id))
    conn.commit()
    conn.close()

def delete_model(id, user_id):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM models WHERE id = ? AND user_id = ?", (id, user_id))
    conn.commit()
    conn.close()

# CRUD functions for analytics
def add_analytics(user_id, name, description, analysis_type, parameters, results, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO analytics (user_id, name, description, analysis_type, parameters, results, shared_with, studies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, name, description, analysis_type, parameters, json.dumps(results), json.dumps(shared_with), json.dumps(studies)))
    conn.commit()
    conn.close()

def get_analytics(user_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # This makes rows accessible by column name
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analytics WHERE user_id = ?", (user_id,))
    analytics = cursor.fetchall()
    conn.close()
    # Convert sqlite3.Row objects to dictionaries
    return [dict(row) for row in analytics]

def update_analytics(id, user_id, name, description, analysis_type, parameters, results, shared_with=None, studies=None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE analytics
        SET name = ?, description = ?, analysis_type = ?, parameters = ?, results = ?, shared_with = ?, studies = ?
        WHERE id = ? AND user_id = ?
    """, (name, description, analysis_type, parameters, json.dumps(results), json.dumps(shared_with), json.dumps(studies), id, user_id))
    conn.commit()
    conn.close()

def delete_analytics(id, user_id):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM analytics WHERE id = ? AND user_id = ?", (id, user_id))
    conn.commit()
    conn.close()

# ==============================
# DEVICES (NeuroTech Workloads)
# ==============================

def add_device(user_id, device_id, device_name, device_type, device_model, device_settings):
    pg = pg_conn()
    if pg:
        cur = pg.cursor()
        try:
            cur.execute(
                """
                INSERT INTO devices (user_id, device_id, device_name, device_type, device_model, device_settings, shared_with)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, device_id, device_name, device_type, device_model, json.dumps(device_settings), json.dumps([]))
            )
            pg.commit()
            cur.execute("SELECT id, user_id, device_id, device_name, device_type, device_model, device_settings, registered_at, shared_with FROM devices WHERE user_id=%s AND device_id=%s", (user_id, device_id))
            row = cur.fetchone()
            pg.close()
            return {
                'id': row[0],
                'device_id': row[2],
                'device_name': row[3],
                'device_type': row[4],
                'device_model': row[5],
                'device_settings': json.loads(row[6]) if row[6] else {},
                'registered_at': row[7],
                'shared_with': json.loads(row[8]) if row[8] else []
            }
        except Exception as e:
            pg.rollback()
            pg.close()
            logging.error(f"PG add_device error: {e}")
            raise
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO devices (user_id, device_id, device_name, device_type, device_model, device_settings, shared_with)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, device_id, device_name, device_type, device_model, json.dumps(device_settings), json.dumps([]))
        )
        conn.commit()
        cursor.execute("SELECT * FROM devices WHERE device_id = ? AND user_id = ?", (device_id, user_id))
        new_device = cursor.fetchone()
        return {
            'id': new_device[0],
            'device_id': new_device[2],
            'device_name': new_device[3],
            'device_type': new_device[4],
            'device_model': new_device[5],
            'device_settings': json.loads(new_device[6]) if new_device[6] else {},
            'registered_at': new_device[7],
            'shared_with': json.loads(new_device[8]) if new_device[8] else []
        }
    finally:
        conn.close()

def get_registered_devices(user_id):
    pg = pg_conn()
    if pg:
        cur = pg.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, user_id, device_id, device_name, device_type, device_model, device_settings, registered_at, shared_with FROM devices WHERE user_id=%s", (user_id,))
        rows = cur.fetchall()
        pg.close()
        result = []
        for r in rows:
            r = dict(r)
            r['device_settings'] = json.loads(r['device_settings']) if r.get('device_settings') else {}
            r['shared_with'] = json.loads(r['shared_with']) if r.get('shared_with']) else []
            result.append(r)
        return result
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices WHERE user_id = ?", (user_id,))
    devices = cursor.fetchall()
    conn.close()
    result = []
    for device in devices:
        device_dict = dict(device)
        device_dict['device_settings'] = json.loads(device_dict['device_settings']) if device_dict.get('device_settings') else {}
        device_dict['shared_with'] = json.loads(device_dict['shared_with']) if device_dict.get('shared_with') else []
        result.append(device_dict)
    return result

def update_device(user_id, device_id, device_name, device_type, device_model, device_settings):
    pg = pg_conn()
    if pg:
        cur = pg.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                """
                UPDATE devices SET device_name=%s, device_type=%s, device_model=%s, device_settings=%s, registered_at=CURRENT_TIMESTAMP
                WHERE device_id=%s AND user_id=%s
                """,
                (device_name, device_type, device_model, json.dumps(device_settings), device_id, user_id)
            )
            pg.commit()
            cur.execute("SELECT id, user_id, device_id, device_name, device_type, device_model, device_settings, registered_at, shared_with FROM devices WHERE user_id=%s AND device_id=%s", (user_id, device_id))
            row = cur.fetchone()
            pg.close()
            return {
                'id': row['id'],
                'device_id': row['device_id'],
                'device_name': row['device_name'],
                'device_type': row['device_type'],
                'device_model': row['device_model'],
                'device_settings': json.loads(row['device_settings']) if row.get('device_settings') else {},
                'registered_at': row['registered_at'],
                'shared_with': json.loads(row['shared_with']) if row.get('shared_with') else []
            }
        except Exception as e:
            pg.rollback()
            pg.close()
            logging.error(f"PG update_device error: {e}")
            raise
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE devices
            SET device_name = ?, device_type = ?, device_model = ?, device_settings = ?
            WHERE device_id = ? AND user_id = ?
            """,
            (device_name, device_type, device_model, json.dumps(device_settings), device_id, user_id)
        )
        conn.commit()
        cursor.execute("SELECT * FROM devices WHERE device_id = ? AND user_id = ?", (device_id, user_id))
        updated_device = cursor.fetchone()
        return {
            'id': updated_device[0],
            'device_id': updated_device[2],
            'device_name': updated_device[3],
            'device_type': updated_device[4],
            'device_model': updated_device[5],
            'device_settings': json.loads(updated_device[6]) if updated_device[6] else {},
            'registered_at': updated_device[7],
            'shared_with': json.loads(updated_device[8]) if updated_device[8] else []
        }
    finally:
        conn.close()

def delete_device(user_id, device_id):
    pg = pg_conn()
    if pg:
        cur = pg.cursor()
        cur.execute("DELETE FROM devices WHERE user_id=%s AND device_id=%s", (user_id, device_id))
        pg.commit()
        pg.close()
        return
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM devices WHERE user_id = ? AND device_id = ?", (user_id, device_id))
    conn.commit()
    conn.close()

def get_user_settings(user_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # This makes rows accessible by column name
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
    settings_row = cursor.fetchone()
    conn.close()
    
    if settings_row:
        # Parse the JSON settings field
        settings_text = settings_row['settings']
        if settings_text:
            try:
                return json.loads(settings_text)
            except (json.JSONDecodeError, TypeError):
                return {}
        else:
            return {}
    return {}

def update_user_settings(user_id, settings_dict):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    settings_json = json.dumps(settings_dict)
    cursor.execute("INSERT INTO user_settings (user_id, settings) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings", (user_id, settings_json))
    conn.commit()
    conn.close()

# ===========================================
# DEPLOYMENT FUNCTIONS
# ===========================================

def add_mgflow(user_id, name, description, mgflow_flow='{}', shared_with=None):
    """Add a new mgflow"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute('''INSERT INTO mgflows (user_id, name, description, mgflow_flow, shared_with)
                          VALUES (?, ?, ?, ?, ?)''', 
                       (user_id, name, description, mgflow_flow, shared_with))
        mgflow_id = cursor.lastrowid
        conn.commit()
        logging.info(f"Added mgflow: {name} for user {user_id}")
        return mgflow_id
    except Exception as e:
        logging.error(f"Error adding mgflow: {e}")
        return None
    finally:
        conn.close()

def get_user_mgflows(user_id):
    """Get all mgflows for a user"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute('''SELECT id, name, description, mgflow_flow, shared_with, created_at, updated_at
                          FROM mgflows WHERE user_id = ?''', (user_id,))
        rows = cursor.fetchall()
        mgflows = []
        for row in rows:
            shared_with_list = row[4].split(',') if row[4] else []
            mgflows.append({
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'mgflow_flow': row[3],
                'shared_with': shared_with_list,
                'created_at': row[5],
                'updated_at': row[6]
            })
        return mgflows
    except Exception as e:
        logging.error(f"Error getting mgflows: {e}")
        return []
    finally:
        conn.close()

def get_mgflow(mgflow_id):
    """Get a specific mgflow by ID (for webhooks and other cross-user access)"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute('''SELECT id, user_id, name, description, mgflow_flow, shared_with, created_at, updated_at 
                          FROM mgflows WHERE id = ?''', (mgflow_id,))
        row = cursor.fetchone()
        if row:
            return {
                'id': row[0],
                'user_id': row[1],
                'name': row[2],
                'description': row[3],
                'mgflow_flow': row[4],
                'shared_with': row[5].split(',') if row[5] else [],
                'created_at': row[6],
                'updated_at': row[7]
            }
        return None
    except Exception as e:
        logging.error(f"Error getting mgflow {mgflow_id}: {e}")
        return None
    finally:
        conn.close()

def update_mgflow(mgflow_id, user_id, name=None, description=None, mgflow_flow=None, shared_with=None):
    """Update a mgflow"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        # Build dynamic update query
        updates = []
        params = []
        
        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if mgflow_flow is not None:
            updates.append("mgflow_flow = ?")
            params.append(mgflow_flow)
        if shared_with is not None:
            updates.append("shared_with = ?")
            params.append(shared_with)
        
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.extend([mgflow_id, user_id])
            
            query = f"UPDATE mgflows SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
            cursor.execute(query, params)
            
            if cursor.rowcount > 0:
                conn.commit()
                logging.info(f"Updated mgflow {mgflow_id} for user {user_id}")
                return True
            else:
                logging.warning(f"No mgflow found with id {mgflow_id} for user {user_id}")
                return False
        else:
            return False
    except Exception as e:
        logging.error(f"Error updating mgflow: {e}")
        return False
    finally:
        conn.close()

def delete_mgflow(mgflow_id, user_id):
    """Delete a mgflow"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM mgflows WHERE id = ? AND user_id = ?", (mgflow_id, user_id))
        if cursor.rowcount > 0:
            conn.commit()
            logging.info(f"Deleted mgflow {mgflow_id} for user {user_id}")
            return True
        else:
            logging.warning(f"No mgflow found with id {mgflow_id} for user {user_id}")
            return False
    except Exception as e:
        logging.error(f"Error deleting mgflow: {e}")
        return False
    finally:
        conn.close()

# ===========================================
# FILE FUNCTIONS
# ===========================================

def add_file(user_id, file_name, file_type, file_size, file_path, metadata=None):
    """Add a new file"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        metadata_json = json.dumps(metadata) if metadata else None
        cursor.execute('''INSERT INTO files (user_id, file_name, file_type, file_size, file_path, metadata)
                          VALUES (?, ?, ?, ?, ?, ?)''', 
                       (user_id, file_name, file_type, file_size, file_path, metadata_json))
        file_id = cursor.lastrowid
        conn.commit()
        logging.info(f"Added file: {file_name} for user {user_id}")
        return file_id
    except Exception as e:
        logging.error(f"Error adding file: {e}")
        return None
    finally:
        conn.close()

def get_user_files(user_id):
    """Get all files for a user"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute('''SELECT id, file_name, file_type, file_size, file_path, metadata, uploaded_at
                          FROM files WHERE user_id = ? ORDER BY uploaded_at DESC''', (user_id,))
        rows = cursor.fetchall()
        files = []
        for row in rows:
            metadata = json.loads(row[5]) if row[5] else {}
            files.append({
                'id': row[0],
                'file_name': row[1],
                'file_type': row[2],
                'file_size': row[3],
                'file_path': row[4],
                'metadata': metadata,
                'uploaded_at': row[6]
            })
        return files
    except Exception as e:
        logging.error(f"Error getting files: {e}")
        return []
    finally:
        conn.close()

def delete_file(file_id, user_id):
    """Delete a file"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM files WHERE id = ? AND user_id = ?", (file_id, user_id))
        if cursor.rowcount > 0:
            conn.commit()
            logging.info(f"Deleted file {file_id} for user {user_id}")
            return True
        else:
            logging.warning(f"No file found with id {file_id} for user {user_id}")
            return False
    except Exception as e:
        logging.error(f"Error deleting file: {e}")
        return False
    finally:
        conn.close()


# CRUD functions for API connections
def add_api_connection(connection_id, user_id, name, description, api_type, base_url, api_token=None, endpoints_available=None, openapi_info=None, status='configured'):
    """Add a new API connection"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        logging.info(f"🔍 Attempting to add API connection - ID: {connection_id}, User: {user_id}, Name: {name}")
        cursor.execute("""
            INSERT INTO api_connections (id, user_id, name, description, api_type, base_url, api_token, endpoints_available, openapi_info, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (connection_id, user_id, name, description, api_type, base_url, api_token,
              json.dumps(endpoints_available) if endpoints_available else None,
              json.dumps(openapi_info) if openapi_info else None, status))
        conn.commit()
        logging.info(f"✅ Successfully added API connection {connection_id} for user {user_id}")
        
        # Verify the insert worked by querying back
        cursor.execute("SELECT COUNT(*) FROM api_connections WHERE id = ? AND user_id = ?", (connection_id, user_id))
        count = cursor.fetchone()[0]
        logging.info(f"🔍 Verification: Found {count} records for connection {connection_id} and user {user_id}")
        
        return True
    except Exception as e:
        logging.error(f"❌ Error adding API connection: {e}")
        import traceback
        logging.error(f"❌ Traceback: {traceback.format_exc()}")
        return False
    finally:
        conn.close()


def get_api_connections(user_id):
    """Get all API connections for a user"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        logging.info(f"🔍 Querying API connections for user: {user_id}")
        cursor.execute("""
            SELECT id, name, description, api_type, base_url, api_token, endpoints_available, openapi_info, status, created_at, updated_at
            FROM api_connections WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,))
        rows = cursor.fetchall()
        logging.info(f"🔍 Found {len(rows)} raw database rows for user {user_id}")
        
        connections = []
        for row in rows:
            connection = {
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'api_type': row[3],
                'base_url': row[4],
                'api_token': row[5],
                'endpoints_available': json.loads(row[6]) if row[6] else [],
                'openapi_info': json.loads(row[7]) if row[7] else None,
                'status': row[8],
                'created_at': row[9],
                'updated_at': row[10]
            }
            connections.append(connection)
            logging.info(f"🔍 Processed connection: {connection['id']} - {connection['name']}")
        
        logging.info(f"✅ Returning {len(connections)} API connections for user {user_id}")
        return connections
    except Exception as e:
        logging.error(f"❌ Error getting API connections: {e}")
        import traceback
        logging.error(f"❌ Traceback: {traceback.format_exc()}")
        return []
    finally:
        conn.close()


def get_api_connection(connection_id, user_id):
    """Get a specific API connection"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, name, description, api_type, base_url, api_token, endpoints_available, openapi_info, status, created_at, updated_at
            FROM api_connections WHERE id = ? AND user_id = ?
        """, (connection_id, user_id))
        row = cursor.fetchone()
        if row:
            return {
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'api_type': row[3],
                'base_url': row[4],
                'api_token': row[5],
                'endpoints_available': json.loads(row[6]) if row[6] else [],
                'openapi_info': json.loads(row[7]) if row[7] else None,
                'status': row[8],
                'created_at': row[9],
                'updated_at': row[10]
            }
        return None
    except Exception as e:
        logging.error(f"Error getting API connection: {e}")
        return None
    finally:
        conn.close()


def delete_api_connection(connection_id, user_id):
    """Delete an API connection"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM api_connections WHERE id = ? AND user_id = ?", (connection_id, user_id))
        if cursor.rowcount > 0:
            conn.commit()
            logging.info(f"Deleted API connection {connection_id} for user {user_id}")
            return True
        else:
            logging.warning(f"No API connection found with id {connection_id} for user {user_id}")
            return False
    except Exception as e:
        logging.error(f"Error deleting API connection: {e}")
        return False
    finally:
        conn.close()


def update_api_connection(connection_id, user_id, **kwargs):
    """Update an API connection"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        # Build the SET clause dynamically
        set_clause = []
        values = []
        
        for key, value in kwargs.items():
            if key in ['name', 'description', 'api_type', 'base_url', 'status', 'api_token']:
                set_clause.append(f"{key} = ?")
                values.append(value)
            elif key in ['endpoints_available', 'openapi_info']:
                set_clause.append(f"{key} = ?")
                values.append(json.dumps(value) if value else None)
        
        if not set_clause:
            return False
        
        # Add updated_at timestamp
        set_clause.append("updated_at = CURRENT_TIMESTAMP")
        
        # Add WHERE clause values
        values.extend([connection_id, user_id])
        
        query = f"UPDATE api_connections SET {', '.join(set_clause)} WHERE id = ? AND user_id = ?"
        cursor.execute(query, values)
        
        if cursor.rowcount > 0:
            conn.commit()
            logging.info(f"Updated API connection {connection_id} for user {user_id}")
            return True
        else:
            logging.warning(f"No API connection found with id {connection_id} for user {user_id}")
            return False
    except Exception as e:
        logging.error(f"Error updating API connection: {e}")
        return False
    finally:
        conn.close()

