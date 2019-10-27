const L = require("leaflet");
require("leaflet-tilelayer-colorpicker");
const Music = require("./music-gen");
const WaveformPlaylist = require('waveform-playlist');
//the styles for waveform-playlist are included separately and compiled in a separate step

// Important DOM things
let canvasDOM = document.getElementById("drawingLayer");

// Map toolbar handling
let mapToolbarChildren = document.getElementById("mapToolbar").children;

// Process panning/drawing toggle
document.getElementById("panningMode").oninput = function(e){
	// Set to panning mode by removing click events on the canvas
	console.log("setting pan mode");
	canvasDOM.classList.add("noInteraction");
};

document.getElementById("drawingMode").oninput = function(e){
	console.log("setting drawmode");
	canvasDOM.classList.remove("noInteraction");
};

// Add a place to the saved locations list in display and data
function addPlaceToPresetsDOM(place, index){
	let option = document.createElement("option");
	option.text = place.name;
	option.value = index;
	mapToolbarChildren.locationSelect.add(option);
	savedPlaces[index] = place;
}
savedPlaces = [
	{name: "Grand Canyon", coordinates: [35.81025936, -113.6302593801], zoom: 11},
	{name: "Vancouver Mountains", coordinates: [49.3822072, -123.1363749], zoom: 12},
	{name: "University of Rochester", coordinates: [43.1289624, -77.629125], zoom: 16},
	{name: "Mount Everest", coordinates: [27.9881199, 86.9162203], zoom: 11},
	{name: "Death Valley", coordinates: [36.3885879, -116.89384], zoom: 10},
	{name: "Shenandoah River", coordinates: [38.8879720, -78.3622169], zoom: 12},
	{name: "Appalachian Mountains", coordinates: [37.01330, -81.4879989624], zoom: 11}
];
savedPlaces.forEach(addPlaceToPresetsDOM); // Load in all of the preset options

// Save the current location in the presets list
mapToolbarChildren.saveLocationButton.onclick = function(e){
	// Check if the name is already used in the places array
	let newPlaceName = mapToolbarChildren.saveLocationName.value;
	if(newPlaceName === "" || savedPlaces.reduce((accumulator, place) => {return accumulator || place.name === newPlaceName}, false)){
		console.log("trying to add an already used name, or name not specified.");
	} else {
		// Adding current location to presets list
		addPlaceToPresetsDOM({name: newPlaceName, coordinates: mymap.getCenter(), zoom: mymap.getZoom()}, savedPlaces.length);
		mapToolbarChildren.saveLocationName.value = "";
		mapToolbarChildren.locationSelect.value = savedPlaces.length - 1;
	}
};

// Jump to the preset selected
mapToolbarChildren.locationSelect.oninput = function(e){
	let destination = savedPlaces[mapToolbarChildren.locationSelect.value];
	mymap.setView(destination.coordinates, destination.zoom);
};

// Map settings
const urlTerrain = "https://api.mapbox.com/styles/v1/mwsundberg/ck26wfu0759jk1claf7a3bblm/tiles/{z}/{x}/{y}?access_token={accessToken}";
const urlRGBheight = "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={accessToken}";
const accessToken = "pk.eyJ1IjoibXdzdW5kYmVyZyIsImEiOiJjazI4Z3lkcHkwb3pzM2RwYm44YW9nM2ZuIn0.EyqGj9GuiUpvoauajxVPgA";

// Map initialization
let mymap = L.map("mapLayer").setView(savedPlaces[0].coordinates, savedPlaces[0].zoom);

// Mapbox map layers
let terrainVisible = L.tileLayer(urlTerrain, {
	attribution: "",
	minZoom: 1,
	maxZoom: 18,
	accessToken: accessToken
}).addTo(mymap);

let elevationData = L.tileLayer.colorPicker(urlRGBheight, {
	attribution: "",
	minZoom: 1,
	maxZoom: 18,
	maxNativeZoom: 14,
	opacity: 0.0,
	accessToken: accessToken
}).addTo(mymap);


