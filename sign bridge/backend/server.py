from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sqlite3
import hashlib

app = Flask(__name__)
CORS(app, resources={r"/send-emergency": {"origins": "*"}})

def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  email TEXT UNIQUE, 
                  password TEXT,
                  sender_email TEXT,
                  sender_password TEXT)''')
    conn.commit()
    conn.close()

init_db()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = hash_password(data.get('password'))
    sender_email = data.get('sender_email')
    sender_password = data.get('sender_password')
    
    try:
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute("INSERT INTO users (email, password, sender_email, sender_password) VALUES (?, ?, ?, ?)",
                  (email, password, sender_email, sender_password))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Registration successful!'})
    except:
        return jsonify({'success': False, 'message': 'Email already exists!'}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = hash_password(data.get('password'))
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT sender_email, sender_password FROM users WHERE email=? AND password=?", (email, password))
    result = c.fetchone()
    conn.close()
    
    if result:
        return jsonify({
            'success': True, 
            'sender_email': result[0],
            'sender_password': result[1]
        })
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials!'}), 401

@app.route('/send-emergency', methods=['POST'])
def emergency_alert():
    data = request.json
    sender_email = data.get('sender_email')
    sender_password = data.get('sender_password')
    receiver_email = data.get('receiver_email')
    
    if not sender_email or not sender_password or not receiver_email:
        return jsonify({'success': False, 'message': 'Missing credentials'}), 400
    
    subject = "EMERGENCY ALERT!"
    body = "I AM IN EMERGENCY! Please help me immediately!"
    
    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = receiver_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        
        text = msg.as_string()
        server.sendmail(sender_email, receiver_email, text)
        server.quit()
        
        return jsonify({'success': True, 'message': 'Email sent successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/')
def home():
    return "Communication Bridge API Running!"

if __name__ == '__main__':
    app.run(debug=True, port=5000)