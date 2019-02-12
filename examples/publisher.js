function Publisher()
{
var self = this;

var UbiMqtt = require("../src/ubimqtt.js");

var fs = require("fs");
var homedir = require('os').homedir();

var logger = console;


var privateKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key.pem");
var publicKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key-public.pem");

var mqtt = new UbiMqtt("mqtt://10.120.0.4:1883");

self.run = function()
	{
	mqtt.connect(function(error)
		{
		if (error)
			{
			logger.log("Failed to connect to the Mqtt server: " + error);
			return;
			}
		mqtt.publish("test/test", "testmessage", {qos: 1}, function(err)
			{
			if (!err)
				logger.log("Publication made");
			else
				logger.log("Publishing failed: "+err);
			/*
			mqtt.disconnect(function(err)
				{
				if (!err)
					logger.log("Disconnected from Mqtt server");
				});*/
			});
		});
	}
}

var publisher = new Publisher();
publisher.run();