//mymap.dragging.disable(); //disable drag for now

// Data for the paths
pathsAsCoordinates = [];
pathsAsPolylines = [];
pathsAsElevations = [];

// Audio config preview canvas
let stagedAudioCanvasDOM = document.getElementById("stagedAudioCanvas");
let stagedAudioCanvasContext = stagedAudioCanvasDOM.getContext("2d");

// Update canvas coordinate system
let mapContainerDOM = document.getElementById("mapWrapper");
let canvasContext = canvasDOM.getContext("2d");
window.onresize = function(e){
	canvasDOM.width = mapContainerDOM.offsetWidth;
	canvasDOM.height = mapContainerDOM.offsetHeight;
	canvasCoordinates = canvasDOM.getBoundingClientRect();

	// Code for later stuff
	stagedAudioCanvasDOM.width = audioControlsContainer.offsetWidth - 20; // 10px padding
	stagedAudioCanvasDOM.height = window.innerHeight / 10; // 10 vh

	// Redraw on resize
	if(pathsAsElevations.length > 0){
		renderElevationHistogram(pathsAsElevations[pathsAsElevations.length-1]);
	}
};
window.onresize(); // Call once to set initial values for coordinate systems

// Drawing code
const draftingLineColor = "#525442";
const setLineColor = "#464738";
let painting = false;
let lineCoordinates = [];
const rawDistanceThreshold = 2;

function getAudioConfigValues() {
	//Grab the values out of each thing that we want
	//Right now we want high note, low note, and duration information
	//High note
	let highNote = parseInt($("#highNote").val());
	let lowNote = parseInt($("#lowNote").val());

	let scalingType = $("#audioLengthScalingMode").val();
	let durationValue = parseFloat($("#audioLength").val());

	let playLivePreview = document.getElementById("playLivePreview").checked;

	let soundName = $("#soundName").val();

	let sampleTo = $("#sampleTo").val();
	let sampleToPredicate = document.getElementById("sampleToPredicate").checked;

	if(scalingType === "totalLength") {
		return {
			highNote: highNote,
			lowNote: lowNote,
			totalPlayTime: durationValue,
			noteDuration: false,
			playLivePreview: playLivePreview,
			soundName: soundName,
			sampleTo: sampleTo,
			sampleToPredicate: sampleToPredicate
		}
	} else if(scalingType === "noteDuration") {
		return {
			highNote: highNote,
			lowNote: lowNote,
			totalPlayTime: false,
			noteDuration: durationValue,
			playLivePreview: playLivePreview,
			soundName: soundName,
			sampleTo: sampleTo,
			sampleToPredicate: sampleToPredicate
		}
	} else {
		console.log("ERROR! Unknown duration interpretation!");
	}
}

document.getElementById("sampleToPredicate").onclick = function(e){
	console.log("toggling resampling.")
	if(this.checked){
		document.getElementById("sampleTo").disabled = false;
	} else {
		document.getElementById("sampleTo").disabled = true;
	}
}

canvasDOM.onmousedown = function(e) {
	painting = true;
	const mouseLocation = L.point(e.clientX - canvasCoordinates.left,
		e.clientY - canvasCoordinates.top);

	lineCoordinates.push(mouseLocation);

	// Start drawing a line
	canvasContext.strokeStyle = draftingLineColor;
	canvasContext.lineJoin = "round";
	canvasContext.lineCap = "round";
	canvasContext.lineWidth = 1;
	canvasContext.beginPath();
	canvasContext.moveTo(mouseLocation.x, mouseLocation.y);
};

