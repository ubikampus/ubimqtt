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

	if (typeof(exports) !== "undefined")
		{
		UbiMqtt = require("../src/ubimqtt.js");
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

	it ("connects subscribes and publishes a message", function(done)
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
				mqtt.publish("test/test","viestijee", function(err)
					{
					expect(err).toBeFalsy();
					});
				});
			});
		});
	});
