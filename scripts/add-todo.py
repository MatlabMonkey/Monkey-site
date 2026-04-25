#!/usr/bin/env python3
"""
Quick Todo Adder Script
Usage: python add-todo.py "Your todo item here"
"""

import sys
import os
import json
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime

# Configuration
TODO_API_URL = os.getenv("TODO_API_URL", "https://ztbrown.com/api/webhook/todos")
WEBHOOK_SECRET = (
    os.getenv("TODO_WEBHOOK_SECRET")
    or os.getenv("WEBHOOK_SECRET")
    or os.getenv("CAPTURE_API_KEY")
    or ""
)

def add_todo(content, source="Desktop"):
    """Add a todo item via the webhook API"""
    
    if not content.strip():
        print("❌ Error: Todo content cannot be empty")
        return False
    
    # Prepare the data
    data = {
        "content": content.strip(),
        "source": source
    }
    
    # Convert to JSON
    json_data = json.dumps(data).encode('utf-8')
    
    # Create the request
    req = urllib.request.Request(
        TODO_API_URL,
        data=json_data,
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'TodoScript/1.0'
        }
    )
    
    # Add authentication if webhook secret is configured
    if WEBHOOK_SECRET:
        req.add_header('Authorization', f'Bearer {WEBHOOK_SECRET}')
    
    try:
        # Send the request
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            if result.get('success'):
                print(f"✅ Todo added successfully!")
                print(f"📝 Content: {content}")
                print(f"🕒 Time: {datetime.now().strftime('%H:%M:%S')}")
                return True
            else:
                print(f"❌ Error: {result.get('error', 'Unknown error')}")
                return False
                
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error {e.code}: {e.reason}")
        try:
            error_data = json.loads(e.read().decode('utf-8'))
            print(f"   Details: {error_data.get('error', 'No details available')}")
        except:
            pass
        return False
        
    except urllib.error.URLError as e:
        print(f"❌ Connection Error: {e.reason}")
        print("   Check your internet connection and API URL")
        return False
        
    except json.JSONDecodeError:
        print("❌ Error: Invalid response from server")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

def main():
    """Main function to handle command line arguments"""
    
    if len(sys.argv) < 2:
        print("🚀 Quick Todo Adder")
        print("Usage: python add-todo.py \"Your todo item here\"")
        print("\nExamples:")
        print("  python add-todo.py \"Buy groceries\"")
        print("  python add-todo.py \"Call dentist for appointment\"")
        print("  python add-todo.py \"Review project proposal by Friday\"")
        return
    
    # Join all arguments as the todo content
    todo_content = " ".join(sys.argv[1:])
    
    print(f"🔄 Adding todo: {todo_content}")
    success = add_todo(todo_content)
    
    if success:
        print("🎉 Done! Check your dashboard inbox.")
    else:
        print("💡 Tip: Make sure your API URL and internet connection are working.")
    
    # Keep window open for a moment so user can see the result
    input("\nPress Enter to close...")

if __name__ == "__main__":
    main()
