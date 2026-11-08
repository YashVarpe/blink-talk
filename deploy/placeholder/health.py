"""Placeholder backend on :8000 until AT's FastAPI app is deployed.
Answers GET /api/health with {"ok": true}; everything else is 404. Standard library only (no venv needed)."""
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/health":
            body = b'{"ok": true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)


# 127.0.0.1 = only reachable from inside the server (Caddy), never directly from the internet
HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
