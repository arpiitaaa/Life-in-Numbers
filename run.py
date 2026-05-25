import os
import sys
import subprocess
import webbrowser
import time
from threading import Timer

def install_dependencies():
    print("Checking dependencies...")
    try:
        import flask
        print("Flask is already installed.")
    except ImportError:
        print("Flask not found. Installing via pip...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])
            print("Flask successfully installed!")
        except Exception as e:
            print(f"Error installing dependencies: {e}")
            print("Please run: pip install flask")
            sys.exit(1)

def open_browser():
    print("Opening browser...")
    webbrowser.open("http://127.0.0.1:5000")

if __name__ == '__main__':
    install_dependencies()
    
    # Schedule browser opening after 1.5 seconds to let the server initialize
    Timer(1.5, open_browser).start()
    
    print("Starting Life in Numbers server...")
    print("Dashboard will open in your default browser shortly.")
    print("To stop the server, press Ctrl+C in this terminal.")
    
    from app import app
    app.run(debug=True, port=5000, host="127.0.0.1")