canvasDOM.onmousemove = function(e) {
	if(painting) {
		const mouseLocation = L.point(e.clientX - canvasCoordinates.left,
			e.clientY - canvasCoordinates.top);

		// Get the direction of the mouse movement (for use with: https://math.stackexchange.com/a/175906)
		const v = mouseLocation.subtract(lineCoordinates[lineCoordinates.length - 1]);
		const du = v.divideBy(v.distanceTo(L.point(0,0))).multiplyBy(rawDistanceThreshold);

		// If greater than the distance criteria, draw set length lines towards current mouse location until too close
		while(mouseLocation.distanceTo(lineCoordinates[lineCoordinates.length - 1]) >= rawDistanceThreshold){
			// Interpolate a point rawDistanceThreshold units away from the last point (final bit of: https://math.stackexchange.com/a/175906)
			const interpolatedPoint = du.add(lineCoordinates[lineCoordinates.length - 1]);

			// Add the interpolated point to the list
			lineCoordinates.push(interpolatedPoint);

			// Draw the next line segment
			canvasContext.lineTo(interpolatedPoint.x, interpolatedPoint.y);
			canvasContext.stroke();
		}
	}
};

canvasDOM.onmouseup = function(e) {
	// Check if there are enough points to do audio stuff
	if(lineCoordinates.length >= 2) {
		// Convert to a GeoJSON object (Assumes canvas origin and map origin are equivalent)
		const coordinates = lineCoordinates.map((point) => {
			return mymap.containerPointToLatLng(point);
		});

		// Add GeoJSON to the map (and store the path in the polylines list)
		pathsAsPolylines.push(L.polyline(coordinates, {color: setLineColor}).addTo(mymap));

		// Points to elevation data
		const elevations = coordinates.map((point) => {
			const color = elevationData.getColor(point);
			if (color !== null) {
				// Convert the RGB channels to one hex number then scale to mapbox elevation data
				return -10000 + 0.1 * ((color[0] << 16) + (color[1] << 8) + color[2]);
			} else {
				console.log("crap, coordinates at " + point + " aren't color-elevation-readable.");
			}
		});

		// Add elevation data and path to arrays
		pathsAsElevations.push(elevations);
		pathsAsCoordinates.push(coordinates);

		//Get the config values from the page
		let configValues = getAudioConfigValues();
		if(configValues.playLivePreview) {
			Music.playTones(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, configValues.sampleTo, configValues.sampleToPredicate, elevations), configValues);
		}

		renderElevationHistogram(elevations);
	}

	// Reset canvas painting stuff
	canvasContext.closePath();
	canvasContext.clearRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height); // Clears the canvas
	painting = false;
	lineCoordinates = [];
};

// Render canvas with the height histogram
function renderElevationHistogram(elevations){
	// Plot the elevation map
	let histogramValues = interpolateArray(elevations, Math.floor(stagedAudioCanvasDOM.width));
	const maxHeight =  Math.max( ...histogramValues);
	const minHeight =  Math.min( ...histogramValues);
	stagedAudioCanvasContext.clearRect(0, 0, stagedAudioCanvasDOM.width, stagedAudioCanvasDOM.height);
	histogramValues.forEach((height, index) => {
		let normalizedHeight = (height - minHeight)/(maxHeight - minHeight);
		stagedAudioCanvasContext.fillStyle = "#fff";
		stagedAudioCanvasContext.fillRect(index, stagedAudioCanvasDOM.height * (1 - normalizedHeight), 1, stagedAudioCanvasDOM.height * normalizedHeight);
	});
}

// Audio config options pane submit action
document.getElementById("addStagedAudio").onclick = function(e) {
	let elevations = pathsAsElevations[pathsAsElevations.length - 1];
	let configValues = getAudioConfigValues();
	Music.renderOffline(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, configValues.sampleTo, configValues.sampleToPredicate, elevations), configValues, function (blob) {
		console.log("blob callback, blob:", blob);
		playlist.load([{
			src: blob,
			name: configValues.soundName,
			gain: 0.5
		}]);
	});
};

// Audio config options pane play audio again action
document.getElementById("playStagedAudio").onclick = function(e) {
	let elevations = pathsAsElevations[pathsAsElevations.length - 1];
	let configValues = getAudioConfigValues();
	Music.playTones(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, configValues.sampleTo, configValues.sampleToPredicate, elevations), configValues);
};

