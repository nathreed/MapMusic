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
    {name: "Grand Canyon", coordinates: [36.128159479,-112.139167785], zoom: 11},
    {name: "Vancouver Mountains", coordinates: [49.3822072, -123.1363749], zoom: 12},
    {name: "University of Rochester", coordinates: [43.1289624, -77.629125], zoom: 16},
    {name: "Mount Everest", coordinates: [27.9881199, 86.9162203], zoom: 12},
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
const accessToken = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

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

// Update canvas coordinate system
let canvasContext = canvasDOM.getContext("2d");
let mapContainerDOM = document.getElementById("mapWrapper");
window.onresize = function(e){
    canvasDOM.width = mapContainerDOM.offsetWidth;
    canvasDOM.height = mapContainerDOM.offsetHeight;
    canvasCoordinates = canvasDOM.getBoundingClientRect();
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

    if(scalingType === "totalLength") {
        return {
            highNote: highNote,
            lowNote: lowNote,
            totalPlayTime: durationValue,
            noteDuration: false,
            playLivePreview: playLivePreview,
            soundName: soundName
        }
    } else if(scalingType === "noteDuration") {
        return {
            highNote: highNote,
            lowNote: lowNote,
            totalPlayTime: false,
            noteDuration: durationValue,
            playLivePreview: playLivePreview,
            soundName: soundName
        }
    } else {
        console.log("ERROR! Unknown duration interpretation!");
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
            Music.playTones(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, elevations), configValues);
        }

    }

    // Reset canvas painting stuff
    canvasContext.closePath();
    canvasContext.clearRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height); // Clears the canvas
    painting = false;
    lineCoordinates = [];
};

// Audio config options pane submit action
document.getElementById("addStagedAudio").onclick = function(e) {
    let elevations = pathsAsElevations[pathsAsElevations.length - 1];
    let configValues = getAudioConfigValues();
    Music.renderOffline(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, elevations), configValues, function (blob) {
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
    Music.playTones(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, elevations), configValues);
};

function normalizeElevations100(pathElevation) {
    //We take the array of elevations and we map them onto a 0-100 scale
    //Simple idea for now: We just make their value be the % of the max they are
    let max = Math.max.apply(null, pathElevation);
    let min = Math.min.apply(null, pathElevation);

    let normalizedElevations = [];
    pathElevation.forEach(function(x) {
        normalizedElevations.push(((x-min)/(max-min))*100);
    });
    return normalizedElevations;
}

function normalizeToMidiNotes(noteMin, noteMax, elevations) {
    //First normalize the elevations to the 100 scale
    let elevations100 = normalizeElevations100(elevations);

    //Next, apply a similar procedure to get midi notes, except this time with rounding bc midi notes are ints
    let midiNotes = [];

    //We don't need to find min and max, they are 0 and 100 by definition
    elevations100.forEach(function(x) {
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

playlist.load([{
    "src": "suv-godbless.mp3",
    "name": "SUV"
}]).then(function() {
    console.log("loading done!");
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

function toggleActive(node) {
    let active = node.parentNode.querySelectorAll('.active');
    let i = 0, len = active.length;

    for (; i < len; i++) {
        active[i].classList.remove('active');
    }

    node.classList.toggle('active');
}

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

document.getElementById("btn-cursor").onclick = function(e) {
    ee.emit("statechange", "cursor");
    toggleActive(this);
};

document.getElementById("btn-select").onclick = function(e) {
    ee.emit("statechange", "select");
    toggleActive(this);
};

document.getElementById("btn-shift").onclick = function(e) {
    ee.emit("statechange", "shift");
    toggleActive(this);
};

$container.on("click", ".btn-trim-audio", function() {
    ee.emit("trim");
});

$container.on("click", ".btn-download", function () {
    ee.emit('startaudiorendering', 'wav');
});



let audioStates = ["uninitialized", "loading", "decoding", "finished"];

ee.on("audiorequeststatechange", function(state, src) {
    var name = src;

    if (src instanceof File) {
        name = src.name;
    }

    console.log("Track " + name + " is in state " + audioStates[state]);
});

ee.on("loadprogress", function(percent, src) {
    let name = src;

    if (src instanceof File) {
        name = src.name;
    }

    console.log("Track " + name + " has loaded " + percent + "%");
});

ee.on("audiosourcesloaded", function() {
    console.log("Tracks have all finished decoding.");
});

ee.on("audiosourcesrendered", function() {
    console.log("Tracks have been rendered");
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
    const keyName = e.key;
    //Spacebar: toggle play pause
    if(keyName === " ") {
        if(playlist.isPlaying()) {
            isLooping = false;
            ee.emit("pause");
        } else {
            ee.emit("play");
        }
    } else if(keyName === "s") {
        isLooping = false;
        ee.emit("stop");
    } else if(keyName === "x") {
        isLooping = false;
        ee.emit("clear");
    } else if(keyName === "c") {
        //cursor
        ee.emit("statechange", "cursor");
        toggleActive(this);
    } else if(keyName === "s") {
        ee.emit("statechange", "select");
        toggleActive(this);
    } else if(keyName === "f") {
        ee.emit("statechange", "shift");
        toggleActive(this);
    } else if(keyName === "t") {
        ee.emit("trim");
    }
});