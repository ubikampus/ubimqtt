function SubscribeToJava()
{
var self = this;

const TOPIC = "test/javasignedtesttopic";

var UbiMqtt = require("../src/ubimqtt.js");

var fs = require("fs");
var homedir = require('os').homedir();

var logger = console;

var privateKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key.pem");
var publicKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key-public.pem");

var mqtt = new UbiMqtt("mqtt://localhost:1883");

self.onMessage = function(topic, message)
	{
	logger.log("SubscribeToJava::onMessage() Correctly signed message received from mqtt server: {topic: \""+topic+"\",message: \""+message+"\"}");
	};

self.run = function()
	{
	logger.log("run()");
	mqtt.connect(function(error)
  	{
  	if (error)
 			logger.error(error);

		else
			logger.log("Connected");

		mqtt.subscribeSigned(TOPIC, publicKey, self, self.onMessage, function(err)
 			{
			if (!err)
 				logger.log("Subscribed to topic "+TOPIC);
			else
				logger.error("Failed to subscribe to: "+TOPIC+" "+err);
			});
 		});
	}
}

var subscriber = new SubscribeToJava();
subscriber.run();
