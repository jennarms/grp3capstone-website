
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

# ---- CHANNEL CONFIGURATION ----
# Two distinct channels with their own tables:
CHANNELS = {
    "everyone": {
        "message_table": "BroadcastChannel_Message",
        "reaction_table": "BroadcastChannel_Reaction",
        "allowed_roles": ["main-admin", "station-admin", "user"],  # everyone can view
        "can_send": ["main-admin", "station-admin"],  # only admins can send
        "can_react": ["main-admin", "station-admin", "user"]  # everyone can react
    },
    "admins": {
        "message_table": "AdminMessage", 
        "reaction_table": "AdminMessage_Reaction",
        "allowed_roles": ["main-admin", "station-admin"],  # only admins can view
        "can_send": ["main-admin", "station-admin"],  # only admins can send
        "can_react": ["main-admin", "station-admin"]  # only admins can react
    }
}

# Cache table schema info to avoid DESCRIBE on every request
_schema_cache = {}

# -----------------------------
# Helpers
# -----------------------------
def get_current_time():
    return datetime.now()

def get_next_message_id(channel_name):
    """Generate next sequential message ID for the channel"""
    try:
        config = CHANNELS[channel_name]
        msg_table = config["message_table"]
        
        with mysql.connection.cursor() as cur:
            # Get the highest existing message ID number for this table
            cur.execute(f"""
                SELECT Message_ID 
                FROM {msg_table} 
                WHERE Message_ID LIKE 'MSG%%' 
                ORDER BY CAST(SUBSTRING(Message_ID, 4) AS UNSIGNED) DESC 
                LIMIT 1
            """)
            result = cur.fetchone()
            
            if result and result[0]:
                # Extract number from MSG123 format
                last_num = int(result[0][3:])  # Remove 'MSG' prefix
                next_num = last_num + 1
            else:
                next_num = 1
                
            return f"MSG{next_num:03d}"  # MSG001, MSG002, etc.
    except Exception as e:
        logger.error(f"Error generating message ID: {e}")
        # Fallback to UUID if sequential ID fails
        return f"MSG{str(uuid.uuid4())[:8].upper()}"

def get_next_reaction_id(channel_name):
    """Generate next sequential reaction ID for the channel"""
    try:
        config = CHANNELS[channel_name]
        reaction_table = config["reaction_table"]
        
        with mysql.connection.cursor() as cur:
            # Get the highest existing reaction ID number for this table
            cur.execute(f"""
                SELECT Reaction_ID 
                FROM {reaction_table} 
                WHERE Reaction_ID LIKE 'REACT%%' 
                ORDER BY CAST(SUBSTRING(Reaction_ID, 6) AS UNSIGNED) DESC 
                LIMIT 1
            """)
            result = cur.fetchone()
            
            if result and result[0]:
                # Extract number from REACT123 format
                last_num = int(result[0][5:])  # Remove 'REACT' prefix
                next_num = last_num + 1
            else:
                next_num = 1
                
            return f"REACT{next_num:03d}"  # REACT001, REACT002, etc.
    except Exception as e:
        logger.error(f"Error generating reaction ID: {e}")
        # Fallback to UUID if sequential ID fails
        return f"REACT{str(uuid.uuid4())[:8].upper()}"

def cache_table_columns(table_name):
    """Return list of column names for table_name and cache it."""
    if table_name in _schema_cache:
        return _schema_cache[table_name]

    try:
        with mysql.connection.cursor() as cur:
            cur.execute("SHOW TABLES LIKE %s", (table_name,))
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
        
        user_id = str(user_id).strip()
        user_type = role_from_header or "user"
        return user_id, user_type
    except Exception:
        return "unknown", "unknown"

def get_channel_config(channel_name):
    """Get channel configuration and validate access"""
    if channel_name not in CHANNELS:
        return None, "Invalid channel"
    
    config = CHANNELS[channel_name]
    user_id, user_type = get_user_info()
    
    if user_type not in config["allowed_roles"]:
        return None, f"Access denied to {channel_name} channel"
    
    return config, None