function normalizeToMidiNotes(noteMin, noteMax, sampleTo, sampleToPredicate, elevations) {
	//First normalize the elevations to the 100 scale
	const max = Math.max( ...elevations);
	const min = Math.min( ...elevations);

	let normalizedElevations = elevations.map((height) => {
		return ((height - min)/(max - min)) * 100;
	});

	// If the user wants to resample the notes, do so
	if(sampleToPredicate){
		console.log("interpolating");
		normalizedElevations = interpolateArray(normalizedElevations, sampleTo);
	}

	//Next, apply a similar procedure to get midi notes, except this time with rounding bc midi notes are ints
	let midiNotes = [];

	//We don't need to find min and max, they are 0 and 100 by definition
	normalizedElevations.forEach(function(x) {
		let preRoundNote = ((x/100) * (noteMax - noteMin)) + noteMin;
		midiNotes.push(Math.round(preRoundNote));
	});

	return midiNotes;
}

//Setup editor
let playlist = WaveformPlaylist.init({
	samplesPerPixel: 3000,
	mono: true,
	waveHeight: 100,
	container: document.getElementById("loopEditorContainer"),
	state: 'cursor',
	colors: {
		waveOutlineColor: '#3D3D3D',
		timeColor: 'grey',
		fadeColor: 'black',
	},
	controls: {
		show: true,
		width: 200
	},
	zoomLevels: [500, 1000, 3000, 5000]
});

playlist.initExporter();
console.log("added playlist");


/*
PLAYLIST EVENT CONTROL BELOW HERE
 */

let ee = playlist.getEventEmitter();
let $container = $("body");
let startTime = 0;
let endTime = 0;
let audioPos = 0;
let isLooping = false;
let playoutPromises;

function updateSelect(start, end) {
	if (start < end) {
		$('.btn-trim-audio').removeClass('disabled');
	}
	else {
		$('.btn-trim-audio').addClass('disabled');
	}

	startTime = start;
	endTime = end;
}

updateSelect(startTime, endTime);

$container.on("click", ".btn-play", function() {
	ee.emit("play");
});

$container.on("click", ".btn-pause", function() {
	isLooping = false;
	ee.emit("pause");
});

$container.on("click", ".btn-stop", function() {
	isLooping = false;
	ee.emit("stop");
});

$container.on("click", ".btn-clear", function() {
	isLooping = false;
	ee.emit("clear");
});

//Drag and Drop support
$container.on("dragenter", ".track-drop", function(e) {
	console.log("DRAG ENTER!");
	e.preventDefault();
	e.target.classList.add("drag-enter");
});

$container.on("dragover", ".track-drop", function(e) {
	console.log("DRAG OVER!");
	e.preventDefault();
});

$container.on("dragleave", ".track-drop", function(e) {
	console.log("DRAG LEAVE!");
	e.preventDefault();
	e.target.classList.remove("drag-enter");
});

$container.on("drop", ".track-drop", function(e) {
	console.log("DROP!");
	e.preventDefault();
	e.target.classList.remove("drag-enter");

	let dropEvent = e.originalEvent;

	for (let i = 0; i < dropEvent.dataTransfer.files.length; i++) {
		ee.emit("newtrack", dropEvent.dataTransfer.files[i]);
	}
});


document.getElementById("btn-cursor").onclick = function(e) {
	ee.emit("statechange", "cursor");
};

document.getElementById("btn-select").onclick = function(e) {
	ee.emit("statechange", "select");
};

document.getElementById("btn-shift").onclick = function(e) {
	ee.emit("statechange", "shift");
};

$container.on("click", ".btn-trim-audio", function() {
	ee.emit("trim");
});

$container.on("click", ".btn-download", function () {
	ee.emit('startaudiorendering', 'wav');
});

ee.on('audiorenderingfinished', function (type, data) {
	if(type == 'wav'){
		// Make a download link and click it, then make it all go away
		let anchor = document.createElement('a');
		anchor.style = 'display: none';
		anchor.href = window.URL.createObjectURL(data);
		document.body.appendChild(anchor);
		anchor.download = 'audio.wav';
		anchor.click();
		window.URL.revokeObjectURL(anchor.href);
		anchor.remove();
	}
});

