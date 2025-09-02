import pymysql
pymysql.install_as_MySQLdb()  # makes PyMySQL work as MySQLdb

from app import create_app

app = create_app()

@app.route('/')
def home():
    return "Backend is running!"

if __name__ == '__main__':
    app.run(debug=True)