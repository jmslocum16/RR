var socket = io.connect('//localhost:3000');

function mqSendMessage(m) {
	console.log('client sending message ' + m.data);
	// ignores destid because there's only 1 possible destination
	socket.emit('message', m);
}

function sendMessage(data) {
	console.log('doing a send message');
	m = message.createMessage(data, clientNum, 0);
	messagequeue.addMessage(m);
}
/*var myMessage = message.createMessage({a: 'test'}, 0);
messagequeue.addMessage(myMessage);
setTimeout(function(){messagequeue.ackMessage(0)}, 1500);*/

function handleServerMessage(m) {
	// add to queue of messages to be processed in animation loop
	updateQueue.push(m.data);
}

updateQueue = new Array();
messagequeue.sendMessage = mqSendMessage;
messagequeue.mLoop();

socket.on('welcome', function(data) {
	$('#messages').append('<li>' + data.message + '</li>');
	socket.emit('i am client', {data: 'foo!'});
});

socket.on('error', function() { console.error(arguments) });
socket.on('registered', function(data) { console.log('i am client ' + data.cnum); clientNum = data.cnum; sendMessage({a: 'test'})});
socket.on('ack', function(data) {console.log('acking '); console.log(data); messagequeue.ackMessage(data.id)});
socket.on('message', function(m) {console.log('got message '); console.log(m); handleServerMessage(m); socket.emit('ack', {id: m.id})});

window.onbeforeunload = function(e) {
	socket.emit('end');
}



function processUpdateQueue() {
	while(updateQueue.length > 0) {
		data = updateQueue.shift();
		// process data
		if (data != undefined && data.type != undefined) {
			
		}
	}
}


// game stuff
function update() {

}

function draw() {

}


var ms = 25;

function gameLoop() {
	t = new Date().getTime();
	processUpdateQueue();
	update();
	draw();
	t = new Date().getTime() - t;
	setTimeout(gameLoop, Math.min(0, ms - t));
}