// Linear interpolation function for remapping elevation data (source: https://stackoverflow.com/a/26941169/3196151)
function interpolateArray(data, newLength) {
	const indexScalar = (data.length - 1) / (newLength - 1);
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
		resultData[i] = ((before, after, atPoint) => {return before + (after - before) * atPoint;})(data[beforeIndex], data[afterIndex], howFar - beforeIndex);
	}

	// Set the last value to be the same
	resultData[newLength - 1] = data[data.length - 1];

	return resultData;
}

//Event listeners for keyboard controls
document.addEventListener("keydown", function(e) {
	console.log("TAGNAME:", document.activeElement.tagName);
	if(document.activeElement.tagName.toLowerCase() === "input") {
		return; //no keyboard shortcuts while typing or having anything selected, just when the body is active
	}
	const keyName = e.key;
	switch(keyName){
		case " ":
			// Spacebar: toggle play pause
			if(playlist.isPlaying()) {
				isLooping = false;
				ee.emit("pause");
			} else {
				ee.emit("play");
			}
			break;
		case "p":
			// P: map panning mode
			// Set to panning mode by removing click events on the canvas
			canvasDOM.classList.add("noInteraction");
			document.getElementById("panningMode").checked = true;
			break;
		case "d":
			// D: map drawing mode
			canvasDOM.classList.remove("noInteraction");
			document.getElementById("drawingMode").checked = true;
			break;
		case "s":
			// S: stop playlist audio
			isLooping = false;
			ee.emit("stop");
			break;
		case "x":
			// X: clear playlist tracks
			isLooping = false;
			ee.emit("clear");
			break;
		case "c":
			// C: cursor playlist tool
			ee.emit("statechange", "cursor");
			document.getElementById("btn-cursor").checked = true;
			break;
		case "l":
			// L: select playlist tool
			ee.emit("statechange", "select");
			document.getElementById("btn-select").checked = true;
			break;
		case "f":
			// F: shift playlist tool
			ee.emit("statechange", "shift");
			document.getElementById("btn-shift").checked = true;
			break;
		case "t":
			// T: trip selection in playlist
			ee.emit("trim");
			break;
	}
});


/*
PROJECT FILE SAVE/LOAD
 */

