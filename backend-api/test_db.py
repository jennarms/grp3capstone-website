import mysql.connector
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

try:
    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )

    if connection.is_connected():
        print("✅ Database connection successful!")
        cursor = connection.cursor()
        cursor.execute("SHOW TABLES;")
        print("📋 Tables in database:", cursor.fetchall())
        cursor.close()

except mysql.connector.Error as err:
    print(f"❌ Error: {err}")

finally:
    if 'connection' in locals() and connection.is_connected():
        connection.close()
