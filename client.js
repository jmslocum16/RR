var socket = io.connect('//localhost:3000');

socket.on('welcome', function(data) {
	$('#messages').append('<li>' + data.message + '</li>');
	socket.emit('i am client', {data: 'foo!'});
});

socket.on('error', function() { console.error(arguments) });
socket.on('message', function() { console.log(arguments) });
socket.on('registered', function(data) { console.log(data); clientNum = data.cnum });

window.onbeforeunload = function(e) {
	socket.emit('end');
}
