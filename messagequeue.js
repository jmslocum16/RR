(function(exports){

var queue = new Array();
var nextid = 0;
var timeout  = 1000;

exports.addMessage = function(m) {
	m.ack = false;
	m.id = nextid++;
	m.timestamp2 = 0;
	queue.push(m);
};

exports.ackMessage = function(id) {
	for (var i = 0; i < queue.length; i++) {
		if (id == m.id) {
			m.ack = true;
			console.log('ack\'d message '  + id);
			return;
		}
	}
	console.log('couldn\'t find message ' + id + ' in queue to ack');
	// couldn't find message that was ack'd
};

exports.sendMessage = function() {
	// clients should override this to actually send the correct message
};

exports.mLoop = function() {
	var len = queue.length;
	for (var i = 0; i < len; i++) {
		m = queue.shift();
		if (m.timestamp2 == 0) {
			m.timestamp2 = new Date().getTime();
			exports.sendMessage(m);
		} else if (m.ack) {
			continue;
		} else if (m.timestamp2 + timeout < new Date().getTime()) {
			m.timestamp2 = new Date().getTime();
			exports.sendMessage(m);
		}
		queue.push(m);
	}
	setTimeout(exports.mLoop,4);
};


})(typeof exports === 'undefined'? this['messagequeue']={}: exports);
