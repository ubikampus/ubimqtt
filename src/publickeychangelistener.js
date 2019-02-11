// Class for listening to public key changes
function PublicKeyChangeListener(ubiMqtt, mainTopic, mainObj, mainListener, originalCallback_)
{
var self = this;

var logger = console;

var originalCallback = originalCallback_;
var mainListenerId = null;

self.onPublicKeyChanged = function(publicKeyTopic, message, listenerId)
	{
	if (mainListenerId)
 		{
		logger.log("PublicKeyChangeListener::onPublicKeyChanged() changing public key");
		ubiMqtt.updatePublicKey(mainTopic, mainListenerId, message);
		}
	else
		{
		// This is the first time the public key arrives, subscribe to the main topic
		ubiMqtt.subscribeSigned(mainTopic, message, mainObj, mainListener, function(err, listenerId)
			{
			mainListenerId = listenerId;
			if (originalCallback)
				originalCallback(err, listenerId);
			});
		}
	}
}

if (typeof exports !== "undefined")
		module.exports = PublicKeyChangeListener;
