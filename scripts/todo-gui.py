#!/usr/bin/env python3
"""
Quick Todo Adder - GUI Version
A simple GUI for adding todos quickly
"""

import tkinter as tk
from tkinter import ttk, messagebox
import json
import urllib.request
import urllib.parse
import urllib.error
import threading
from datetime import datetime

# Configuration - UPDATE THESE VALUES
TODO_API_URL = "https://ztbrown.com/api/webhook/todos"  # Replace with your actual domain
WEBHOOK_SECRET = "your-webhook-secret-here"  # Optional: for authentication

class TodoAdderGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Quick Todo Adder")
        self.root.geometry("500x300")
        self.root.resizable(False, False)
        
        # Center the window
        self.center_window()
        
        # Create the UI
        self.create_widgets()
        
        # Focus on the text entry
        self.todo_entry.focus()
        
        # Bind Enter key to add todo
        self.root.bind('<Return>', lambda e: self.add_todo())
        self.root.bind('<Escape>', lambda e: self.root.quit())
    
    def center_window(self):
        """Center the window on the screen"""
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() // 2) - (500 // 2)
        y = (self.root.winfo_screenheight() // 2) - (300 // 2)
        self.root.geometry(f"500x300+{x}+{y}")
    
    def create_widgets(self):
        """Create the GUI widgets"""
        
        # Main frame
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Title
        title_label = ttk.Label(main_frame, text="🚀 Quick Todo Adder", font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 20))
        
        # Todo entry
        ttk.Label(main_frame, text="What needs to be done?", font=("Arial", 10)).grid(row=1, column=0, columnspan=2, sticky=tk.W, pady=(0, 5))
        
        self.todo_entry = tk.Text(main_frame, height=4, width=50, font=("Arial", 11), wrap=tk.WORD)
        self.todo_entry.grid(row=2, column=0, columnspan=2, pady=(0, 15), sticky=(tk.W, tk.E))
        
        # Buttons frame
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=3, column=0, columnspan=2, pady=(0, 15))
        
        # Add button
        self.add_button = ttk.Button(button_frame, text="✅ Add Todo", command=self.add_todo)
        self.add_button.pack(side=tk.LEFT, padx=(0, 10))
        
        # Clear button
        clear_button = ttk.Button(button_frame, text="🗑️ Clear", command=self.clear_text)
        clear_button.pack(side=tk.LEFT, padx=(0, 10))
        
        # Close button
        close_button = ttk.Button(button_frame, text="❌ Close", command=self.root.quit)
        close_button.pack(side=tk.LEFT)
        
        # Status label
        self.status_label = ttk.Label(main_frame, text="Ready to add todos!", foreground="green")
        self.status_label.grid(row=4, column=0, columnspan=2, pady=(10, 0))
        
        # Progress bar (hidden initially)
        self.progress = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        self.progress.grid_remove()  # Hide initially
        
        # Configure grid weights
        main_frame.columnconfigure(0, weight=1)
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
    
    def clear_text(self):
        """Clear the text entry"""
        self.todo_entry.delete(1.0, tk.END)
        self.todo_entry.focus()
    
    def add_todo(self):
        """Add the todo item"""
        content = self.todo_entry.get(1.0, tk.END).strip()
        
        if not content:
            messagebox.showwarning("Empty Todo", "Please enter a todo item!")
            return
        
        # Disable the button and show progress
        self.add_button.config(state='disabled')
        self.progress.grid()
        self.progress.start()
        self.status_label.config(text="Adding todo...", foreground="blue")
        
        # Run the API call in a separate thread
        thread = threading.Thread(target=self.add_todo_thread, args=(content,))
        thread.daemon = True
        thread.start()
    
    def add_todo_thread(self, content):
        """Add todo in a separate thread"""
        success = self.call_api(content)
        
        # Update UI in main thread
        self.root.after(0, self.add_todo_complete, success, content)
    
    def call_api(self, content):
        """Call the todo API"""
        data = {
            "content": content,
            "source": "Desktop-GUI"
        }
        
        json_data = json.dumps(data).encode('utf-8')
        
        req = urllib.request.Request(
            TODO_API_URL,
            data=json_data,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'TodoScript-GUI/1.0'
            }
        )
        
        if WEBHOOK_SECRET:
            req.add_header('Authorization', f'Bearer {WEBHOOK_SECRET}')
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result.get('success', False)
        except Exception as e:
            print(f"API Error: {e}")
            return False
    
    def add_todo_complete(self, success, content):
        """Handle completion of todo addition"""
        # Stop progress and re-enable button
        self.progress.stop()
        self.progress.grid_remove()
        self.add_button.config(state='normal')
        
        if success:
            self.status_label.config(text=f"✅ Todo added successfully! ({datetime.now().strftime('%H:%M:%S')})", foreground="green")
            self.clear_text()
            
            # Show success message
            messagebox.showinfo("Success", f"Todo added successfully!\n\n📝 {content}")
        else:
            self.status_label.config(text="❌ Failed to add todo. Check your connection.", foreground="red")
            messagebox.showerror("Error", "Failed to add todo. Please check your internet connection and try again.")

def main():
    root = tk.Tk()
    app = TodoAdderGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
