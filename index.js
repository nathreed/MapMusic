const L = require("leaflet");
require("leaflet-tilelayer-colorpicker");
const Music = require("./music-gen");
const WaveformPlaylist = require('waveform-playlist');
const numConverter = require("number-to-words");
const checkSVG = require("./fakeCheckSVG.js");
//the styles for waveform-playlist are included separately and compiled in a separate step

// Map toolbar handling
let mapToolbarChildren = $id("mapToolbar").children;
// Process panning/drawing toggle
$id("panningMode").oninput = function(e){
	// Set to panning mode by removing click events on the canvas
	console.log("setting pan mode");
	canvasDOM.classList.add("noInteraction");
};

$id("drawingMode").oninput = function(e){
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

//Switch between music tab and cash tab
$id("musicTab").onclick = function() {
	$id("bankingControlsWrapper").style.display = "none";
	$id("audioControlsWrapper").style.display = "";

	$id("editorHideWrapper").style.display = "";
    $id("checkShowWrapper").style.display = "none";
    $id("loopEditorWrapper").style.overflow = "auto";

	//We have to do this to not mess up the drawing
	resizeCanvasesAndRedrawHistogram()
};

$id("cashTab").onclick = function() {
	$id("bankingControlsWrapper").style.display = "";
	$id("audioControlsWrapper").style.display = "none";

	$id("editorHideWrapper").style.display = "none";
	$id("checkShowWrapper").style.display = "";
    $id("loopEditorWrapper").style.overflow = "none";

	resizeCanvasesAndRedrawHistogram()
};
//Given the last set of elevations, determine whether to send them to the music playing code or the bank code
//This will be determined based on which tab is selected on top
function elevationDataDispatch(elevations) {
	let musicTab = $id("musicTab");
	if(musicTab.checked) {
		//Music tab is selected, dispatch to music code
		musicPlay(elevations);
	} else {
		//Cash tab is selected, dispatch to cash code
		cash(elevations);
	}
}

function musicPlay(elevations) {
	//Get the config values from the page
	let configValues = getAudioConfigValues();
	if(configValues.playLivePreview) {
		Music.playTones(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, configValues.sampleTo, configValues.sampleToPredicate, elevations), configValues);
	}
}

function cash(elevations) {
	//First determine if we are sending or requesting money
	//If the general trend is downhill, we are sending
	//If the general trend is uphill, we are requesting
	if(elevations[0] >= elevations[elevations.length - 1]) {
		//First is greater than the last, that means downhill -> sending
		$id("sendMoney").checked = true;
	} else {
		//Uphill -> requesting
		$id("reqMoney").checked = true;
	}

	//Next determine the amount, this is the abs of the first minus last
	let amount = Math.abs(elevations[0] - elevations[elevations.length - 1]);
	$id("cashAmount").value = amount.toFixed(2);
}

//Cash go button - modify SVG
$id("cashGo").onclick = function() {
	//Grab the names from the page
	//And the amount, whether sending or receiving, etc
	let senderName = $id("yourName").value;
	let toName = $id("cashName").value;
	let amount = $id("cashAmount").value;

	//Check to see if it's filled in
	//if(amount === "") return;

	//Get spelled out words for the dollar amount
	let dollars = parseInt(amount);
	let dollarsString = numConverter.toWords(dollars) + " dollars";

	let centsString = " and " + Math.round((amount-dollars)*100) + "/100";

	let finalAmtString = dollarsString + centsString;
	finalAmtString = finalAmtString.toUpperCase();

	//Format date
	//August 1, 2019
	let date = new Date();
	let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	let dateString = months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();



	let sendBtn = $id("sendMoney");

    // Finalize the SVG
    let svgString = checkSVG.svgString.replace("\{svgDollarNText\}", amount);
    svgString = svgString.replace("\{svgDollarWordsText\}", finalAmtString);
    svgString = svgString.replace("\{svgDateText\}", dateString);
    if(sendBtn.checked) {
        svgString = svgString.replace("\{svgSenderText\}", senderName);
        svgString = svgString.replace("\{svgDestinationText\}", toName);
      } else {
		//Requesting money, swap names on check
        svgString = svgString.replace("\{svgSenderText\}", toName);
        svgString = svgString.replace("\{svgDestinationText\}", senderName);
	}

    $id("checkShowWrapper").innerHTML = svgString;
};

// Audio config preview canvas
let stagedAudioCanvasDOM = $id("stagedAudioCanvas");
let stagedAudioCanvasContext = stagedAudioCanvasDOM.getContext("2d");

// Map layer canvas
let mapContainerDOM = $id("mapWrapper");
canvasDOM = $id("drawingLayer");
let canvasContext = canvasDOM.getContext("2d");

// Update each size and redraw on window resize
function resizeCanvasesAndRedrawHistogram(resizeEvent){
    console.log("resizing Canvases to ",  canvasDOM.offsetWidth, ", ", canvasDOM.offsetHeight);
	canvasDOM.width = canvasDOM.offsetWidth;
	canvasDOM.height = canvasDOM.offsetHeight;

	// Code for histogram window resizing
	stagedAudioCanvasDOM.width = stagedAudioCanvasDOM.offsetWidth;
	stagedAudioCanvasDOM.height = stagedAudioCanvasDOM.offsetHeight;

	// Redraw on resize
	if(pathsAsElevations.length > 0){
		renderElevationHistogram(pathsAsElevations[pathsAsElevations.length-1]);
	}
};

// Call it once to initialize the values
resizeCanvasesAndRedrawHistogram();
window.onresize = resizeCanvasesAndRedrawHistogram;

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

canvasDOM.onmousedown = function(e) {
	painting = true;
    const mouseLocation = L.point(e.offsetX, e.offsetY);

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
        const mouseLocation = L.point(e.offsetX, e.offsetY);

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

		elevationDataDispatch(elevations);

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
$id("addStagedAudio").onclick = function(e) {
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
$id("playStagedAudio").onclick = function(e) {
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
console.log("added playlist");


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
			$id("panningMode").checked = true;
			break;
		case "d":
			// D: map drawing mode
			canvasDOM.classList.remove("noInteraction");
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
	}
});


/*
PROJECT FILE SAVE/LOAD
 */
$id("projSave").onclick = function(e) {
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
		const fileBlob = new window.Blob([data], {
			type: "application/json"
		});
		download(fileBlob, "prop.json");
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
		console.log(reader.result);
		let strData = reader.result;
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
		$id("chooseFileContainer").style.display = "none";
	}
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