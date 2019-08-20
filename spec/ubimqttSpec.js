if (!global.reporterAdded)
	{

	var specReporter = new function()
		{
		var self = this;

		self.specStarted = function(result)
			{
			self.name = result.fullName;
			console.log("\n-----------------------"+self.name+"------------------------------\n");
			}
		};

	jasmine.getEnv().addReporter(specReporter);
	global.reporterAdded = true;
	}


describe("UbiMqtt", function()
	{
	var  UbiMqtt = null;
	var fs = null;

	if (typeof(exports) !== "undefined")
		{
		UbiMqtt = require("../src/ubimqtt.js");
		fs = require("fs");
		}
	else
		{
		}

	var logger = console;

	it ("connects and disconnects the mqtt server", function(done)
		{
		let mqtt = new UbiMqtt("mqtt://localhost:1883");

		mqtt.connect(function(error)
			{
			expect(error).toBeFalsy();

			mqtt.disconnect(function(err)
				{
				expect(err).toBeFalsy();
				done();
				});
			});
		});

	it ("connects, subscribes and publishes a message", function(done)
		{
		let mqtt = new UbiMqtt("mqtt://localhost:1883");

		mqtt.connect(function(error)
			{
			expect(error).toBeFalsy();

			var onMessage = function(topic, message)
				{
				logger.log("message received from mqtt server: {topic: \""+topic+"\",message: \""+message+"\"}");
				mqtt.disconnect(function(err)
					{
					expect(err).toBeFalsy();
					done();
					});
				};
			mqtt.subscribe("test/test", this, onMessage, function(err)
				{
				expect(err).toBeFalsy();
				mqtt.publish("test/test", "viestijee", null, function(err)
					{
					expect(err).toBeFalsy();
					});
				});
			});
		});

	it ("subscribes, publishes a signed message, then verifies the signature", function(done)
		{
		const homedir = require('os').homedir();
		var privateKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key.pem");
		var publicKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key-public.pem");
		var mqtt = new UbiMqtt("mqtt://localhost:1883");

		mqtt.connect(function(error)
			{
			expect(error).toBeFalsy();

			var onMessage = function(topic, message)
				{
				logger.log("message received from mqtt server: {topic: \""+topic+"\",message: \""+message+"\"}");
				mqtt.disconnect(function(err)
					{
					expect(err).toBeFalsy();
					done();
					});
				};
			mqtt.subscribeSigned("test/test", [publicKey], this, onMessage, function(err)
				{
				expect(err).toBeFalsy();
				mqtt.publishSigned("test/test", "viestijee", null, privateKey, function(err)
					{
					expect(err).toBeFalsy();
					});
				});
			});
		});

	it ("subscribes from a known publisher", function(done)
		{
		const homedir = require('os').homedir();
		var privateKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key.pem");
		var publicKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key-public.pem");
		var mqtt = new UbiMqtt("mqtt://localhost:1883");

		mqtt.connect(function(error)
			{
			expect(error).toBeFalsy();

			//publish the public key for the "known publisher"
			mqtt.publish("publishers/testpublisher/publicKey", publicKey, {retain: true, qos: 1}, function(err)
				{
				expect(err).toBeFalsy();
				var onMessage = function(topic, message)
					{
					logger.log("Jsmine:: message received from mqtt server: {topic: \""+topic+"\",message: \""+message+"\"}");
					//clear the public key for the "known publisher"
					mqtt.publish("publishers/testpublisher/publicKey", "", {retain: true, qos:1}, function(err)
						{
						expect(err).toBeFalsy();
						mqtt.disconnect(function(err)
							{
							expect(err).toBeFalsy();
							done();
							});
						});
					};

				mqtt.subscribeFromPublisher("test/test", "testpublisher", this, onMessage, function(err)
					{
					expect(err).toBeFalsy();

					console.log("PRIVATE KEY WHEN PUBLISHING SIGNED: "+privateKey);
					mqtt.publishSigned("test/test", "viestijee", null, privateKey, function(err)
						{
						expect(err).toBeFalsy();
						});
					});
				});
			});
		});

	it ("subscribes from a known publisher who changes keys", function(done)
		{
		const homedir = require('os').homedir();
		var privateKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key.pem");
		var publicKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key-public.pem");
		var mqtt = new UbiMqtt("mqtt://localhost:1883");

		mqtt.connect(function(error)
			{
			expect(error).toBeFalsy();

			//publish the public key for the "known publisher"
			mqtt.publish("publishers/testpublisher/publicKey", "fakekey", {retain: true}, function(err)
				{
				expect(err).toBeFalsy();
				});

			var onMessage = function(topic, message)
				{
				logger.log("Jasmine:: message received from mqtt server: {topic: \""+topic+"\",message: \""+message+"\"}");
				//clear the public key for the "known publisher"
				mqtt.publish("publishers/testpublisher/publicKey", "", {retain: true}, function(err)
					{
					expect(err).toBeFalsy();
					mqtt.disconnect(function(err)
						{
						expect(err).toBeFalsy();
						done();
						});
					});
				};

			mqtt.subscribeFromPublisher("test/test", "testpublisher", this, onMessage, function(err)
				{
				expect(err).toBeFalsy();

				//change publisher key
				mqtt.publish("publishers/testpublisher/publicKey", publicKey, {retain: true}, function(err)
					{
					expect(err).toBeFalsy();

					mqtt.publishSigned("test/test", "viestijee", null, privateKey, function(err)
						{
						expect(err).toBeFalsy();
						});
					});
				});
			});
		});

		it("subscribes, publishes an encrypted message, and decrypts that message", function(done)
			{
			const homedir = require('os').homedir();
			var privateKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key.pem");
			var publicKey= fs.readFileSync(homedir+"/.private/ubimqtt-testing-key-public.pem");
			var mqtt = new UbiMqtt("mqtt://localhost:1883");
	
			mqtt.connect(function(error)
				{
				expect(error).toBeFalsy();
	
				var onMessage = function(topic, message)
					{
					logger.log("message received from mqtt server: {topic: \""+topic+"\",message: \""+message+"\"}");
					mqtt.disconnect(function(err)
						{
						expect(err).toBeFalsy();
						done();
						});
					};
				mqtt.subscribeEncrypted("test/test", [privateKey], this, onMessage, function(err)
					{
					expect(err).toBeFalsy();
					mqtt.publishEncrypted("test/test", "viestijee", null, publicKey, function(err)
						{
						expect(err).toBeFalsy();
						});
					});
				});
			});
	});
