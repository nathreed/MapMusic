const Music = require("./music-gen");
const setLineColor = "#464738";

// Constructor function takes in 3 form coordinates
function Path(coordinates){
	this.coordinates = coordinates;

	// Extract the elevations (remove this if rewriting)
	let elevations = coordinates.map((point) => {
		return point.alt;
	});

	// Generate a polyline for the points
	this.polyline = L.polyline(coordinates, {color: setLineColor});

	// Normalize to 0-1 range
	let maxHeight = Math.max(...elevations);
	let minHeight = Math.min(...elevations);
	this.elevationsNormalized = elevations.map((height) => {
		return (height - minHeight)/(maxHeight - minHeight);
	});


	// Render a histogram to the provided canvas
	this.renderHistogram = function(canvasDOM, clear){
		let histogramValues = interpolateArray(this.elevationsNormalized, Math.floor(canvasDOM.width));
		let canvasContext = canvasDOM.getContext("2d");
		if(clear){
			canvasContext.clearRect(0, 0, canvasDOM.width, canvasDOM.height);
		}
		histogramValues.forEach((height, index) => {
			// In the future this might be recolored to the elevation
			canvasContext.fillStyle = "#fff";
			canvasContext.fillRect(index, canvasDOM.height * (1 - height), 1, canvasDOM.height * height);
		});
	};

	// Midi notes generation
	this.normalizeToMidiTones = function(audioConfig){
		let elevations = this.elevationsNormalized;

		// If the user wants to resample the notes, do so
		if(audioConfig.sampleToPredicate){
			elevations = interpolateArray(elevations, audioConfig.sampleTo);
		}

		// Map the normalized value to the midi scale
		return elevations.map((normalizedElevation) => {
			return Math.round((normalizedElevation * (audioConfig.highNote - audioConfig.lowNote)) + audioConfig.lowNote);
		});
	};

	// Play the path audio
	this.playAudio = function(audioConfig){
		Music.playTones(this.normalizeToMidiTones(audioConfig), audioConfig);
	}

	// Wrappers for map functionality, adding to and removing from a map
	this.addTo = function(map){
		return this.polyline.addTo(map);
	}
	this.removeFrom = function(map) {
		return this.polyline.removeFrom(map);
	}
}


// Linear interpolation helper function for remapping elevation data (source: https://stackoverflow.com/a/26941169/3196151)
function interpolateArray(data, newLength) {
	let indexScalar = (data.length - 1) / (newLength - 1);
	let resultData = [];

	// Set the first value to be the same
	resultData[0] = data[0];

	// For each new index
	for (let i = 1; i < newLength - 1; i++) {
		// Figure out how far through the original data it is (and which two datapoints are on either side of it)
		let howFar = i * indexScalar;
		let beforeIndex = Math.floor(howFar);
		let afterIndex = Math.ceil(howFar);

		// Save the value interpolated that far in ()
		resultData[i] = ((before, after, atPoint) => {
			return before + (after - before) * atPoint;
		})(data[beforeIndex], data[afterIndex], howFar - beforeIndex);
	}

	// Set the last value to be the same
	resultData[newLength - 1] = data[data.length - 1];

	return resultData;
}

exports.Path = Path;