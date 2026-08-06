import asyncio
import websockets
import json
import random
import string
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import os
import mimetypes

lobbies = {}
portSet = 8087

def generate_uid():
    return ''.join(random.choices(string.digits, k=4))

async def websocket_handler(websocket, path=None):
    # (unchanged – your original logic)
    try:
        msg = await websocket.recv()
        data = json.loads(msg)
        if data.get('type') != 'join':
            await websocket.close()
            return
        uid = data['uid']
        role = data['role']
    except Exception:
        await websocket.close()
        return

    if uid not in lobbies:
        lobbies[uid] = {'host': None, 'joiner': None, 'connections': []}

    lobby = lobbies[uid]

    if role == 'host':
        if lobby['host'] is not None:
            await websocket.send(json.dumps({'type': 'error', 'message': 'Host bestaat al'}))
            await websocket.close()
            return
        lobby['host'] = websocket
    else:
        if lobby['joiner'] is not None:
            await websocket.send(json.dumps({'type': 'error', 'message': 'Joiner bestaat al'}))
            await websocket.close()
            return
        lobby['joiner'] = websocket

    lobby['connections'].append(websocket)
    await websocket.send(json.dumps({'type': 'joined', 'role': role}))

    if lobby['host'] is not None and lobby['joiner'] is not None:
        for conn in lobby['connections']:
            await conn.send(json.dumps({'type': 'start'}))

    try:
        async for message in websocket:
            other = lobby['host'] if websocket == lobby['joiner'] else lobby['joiner']
            if other:
                await other.send(message)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if websocket in lobby['connections']:
            lobby['connections'].remove(websocket)
        if lobby['host'] == websocket:
            lobby['host'] = None
        if lobby['joiner'] == websocket:
            lobby['joiner'] = None
        if not lobby['connections']:
            del lobbies[uid]

class HTTPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Remove query string
        path = self.path.split('?')[0]
        if path == '/':
            path = '/index.html'

        # Prevent directory traversal (only basic check)
        if '..' in path:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'Forbidden')
            return

        # Build filesystem path
        file_path = '.' + path  # relative to current working dir

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            # Guess MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type is None:
                mime_type = 'application/octet-stream'
            self.send_response(200)
            self.send_header('Content-type', mime_type)
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')
        except Exception:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'500 Internal Server Error')

def run_http_server(port):
    HTTPServer(('0.0.0.0', port), HTTPHandler).serve_forever()

async def main():
    port = portSet
    http_thread = threading.Thread(target=run_http_server, args=(port,), daemon=True)
    http_thread.start()
    print(f"Launched: http://127.0.0.1:{port}")
    async with websockets.serve(websocket_handler, '0.0.0.0', 8765):
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())