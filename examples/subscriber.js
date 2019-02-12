function Subscriber()
{
var self = this;

var UbiMqtt = require("../src/ubimqtt.js");

var fs = require("fs");
var homedir = require('os').homedir();

var logger = console;

var privateKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key.pem");
var publicKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key-public.pem");

var mqtt = new UbiMqtt("mqtt://10.120.0.4:1883");

self.onMessage = function(topic, message)
	{
	logger.log("Message received from mqtt server: {topic: \""+topic+"\",message: \""+message+"\"}");
	};

self.run = function()
	{
	mqtt.connect(function(error)
  	{
  	if (error)
 			logger.error(error);

		mqtt.subscribe("#", self, self.onMessage, function(err)
 			{
			if (!err)
 				logger.log("Subscribed to topic #");
			else
				logger.error("Failed to subscribe to #: "+err);
			});
 		});
	}
}

var subscriber = new Subscriber();
subscriber.run();
