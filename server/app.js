const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

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

        // Vanaf hier: relay-loop, gelijkaardig aan "async for message in websocket"
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

class HTTPHandler {
    static handle(req, res) {
        if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            fs.readFile('index.html', (err, data) => {
                if (err) {
                    res.end('<h1>index.html niet gevonden</h1>');
                } else {
                    res.end(data);
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    }
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