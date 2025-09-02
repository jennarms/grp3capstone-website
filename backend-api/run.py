import pymysql
pymysql.install_as_MySQLdb()  # make PyMySQL behave like MySQLdb

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)