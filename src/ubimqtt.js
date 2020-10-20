/**
* Class for signed Mqtt communications at Ubikampus
*
* @constructor
* @param {string} serverAddress the Mqtt server to cennect to
* @param {object} [options]
* @param {boolean} [options.silent] do not print logs
*/

function UbiMqtt(serverAddress, options)
{
var self = this;

var debug = function(message)
	{
		if (!options || !options.silent)
			{
				console.log(message)
			}
	}

const PUBLISHERS_PREFIX = "publishers/";

var listenerCounter = 0;

var mqtt = require("mqtt");
var jose = require("node-jose");
var crypto = require("crypto");
var mqttWildcard = require("mqtt-wildcard");

var PublicKeyChangeListener = require("./publickeychangelistener")

var client  = null;

// {topic: { {listenerId: a, listener: xx, obj: yy, publicKey:zz }, ..} }
var subscriptions = new Object();
var publicKeyChangeListeners = new Array();

var generateRandomString = function(length)
	{
	var base = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
	var bytes = crypto.randomBytes(length);

	var ret = "";
	for (var i = 0; i < bytes.length; i++)
		{
		ret += base[bytes[i]%base.length];
		};
	return ret;
	};

var verifyWithKeys = function(parsedMessage, keys, index, callback)
	{
	jose.JWK.asKey(keys[index], "pem")
	.then(function(key)
		{
		var opts = {algorithms: ["ES512"]};
		jose.JWS.createVerify(key, opts)
		.verify(parsedMessage)
		.then(function(result)
			{
			debug("UbiMqtt::handleIncomingMessage() Signature verification succeeded");
			callback(null, result.payload);
			})
		.catch(function(reason)
			{
			debug("UbiMqtt::handleIncomingMessage() Signature verification failed: "+reason);
			if (index >= keys.length)
				return callback("Verification failed");
			else
				return verifyWithKeys(parsedMessage, keys, index+1, callback);
			});
		});
	};

let decryptWithKeys = function(message, keys, callback)
	{
	let opts = { algorithms: ["ECDH-ES", "A128CBC-HS256"] };

	for (let key of keys)
		{
		jose.JWK.asKey(key, "pem")
		.then(function(key)
			{
			jose.JWE.createDecrypt(key, opts)
			.decrypt(message)
			.then(function(result)
				{
				debug("UbiMqtt::handleIncomingMessage() Decryption succeeded");
				return callback(null, result.payload.toString());
				})
			.catch(function(reason)
				{
				debug("UbiMqtt::handleIncomingMessage() Decryption failed: "+reason);
				});
			});
		}
	return callback("Decryption failed");
}

var getSubscriptionsForTopic = function(topic)
	{
	var ret = new Array();

	var keys = Object.keys(subscriptions);

	for (let i = 0; i < keys.length; i++)
		{
		if (mqttWildcard(topic, keys[i]))
			{
			//console.log("Mqtt wildcard matches, subscriptions is: "+JSON.stringify(subscriptions));

			for (var j in subscriptions[keys[i]])
				{
				//console.log("adding subscription to ret");
				ret.push(subscriptions[keys[i]][j]);

				}
			}
		}

	return ret;
	};

var handleIncomingMessage = function(topic, message)
	{
	debug("UbiMqtt::handleIncomingMessage() Raw message at receiving end. topic: "+topic +" message: "+message);

	var subscriptionsForTopic = getSubscriptionsForTopic(topic);
	for (let subscription of subscriptionsForTopic)
		{
		if (subscription.publicKeys)
			{
			// This topic was subscribed with subscribeSigned
			// We shall discard all messages that are not signed with the
			// correct public keys
			var parsedMessage = null;
			try
				{
				parsedMessage = JSON.parse(message)
				}
			catch (e)
				{
				debug("UbiMqtt::handleIncomingMessage() Message was not in JSON format in topic " + topic + " where JWS signed messages are expected");
				debug(e);
				continue;
				}

			let keys = subscription.publicKeys;

			parsedMessage.payload =  jose.util.base64url.encode(parsedMessage.payload , "utf8");
			parsedMessage.signatures[0].protected =  jose.util.base64url.encode(JSON.stringify(parsedMessage.signatures[0].protected) , "utf8");

			debug("keys:" + JSON.stringify(keys));

			verifyWithKeys(parsedMessage, keys, 0, function(err, decodedPayload)
				{
				if (!err)
					subscription.listener.call(subscription.obj, topic, decodedPayload, subscription.id);
				});
			}
		else if (subscription.privateKeys)
			{
			let keys = subscription.privateKeys;
			decryptWithKeys(message, keys, function(err, decryptedPayload)
				{
				if (!err)
					{
					subscription.listener.call(subscription.obj, topic, decryptedPayload, subscriptions.id);
					}
				});
			}
		else
			subscription.listener.call(subscription.obj, topic, message, subscription.id);
		}
	};

/**
* Connecs to the Mqtt server the address of which was given as a constructor parameter
*
* @function connect
* @memberOf UbiMqtt#
* @param {function} callback the callback to call upon connection or error
*/

self.connect = function(callback)
	{
	client = mqtt.connect(serverAddress);
	client.on("connect", function()
		{
		callback(null);
		});

	client.on("message", function (topic, message)
		{
		handleIncomingMessage(topic, message.toString());
		});

	client.on("offline", function()
		{
		callback(new Error("connection to the server was closed"));
		});

	client.on("error", function(error)
		{
		callback(error);
		});
	};

/**
* Disconnects from the Mqtt server
*
* @function disconnect
* @memberOf UbiMqtt#
* @param {function} callback the callback to call upon successful disconnection or error
*/

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

/**
 * Immediately disconnect without waiting for ACKs. If called before bus
 * connection is established, connection is canceled.
 *
 * @function forceDisconnect
 * @memberOf UbiMqtt#
 * @param {function} callback called when disconnect succeeds
 */
self.forceDisconnect = function(callback)
	{
	client.end(true, callback);
	}

/**
* Publishes a message on the connected Mqtt server
*
* @function publish
* @memberOf UbiMqtt#
* @param {string} topic the Mqtt topic to publish to
* @param {any} message the message to publish
* @param {object} opts the options to pass to node-mqtt
* @param {function} callback the callback to call upon success or error
*/

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

/**
*
* Publishes a signed message on the connected Mqtt server
* @function publishSigned
* @memberOf UbiMqtt#
* @param {string} topic the Mqtt topic to publish to
* @param {any} message the message to publish
* @param {object} opts the options to pass to node-mqtt
* @param {string} privateKey the private key in .pem format to sign the message with
* @param {function} callback the callback to call upon success or error
*/

self.publishSigned = function(topic, message, opts, privateKey, callback)
		{
		jose.JWK.asKey(privateKey, "pem")
		.then(function(key)
			{
			jose.JWS.createSign({fields: { timestamp: Date.now(), messageid: generateRandomString(12) }}, key)
			.update(message)
			.final()
			.then(function(result)
				{
				// {result} is a JSON object -- JWS using the JSON General Serialization
				// make the payload human-readable
				result.payload = jose.util.base64url.decode(result.payload).toString();

				// make the headers humand-readable

				result.signatures[0].protected = JSON.parse(jose.util.base64url.decode(result.signatures[0].protected).toString());

				self.publish(topic, JSON.stringify(result), opts, callback);
				});
      });
		};

self.publishEncrypted = function(topic, message, opts, publicKey, callback)
		{
		jose.JWK.asKey(publicKey, "pem")
		.then(function(key)
			{
			jose.JWE.createEncrypt({ format: "compact", fields: { timestamp: Date.now(), messageid: generateRandomString(12) }}, key)
			.update(message)
			.final()
			.then(function(result)
				{
				self.publish(topic, result, opts, callback);
				});
			});
		}

/**
* Subscribes to a Mqtt topic on the connected Mqtt server
*
* @function subscribe
* @memberOf UbiMqtt#
* @param {string} topic the Mqtt topic to subscribe to
* @param {any} obj the value of "this" to be used whan calling the listener
* @param {function} listener the listener function to call whenever a message matching the topic arrives
* @param {function} callback the callback to be called upon successful subscription or error
*/

self.subscribe = function(topic, obj, listener, callback)
	{
	//if publicKey is given, only let events with correct public key through
	if (!subscriptions.hasOwnProperty(topic))
		subscriptions[topic] = new Object();

	var listenerId = listenerCounter+"";
	listenerCounter++;

	subscriptions[topic][listenerId] = {listener: listener, obj: obj, id: listenerId};

	client.subscribe(topic, null, function(err)
		{
		callback(err, listenerId);
		});
	};

/**
* Subscribes to messages signed by particular keypair on a Mqtt topic on the connected Mqtt server
*
* @function subscribeSigned
* @memberOf UbiMqtt#
* @param {string} topic the Mqtt topic to subscribe to
* @param {string[]} publicKeys the public keys of the keypairs the messages need to to be signed with. Only messages signed with these keypairs will invoke the listener
* @param {any} obj the value of "this" to be used whan calling the listener
* @param {function} listener the listener function to call whenever a message matching the topic and signed with the publicKey arrives
* @param {function} callback the callback to be called upon successful subscription or error
*/

self.subscribeSigned = function(topic, publicKeys, obj, listener, callback)
	{
	//if publicKey is given, only let events with correct public key through
	if (!subscriptions.hasOwnProperty(topic))
		subscriptions[topic] = new Object();

	listenerId = listenerCounter+"";
	listenerCounter++;

	subscriptions[topic][listenerId] = {listener: listener, obj: obj, id: listenerId, publicKeys: publicKeys};

	client.subscribe(topic, null, function(err)
		{
		callback(err, listenerId);
		});
	};

self.subscribeEncrypted = function(topic, privateKeys, obj, listener, callback)
	{
	//if publicKey is given, only let events with correct public key through
	if (!subscriptions.hasOwnProperty(topic))
		subscriptions[topic] = new Object();

	listenerId = listenerCounter+"";
	listenerCounter++;

	subscriptions[topic][listenerId] = {listener: listener, obj: obj, id: listenerId, privateKeys: privateKeys};

	client.subscribe(topic, null, function(err)
		{
		callback(err, listenerId);
		});
	};

self.updatePublicKeys = function(topic, listenerId, keys)
	{
	if (subscriptions.hasOwnProperty(topic) && subscriptions[topic].hasOwnProperty(listenerId))
		{
		subscriptions[topic][listenerId].publicKeys = keys;
		debug("UbiMqtt::updatePublicKeys() updated public keys for topic: "+topic+" and listenerId: "+listenerId);
		}
	};

/**
* Subscribes to messages on a Mqtt topic on the connected Mqtt server signed by a known publiser
* The public key of the publiser is used for recognizing the messages originating from the publisher.
* The public key of the publisher is fetched from the Mqtt topic publishers/publishername/publicKey
* and kept up-to-date with the help of a regular Mqtt subscription
*
* @function subscribeFromPublisher
* @memberOf UbiMqtt#
* @param {string} topic the Mqtt topic to subscribe to
* @param {string} publiserName the name of the known publisher
* @param {any} obj the value of "this" to be used whan calling the listener
* @param {function} listener the listener function to call whenever a message matching the topic and signed with the publicKey arrives
* @param {function} callback the callback to be called upon successful subscription or error
*/

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
