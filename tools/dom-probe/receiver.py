from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import json
# Loopback-only evidence sink for tools/dom-probe/probe.js. Accepts POST /evidence only.
OUT = Path(__file__).resolve().parent / 'out.jsonl'
class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','Content-Type'); self.end_headers()
    def do_POST(self):
        n=int(self.headers.get('Content-Length','0'))
        if self.path != '/evidence' or n > 3000000:
            self.send_error(400); return
        data=json.loads(self.rfile.read(n))
        with OUT.open('a') as f: f.write(json.dumps(data)+'\n')
        self.send_response(200); self.send_header('Access-Control-Allow-Origin','*'); self.end_headers(); self.wfile.write(b'OK')
    def log_message(self,*args): pass
HTTPServer(('127.0.0.1',18794),Handler).serve_forever()
