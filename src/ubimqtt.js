function UbiMqtt(serverAddress)
{
var self = this;

const PUBLISHERS_PREFIX = "publishers/";

var listenerCounter = 0;

var mqtt = require("mqtt");
var jose = require("node-jose");
var PublicKeyChangeListener = require("./publickeychangelistener")

var client  = null;

// {topic: { {listenerId: a, listener: xx, obj: yy, publicKey:zz }, ..} }
var subscriptions = new Object();
var publicKeyChangeListeners = new Array();

var handleIncomingMessage = function(topic, message)
	{
	if (!subscriptions.hasOwnProperty(topic))
		return;

	for (let i in subscriptions[topic])
		{
		if (subscriptions[topic][i].publicKey)
			{
			// This topic was subscribed with subscribeSigned
			// We shall discard all messages that are not signed with the
			// correct public key
			var parsedMessage = null;
			try
				{
				parsedMessage = JSON.parse(message)
				}
			catch (e)
				{
				console.log("Message was not in JSON format");
				continue;
				}
			console.log("raw message at receiving end: "+message);

			parsedMessage.payload =  jose.util.base64url.encode(parsedMessage.payload , "utf8");


			jose.JWK.asKey(subscriptions[topic][i].publicKey, "pem")
			.then(function(key)
				{
				var opts = {algorithms: ["ES512"]};
				jose.JWS.createVerify(key, opts)
				.verify(parsedMessage)
				.then(function(result)
					{
          console.log("verification succeeded");
					subscriptions[topic][i].listener.call(subscriptions[topic][i].obj, topic, result.payload, i);
					})
				.catch(function(reason)
					{
					console.log("verification failed: "+reason);
					});
				});
			}
		else
			subscriptions[topic][i].listener.call(subscriptions[topic][i].obj, topic, message, i);
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

self.publish = function(topic, message, opts, callback)
	{
	if (client)
		{
		client.publish(topic, message, opts, callback);
		}
	else
		{
		callback("Error: Mqtt client not connected");
		}
	};

self.publishSigned = function(topic, message, opts, privateKey, callback)
		{
		console.log("privateKey: "+privateKey);

		jose.JWK.asKey(privateKey, "pem")
		.then(function(key)
			{
			jose.JWS.createSign(key)
			.update(message)
			.final()
			.then(function(result)
				{
				// {result} is a JSON object -- JWS using the JSON General Serialization
				// make the payload human-readable
				result.payload = jose.util.base64url.decode(result.payload).toString();
				console.log("jose produced: "+JSON.stringify(result));

				self.publish(topic, JSON.stringify(result), opts, callback);
				});
      });
		};

self.subscribe = function(topic, obj, listener, callback)
	{
	//if publicKey is given, only let events with correct public key through
	if (!subscriptions.hasOwnProperty(topic))
		subscriptions[topic] = new Object();

	listenerId = listenerCounter+"";
	listenerCounter++;

	subscriptions[topic][listenerId] = {listener: listener, obj: obj};

	client.subscribe(topic, null, function(err)
		{
		callback(err, listenerId);
		});
	};


self.subscribeSigned = function(topic, publicKey, obj, listener, callback)
	{
	//if publicKey is given, only let events with correct public key through
	if (!subscriptions.hasOwnProperty(topic))
		subscriptions[topic] = new Object();

	listenerId = listenerCounter+"";
	listenerCounter++;

	subscriptions[topic][listenerId] = {listener: listener, obj: obj, publicKey: publicKey};

	client.subscribe(topic, null, function(err)
		{
		callback(err, listenerId);
		});
	};

self.updatePublicKey = function(topic, listenerId, key)
	{
	if (subscriptions.hasOwnProperty(topic) && subscriptions[topic].hasOwnProperty(listenerId))
		{
		subscriptions[topic][listenerId].publicKey = key;
		console.log("UbiMqtt::updatePublicKey() updated public key for topic: "+topic+" and listenerId: "+listenerId);
		}
	};

self.subscribeFromPublisher = function(topic, publisherName, obj, listener, callback)
	{
	let publicKeyChangeListener = new PublicKeyChangeListener(self, topic, obj, listener, callback);
	publicKeyChangeListeners.push(publicKeyChangeListener);

	//subscribe to the public key of the publisher
	let publicKeyTopic = PUBLISHERS_PREFIX + publisherName + "/publicKey";
	self.subscribe(publicKeyTopic, publicKeyChangeListener, publicKeyChangeListener.onPublicKeyChanged, function(err, listenerId)
 		{
		if (err)
			return callback(err);
		});
	};
}

if (typeof exports !== "undefined")
	module.exports = UbiMqtt;
