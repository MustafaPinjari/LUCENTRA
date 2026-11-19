"""LUCENTRA Demonstration Static HTTP Server.

Serves the demo application on port 8080 with support for live tamper switching.
Usage:
  python demo/server.py [--tamper] [--port 8080]
"""

import os
import sys
import argparse
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TAMPERED_MODE = False


class DemoHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        global TAMPERED_MODE
        # Endpoint to toggle tamper mode on the fly
        if self.path == "/api/tamper/toggle":
            TAMPERED_MODE = not TAMPERED_MODE
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            status = "TAMPERED" if TAMPERED_MODE else "AUTHENTIC"
            self.wfile.write(f'{{"tamper_mode": {str(TAMPERED_MODE).lower()}, "status": "{status}"}}'.encode())
            return

        if self.path == "/api/tamper/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            status = "TAMPERED" if TAMPERED_MODE else "AUTHENTIC"
            self.wfile.write(f'{{"tamper_mode": {str(TAMPERED_MODE).lower()}, "status": "{status}"}}'.encode())
            return

        # Serve either authentic or tampered app.js based on mode
        if self.path == "/static/js/app.js":
            target_file = "app.tampered.js" if TAMPERED_MODE else "app.js"
            target_path = os.path.join(BASE_DIR, "static", "js", target_file)
            try:
                with open(target_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript")
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_error(500, f"Error reading script: {e}")
                return

        return super().do_GET()


def main():
    global TAMPERED_MODE
    parser = argparse.ArgumentParser(description="LUCENTRA Demo Server")
    parser.add_argument("--port", type=int, default=8080, help="Port to serve on (default: 8080)")
    parser.add_argument("--tamper", action="store_true", help="Start in tampered mode")
    args = parser.parse_args()

    if args.tamper:
        TAMPERED_MODE = True

    server_address = ("127.0.0.1", args.port)
    httpd = HTTPServer(server_address, DemoHTTPRequestHandler)
    mode_str = "TAMPERED" if TAMPERED_MODE else "AUTHENTIC"
    print(f"[LUCENTRA] Demo Server listening at http://127.0.0.1:{args.port} (Mode: {mode_str})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[LUCENTRA] Demo Server stopped.")


if __name__ == "__main__":
    main()

