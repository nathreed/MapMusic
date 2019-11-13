const L = require("leaflet");
require("leaflet-tilelayer-colorpicker");
const Music = require("./music-gen");
const WaveformPlaylist = require('waveform-playlist');
const numConverter = require("number-to-words");
const checkSVG = require("./fakeCheckSVG.js");
const Path = require("./Path").Path;
//the styles for waveform-playlist are included separately and compiled in a separate step

// Map toolbar handling
let mapToolbarChildren = $id("mapToolbar").children;
// Process panning/drawing toggle
$id("panningMode").oninput = function(e){
	// Set to panning mode by removing click events on the canvas
	console.log("setting pan mode");
	mapCanvasDOM.classList.add("noInteraction");
};

$id("drawingMode").oninput = function(e){
	console.log("setting drawmode");
	mapCanvasDOM.classList.remove("noInteraction");
};

// Add a place to the saved locations list in display and data
function addPlaceToPresetsDOM(place, index){
	let option = document.createElement("option");
	option.text = place.name;
	option.value = index;
	mapToolbarChildren.locationSelect.add(option);
	savedPlaces[index] = place;
}
let savedPlaces = [
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

// Elevation data, hidden from view
let elevationData = L.tileLayer.colorPicker(urlRGBheight, {
	attribution: "",
	minZoom: 1,
	maxZoom: 18,
	maxNativeZoom: 14,
	opacity: 0.0,
	accessToken: accessToken
}).addTo(mymap);

//Switch between music tab and cash tab
$id("musicTab").onclick = function() {
	$id("bankingControlsWrapper").classList.add("hide");
	$id("audioControlsWrapper").classList.remove("hide");

	$id("editorHideWrapper").classList.remove("hide");
    $id("checkShowWrapper").classList.add("hide");

	//We have to do this to not mess up the drawing
	resizeCanvasesAndRedrawHistogram()
};

$id("cashTab").onclick = function() {
	// Toggle what's being shown
	$id("bankingControlsWrapper").classList.remove("hide");
	$id("audioControlsWrapper").classList.add("hide");

	$id("editorHideWrapper").classList.add("hide");
	$id("checkShowWrapper").classList.remove("hide");

	// Call the cash function to update the input values
	if(stagedPath){
		cash(stagedPath.coordinates[0].alt, stagedPath.coordinates[stagedPath.coordinates.length - 1].alt);
	}

	// Update the canvas because we always update the canvas
	resizeCanvasesAndRedrawHistogram()
};
//Given the last set of elevations, determine whether to send them to the music playing code or the bank code
//This will be determined based on which tab is selected on top
function elevationDataDispatch(pathObj) {
	if($id("musicTab").checked) {
		//Music tab is selected, dispatch to music code (if setting to play automatically)
		let audioConfig = getAudioConfigValues();
		if(audioConfig.playLivePreview) {
			pathObj.playAudio(audioConfig);
		}
	} else {
		//Cash tab is selected, dispatch to cash code
		cash(pathObj.coordinates[0].alt, pathObj.coordinates[pathObj.coordinates.length - 1].alt);
	}
}


function cash(start, end) {
	//First determine if we are sending or requesting money
	//If the general trend is downhill, we are sending, otherwise requesting
	if(start >= end) {
		//First is greater than the last, that means downhill -> sending
		$id("sendMoney").checked = true;
	} else {
		//Uphill -> requesting
		$id("reqMoney").checked = true;
	}

	//Next determine the amount, this is the abs of the first minus last
	let amount = Math.abs(start - end);
	$id("cashAmount").value = amount.toFixed(2);
}

//Cash go button - render SVG
$id("cashGo").onclick = function() {
	//Grab the names from the page
	//And the amount, whether sending or receiving, etc
	let senderName = $id("yourName").value;
	let toName = $id("cashName").value;

	// If receiving money, swap values
	if($id("reqMoney").checked) {
		let temp = senderName;
		senderName = toName;
		toName = temp;
	}

	// Numerical value of $
	let amount = $id("cashAmount").value;

	//Get spelled out words for the dollar amount
	let dollars = parseInt(amount);
	let finalAmtString = numConverter.toWords(dollars) + " dollars and " + Math.round((amount - dollars) * 100) + "/100";
	finalAmtString = finalAmtString.toUpperCase();

	//Format date
	//August 1, 2019
	let date = new Date();
	let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	let dateString = months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();

    // Finalize the SVG
    let svgString = checkSVG.svgString.replace("\{svgDollarNText\}", amount);
    svgString = svgString.replace("\{svgDollarWordsText\}", finalAmtString);
    svgString = svgString.replace("\{svgDateText\}", dateString);
    svgString = svgString.replace("\{svgSenderText\}", senderName);
    svgString = svgString.replace("\{svgDestinationText\}", toName);

	// URL encoding the SVG so can right click to download it
    $id("checkImage").src = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svgString);
};

