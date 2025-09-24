# broadcast_blueprint.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import datetime
import uuid
import logging
import traceback

broadcast_bp = Blueprint("broadcast", __name__)

# logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---- CONFIG / CACHE ----
# Cache table schema info to avoid DESCRIBE on every request
_schema_cache = {}

# Tables used
BC_MSG_TABLE = "BroadcastChannel_Message"
BC_REACTION_TABLE = "BroadcastChannel_Reaction"
ADMIN_MSG_TABLE = "AdminMessage"
ADMIN_REACTION_TABLE = "AdminMessage_Reaction"

# Recommended DB indexes (run once in your DB admin)
# -- RUN THIS ONCE --
# CREATE INDEX idx_bcm_sent_at ON BroadcastChannel_Message(Sent_At);
# CREATE INDEX idx_bcm_message_id ON BroadcastChannel_Message(Message_ID);
# CREATE INDEX idx_bcr_msgid ON BroadcastChannel_Reaction(Message_ID);
# CREATE INDEX idx_am_sent_at ON AdminMessage(Sent_At);
# CREATE INDEX idx_am_message_id ON AdminMessage(Message_ID);
# CREATE INDEX idx_amr_msgid ON AdminMessage_Reaction(Message_ID);

# -----------------------------
# Helpers
# -----------------------------
def get_current_time():
    return datetime.now()

def cache_table_columns(table_name):
    """Return list of column names for table_name and cache it."""
    if table_name in _schema_cache:
        return _schema_cache[table_name]

    try:
        with mysql.connection.cursor() as cur:
            cur.execute(f"SHOW TABLES LIKE %s", (table_name,))
            if not cur.fetchone():
                _schema_cache[table_name] = None
                return None

            cur.execute(f"DESCRIBE {table_name}")
            rows = cur.fetchall()
            cols = [r[0] for r in rows]
            _schema_cache[table_name] = cols
            logger.info(f"Cached schema for {table_name}: {cols}")
            return cols
    except Exception as e:
        logger.error(f"Failed to describe {table_name}: {e}")
        _schema_cache[table_name] = None
        return None

def get_user_info():
    try:
        role_from_header = request.headers.get('X-User-Role')
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            user_id = identity.get("id") or identity.get("user_id") or str(identity)
        else:
            user_id = str(identity)
        
        # Ensure user_id is always a string and trimmed
        user_id = str(user_id).strip()
        
        user_type = role_from_header or "user"
        return user_id, user_type
    except Exception:
        return "unknown", "unknown"

def is_admin(user_type):
    return user_type in ["main-admin", "station-admin"]

# FIXED: Python-based aggregation to avoid MySQL emoji encoding issues
def aggregate_reactions_for_messages(message_ids, reaction_table):
    """Return {message_id: {reaction_type: count}} - Python aggregation version"""
    if not message_ids:
        return {}
    try:
        placeholders = ",".join(["%s"] * len(message_ids))
        
        # Get all reactions, let Python do the counting to avoid MySQL emoji issues
        q = f"""
            SELECT Message_ID, Reaction_Type
            FROM {reaction_table}
            WHERE Message_ID IN ({placeholders})
        """
        
        with mysql.connection.cursor() as cur:
            # Ensure proper charset handling
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(q, message_ids)
            rows = cur.fetchall()
            
        # DEBUG: Log raw results
        logger.info(f"All reactions fetched from {reaction_table}: {rows}")
        
        # Count reactions in Python to avoid MySQL emoji encoding issues
        result = {}
        for r in rows:
            mid = r[0]
            rtype = r[1]
            if mid not in result:
                result[mid] = {}
            if rtype not in result[mid]:
                result[mid][rtype] = 0
            result[mid][rtype] += 1
            
        # DEBUG: Log final result
        logger.info(f"Python aggregated result for {reaction_table}: {result}")
        
        return result
        
    except Exception as e:
        logger.error(f"aggregate_reactions_for_messages error: {e}")
        logger.error(traceback.format_exc())
        return {}