def aggregate_reactions_for_messages(message_ids, reaction_table):
    """Return {message_id: {reaction_type: count}} - Python aggregation version"""
    if not message_ids:
        return {}
    try:
        placeholders = ",".join(["%s"] * len(message_ids))
        
        q = f"""
            SELECT Message_ID, Reaction_Type
            FROM {reaction_table}
            WHERE Message_ID IN ({placeholders})
            AND Reaction_Type IS NOT NULL
        """
        
        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(q, message_ids)
            rows = cur.fetchall()
            
        logger.info(f"All reactions fetched from {reaction_table}: {rows}")
        
        # Count reactions in Python
        result = {}
        for r in rows:
            mid = r[0]
            rtype = r[1]
            if mid not in result:
                result[mid] = {}
            if rtype not in result[mid]:
                result[mid][rtype] = 0
            result[mid][rtype] += 1
            
        logger.info(f"Python aggregated result for {reaction_table}: {result}")
        return result
        
    except Exception as e:
        logger.error(f"aggregate_reactions_for_messages error: {e}")
        logger.error(traceback.format_exc())
        return {}

# -----------------------------
# LAST_SEEN HELPERS (DB-BASED)
# -----------------------------
def get_last_seen(channel_name):
    """Return datetime or None from Broadcast_LastSeen."""
    try:
        user_id, user_type = get_user_info()
        with mysql.connection.cursor() as cur:
            cur.execute("""
                SELECT LastSeen
                FROM Broadcast_LastSeen
                WHERE Identity_Value = %s
                  AND Identity_Type = %s
                  AND Channel = %s
            """, (user_id, user_type, channel_name))
            row = cur.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.error(f"get_last_seen error for {channel_name}: {e}")
        logger.error(traceback.format_exc())
        return None

def update_last_seen(channel_name):
    """Upsert LastSeen for this user + channel in Broadcast_LastSeen."""
    try:
        user_id, user_type = get_user_info()
        now = datetime.now()
        with mysql.connection.cursor() as cur:
            cur.execute("""
                INSERT INTO Broadcast_LastSeen
                (Identity_Value, Identity_Type, Channel, LastSeen)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE LastSeen = VALUES(LastSeen)
            """, (user_id, user_type, channel_name, now))
            mysql.connection.commit()
        return now
    except Exception as e:
        logger.error(f"update_last_seen error for {channel_name}: {e}")
        logger.error(traceback.format_exc())
        mysql.connection.rollback()
        return None