// Audio config preview canvas
let elevationHistogramCanvas = $id("elevationHistogramCanvas");

// Map layer canvas
let mapCanvasDOM = $id("drawingLayer");
let mapCanvasContext = mapCanvasDOM.getContext("2d");

// Update each size and redraw on window resize
function resizeCanvasesAndRedrawHistogram(){
	// Update map layer canvas size
	mapCanvasDOM.width = mapCanvasDOM.offsetWidth;
	mapCanvasDOM.height = mapCanvasDOM.offsetHeight;

	// Update histogram canvas size
	elevationHistogramCanvas.width = elevationHistogramCanvas.offsetWidth;
	elevationHistogramCanvas.height = elevationHistogramCanvas.offsetHeight;

	// Redraw histogram on resize (don't redraw map layer since it's temporary, can't resize while drawing)
	if(stagedPath){
		stagedPath.renderHistogram(elevationHistogramCanvas, true);
	}
};

let pathsList = [];
let stagedPath = null;

// Call it once to initialize the values and recall it each time the window's resized
resizeCanvasesAndRedrawHistogram();
window.onresize = resizeCanvasesAndRedrawHistogram;

// Drawing code
const draftingLineColor = "#525442";
let painting = false;
let lineCoordinates = [];
const rawDistanceThreshold = 2;

function getAudioConfigValues() {
	//Grab the values out of each thing that we want
	//Right now we want high note, low note, and duration information
	//High note
	let highNote = parseInt($id("highNote").value);
	let lowNote = parseInt($id("lowNote").value);

	let scalingType = $id("audioLengthScalingMode").value;
	let durationValue = parseFloat($id("audioLength").value);

	let playLivePreview = $id("playLivePreview").checked;

	let soundName = $id("soundName").value;

	let sampleTo = $id("sampleTo").value;
	let sampleToPredicate = $id("sampleToPredicate").checked;


	let synth;
	let classicSynth = $id("classicSynth").checked;
	if(classicSynth) {
		synth = "classic"
	} else {
		synth = "duo"
	}

	if(scalingType === "totalLength") {
		return {
			highNote: highNote,
			lowNote: lowNote,
			totalPlayTime: durationValue,
			noteDuration: false,
			playLivePreview: playLivePreview,
			soundName: soundName,
			sampleTo: sampleTo,
			sampleToPredicate: sampleToPredicate,
			synth: synth
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
			sampleToPredicate: sampleToPredicate,
			synth: synth
		}
	} else {
		console.log("ERROR! Unknown duration interpretation!");
	}
}

$id("sampleToPredicate").onclick = function(e){
	console.log("toggling resampling.")
	if(this.checked){
		$id("sampleTo").disabled = false;
	} else {
		$id("sampleTo").disabled = true;
	}
}

