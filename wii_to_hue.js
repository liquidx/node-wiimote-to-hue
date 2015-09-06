var fs = require('fs');

var thisAppName = 'wii_to_hue';

var hue = require('node-hue-api');
var huePrefsFile = 'hue.json';
var huePrefs = null;
var hueApi = null;
var hueState = null;

var registerHue = function() {
    fs.exists(huePrefsFile, function(exists) {
	if (exists) {
	    // Read hostname, ip and username from stored prefs.
	    fs.readFile(huePrefsFile, function(err, data) {
		if (err) throw err;
		huePrefs = JSON.parse(data);
		console.log("Stored Hue Prefs: " + JSON.stringify(huePrefs));
		hueApi = new hue.HueApi(huePrefs.hostname, huePrefs.user);
		hueApi.connect(function(err, result) {
		    scanHue();
		});
	    });
	} else {
	    // Start hue registration process.
	    var connectBridge = function(bridges) {
		console.log('Hue Bridges Found: ' + JSON.stringify(bridges));
		console.log('Hue Bridge Count: ' + bridges.length);
		if (bridges.length > 0) {
		    var bridge = bridges[0];
		    var hostname = bridge['ipaddress'];
		    var bridge_id = bridge['id'];  // unused
		    var displayUserResult = function(result) {
			huePrefs = {
			    "hostname": hostname,
			    "user": result
			};
			fs.writeFile(huePrefsFile, JSON.stringify(huePrefs), function(err) {
			    if (err) throw err;
			});
			console.log("Created User: " + JSON.stringify(result));
		    };
		    var displayError = function (error) {
			console.log("Error: " + error);
		    };
		    hueApi = new hue.HueApi();
		    var newUserName = null;
		    hueApi.registerUser(hostname, newUserName, thisAppName).then(
			displayUserResult).fail(
			displayError).done();

		}
	    };
	    hue.locateBridges().then(connectBridge).done();
	}
    });
};

var scanHue = function() {
    hueApi.getFullState(function(err, config) {
	if (err) throw err;
	hueState = config;

	var newLightState = hue.lightState.create().on().white(299, 100);
	hueApi.setLightState(1, newLightState, function(err, lights) {
	    console.log(lights);
	});
    });
};

var setLightBrightness = function(light, brightness) {
    if (!hueState) {
	console.log('Hue not yet connected');
	return;
    }
    var newLightState = hue.lightState.create().on().white(299, brightness);
    hueApi.setLightState(light, newLightState, function(err, lights) {
    });  
};

registerHue();


//
// Wii
//

var wii = require('nodewii');
var wiiHold = false;
var wiiOrigin = null;
var wiiLightLevel = 0;
var wiiLastUpdateTime = 0;

var wiimote = new wii.WiiMote();
wiimote.connect('00:00:00:00:00:00', function(err) {
    if (err) throw err;

    wiimote.led(1, true);
    wiimote.on('button', function(button) {
	if (button == 4) { // B-button (trigger)
	    wiiHold = true;
	    hueApi.lightStatus(1, function(err, result) {
		if (err) return;
		wiiLightLevel = result['state']['bri'];
		wiiLastUpdateTime = new Date();
	    });
	    var success = wiimote.acc(true);
	    console.log('Accelerometer on success: ' + success);
	} else if (button == 0) {
	    wiiHold = false;
	    wiiOrigin = null;
	    wiimote.acc(false);
	}
	console.log(button);
    });
    wiimote.on('acc', function(data) {
	if (wiiOrigin == null) {
	    wiiOrigin = data;
	    return;
	}

	// Too soon.
	var now = new Date();
	if (now - wiiLastUpdateTime < 500) {
	    return;
	}

	wiiLastUpdateTime = now;
	
	var diff = data.y - wiiOrigin.y;
	// Modify the brightness.

	var brightnessDiff = 0;
	if (diff > 0) {
	    brightnessDiff = -20;
	} else if (diff < 0) {
	    brightnessDiff = 20;
	}
	console.log(data);
	var newBrightness = Math.max(Math.min(wiiLightLevel + brightnessDiff, 100), 0);
	console.log(newBrightness);
	var newLightState = hue.lightState.create().on().white(299, newBrightness);

	hueApi.setLightState(1, newLightState, function(err, result) {
	    wiiLightLevel = newBrightness;
	});	
    });

    wiimote.button(true);
});


//
// Wait state
// 
var io = require('socket.io');
var http = require('http');
var listener = io.listen(http.createServer().listen(8000));