# DEBUG endpoint - keep this for troubleshooting
@broadcast_bp.route("/debug/reactions/<message_id>", methods=["GET"])
@jwt_required()
def debug_reactions(message_id):
    try:
        # Get raw reaction data from database
        query = f"""
            SELECT Reaction_ID, Message_ID, Reactor_User_ID, Reactor_MainAdmin_ID, 
                   Reactor_Station_ID, Reaction_Type, Reacted_At, Reactor_Unique
            FROM {BC_REACTION_TABLE} 
            WHERE Message_ID = %s
        """
        
        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(query, (message_id,))
            raw_reactions = cur.fetchall()
            colnames = [d[0] for d in cur.description] if cur.description else []
            
        # Convert to dict format
        reactions_data = []
        for row in raw_reactions:
            row_dict = {colnames[i]: row[i] for i in range(len(colnames))}
            reactions_data.append(row_dict)
            
        # Test Python aggregation method
        python_aggregated = {}
        for reaction in reactions_data:
            rtype = reaction['Reaction_Type']
            if rtype not in python_aggregated:
                python_aggregated[rtype] = 0
            python_aggregated[rtype] += 1
            
        return jsonify({
            "message_id": message_id,
            "raw_reactions": reactions_data,
            "python_aggregated_counts": python_aggregated,
            "total_reactions": len(reactions_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Debug reactions error: {str(e)}")
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Basic endpoints for debugging
# -----------------------------
@broadcast_bp.route("/test", methods=["GET"])
def test():
    try:
        with mysql.connection.cursor() as cur:
            cur.execute("SELECT 1 as ok")
            res = cur.fetchone()
        return jsonify({"ok": res}), 200
    except Exception as e:
        logger.error(f"test error: {e}")
        return jsonify({"error": str(e)}), 500

@broadcast_bp.route("/debug-tables", methods=["GET"])
@jwt_required()
def debug_tables():
    try:
        info = {}
        for tbl in [BC_MSG_TABLE, BC_REACTION_TABLE, ADMIN_MSG_TABLE, ADMIN_REACTION_TABLE]:
            cols = cache_table_columns(tbl)
            info[tbl] = {"exists": bool(cols), "columns": cols}
        return jsonify(info), 200
    except Exception as e:
        logger.error(f"debug-tables: {e}")
        return jsonify({"error": str(e)}), 500

# -----------------------------
# GET Broadcast (everyone) - with pagination + reaction counts
# -----------------------------
@broadcast_bp.route("/everyone", methods=["GET"])
@jwt_required()
def get_broadcast_everyone():
    try:
        # pagination params
        limit = int(request.args.get("limit", 50))
        page = int(request.args.get("page", 1))
        offset = (page - 1) * limit if page > 0 else 0

        cols = cache_table_columns(BC_MSG_TABLE)
        if not cols:
            return jsonify([]), 200

        # pick canonical columns
        select_cols = []
        select_cols.append("bm.Message_ID")
        # content
        if "Message_Content" in cols:
            select_cols.append("bm.Message_Content")
        else:
            # fallback to first content-like column
            content_col = next((c for c in cols if "content" in c.lower()), None)
            if content_col:
                select_cols.append(f"bm.{content_col} AS Message_Content")
                
            else:
                select_cols.append("bm.Message_Content")

        # sent_at
        if "Sent_At" in cols:
            select_cols.append("bm.Sent_At")
            order_by = "bm.Sent_At DESC"
        else:
            order_by = "bm.Message_ID DESC"

        # sender ids
        if "Sender_MainAdmin_ID" in cols:
            select_cols.append("bm.Sender_MainAdmin_ID")
        if "Sender_Station_ID" in cols:
            select_cols.append("bm.Sender_Station_ID")

        # include station name if station table exists and Sender_Station_ID exists
        join_clause = ""
        with mysql.connection.cursor() as cur:
            cur.execute("SHOW TABLES LIKE %s", ("Station",))
            station_exists = bool(cur.fetchone())
        if "Sender_Station_ID" in cols and station_exists:
            select_cols.append("s.StationName AS Station_Name")
            join_clause += " LEFT JOIN Station s ON bm.Sender_Station_ID = s.Station_ID "

        query = f"""
            SELECT {', '.join(select_cols)}
            FROM {BC_MSG_TABLE} bm
            {join_clause}
            ORDER BY {order_by}
            LIMIT %s OFFSET %s
        """

        with mysql.connection.cursor() as cur:
            logger.info(f"Executing: {query} with limit={limit}, offset={offset}")
            cur.execute(query, (limit, offset))
            raw = cur.fetchall()
            colnames = [d[0] for d in cur.description] if cur.description else []

        messages = []
        msg_ids = []
        for row in raw:
            rowd = {colnames[i]: row[i] if i < len(row) else None for i in range(len(colnames))}
            mid = str(rowd.get("Message_ID") or "")
            msg = {
                "id": mid,
                "Message_ID": mid,
                "text": rowd.get("Message_Content"),
                "Message_Content": rowd.get("Message_Content"),
                "sent_at": str(rowd.get("Sent_At") or get_current_time()),
                "Sent_At": str(rowd.get("Sent_At") or get_current_time()),
                "audience": "everyone",
                "reactions": {},
            }
            if "Sender_MainAdmin_ID" in rowd:
                msg["Sender_MainAdmin_ID"] = rowd.get("Sender_MainAdmin_ID")
            if "Sender_Station_ID" in rowd:
                msg["Sender_Station_ID"] = rowd.get("Sender_Station_ID")
            if "Station_Name" in rowd:
                msg["Station_Name"] = rowd.get("Station_Name")
            messages.append(msg)
            if mid:
                msg_ids.append(mid)
            

        # aggregate reactions for these message ids using FIXED function
        reaction_map = aggregate_reactions_for_messages(msg_ids, BC_REACTION_TABLE)
        for m in messages:
            mid = m["Message_ID"]
            if mid in reaction_map:
                m["reactions"] = reaction_map[mid]
            else:
                m["reactions"] = {}

        return jsonify(messages), 200

    except Exception as e:
        logger.error(f"get_broadcast_everyone error: {e}")
        logger.error(traceback.format_exc())
        return jsonify([]), 200
    
    

# -----------------------------
# POST send broadcast (everyone)
# -----------------------------
@broadcast_bp.route("/everyone/send", methods=["POST"])
@jwt_required()
def send_broadcast_everyone():
    try:
        user_id, user_type = get_user_info()
        if not is_admin(user_type):
            return jsonify({"error": "Only administrators can send messages"}), 403

        data = request.get_json() or {}
        content = (data.get("message_content") or "").strip()
        if not content:
            return jsonify({"error": "Message content required"}), 400

        cols = cache_table_columns(BC_MSG_TABLE)
        if not cols:
            return jsonify({"error": "Message table missing"}), 500

        message_id = str(uuid.uuid4())
        sent_at = get_current_time()

        insert_cols = []
        placeholders = []
        values = []

        # Message_ID
        insert_cols.append("Message_ID"); placeholders.append("%s"); values.append(message_id)
        # content
        if "Message_Content" in cols:
            insert_cols.append("Message_Content"); placeholders.append("%s"); values.append(content)
        else:
            content_col = next((c for c in cols if "content" in c.lower()), None)
            if content_col:
                insert_cols.append(content_col); placeholders.append("%s"); values.append(content)
        # Sent_At
        if "Sent_At" in cols:
            insert_cols.append("Sent_At"); placeholders.append("%s"); values.append(sent_at)
        else:
            # try created_at fallback
            created_col = next((c for c in cols if "created_at" in c.lower()), None)
            if created_col:
                insert_cols.append(created_col); placeholders.append("%s"); values.append(sent_at)

        # sender
        if user_type == "main-admin" and "Sender_MainAdmin_ID" in cols:
            insert_cols.append("Sender_MainAdmin_ID"); placeholders.append("%s"); values.append(user_id)
        elif user_type == "station-admin" and "Sender_Station_ID" in cols:
            insert_cols.append("Sender_Station_ID"); placeholders.append("%s"); values.append(user_id)

        query = f"INSERT INTO {BC_MSG_TABLE} ({', '.join(insert_cols)}) VALUES ({', '.join(placeholders)})"
        with mysql.connection.cursor() as cur:
            logger.info(f"Insert broadcast everyone: {query} values={values}")
            cur.execute(query, values)
            mysql.connection.commit()

        return jsonify({"msg": "Message sent", "message_id": message_id, "sent_at": sent_at.isoformat()}), 201

    except Exception as e:
        logger.error(f"send_broadcast_everyone error: {e}")
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Edit Own Message
# -----------------------------

# -----------------------------
# POST react (everyone) - store reaction with proper user identification
# -----------------------------
@broadcast_bp.route("/everyone/react", methods=["POST"])
@jwt_required()
def react_broadcast_everyone():
    try:
        current_user_id, current_user_type = get_user_info()
        data = request.get_json()
        message_id = data.get("message_id")
        reaction_type = data.get("reaction_type")

        if not message_id or not reaction_type:
            return jsonify({"error": "Message ID and reaction type are required"}), 400

        # Determine which reactor column to use
        reactor_user = None
        reactor_main = None
        reactor_station = None

        if current_user_type == "user":
            reactor_user = current_user_id
        elif current_user_type == "main-admin":
            reactor_main = current_user_id
        elif current_user_type == "station-admin":
            reactor_station = current_user_id
        else:
            return jsonify({"error": "Invalid user type"}), 400

        reacted_at = datetime.now()
        reaction_id = str(uuid.uuid4())

        # ON DUPLICATE KEY logic
        insert_query = f"""
            INSERT INTO {BC_REACTION_TABLE}
            (Reaction_ID, Message_ID, Reactor_User_ID, Reactor_MainAdmin_ID,
             Reactor_Station_ID, Reaction_Type, Reacted_At)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                Reaction_Type = IF(Reaction_Type = VALUES(Reaction_Type), NULL, VALUES(Reaction_Type)),
                Reacted_At = VALUES(Reacted_At)
        """

        values = (reaction_id, message_id, reactor_user, reactor_main, reactor_station, reaction_type, reacted_at)

        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(insert_query, values)
            mysql.connection.commit()

        # Determine action: added, updated, or removed (NULL toggle)
        action = "added"
        if cur.rowcount == 2:  # 1 insert + 1 update
            if reaction_type == reaction_type:  # toggled off
                action = "removed"
            else:
                action = "updated"

        return jsonify({"status": "success", "action": action}), 200

    except Exception as e:
        logger.error(f"Error in react_broadcast_everyone: {str(e)}")
        logger.error(traceback.format_exc())
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    
# -----------------------------
# Admins endpoints (similar to above)
# -----------------------------
@broadcast_bp.route("/admins", methods=["GET"])
@jwt_required()
def get_broadcast_admins():
    try:
        user_id, user_type = get_user_info()
        if not is_admin(user_type):
            return jsonify({"error": "Access denied"}), 403

        limit = int(request.args.get("limit", 50))
        page = int(request.args.get("page", 1))
        offset = (page - 1) * limit if page > 0 else 0

        cols = cache_table_columns(ADMIN_MSG_TABLE)
        if not cols:
            return jsonify([]), 200

        select_cols = ["am.Message_ID"]
        if "Message_Content" in cols:
            select_cols.append("am.Message_Content")
        else:
            content_col = next((c for c in cols if "content" in c.lower()), None)
            if content_col:
                select_cols.append(f"am.{content_col} AS Message_Content")
            else:
                select_cols.append("am.Message_Content")

        if "Sent_At" in cols:
            select_cols.append("am.Sent_At")
            order_by = "am.Sent_At DESC"
        else:
            order_by = "am.Message_ID DESC"

        if "Sender_MainAdmin_ID" in cols:
            select_cols.append("am.Sender_MainAdmin_ID")
        if "Sender_Station_ID" in cols:
            select_cols.append("am.Sender_Station_ID")

        join_clause = ""
        with mysql.connection.cursor() as cur:
            cur.execute("SHOW TABLES LIKE %s", ("Station",))
            station_exists = bool(cur.fetchone())
            cur.execute("SHOW TABLES LIKE %s", ("MainAdmin",))
            mainadmin_exists = bool(cur.fetchone())

        if "Sender_Station_ID" in cols and station_exists:
            select_cols.append("s.StationName AS Station_Name")
            join_clause += " LEFT JOIN Station s ON am.Sender_Station_ID = s.Station_ID "
        if "Sender_MainAdmin_ID" in cols and mainadmin_exists:
            select_cols.append("ma.username AS Sender_MainAdmin_Username")
            join_clause += " LEFT JOIN MainAdmin ma ON am.Sender_MainAdmin_ID = ma.Admin_ID "

        query = f"""
            SELECT {', '.join(select_cols)}
            FROM {ADMIN_MSG_TABLE} am
            {join_clause}
            ORDER BY {order_by}
            LIMIT %s OFFSET %s
        """

        with mysql.connection.cursor() as cur:
            logger.info(f"Executing admin messages query, limit={limit}, offset={offset}")
            cur.execute(query, (limit, offset))
            raw = cur.fetchall()
            colnames = [d[0] for d in cur.description] if cur.description else []

        messages = []
        msg_ids = []
        for row in raw:
            rowd = {colnames[i]: row[i] if i < len(row) else None for i in range(len(colnames))}
            mid = str(rowd.get("Message_ID") or "")
            pm = {
                "id": mid,
                "Message_ID": mid,
                "text": rowd.get("Message_Content"),
                "Message_Content": rowd.get("Message_Content"),
                "sent_at": str(rowd.get("Sent_At") or get_current_time()),
                "Sent_At": str(rowd.get("Sent_At") or get_current_time()),
                "audience": "admins",
                "reactions": {}
            }
            if "Sender_MainAdmin_ID" in rowd:
                pm["Sender_MainAdmin_ID"] = rowd.get("Sender_MainAdmin_ID")
            if "Sender_Station_ID" in rowd:
                pm["Sender_Station_ID"] = rowd.get("Sender_Station_ID")
            if "Station_Name" in rowd:
                pm["Station_Name"] = rowd.get("Station_Name")
            if "Sender_MainAdmin_Username" in rowd:
                pm["Sender_MainAdmin_Username"] = rowd.get("Sender_MainAdmin_Username")
            messages.append(pm)
            if mid:
                msg_ids.append(mid)

        # Use FIXED aggregation function
        reaction_map = aggregate_reactions_for_messages(msg_ids, ADMIN_REACTION_TABLE)
        for m in messages:
            m["reactions"] = reaction_map.get(m["Message_ID"], {})

        return jsonify(messages), 200

    except Exception as e:
        logger.error(f"get_broadcast_admins error: {e}")
        logger.error(traceback.format_exc())
        return jsonify([]), 200

@broadcast_bp.route("/admins/send", methods=["POST"])
@jwt_required()
def send_broadcast_admins():
    try:
        user_id, user_type = get_user_info()
        if not is_admin(user_type):
            return jsonify({"error": "Access denied"}), 403

        data = request.get_json() or {}
        content = (data.get("message_content") or "").strip()
        if not content:
            return jsonify({"error": "Message content required"}), 400

        cols = cache_table_columns(ADMIN_MSG_TABLE)
        if not cols:
            return jsonify({"error": "Admin message table missing"}), 500

        message_id = str(uuid.uuid4())
        sent_at = get_current_time()

        insert_cols = ["Message_ID"]
        values = [message_id]
        placeholders = ["%s"]

        if "Message_Content" in cols:
            insert_cols.append("Message_Content"); placeholders.append("%s"); values.append(content)
        else:
            content_col = next((c for c in cols if "content" in c.lower()), None)
            if content_col:
                insert_cols.append(content_col); placeholders.append("%s"); values.append(content)

        if "Sent_At" in cols:
            insert_cols.append("Sent_At"); placeholders.append("%s"); values.append(sent_at)
        else:
            created_col = next((c for c in cols if "created_at" in c.lower()), None)
            if created_col:
                insert_cols.append(created_col); placeholders.append("%s"); values.append(sent_at)

        if user_type == "main-admin" and "Sender_MainAdmin_ID" in cols:
            insert_cols.append("Sender_MainAdmin_ID"); placeholders.append("%s"); values.append(user_id)
        elif user_type == "station-admin" and "Sender_Station_ID" in cols:
            insert_cols.append("Sender_Station_ID"); placeholders.append("%s"); values.append(user_id)

        query = f"INSERT INTO {ADMIN_MSG_TABLE} ({', '.join(insert_cols)}) VALUES ({', '.join(placeholders)})"
        with mysql.connection.cursor() as cur:
            logger.info(f"Inserting admin message: {query} values={values}")
            cur.execute(query, values)
            mysql.connection.commit()

        return jsonify({"msg": "Admin message sent", "message_id": message_id, "sent_at": sent_at.isoformat()}), 201

    except Exception as e:
        logger.error(f"send_broadcast_admins error: {e}")
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500

# -----------------------------  
# POST react (admins) - store reaction with proper user identification
# -----------------------------
@broadcast_bp.route("/admins/react", methods=["POST"])
@jwt_required()
def react_broadcast_admins():
    try:
        current_user_id, current_user_type = get_user_info()
        if not is_admin(current_user_type):
            return jsonify({"error": "Only administrators can react to admin messages"}), 403

        data = request.get_json()
        message_id = data.get("message_id")
        reaction_type = data.get("reaction_type")

        if not message_id or not reaction_type:
            return jsonify({"error": "Message ID and reaction type are required"}), 400

        reactor_main = None
        reactor_station = None

        if current_user_type == "main-admin":
            reactor_main = current_user_id
        elif current_user_type == "station-admin":
            reactor_station = current_user_id
        else:
            return jsonify({"error": "Invalid admin type"}), 400

        reacted_at = datetime.now()
        reaction_id = str(uuid.uuid4())

        insert_query = f"""
            INSERT INTO {ADMIN_REACTION_TABLE}
            (Reaction_ID, Message_ID, Reactor_MainAdmin_ID, Reactor_Station_ID, Reaction_Type, Reacted_At)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                Reaction_Type = IF(Reaction_Type = VALUES(Reaction_Type), NULL, VALUES(Reaction_Type)),
                Reacted_At = VALUES(Reacted_At)
        """

        values = (reaction_id, message_id, reactor_main, reactor_station, reaction_type, reacted_at)

        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(insert_query, values)
            mysql.connection.commit()

        action = "added"
        if cur.rowcount == 2:
            action = "removed" if reaction_type == reaction_type else "updated"

        return jsonify({"status": "success", "action": action}), 200

    except Exception as e:
        logger.error(f"Error in react_broadcast_admins: {str(e)}")
        logger.error(traceback.format_exc())
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500


# -----------------------------
# GET user reactions for a specific message (optional helper endpoint)
# -----------------------------
@broadcast_bp.route("/everyone/reactions/<message_id>", methods=["GET"])
@jwt_required()
def get_message_reactions_everyone(message_id):
    try:
        query = f"""
            SELECT Reactor_User_ID, Reactor_MainAdmin_ID, Reactor_Station_ID, 
                   Reaction_Type, Reacted_At
            FROM {BC_REACTION_TABLE} 
            WHERE Message_ID = %s 
            ORDER BY Reacted_At DESC
        """
        
        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(query, (message_id,))
            raw_reactions = cur.fetchall()
            
        reactions = []
        for reaction in raw_reactions:
            reactions.append({
                "reactor_user_id": reaction[0],
                "reactor_mainadmin_id": reaction[1], 
                "reactor_station_id": reaction[2],
                "reaction_type": reaction[3],
                "reacted_at": str(reaction[4])
            })
            
        return jsonify({"reactions": reactions}), 200
        
    except Exception as e:
        logger.error(f"Error getting message reactions: {str(e)}")
        return jsonify({"error": str(e)}), 500


@broadcast_bp.route("/admins/reactions/<message_id>", methods=["GET"])
@jwt_required()
def get_message_reactions_admins(message_id):
    try:
        current_user_id, current_user_type = get_user_info()
        if not is_admin(current_user_type):
            return jsonify({"error": "Access denied"}), 403
            
        query = f"""
            SELECT Reactor_MainAdmin_ID, Reactor_Station_ID, 
                   Reaction_Type, Reacted_At
            FROM {ADMIN_REACTION_TABLE} 
            WHERE Message_ID = %s 
            ORDER BY Reacted_At DESC
        """
        
        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(query, (message_id,))
            raw_reactions = cur.fetchall()
            
        reactions = []
        for reaction in raw_reactions:
            reactions.append({
                "reactor_mainadmin_id": reaction[0],
                "reactor_station_id": reaction[1],
                "reaction_type": reaction[2],
                "reacted_at": str(reaction[3])
            })
            
        return jsonify({"reactions": reactions}), 200
        
    except Exception as e:
        logger.error(f"Error getting admin message reactions: {str(e)}")
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Delete Reaction
# -----------------------------

@broadcast_bp.route("/everyone/reaction/delete", methods=["POST"])
@jwt_required()
def delete_reaction_everyone():
    try:
        user_id, user_type = get_user_info()

        # Only allow deletion if the person actually reacted
        data = request.get_json()
        message_id = data.get("message_id")
        reaction_type = data.get("reaction_type")  # ensure front-end sends it
        if not message_id or not reaction_type:
            return jsonify({"error": "message_id and reaction_type are required"}), 400

        # Determine the correct column based on role
        if user_type == "user":
            column = "Reactor_User_ID"
        elif user_type == "main-admin":
            column = "Reactor_MainAdmin_ID"
        elif user_type == "station-admin":
            column = "Reactor_Station_ID"
        else:
            return jsonify({"error": "Invalid user type"}), 403

        query = f"""
            DELETE FROM {BC_REACTION_TABLE}
            WHERE Message_ID = %s AND {column} = %s AND Reaction_Type = %s
        """
        with mysql.connection.cursor() as cur:
            cur.execute(query, (message_id, user_id, reaction_type))
            mysql.connection.commit()

        return jsonify({"status": "success", "action": "deleted"}), 200

    except Exception as e:
        logger.error(f"delete_reaction_everyone error: {str(e)}")
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500


@broadcast_bp.route("/admins/reaction/delete", methods=["POST"])
@jwt_required()
def delete_reaction_admins():
    try:
        user_id, user_type = get_user_info()
        if not is_admin(user_type):
            return jsonify({"error": "Only admins can delete their reactions"}), 403

        data = request.get_json()
        message_id = data.get("message_id")
        reaction_type = data.get("reaction_type")  # make sure front-end sends it
        if not message_id or not reaction_type:
            return jsonify({"error": "message_id and reaction_type are required"}), 400

        # Determine which column to delete based on admin type
        column = "Reactor_MainAdmin_ID" if user_type == "main-admin" else "Reactor_Station_ID"

        # Only delete if this admin reacted with that emoji
        query = f"""
            DELETE FROM {ADMIN_REACTION_TABLE}
            WHERE Message_ID = %s AND {column} = %s AND Reaction_Type = %s
        """
        with mysql.connection.cursor() as cur:
            cur.execute(query, (message_id, user_id, reaction_type))
            mysql.connection.commit()

        return jsonify({"status": "success", "action": "deleted"}), 200

    except Exception as e:
        logger.error(f"delete_reaction_admins error: {str(e)}")
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500