// Starting drawing (mirrored for touch)
mapCanvasDOM.onmousedown = (e) => canvasStartDrawing(e.offsetX, e.offsetY);
mapCanvasDOM.ontouchstart = (e) => {
	// Handle only one touch
	let touch = e.targetTouches[0];
	let canvasPosition = mapCanvasDOM.getBoundingClientRect();
	canvasStartDrawing(touch.clientX - canvasPosition.x, touch.clientY - canvasPosition.y);
};
function canvasStartDrawing(offsetX, offsetY) {
	// Set painting variables
	painting = true;
    let mouseLocation = L.point(offsetX, offsetY);

    // Clear the old path
    if(stagedPath && !pathsList.includes(stagedPath)){
    	stagedPath.removeFrom(mymap);
    }

	// Start drawing a line
	lineCoordinates.push(mouseLocation);
	mapCanvasContext.strokeStyle = draftingLineColor;
	mapCanvasContext.lineJoin = "round";
	mapCanvasContext.lineCap = "round";
	mapCanvasContext.lineWidth = 1;
	mapCanvasContext.beginPath();
	mapCanvasContext.moveTo(mouseLocation.x, mouseLocation.y);
};

// While the mouse is moving
mapCanvasDOM.onmousemove = (e) => canvasActivelyDrawing(e.offsetX, e.offsetY);
mapCanvasDOM.ontouchmove = (e) => {
	// Handle only one touch
	let touch = e.targetTouches[0];
	let canvasPosition = mapCanvasDOM.getBoundingClientRect();
	canvasActivelyDrawing(touch.clientX - canvasPosition.x, touch.clientY - canvasPosition.y);
};
function canvasActivelyDrawing(offsetX, offsetY) {
	if(painting) {
        let mouseLocation = L.point(offsetX, offsetY);

		// Get the direction of the mouse movement (for use with: https://math.stackexchange.com/a/175906)
		let v = mouseLocation.subtract(lineCoordinates[lineCoordinates.length - 1]);
		let du = v.divideBy(v.distanceTo(L.point(0,0))).multiplyBy(rawDistanceThreshold);

		// If greater than the distance criteria, draw set length lines towards current mouse location until too close
		while(mouseLocation.distanceTo(lineCoordinates[lineCoordinates.length - 1]) >= rawDistanceThreshold){
			// Interpolate a point rawDistanceThreshold units away from the last point (final bit of: https://math.stackexchange.com/a/175906)
			let interpolatedPoint = du.add(lineCoordinates[lineCoordinates.length - 1]);

			// Add the interpolated point to the list
			lineCoordinates.push(interpolatedPoint);

			// Draw the next line segment
			mapCanvasContext.lineTo(interpolatedPoint.x, interpolatedPoint.y);
			mapCanvasContext.stroke();
		}
	}
};

// Closing off a path
mapCanvasDOM.onmouseup = canvasFinishedDrawing;
mapCanvasDOM.ontouchend = canvasFinishedDrawing;
function canvasFinishedDrawing(e) {

	// Check if there are enough points to do audio stuff
	if(lineCoordinates.length >= 2) {
		// Set up the new path
		let coordinates = lineCoordinates.map((point) => {
			// Get lat and long
			let coords = mymap.containerPointToLatLng(point);

			// Get altitude
			let color = elevationData.getColor(coords);
			if (color !== null) {
				// Convert the RGB channels to one hex number then scale to mapbox elevation data
				coords.alt = -10000 + 0.1 * ((color[0] << 16) + (color[1] << 8) + color[2]);
			} else {
				console.log("crap, coordinates at " + point + " aren't color-elevation-readable.");
			}

			// return the coordinates
			return coords;
		});

		// Make a new path object and graph it, add it to the map
		stagedPath = new Path(coordinates);
		stagedPath.renderHistogram(elevationHistogramCanvas, true);
		stagedPath.addTo(mymap);
		elevationDataDispatch(stagedPath);
	}

	// Reset canvas painting stuff
	mapCanvasContext.closePath();
	mapCanvasContext.clearRect(0, 0, mapCanvasContext.canvas.width, mapCanvasContext.canvas.height); // Clears the canvas
	painting = false;
	lineCoordinates = [];
};