# -----------------------------
# UNIFIED MESSAGE RETRIEVAL
# -----------------------------
@broadcast_bp.route("/<channel_name>", methods=["GET"])
@jwt_required()
def get_messages(channel_name):
    try:
        config, error = get_channel_config(channel_name)
        if error:
            return jsonify({"error": error}), 403

        # Pagination params
        limit = int(request.args.get("limit", 50))
        page = int(request.args.get("page", 1))
        offset = (page - 1) * limit if page > 0 else 0

        msg_table = config["message_table"]
        reaction_table = config["reaction_table"]
        
        cols = cache_table_columns(msg_table)
        if not cols:
            return jsonify([]), 200

        # Build select columns
        select_cols = ["bm.Message_ID"]
        
        # Content column
        if "Message_Content" in cols:
            select_cols.append("bm.Message_Content")
        else:
            content_col = next((c for c in cols if "content" in c.lower()), None)
            if content_col:
                select_cols.append(f"bm.{content_col} AS Message_Content")

        # Timestamp column
        if "Sent_At" in cols:
            select_cols.append("bm.Sent_At")
            order_by = "bm.Sent_At DESC"
        else:
            order_by = "bm.Message_ID DESC"

        # Sender columns
        if "Sender_MainAdmin_ID" in cols:
            select_cols.append("bm.Sender_MainAdmin_ID")
        if "Sender_Station_ID" in cols:
            select_cols.append("bm.Sender_Station_ID")

        # Build joins for names
        join_clause = ""
        with mysql.connection.cursor() as cur:
            cur.execute("SHOW TABLES LIKE %s", ("Station",))
            station_exists = bool(cur.fetchone())
            cur.execute("SHOW TABLES LIKE %s", ("MainAdmin",))
            mainadmin_exists = bool(cur.fetchone())

        if "Sender_Station_ID" in cols and station_exists:
            select_cols.append("s.StationName AS Station_Name")
            join_clause += " LEFT JOIN Station s ON bm.Sender_Station_ID = s.Station_ID "
        if "Sender_MainAdmin_ID" in cols and mainadmin_exists:
            select_cols.append("ma.username AS Sender_MainAdmin_Username")
            join_clause += " LEFT JOIN MainAdmin ma ON bm.Sender_MainAdmin_ID = ma.Admin_ID "

        query = f"""
            SELECT {', '.join(select_cols)}
            FROM {msg_table} bm
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
            rowd = {colnames[i]: row[i] if i < len(colnames) else None for i in range(len(colnames))}
            mid = str(rowd.get("Message_ID") or "")
            msg = {
                "id": mid,
                "Message_ID": mid,
                "text": rowd.get("Message_Content"),
                "Message_Content": rowd.get("Message_Content"),
                "sent_at": str(rowd.get("Sent_At") or get_current_time()),
                "Sent_At": str(rowd.get("Sent_At") or get_current_time()),
                "audience": channel_name,
                "reactions": {},
            }
            
            # Add sender info
            for field in ["Sender_MainAdmin_ID", "Sender_Station_ID", "Station_Name", "Sender_MainAdmin_Username"]:
                if field in rowd:
                    msg[field] = rowd.get(field)
                    
            messages.append(msg)
            if mid:
                msg_ids.append(mid)

        # Get reactions
        reaction_map = aggregate_reactions_for_messages(msg_ids, reaction_table)
        for m in messages:
            mid = m["Message_ID"]
            m["reactions"] = reaction_map.get(mid, {})

        return jsonify(messages), 200

    except Exception as e:
        logger.error(f"get_messages error for {channel_name}: {e}")
        logger.error(traceback.format_exc())
        return jsonify([]), 200

# -----------------------------
# CHANNEL SUMMARY (LATEST + UNREAD)
# -----------------------------
@broadcast_bp.route("/<channel_name>/summary", methods=["GET"])
@jwt_required()
def get_channel_summary(channel_name):
    """
    Returns:
      {
        "latest": { Message_ID, Message_Content, Sent_At, Sender_MainAdmin_ID, Sender_Station_ID, audience },
        "unread_count": <int>
      }
    Unread count uses Broadcast_LastSeen and ignores self-sent messages.
    """
    try:
        config, error = get_channel_config(channel_name)
        if error:
            return jsonify({"error": error}), 403

        msg_table = config["message_table"]
        cols = cache_table_columns(msg_table)
        if not cols:
            return jsonify({"latest": None, "unread_count": 0}), 200

        user_id, user_type = get_user_info()

        # Latest message
        latest = None
        with mysql.connection.cursor() as cur:
            # we assume Sent_At exists; if not, fallback to Message_ID ordering
            if "Sent_At" in cols:
                cur.execute(f"""
                    SELECT Message_ID, Message_Content, Sent_At,
                           Sender_MainAdmin_ID, Sender_Station_ID
                    FROM {msg_table}
                    ORDER BY Sent_At DESC
                    LIMIT 1
                """)
            else:
                cur.execute(f"""
                    SELECT Message_ID, Message_Content, NULL as Sent_At,
                           Sender_MainAdmin_ID, Sender_Station_ID
                    FROM {msg_table}
                    ORDER BY Message_ID DESC
                    LIMIT 1
                """)
            row = cur.fetchone()

        if row:
            latest = {
                "Message_ID": row[0],
                "Message_Content": row[1],
                "Sent_At": row[2].isoformat() if isinstance(row[2], datetime) else str(row[2]),
                "Sender_MainAdmin_ID": row[3],
                "Sender_Station_ID": row[4],
                "audience": channel_name,
            }

        # Unread count based on Broadcast_LastSeen
        last_seen = get_last_seen(channel_name)

        unread_count = 0
        with mysql.connection.cursor() as cur:
            base = f"SELECT COUNT(*) FROM {msg_table}"
            conditions = []
            params = []

            if last_seen and "Sent_At" in cols:
                conditions.append("Sent_At > %s")
                params.append(last_seen)

            # Ignore self messages
            if user_type == "main-admin" and "Sender_MainAdmin_ID" in cols:
                conditions.append("(Sender_MainAdmin_ID IS NULL OR Sender_MainAdmin_ID <> %s)")
                params.append(user_id)
            elif user_type == "station-admin" and "Sender_Station_ID" in cols:
                conditions.append("(Sender_Station_ID IS NULL OR Sender_Station_ID <> %s)")
                params.append(user_id)

            if conditions:
                base += " WHERE " + " AND ".join(conditions)

            logger.info(f"Unread count query for {channel_name}: {base} params={params}")
            cur.execute(base, tuple(params))
            row = cur.fetchone()
            unread_count = row[0] if row else 0

        return jsonify({
            "latest": latest,
            "unread_count": int(unread_count or 0),
        }), 200

    except Exception as e:
        logger.error(f"get_channel_summary error for {channel_name}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"latest": None, "unread_count": 0}), 200

# -----------------------------
# MARK READ ENDPOINT
# -----------------------------
@broadcast_bp.route("/<channel_name>/mark-read", methods=["POST"])
@jwt_required()
def mark_read(channel_name):
    try:
        config, error = get_channel_config(channel_name)
        if error:
            return jsonify({"error": error}), 403

        ts = update_last_seen(channel_name)
        if not ts:
            return jsonify({"error": "Failed to update last seen"}), 500

        return jsonify({"status": "ok", "last_seen": ts.isoformat()}), 200
    except Exception as e:
        logger.error(f"mark_read error for {channel_name}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# -----------------------------
# UNIFIED MESSAGE SENDING
# -----------------------------
@broadcast_bp.route("/<channel_name>/send", methods=["POST"])
@jwt_required()
def send_message(channel_name):
    try:
        config, error = get_channel_config(channel_name)
        if error:
            return jsonify({"error": error}), 403

        user_id, user_type = get_user_info()
        if user_type not in config["can_send"]:
            return jsonify({"error": "You cannot send messages to this channel"}), 403

        data = request.get_json() or {}
        content = (data.get("message_content") or "").strip()
        if not content:
            return jsonify({"error": "Message content required"}), 400

        msg_table = config["message_table"]
        cols = cache_table_columns(msg_table)
        if not cols:
            return jsonify({"error": "Message table missing"}), 500

        # Generate sequential message ID
        message_id = get_next_message_id(channel_name)
        sent_at = get_current_time()

        # Build insert query
        insert_cols = ["Message_ID"]
        placeholders = ["%s"]
        values = [message_id]

        # Content
        if "Message_Content" in cols:
            insert_cols.append("Message_Content")
            placeholders.append("%s")
            values.append(content)

        # Timestamp
        if "Sent_At" in cols:
            insert_cols.append("Sent_At")
            placeholders.append("%s")
            values.append(sent_at)

        # Sender - crucial fix here
        if user_type == "main-admin" and "Sender_MainAdmin_ID" in cols:
            insert_cols.append("Sender_MainAdmin_ID")
            placeholders.append("%s")
            values.append(user_id)
        elif user_type == "station-admin" and "Sender_Station_ID" in cols:
            insert_cols.append("Sender_Station_ID")
            placeholders.append("%s")
            values.append(user_id)

        query = f"INSERT INTO {msg_table} ({', '.join(insert_cols)}) VALUES ({', '.join(placeholders)})"
        
        with mysql.connection.cursor() as cur:
            logger.info(f"Insert message to {msg_table}: {query} values={values}")
            cur.execute(query, values)
            mysql.connection.commit()

        return jsonify({
            "msg": f"Message sent to {channel_name}",
            "message_id": message_id,
            "sent_at": sent_at.isoformat()
        }), 201

    except Exception as e:
        logger.error(f"send_message error for {channel_name}: {e}")
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# UNIFIED MESSAGE EDITING
# -----------------------------
@broadcast_bp.route("/<channel_name>/edit", methods=["POST"])
@jwt_required()
def edit_message(channel_name):
    try:
        config, error = get_channel_config(channel_name)
        if error:
            logger.error(f"Channel config error for {channel_name}: {error}")
            return jsonify({"error": error}), 403

        user_id, user_type = get_user_info()
        logger.info(f"Edit attempt by user {user_id} (type: {user_type}) for channel {channel_name}")
        
        if user_type not in config["can_send"]:  # Only people who can send can edit
            logger.error(f"User {user_id} cannot edit in channel {channel_name}")
            return jsonify({"error": "You cannot edit messages in this channel"}), 403

        data = request.get_json()
        message_id = data.get("message_id")
        new_content = data.get("new_content")

        if not message_id or not new_content:
            return jsonify({"error": "message_id and new_content are required"}), 400

        msg_table = config["message_table"]
        logger.info(f"Editing message {message_id} in table {msg_table}")
        
        # Determine sender column based on user type
        sender_column = "Sender_MainAdmin_ID" if user_type == "main-admin" else "Sender_Station_ID"
        logger.info(f"Using sender column: {sender_column} with user_id: {user_id}")

        # First, let's check if the message exists and who owns it
        check_query = f"""
            SELECT Message_ID, Sender_MainAdmin_ID, Sender_Station_ID, Message_Content
            FROM {msg_table}
            WHERE Message_ID = %s
        """
        
        with mysql.connection.cursor() as cur:
            cur.execute(check_query, (message_id,))
            existing_message = cur.fetchone()
            
            if not existing_message:
                logger.error(f"Message {message_id} not found in {msg_table}")
                return jsonify({"error": "Message not found"}), 404
            
            logger.info(f"Found message: {existing_message}")
            
            # Check ownership
            msg_sender_main = existing_message[1]
            msg_sender_station = existing_message[2]
            
            is_owner = False
            if user_type == "main-admin" and str(msg_sender_main) == str(user_id):
                is_owner = True
            elif user_type == "station-admin" and str(msg_sender_station) == str(user_id):
                is_owner = True
                
            logger.info(f"Ownership check: user_type={user_type}, user_id={user_id}, msg_sender_main={msg_sender_main}, msg_sender_station={msg_sender_station}, is_owner={is_owner}")
            
            if not is_owner:
                return jsonify({"error": "You don't own this message"}), 403

        # Update the CORRECT table for this channel
        update_query = f"""
            UPDATE {msg_table}
            SET Message_Content = %s
            WHERE Message_ID = %s AND {sender_column} = %s
        """
        
        with mysql.connection.cursor() as cur:
            logger.info(f"Executing update: {update_query} with values: ({new_content}, {message_id}, {user_id})")
            cur.execute(update_query, (new_content, message_id, user_id))
            
            if cur.rowcount == 0:
                logger.error(f"Update affected 0 rows - this shouldn't happen after ownership check")
                return jsonify({"error": "Update failed - no rows affected"}), 500
                
            mysql.connection.commit()
            logger.info(f"Successfully updated message {message_id} in {msg_table}")

        return jsonify({"status": "success", "action": "edited"}), 200

    except Exception as e:
        logger.error(f"edit_message error for {channel_name}: {str(e)}")
        logger.error(traceback.format_exc())
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# UNIFIED REACTIONS
# -----------------------------
@broadcast_bp.route("/<channel_name>/react", methods=["POST"])
@jwt_required()
def react_to_message(channel_name):
    try:
        config, error = get_channel_config(channel_name)
        if error:
            return jsonify({"error": error}), 403

        user_id, user_type = get_user_info()
        if user_type not in config["can_react"]:
            return jsonify({"error": "You cannot react in this channel"}), 403

        data = request.get_json()
        message_id = data.get("message_id")
        reaction_type = data.get("reaction_type")

        if not message_id or not reaction_type:
            return jsonify({"error": "Message ID and reaction type are required"}), 400

        reaction_table = config["reaction_table"]
        
        # Determine reactor columns based on user type and channel
        reactor_user = None
        reactor_main = None
        reactor_station = None

        if channel_name == "everyone":
            if user_type == "user":
                reactor_user = user_id
            elif user_type == "main-admin":
                reactor_main = user_id
            elif user_type == "station-admin":
                reactor_station = user_id
        else:  # admins channel
            if user_type == "main-admin":
                reactor_main = user_id
            elif user_type == "station-admin":
                reactor_station = user_id

        # First, check if this exact reaction already exists
        if channel_name == "everyone":
            check_query = f"""
                SELECT Reaction_ID, Reaction_Type 
                FROM {reaction_table}
                WHERE Message_ID = %s 
                AND (
                    (Reactor_User_ID = %s AND %s IS NOT NULL) OR
                    (Reactor_MainAdmin_ID = %s AND %s IS NOT NULL) OR
                    (Reactor_Station_ID = %s AND %s IS NOT NULL)
                )
                AND Reaction_Type = %s
            """
            check_values = (message_id, reactor_user, reactor_user, reactor_main, reactor_main, 
                          reactor_station, reactor_station, reaction_type)
        else:  # admins channel
            check_query = f"""
                SELECT Reaction_ID, Reaction_Type 
                FROM {reaction_table}
                WHERE Message_ID = %s 
                AND (
                    (Reactor_MainAdmin_ID = %s AND %s IS NOT NULL) OR
                    (Reactor_Station_ID = %s AND %s IS NOT NULL)
                )
                AND Reaction_Type = %s
            """
            check_values = (message_id, reactor_main, reactor_main, reactor_station, reactor_station, reaction_type)

        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(check_query, check_values)
            existing_reaction = cur.fetchone()

            if existing_reaction:
                # Reaction exists, remove it (toggle off)
                delete_query = f"DELETE FROM {reaction_table} WHERE Reaction_ID = %s"
                cur.execute(delete_query, (existing_reaction[0],))
                action = "removed"
                logger.info(f"Removed existing reaction {existing_reaction[0]}")
            else:
                # Reaction doesn't exist, add it
                reaction_id = get_next_reaction_id(channel_name)
                reacted_at = datetime.now()

                if channel_name == "everyone":
                    insert_query = f"""
                        INSERT INTO {reaction_table}
                        (Reaction_ID, Message_ID, Reactor_User_ID, Reactor_MainAdmin_ID,
                         Reactor_Station_ID, Reaction_Type, Reacted_At)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """
                    insert_values = (reaction_id, message_id, reactor_user, reactor_main, 
                                   reactor_station, reaction_type, reacted_at)
                else:  # admins channel
                    insert_query = f"""
                        INSERT INTO {reaction_table}
                        (Reaction_ID, Message_ID, Reactor_MainAdmin_ID, Reactor_Station_ID, 
                         Reaction_Type, Reacted_At)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """
                    insert_values = (reaction_id, message_id, reactor_main, reactor_station, 
                                   reaction_type, reacted_at)

                cur.execute(insert_query, insert_values)
                action = "added"
                logger.info(f"Added new reaction {reaction_id}")

            mysql.connection.commit()

        return jsonify({"status": "success", "action": action}), 200

    except Exception as e:
        logger.error(f"Error in react_to_message for {channel_name}: {str(e)}")
        logger.error(traceback.format_exc())
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# GET REACTIONS FOR MESSAGE
# -----------------------------
@broadcast_bp.route("/<channel_name>/reactions/<message_id>", methods=["GET"])
@jwt_required()
def get_message_reactions(channel_name, message_id):
    try:
        config, error = get_channel_config(channel_name)
        if error:
            return jsonify({"error": error}), 403

        reaction_table = config["reaction_table"]
        
        if channel_name == "everyone":
            query = f"""
                SELECT Reactor_User_ID, Reactor_MainAdmin_ID, Reactor_Station_ID, 
                       Reaction_Type, Reacted_At
                FROM {reaction_table} 
                WHERE Message_ID = %s AND Reaction_Type IS NOT NULL
                ORDER BY Reacted_At DESC
            """
        else:  # admins
            query = f"""
                SELECT Reactor_MainAdmin_ID, Reactor_Station_ID, 
                       Reaction_Type, Reacted_At
                FROM {reaction_table} 
                WHERE Message_ID = %s AND Reaction_Type IS NOT NULL
                ORDER BY Reacted_At DESC
            """
        
        with mysql.connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(query, (message_id,))
            raw_reactions = cur.fetchall()
            
        reactions = []
        for reaction in raw_reactions:
            if channel_name == "everyone":
                reactions.append({
                    "reactor_user_id": reaction[0],
                    "reactor_mainadmin_id": reaction[1], 
                    "reactor_station_id": reaction[2],
                    "reaction_type": reaction[3],
                    "reacted_at": str(reaction[4])
                })
            else:  # admins
                reactions.append({
                    "reactor_mainadmin_id": reaction[0],
                    "reactor_station_id": reaction[1],
                    "reaction_type": reaction[2],
                    "reacted_at": str(reaction[3])
                })
            
        return jsonify({"reactions": reactions}), 200
        
    except Exception as e:
        logger.error(f"Error getting reactions for {channel_name}: {str(e)}")
        return jsonify({"error": str(e)}), 500

# -----------------------------
# DELETE REACTION
# -----------------------------
@broadcast_bp.route("/<channel_name>/reaction/delete", methods=["POST"])
@jwt_required()
def delete_reaction(channel_name):
    try:
        config, error = get_channel_config(channel_name)
        if error:
            return jsonify({"error": error}), 403

        user_id, user_type = get_user_info()
        if user_type not in config["can_react"]:
            return jsonify({"error": "You cannot delete reactions in this channel"}), 403

        data = request.get_json()
        message_id = data.get("message_id")
        reaction_type = data.get("reaction_type")
        
        if not message_id or not reaction_type:
            return jsonify({"error": "message_id and reaction_type are required"}), 400

        reaction_table = config["reaction_table"]
        
        # Determine the correct column based on user type
        if user_type == "user" and channel_name == "everyone":
            column = "Reactor_User_ID"
        elif user_type == "main-admin":
            column = "Reactor_MainAdmin_ID"
        elif user_type == "station-admin":
            column = "Reactor_Station_ID"
        else:
            return jsonify({"error": "Invalid user type for this channel"}), 403

        query = f"""
            DELETE FROM {reaction_table}
            WHERE Message_ID = %s AND {column} = %s AND Reaction_Type = %s
        """
        
        with mysql.connection.cursor() as cur:
            logger.info(f"Deleting reaction from {reaction_table}: {query}")
            cur.execute(query, (message_id, user_id, reaction_type))
            mysql.connection.commit()

        return jsonify({"status": "success", "action": "deleted"}), 200

    except Exception as e:
        logger.error(f"delete_reaction error for {channel_name}: {str(e)}")
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# DEBUG ENDPOINTS
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
        for channel_name, config in CHANNELS.items():
            msg_table = config["message_table"]
            reaction_table = config["reaction_table"]
            
            msg_cols = cache_table_columns(msg_table)
            reaction_cols = cache_table_columns(reaction_table)
            
            info[channel_name] = {
                "message_table": {
                    "name": msg_table,
                    "exists": bool(msg_cols),
                    "columns": msg_cols
                },
                "reaction_table": {
                    "name": reaction_table,
                    "exists": bool(reaction_cols), 
                    "columns": reaction_cols
                }
            }
        return jsonify(info), 200
    except Exception as e:
        logger.error(f"debug-tables: {e}")
        return jsonify({"error": str(e)}), 500

# =================== BACKWARD COMPATIBILITY ENDPOINTS ===================

@broadcast_bp.route("/everyone", methods=["GET"])
@jwt_required()
def get_broadcast_everyone():
    return get_messages("everyone")

@broadcast_bp.route("/admins", methods=["GET"])
@jwt_required() 
def get_broadcast_admins():
    return get_messages("admins")

@broadcast_bp.route("/everyone/send", methods=["POST"])
@jwt_required()
def send_broadcast_everyone():
    return send_message("everyone")

@broadcast_bp.route("/admins/send", methods=["POST"])
@jwt_required()
def send_broadcast_admins():
    return send_message("admins")

@broadcast_bp.route("/everyone/edit", methods=["POST"])
@jwt_required()
def edit_broadcast_everyone():
    return edit_message("everyone")

@broadcast_bp.route("/admins/edit", methods=["POST"])
@jwt_required()
def edit_broadcast_admins():
    return edit_message("admins")

@broadcast_bp.route("/everyone/react", methods=["POST"])
@jwt_required()
def react_broadcast_everyone():
    return react_to_message("everyone")

@broadcast_bp.route("/admins/react", methods=["POST"])
@jwt_required()
def react_broadcast_admins():
    return react_to_message("admins")

@broadcast_bp.route("/everyone/reactions/<message_id>", methods=["GET"])
@jwt_required()
def get_reactions_everyone(message_id):
    return get_message_reactions("everyone", message_id)

@broadcast_bp.route("/admins/reactions/<message_id>", methods=["GET"])
@jwt_required()
def get_reactions_admins(message_id):
    return get_message_reactions("admins", message_id)

@broadcast_bp.route("/everyone/reaction/delete", methods=["POST"])
@jwt_required()
def delete_reaction_everyone():
    return delete_reaction("everyone")

@broadcast_bp.route("/admins/reaction/delete", methods=["POST"])
@jwt_required()
def delete_reaction_admins():
    return delete_reaction("admins")

# NEW: summary + mark-read backward-compat
@broadcast_bp.route("/everyone/summary", methods=["GET"])
@jwt_required()
def summary_everyone():
    return get_channel_summary("everyone")

@broadcast_bp.route("/admins/summary", methods=["GET"])
@jwt_required()
def summary_admins():
    return get_channel_summary("admins")

@broadcast_bp.route("/everyone/mark-read", methods=["POST"])
@jwt_required()
def mark_read_everyone():
    return mark_read("everyone")

@broadcast_bp.route("/admins/mark-read", methods=["POST"])
@jwt_required()
def mark_read_admins():
    return mark_read("admins")
