import tkinter as tk
from tkinter import messagebox
from rapidfuzz import fuzz, process
import pyperclip

# Morse dictionaries
CHARS_TO_MORSE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..'
}
MORSE_TO_CHARS = {morse: char for char, morse in CHARS_TO_MORSE.items()}

def english_to_morse(text):
    morse = ''
    for char in text.upper():
        if char == ' ': morse += '   '
        elif char in CHARS_TO_MORSE: morse += CHARS_TO_MORSE[char] + ' '
    return morse.strip()

def ai_morse_to_english(morse):  # AI-powered with fuzzy matching
    words = morse.strip().split('   ')
    result = ''
    for word in words:
        letters = word.split()
        for morse_letter in letters:
            if morse_letter in MORSE_TO_CHARS:
                result += MORSE_TO_CHARS[morse_letter]
            else:
                # AI finds closest match
                matches = process.extract(morse_letter, MORSE_TO_CHARS.keys(), scorer=fuzz.ratio, limit=1)
                if matches and matches[0][1] > 70:
                    result += MORSE_TO_CHARS[matches[0][0]]
                else:
                    result += '?'
        result += ' '
    return result.strip()

def translate():
    input_text = input_box.get("1.0", "end-1c").strip()
    if not input_text: 
        messagebox.showwarning("Input needed", "Enter text!")
        return
    
    if var.get() == 1:  # Text to Morse
        result = english_to_morse(input_text)
    else:  # Morse to Text (AI)
        result = ai_morse_to_english(input_text)
    
    output_box.config(state='normal')
    output_box.delete("1.0", "end")
    output_box.insert("1.0", result)
    output_box.config(state='disabled')

def copy_text():
    text = output_box.get("1.0", "end-1c")
    if text: 
        pyperclip.copy(text)
        status_label.config(text="✅ Copied to clipboard!")

# GUI Setup
root = tk.Tk()
root.title("🤖 AI Morse Nexus")
root.geometry("700x500")
root.configure(bg='black')

var = tk.IntVar(value=1)
status_label = tk.Label(root, text="AI Ready! 🚀", bg='black', fg='cyan', font=('Arial', 12))

tk.Label(root, text="Mode:", bg='black', fg='cyan', font=('Arial', 14)).pack(pady=10)
tk.Radiobutton(root, text="📝 Text → Morse", variable=var, value=1, bg='black', fg='white', font=('Arial', 12)).pack()
tk.Radiobutton(root, text="📡 Morse → Text (AI)", variable=var, value=2, bg='black', fg='white', font=('Arial', 12)).pack()

tk.Label(root, text="Input:", bg='black', fg='cyan', font=('Arial', 14)).pack(pady=(20,5))
input_box = tk.Text(root, height=6, font=('Consolas', 12), bg='#1a1a1a', fg='white', insertbackground='cyan')
input_box.pack(fill='x', padx=20)

tk.Button(root, text="🎯 TRANSLATE", command=translate, bg='#00ff00', fg='black', 
          font=('Arial', 14, 'bold'), pady=10, width=15).pack(pady=15)

tk.Label(root, text="Output:", bg='black', fg='cyan', font=('Arial', 14)).pack(pady=(5,5))
output_box = tk.Text(root, height=6, state='disabled', font=('Consolas', 12), 
                     bg='#1a1a1a', fg='#00ff00', insertbackground='cyan')
output_box.pack(fill='x', padx=20)

tk.Button(root, text="📋 Copy Output", command=copy_text, bg='#ff6b35', fg='white', 
          font=('Arial', 12, 'bold'), pady=5).pack(pady=10)
status_label.pack(pady=10)

root.mainloop()
