import os
import threading
import smtplib
from email.message import EmailMessage
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_bcrypt import Bcrypt

app = Flask(__name__)

# --- CONFIGURATION ---
# Use Environment Variable for Secret Key or a fallback for local dev
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default_secret_key_123')
# SQLite database setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'index'

# --- EMAIL BACKGROUND TASK ---
def send_mail_async(receiver_email, admin_email, admin_password):
    """Sends email in a separate thread to prevent Render 'SIGKILL' timeouts."""
    try:
        msg = EmailMessage()
        msg['Subject'] = "🚨 SIGN BRIDGE: EMERGENCY ALERT"
        msg['From'] = admin_email
        msg['To'] = receiver_email
        msg.set_content("An emergency gesture was detected by the Sign Bridge app. Please check on the user immediately.")

        # Gmail uses Port 465 for SSL
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(admin_email, admin_password)
            smtp.send_message(msg)
        print(f"✅ Email sent successfully to {receiver_email}")
    except Exception as e:
        print(f"❌ Background Email Error: {e}")

# --- DATABASE MODELS ---
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    receiver_email = db.Column(db.String(150), nullable=True)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- ROUTES ---

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        receiver = request.form.get('receiver_email')
        
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user = User(username=username, email=email, password=hashed_pw, receiver_email=receiver)
        
        try:
            db.session.add(new_user)
            db.session.commit()
            flash('Account created! Please login.', 'success')
            return redirect(url_for('index'))
        except:
            flash('Username or Email already exists.', 'danger')
            
    return render_template('register.html')

@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email')
    password = request.form.get('password')
    user = User.query.filter_by(email=email).first()
    
    if user and bcrypt.check_password_hash(user.password, password):
        login_user(user)
        return redirect(url_for('home'))
    else:
        flash('Login Unsuccessful. Check email and password', 'danger')
        return redirect(url_for('index'))

@app.route('/home')
@login_required
def home():
    return render_template('home.html', user=current_user)

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/send-emergency', methods=['POST'])
def send_emergency():
    data = request.get_json()
    receiver = data.get('email')
    
    # Must match your Render Environment Variable Keys
    admin_email = os.environ.get('ADMIN_EMAIL')
    admin_pass = os.environ.get('ADMIN_PASSWORD')

    if not receiver:
        return jsonify({"success": False, "error": "No receiver email"}), 400

    if admin_email and admin_pass:
        # Launch the email task in the background
        thread = threading.Thread(target=send_mail_async, args=(receiver, admin_email, admin_pass))
        thread.start()
        return jsonify({"success": True, "message": "Background alert started"}), 200
    
    print("❌ Critical: Environment variables ADMIN_EMAIL or ADMIN_PASSWORD are missing!")
    return jsonify({"success": False, "error": "Server configuration error"}), 500

# --- DATABASE INITIALIZATION ---
# This ensures tables are created on Render even if the disk resets
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)