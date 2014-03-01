

module.exports = function(d, i, desti) {
	var t = new Date().getTime();
	return {
		data: d,
		timestamp: t,
		ack: false,
		timestamp2: 0,
		id: i,
		destid: desti,
	};
};
