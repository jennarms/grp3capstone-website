from flask import Blueprint, request, jsonify
from app import mysql

faqs_bp = Blueprint("faqs", __name__)

# ✅ Helper function to generate new FAQ ID
def generate_faq_id():
    cur = mysql.connection.cursor()
    cur.execute("SELECT Faq_ID FROM FAQs ORDER BY Faq_ID DESC LIMIT 1")
    last_id = cur.fetchone()
    cur.close()

    if last_id:
        # Extract number part (e.g., faq005 -> 5)
        num = int(last_id[0].replace("faq", ""))
        new_id = f"faq{num+1:03d}"  # keeps leading zeros (faq006)
    else:
        new_id = "faq001"
    return new_id

# ✅ Get all FAQs
@faqs_bp.route("/", methods=["GET"])
def get_faqs():
    cur = mysql.connection.cursor()
    cur.execute("SELECT Faq_ID, Admin_ID, Question, Answer FROM FAQs")
    rows = cur.fetchall()
    cur.close()

    faqs = [
        {"faq_id": r[0], "admin_id": r[1], "question": r[2], "answer": r[3]}
        for r in rows
    ]
    return jsonify(faqs), 200

# ✅ Add FAQ
@faqs_bp.route("/", methods=["POST"])
def add_faq():
    data = request.get_json()
    admin_id = data.get("admin_id")
    question = data.get("question")
    answer = data.get("answer")

    if not admin_id or not question or not answer:
        return jsonify({"error": "All fields are required"}), 400

    faq_id = generate_faq_id()  # auto-generate new ID

    cur = mysql.connection.cursor()
    cur.execute(
        "INSERT INTO FAQs (Faq_ID, Admin_ID, Question, Answer) VALUES (%s, %s, %s, %s)",
        (faq_id, admin_id, question, answer),
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "FAQ added successfully!", "faq_id": faq_id}), 201

# ✅ Update FAQ
@faqs_bp.route("/<faq_id>", methods=["PUT"])
def update_faq(faq_id):
    data = request.get_json()
    question = data.get("question")
    answer = data.get("answer")

    if not question or not answer:
        return jsonify({"error": "Question and Answer are required"}), 400

    cur = mysql.connection.cursor()
    cur.execute(
        "UPDATE FAQs SET Question=%s, Answer=%s WHERE Faq_ID=%s",
        (question, answer, faq_id),
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "FAQ updated successfully!"}), 200

# ✅ Delete FAQ
@faqs_bp.route("/<faq_id>", methods=["DELETE"])
def delete_faq(faq_id):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM FAQs WHERE Faq_ID=%s", (faq_id,))
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "FAQ deleted successfully!"}), 200
