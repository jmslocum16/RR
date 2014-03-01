(function(exports){
exports.createMessage = function(d, c, desti) {
	var t = new Date().getTime();
	return {
		data: d,
		timestamp: t,
		ack: false,
		timestamp2: 0,// assigned by message queue
		id: -1,// assigned by message queue
		cid: c,
		destid: desti,
	};
};
})(typeof exports === 'undefined'? this['message']={}: exports);
