from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

app = Flask(__name__)
# IMPORTANT: In a real app, use an environment variable for the secret key
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-this')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'index'

# Email Config (Admin sets this globally)
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', "your_email@gmail.com")
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', "your_app_password")

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- DATABASE MODEL ---
# Added UserMixin here to fix the 'is_active' error
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    receiver_email = db.Column(db.String(150), nullable=True)

# --- DATABASE INITIALIZATION ---
# Moved outside of __main__ so it runs under Gunicorn on Render
with app.app_context():
    db.create_all()

# --- ROUTES ---
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    
    if User.query.filter_by(email=email).first():
        flash('Email already exists!', 'error')
        return redirect(url_for('index'))
    
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, email=email, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    
    flash('Account created! Please login.', 'success')
    return redirect(url_for('index'))

@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email')
    password = request.form.get('password')
    user = User.query.filter_by(email=email).first()
    
    if user and bcrypt.check_password_hash(user.password, password):
        login_user(user)
        return redirect(url_for('dashboard'))
    else:
        flash('Invalid email or password!', 'error')
        return redirect(url_for('index'))

@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    if request.method == 'POST':
        receiver_email = request.form.get('receiver_email')
        current_user.receiver_email = receiver_email
        db.session.commit()
        flash('Receiver email saved!', 'success')
        return redirect(url_for('home'))
    return render_template('dashboard.html', user=current_user)

@app.route('/home')
@login_required
def home():
    if not current_user.receiver_email:
        flash('Please set receiver email first!', 'warning')
        return redirect(url_for('dashboard'))
    return render_template('home.html', user=current_user)

@app.route('/send-emergency', methods=['POST'])
def send_emergency():
    data = request.json
    receiver_email = data.get('email')
    
    if not receiver_email:
        return {'success': False, 'message': 'No email provided'}, 400
    
    subject = "EMERGENCY ALERT!"
    body = "I AM IN EMERGENCY! Please help me immediately!"
    
    try:
        msg = MIMEMultipart()
        msg['From'] = ADMIN_EMAIL
        msg['To'] = receiver_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        server.sendmail(ADMIN_EMAIL, receiver_email, msg.as_string())
        server.quit()
        
        return {'success': True, 'message': 'Email sent successfully!'}
    except Exception as e:
        return {'success': False, 'message': str(e)}, 500

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

if __name__ == "__main__":
    app.run()