var http = require('http');

var app = http.createServer(function(req, res) {
		console.log(res);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("moo");
});

// Socket.io server listens to our app
var io = require('socket.io').listen(app);
var message = require('./message');
//var myMessage = message.createMessage({a: 'test'}, 0, 0);
//console.log(myMessage.data);

function mqSendMessage(m) {
	console.log('sending message '); console.log(m);
	for (var i = 0; i < connections.length; i++) {
		if (m.destid == connections[i].number) {
			connections[i].sock.emit('message', m);
			return;
		}
	}
	console.error('message destination not found');
}

var messagequeue = require('./messagequeue');
messagequeue.sendMessage = mqSendMessage;
messagequeue.mLoop();
/*messagequeue.addMessage(message({a: 'test'}, -1, 0));
setTimeout(function(){messagequeue.ackMessage(0)}, 1500);*/

var nextClientNumber = 0;
var connections = new Array();

function Connection(num, sock, ip) {
	this.number = num;
	this.sock = sock;
	this.ip = ip;
	this.active = true;
}

function getNextClientNumber() {
	return nextClientNumber++;
}

function registerNextClient(sock, ip) {
	var next = getNextClientNumber();
	connections.push(new Connection(next, sock, ip));
	return next;
}

function handleClientConnect(sock, ip) {
	/*for (var i = 0; i < connections.length; i++) {
		if (connections[i].ip == ip) {
			if (connections[i].active) {
				console.log('still active client is trying to connect....');
				return -1;
			} else {
				connections[i].active = true;
				connections[i].sock = sock;
				return connections[i].number;
			}
		}
	}*/
	return registerNextClient(sock, ip);
}

function handleClientDisconnect(ip, socket) {
	for (var i = 0; i < connections.length; i++) {
		if (connections[i].ip == ip && connections[i].sock == socket) {
			console.log('found socket');
			connections[i].active = false;
			return;
		}
	}
	console.log('didn\'t find socket :(');
}

function transmitClientMessage(m, to) {
	console.log('passing message ' + m.data + ' to client ' + to);
	m2 = message.createMessage(m.data, m.cid, to);
	m2.timestamp = m.timestamp;
	messagequeue.addMessage(m2);
}

function handleClientMessage(m) {
	var id = m.cid;
	for (var i = 0; i < connections.length; i++) {
		if (connections[i].number != id && connections[i].active) {
			transmitClientMessage(m, connections[i].number);
		}
	}
}

// Emit welcome message on connection
io.sockets.on('connection', function(socket) {
		// annoying stuff
		console.log('socket connected');
    socket.emit('welcome', { message: 'Welcome!'});
    socket.on('i am client', function(data) {
			console.log(data);
			// console.log(socket);
			//var address = socket.address();
			var address = socket.manager.handshaken[socket.id].address;
			console.log(address.address);
			var num = handleClientConnect(socket, address.address);
			if (num != -1) {
				socket.emit('registered', {message:'you are client number ' + num, cnum: num});	
			} else {
				socket.emit('error', {message:'only one instance of the program per ip address!'});
			}
		});
		socket.on('end', function(data) {
			var address = socket.manager.handshaken[socket.id].address;
			console.log('disconnecting socket with address ' + address.address);
			handleClientDisconnect(address.address, socket);
			socket.disconnect('unauthorized');
		});	
		// RR state stuff
		socket.on('get state', function(data) { 
			var id = data.cnum;
			socket.emit('set state', gameState);	
		});

		socket.on('message', function(m) {
				console.log('got message ');
				console.log(m.data);
				handleClientMessage(m);
				socket.emit('ack', {id: m.id});
		});

		socket.on('ack', function(a) {
			messagequeue.ackMessage(a.id);
		});
});

/*io.sockets.on('disconnect', function(socket) {
	var address = socket.manager.handshaken[socket.id].address;
	console.log('disconnecting socket with address ' + address.address);
	handleClientDisconnect(address.address);
});*/


app.listen(3000);
