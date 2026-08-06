const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const lobbies = {};
const portSet = 8087;

function generateUid() {
    let uid = '';
    for (let i = 0; i < 4; i++) {
        uid += Math.floor(Math.random() * 10).toString();
    }
    return uid;
}

async function websocketHandler(ws) {
    let uid = null;
    let role = null;
    let lobby = null;

    ws.once('message', (msg) => {
        let data;
        try {
            data = JSON.parse(msg.toString());
            if (data.type !== 'join') {
                ws.close();
                return;
            }
            uid = data.uid;
            role = data.role;
            if (uid === undefined || role === undefined) {
                throw new Error('uid of role ontbreekt');
            }
        } catch (e) {
            ws.close();
            return;
        }

        if (!lobbies[uid]) {
            lobbies[uid] = { host: null, joiner: null, connections: [] };
        }
        lobby = lobbies[uid];

        if (role === 'host') {
            if (lobby.host !== null) {
                ws.send(JSON.stringify({ type: 'error', message: 'Host bestaat al' }));
                ws.close();
                return;
            }
            lobby.host = ws;
        } else {
            if (lobby.joiner !== null) {
                ws.send(JSON.stringify({ type: 'error', message: 'Joiner bestaat al' }));
                ws.close();
                return;
            }
            lobby.joiner = ws;
        }

        lobby.connections.push(ws);
        ws.send(JSON.stringify({ type: 'joined', role: role }));

        if (lobby.host !== null && lobby.joiner !== null) {
            for (const conn of lobby.connections) {
                conn.send(JSON.stringify({ type: 'start' }));
            }
        }

        // Relay loop
        ws.on('message', (message) => {
            const other = (ws === lobby.joiner) ? lobby.host : lobby.joiner;
            if (other) {
                other.send(message.toString());
            }
        });
    });

    ws.on('close', () => {
        if (!lobby) return;
        const idx = lobby.connections.indexOf(ws);
        if (idx !== -1) lobby.connections.splice(idx, 1);
        if (lobby.host === ws) lobby.host = null;
        if (lobby.joiner === ws) lobby.joiner = null;
        if (lobby.connections.length === 0) delete lobbies[uid];
    });
}

// Map file extensions to MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
};

function getContentType(ext) {
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

class HTTPHandler {
    static handle(req, res) {
        // Parse request URL
        const parsedUrl = url.parse(req.url);
        let pathname = parsedUrl.pathname;
        if (pathname === '/') pathname = '/index.html';

        // Prevent directory traversal
        const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(process.cwd(), safePath);

        // Ensure the resolved path is inside the current working directory
        if (!filePath.startsWith(process.cwd())) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.stat(filePath, (err, stats) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('404 Not Found');
                } else {
                    res.writeHead(500);
                    res.end('500 Internal Server Error');
                }
                return;
            }

            if (stats.isDirectory()) {
                // Try to serve index.html inside the directory
                const indexPath = path.join(filePath, 'index.html');
                fs.stat(indexPath, (err2, stats2) => {
                    if (err2 || !stats2.isFile()) {
                        res.writeHead(404);
                        res.end('404 Not Found');
                    } else {
                        serveFile(indexPath, res);
                    }
                });
            } else if (stats.isFile()) {
                serveFile(filePath, res);
            } else {
                res.writeHead(404);
                res.end('404 Not Found');
            }
        });
    }
}

function serveFile(filePath, res) {
    const ext = path.extname(filePath);
    const contentType = getContentType(ext);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('500 Internal Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

function runHttpServer(port) {
    const server = http.createServer(HTTPHandler.handle);
    server.listen(port, '0.0.0.0', () => {
        console.log(`Launched: http://127.0.0.1:${port}`);
    });
    return server;
}

function main() {
    const port = portSet;
    runHttpServer(port);

    const wss = new WebSocket.Server({ host: '0.0.0.0', port: 8765 });
    wss.on('connection', websocketHandler);
}

main();