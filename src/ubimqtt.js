function UbiMqtt(serverAddress)
{
var self = this;

var mqtt = require("mqtt");

var client  = null;

// {topic: [{listener: xx, obj: yy, publicKey:zz }, ...] }
var subscriptions = new Object();

var handleIncomingMessage = function(topic, message)
	{
	if (!subscriptions.hasOwnProperty(topic))
		return;

	for (let i = 0; i < subscriptions[topic].length; i++)
		{
		if (subscriptions[topic][i].publicKey)
			{
			//check if signature is correct
			}
		subscriptions[topic][i].listener.call(subscriptions[topic][i].obj, topic, message);
		}
	};

self.connect = function(callback)
	{
	let tempClient = mqtt.connect(serverAddress);

	tempClient.on("connect", function ()
		{
		console.log("tempClient.on connect");
		client = tempClient;
  	callback(null);
    });

	tempClient.on("message", function (topic, message)
		{
		 // message is Buffer
		handleIncomingMessage(topic, message.toString());
		});
	};

self.disconnect = function(callback)
	{
	if (client)
		{
		client.end(false, function()
			{
			client = null;
			callback(null);
			});
		}
	else
		{
		callback("Error: trying to disconnect non-connected client");
		}
	};

self.publish = function(topic, message, callback)
	{
	if (client)
		client.publish(topic, message, null, callback);
	};

self.subscribe = function(topic, obj, listener, callback)
	{
	//if publicKey is given, only let events with correct public key through

	if (!subscriptions.hasOwnProperty(topic))
		subscriptions[topic] = new Array();

	subscriptions[topic].push({listener: listener, obj: obj});

	client.subscribe(topic, null, callback);
	};
}

if (typeof exports !== "undefined")
	module.exports = UbiMqtt;