// Audio config options pane submit action
$id("addStagedAudio").onclick = function(e) {
	// Only add if there's a path to use
	if(stagedPath){
		// Adding to the pathsList (saving)
		pathsList.push(stagedPath);

		let configValues = getAudioConfigValues();
		Music.renderOffline(stagedPath.normalizeToMidiTones(configValues), configValues, function (blob) {
			console.log("blob callback, blob:", blob);
			playlist.load([{
				src: blob,
				name: configValues.soundName,
				gain: 0.5
			}]);
		});
	}
};

// Audio config options pane play audio again action
$id("playStagedAudio").onclick = function(e) {
	if(stagedPath){
		stagedPath.playAudio(getAudioConfigValues());
	}
};

//Setup editor
let playlist = WaveformPlaylist.init({
	samplesPerPixel: 3000,
	mono: true,
	waveHeight: 100,
	container: $id("loopEditorContainer"),
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


/*
PLAYLIST EVENT CONTROL BELOW HERE
 */

let ee = playlist.getEventEmitter();
let startTime = 0;
let endTime = 0;
let audioPos = 0;
let isLooping = false;
let playoutPromises;

function updateSelect(start, end) {
	if (start < end) {
		$id("btn-trim-audio").classList.remove('disabled');
	}
	else {
		$id("btn-trim-audio").classList.add('disabled');
	}

	startTime = start;
	endTime = end;
}

updateSelect(startTime, endTime);

$id("btn-play").onclick = function(e){
	ee.emit("play");
};
$id("btn-pause").onclick = function(e){
	isLooping = false;
	ee.emit("pause");
};

$id("btn-stop").onclick =  function(e) {
	isLooping = false;
	ee.emit("stop");
};

$id("btn-clear").onclick = function(e) {
	isLooping = false;
	ee.emit("clear");

	// Clear the map as well
	clearMapPaths();
};

//Drag and Drop support
$id("track-drop").ondragenter = function(e) {
	console.log("DRAG ENTER!");
	e.preventDefault();
	e.target.classList.add("drag-enter");
};

$id("track-drop").ondragover = function(e) {
	console.log("DRAG OVER!");
	e.preventDefault();
};

$id("track-drop").ondragleave = function(e) {
	console.log("DRAG LEAVE!");
	e.preventDefault();
	e.target.classList.remove("drag-enter");
};

$id("track-drop").drop = function(e) {
	console.log("DROP!");
	e.preventDefault();
	e.target.classList.remove("drag-enter");

	let dropEvent = e.originalEvent;

	for (let i = 0; i < dropEvent.dataTransfer.files.length; i++) {
		ee.emit("newtrack", dropEvent.dataTransfer.files[i]);
	}
};


$id("btn-cursor").onclick = function(e) {
	ee.emit("statechange", "cursor");
};

$id("btn-select").onclick = function(e) {
	ee.emit("statechange", "select");
};

$id("btn-shift").onclick = function(e) {
	ee.emit("statechange", "shift");
};

$id("btn-trim-audio").onclick = function(e) {
	ee.emit("trim");
};

$id("btn-download").onclick = function(e) {
	ee.emit('startaudiorendering', 'wav');
};

ee.on('audiorenderingfinished', function (type, data) {
	if(type === 'wav'){
		download(data, "audio.wav");
	}
});

//Event listeners for keyboard controls
document.addEventListener("keydown", function(e) {
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
			mapCanvasDOM.classList.add("noInteraction");
			$id("panningMode").checked = true;
			break;
		case "d":
			// D: map drawing mode
			mapCanvasDOM.classList.remove("noInteraction");
			$id("drawingMode").checked = true;
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

			// Clear the map as well
			clearMapPaths();
			break;
		case "c":
			// C: cursor playlist tool
			ee.emit("statechange", "cursor");
			$id("btn-cursor").checked = true;
			break;
		case "l":
			// L: select playlist tool
			ee.emit("statechange", "select");
			$id("btn-select").checked = true;
			break;
		case "f":
			// F: shift playlist tool
			ee.emit("statechange", "shift");
			$id("btn-shift").checked = true;
			break;
		case "t":
			// T: trip selection in playlist
			ee.emit("trim");
			break;
		case "m":
			//M: download midi file
			setupMIDIDownload();
			break;
	}
});

function setupMIDIDownload() {
	if(!stagedPath) {
		return; //do nothing if there is not a staged path
	}
	//Have to get the note duration
	//Easiest way to do this is with the config values
	let configValues = getAudioConfigValues();
	//let elevations = pathObj.elevations;
	let notes = stagedPath.normalizeToMidiTones(configValues);
	//If noteDuration is set, we can just use that, else we need to determine it
	let durationSec = 0;
	if(configValues.noteDuration) {
		durationSec = configValues.noteDuration;
	} else {
		durationSec = configValues.totalPlayTime / notes.length;
	}

	Music.toMIDI(notes, durationSec, configValues.soundName);
}


/*
PROJECT FILE SAVE/LOAD
 */
$id("projSave").onclick = function(e) {
	//Assemble the components for the file
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

	// Extract just the coordinates from the pathsList
	let coordinates = pathsList.map((path) => {
		return path.coordinates;
	});

	Promise.all(trackPromises).then(function() {
		console.log("ALL TRACKS DONE!");
		console.log(tracks);
		//Final object
		let save = {
			filetype: "mapmusic-save",
			pathsCoords: coordinates,
			tracks: tracks,
			mapCenter: mapCenter,
			mapZoom: mapZoom,
			savedPlaces: savedPlaces
		};

		//Write out data as JSON
		const data = JSON.stringify(save);
		const fileBlob = new window.Blob([data], {
			type: "application/json"
		});
		download(fileBlob, "proj.json");
	});
};

$id("projLoad").onclick = function(e) {
	//Show the choose file button
	$id("chooseFileContainer").style.display = "inline";
};

$id("filePicker").onchange = function(e) {
	let files = e.target.files;
	//Get files[0]
	let projFile = files[0];
	console.log(projFile);
	let reader = new FileReader();
	reader.readAsText(projFile);
	reader.onloadend = function() {
		let strData = reader.result;
		try {
			let projData = JSON.parse(strData);
			if(projData["filetype"] !== "mapmusic-save") {
				throw new Error("wrong filetype");
			}
			//Unpack the project data into its various components
			// Set the zoom and view
			mymap.setView(projData.mapCenter, projData.mapZoom);
			
			// Load the saved places in, clearing the dropdown before we add everything back
			savedPlaces = projData.savedPlaces;
			mapToolbarChildren.locationSelect.innerHTML = "";
			savedPlaces.forEach(addPlaceToPresetsDOM);

			// Load the paths in (clearing the current paths first) and adding to the map
			clearMapPaths();
			pathsList = projData.pathsCoords.map((coordinates) => {
				let path = new Path(coordinates);
				path.addTo(mymap);
				return path;
			});

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
		} catch (e) {
			console.log("NOT A MAP MUSIC PROJECT SAVE!");
			console.log(e);

		}

		//Hide the choose file button now that we are done
		$id("chooseFileContainer").style.display = "none";
	}
};

$id("downloadMIDI").onclick = function() {
	//cause midi file to download
	setupMIDIDownload();
};

// Clear paths from the map
function clearMapPaths() {
	// Clear the staged path
	if(stagedPath){
		stagedPath.removeFrom(mymap);
		stagedPath = null;
	}

	// Clear the saved paths
	for(let i = 0; i < pathsList.length; i++){
		pathsList[i].removeFrom(mymap);
	}
	pathsList = [];
}

// JankQuery (We repeat this so much it's painful)
function $id(id) {
    return document.getElementById(id);
}

// Download some data automatically
function download(data, filename){
    // Make a download link and click it, then make it all go away
    let anchor = document.createElement('a');
    anchor.style = 'display: none';
    anchor.href = window.URL.createObjectURL(data);
    document.body.appendChild(anchor);
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(anchor.href);
    anchor.remove();
}