//Utility
function ab2str(buf) {
	let arr = new Uint16Array(buf);
	let str = "";
	for(let i=0; i<arr.length; i++) {
		str += String.fromCharCode(arr[i]);
	}
	return str;
}
function str2ab(str) {
	let buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
	let bufView = new Uint16Array(buf);
	for (let i=0, strLen=str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}


$("#projSave").on("click", function() {
	//Assemble the components for the file
	//paths object

	let plGJSON = pathsAsPolylines.map(x => x.toGeoJSON(8));
	const paths = {
		elevations: pathsAsElevations,
		coordinates: pathsAsCoordinates,
		polylines: plGJSON
	};


	const mapCenter = mymap.getCenter();
	const mapZoom = mymap.getZoom();


	const rawTracks = playlist.getInfo();
	console.log(rawTracks);
	let tracks = [];
	let trackPromises = [];
	rawTracks.forEach(function(x) {
		//Need to convert the blob to base64
		let reader = new window.FileReader();
		trackPromises.push(new Promise(function(resolve, reject) {
			reader.readAsDataURL(x.src);
			reader.onloadend = function () {
				let base64data = reader.result;

				let trackObj = {
					blob64: base64data,
					blobSize: x.src.size,
					blobType: x.src.type,
					name: x.name,
					start: x.start,
					end: x.end,
					cuein: x.cuein,
					cueout: x.cueout
				};
				tracks.push(trackObj);
				resolve();
			}
		}));
	});

	Promise.all(trackPromises).then(function() {
		console.log("ALL TRACKS DONE!");
		console.log(tracks);
		//Final object
		let save = {
			filetype: "mapmusic-save",
			paths: paths,
			tracks: tracks,
			mapCenter: mapCenter,
			mapZoom: mapZoom,
			savedPlaces: savedPlaces
		};

		//Write out
		const data = JSON.stringify(save);
		const ab = str2ab(data);
		const fileBlob = new window.Blob([new DataView(ab)], {
			type: "application/json"
		});
		let anchor = document.createElement('a');
		document.body.appendChild(anchor);
		anchor.style = 'display: none';
		let url = window.URL.createObjectURL(fileBlob);
		anchor.href = url;
		anchor.download = 'proj.json';
		anchor.click();
		window.URL.revokeObjectURL(url);
	});
});

$("#projLoad").on("click", function() {
	//Show the choose file button
	document.getElementById("chooseFileContainer").style.display = "inline"
});

document.getElementById("filePicker").addEventListener("change", handleFileSelect, false);
function handleFileSelect(e) {
	let files = e.target.files;
	//Get files[0]
	let projFile = files[0];
	console.log(projFile);
	let reader = new FileReader();
	reader.readAsArrayBuffer(projFile);
	reader.onloadend = function() {
		let abdata = reader.result;
		//console.log(abdata);
		let strData = ab2str(abdata);
		//console.log(strData.substring(0,101));
		try {
			let projData = JSON.parse(strData);
			if(projData["filetype"] !== "mapmusic-save") {
				throw new Error("wrong filetype");
			}
			//Unpack the project data into its various components
			//First set up the easy stuff
			let mapCenter = projData.mapCenter;
			let mapZoom = projData.mapZoom;
			let fileSavedPlaces = projData.savedPlaces;

			//Extract the polylines and convert back to leaflet obj, and the other path info
			let leafletPolylines = projData.paths.polylines.map(x => L.geoJSON(x));
			let filePathsAsElevations = projData.paths.elevations;
			let filePathsAsCoordinates = projData.paths.coordinates;

			//Extract the tracks
			let trackData = [];
			projData.tracks.forEach(function(trackObj) {
				//Create a new blob from the base64 representation
				//cut off the preamble/header thing
				const byteCharacters = atob(trackObj.blob64.substring(22));
				const byteNumbers = new Array(byteCharacters.length);
				for (let i = 0; i < byteCharacters.length; i++) {
					byteNumbers[i] = byteCharacters.charCodeAt(i);
				}
				const byteArray = new Uint8Array(byteNumbers);
				const trackBlob = new Blob([byteArray], {
					type: trackObj.blobType
				});

				trackData.push({
					src: trackBlob,
					start: trackObj.start,
					end: trackObj.end,
					cuein: trackObj.cuein,
					cueout: trackObj.cueout,
					name: trackObj.name
				})
			});

			//Now we have everything back how it should be. Load it all back in
			//Clear the playlist first.
			playlist.clear();
			//Load tracks into playlist
			playlist.load(trackData);
			//Load paths in
			this.pathsAsElevations = filePathsAsElevations;
			this.pathsAsCoordinates = filePathsAsCoordinates;
			//Clear the leaflet map
			mymap.eachLayer(function (layer) {
				if(layer === elevationData || layer === terrainVisible) {
					return;
				}
				mymap.removeLayer(layer);
			});
			//And add the polylines back
			leafletPolylines.forEach(function(p) {
				p.addTo(mymap);
			});
			//Load the saved places in
			//Clear the dropdown before we add everything back
			mapToolbarChildren.locationSelect.innerHTML = "";
			this.savedPlaces = fileSavedPlaces;
			this.savedPlaces.forEach(addPlaceToPresetsDOM);
			//Set the map center and zoom
			mymap.center = mapCenter;
			mymap.zoom = mapZoom;


		} catch (e) {
			console.log("NOT A MAP MUSIC PROJECT SAVE!");
			console.log(e);

		}

		//Hide the choose file button now that we are done
		document.getElementById("chooseFileContainer").style.display = "none";
	}
}