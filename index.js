let L = require("leaflet");
require("leaflet-tilelayer-colorpicker");
let Music = require("./music-gen");
console.log(Music);

// Map toolbar handling
let savedPlaces = [
    {name: "Grand Canyon", coordinates: [36.1307675,-112.0945079], zoom: 12},
    {name: "Vancouver Mountains", coordinates: [49.3822072, -123.1363749], zoom: 12},
    {name: "University of Rochester", coordinates: [43.1289624, -77.629125], zoom: 16},
    {name: "Mount Everest", coordinates: [27.9881199, 86.9162203], zoom: 12},
    {name: "Death Valley", coordinates: [36.5045059, -117.078918], zoom: 13},
    {name: "Shenandoah River", coordinates: [38.8943634, -78.4618465], zoom: 13},
    {name: "Appalachian Mountains", coordinates: [38.4381578, -79.2209245], zoom: 14}
];


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

let canvasDOM = document.getElementById("drawingLayer");
let canvasContext = canvasDOM.getContext("2d");

// Update canvas coordinate system
let mapContainerDOM = document.getElementById("mapContainer");
canvasDOM.width = mapContainerDOM.offsetWidth;
canvasDOM.height = mapContainerDOM.offsetHeight;
window.onresize = function(e){
    canvasDOM.width = mapContainerDOM.offsetWidth;
    canvasDOM.height = mapContainerDOM.offsetHeight;
};

// Drawing code
const draftingLineColor = "#737561";
const setLineColor = "#464738";
let painting = false;
let lineCoordinates = [];
const distanceThreshold = 5;

canvasDOM.onmousedown = function(e) {
    console.log("hi");
    painting = true;
    const mouseLocation = L.point(e.pageX - this.offsetLeft,
        e.pageY - this.offsetTop);

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
        const mouseLocation = L.point(e.pageX - this.offsetLeft,
            e.pageY - this.offsetTop);

        // Get the direction of the mouse movement (for use with: https://math.stackexchange.com/a/175906)
        const v = mouseLocation.subtract(lineCoordinates[lineCoordinates.length - 1]);
        const du = v.divideBy(v.distanceTo(L.point(0,0))).multiplyBy(distanceThreshold);

        // If greater than the distance criteria, draw set length lines towards current mouse location until too close
        while(mouseLocation.distanceTo(lineCoordinates[lineCoordinates.length - 1]) >= distanceThreshold){
            // Interpolate a point distanceThreshold units away from the last point (final bit of: https://math.stackexchange.com/a/175906)
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
    // Convert to a GeoJSON object (Assumes canvas origin and map origin are equivalent)
    const coordinates = lineCoordinates.map((point) => {
        return mymap.containerPointToLatLng(point);
    });

    // Add GeoJSON to the map (and store the path in the polylines list)
    pathsAsPolylines.push(L.polyline(coordinates, {color: setLineColor}).addTo(mymap));

    // Points to elevation data
    const elevations = coordinates.map((point) => {
        const color = elevationData.getColor(point);
        if(color !== null){
            // Convert the RGB channels to one hex number then scale to mapbox elevation data
            return -10000 + 0.1 * ((color[0] << 16) + (color[1] << 8) + color[2]);
        } else {
            console.log("crap, coordinates at " + point + " aren't color-readable.");
        }
    });

    // Add elevation data and path to arrays
    pathsAsElevations.push(elevations);
    pathsAsCoordinates.push(coordinates);

    //TEST: normalize elevations and print
    console.log("**TESTING**");
    console.log(elevations);
    console.log(normalizeElevations100(elevations));
    console.log(normalizeToMidiNotes(24, 84, elevations));
    //Test play tones
    Music.playTones(normalizeToMidiNotes(24,84,elevations), 8);
    Music.renderOffline(normalizeToMidiNotes(24,84,elevations), 8);

    // Reset canvas painting stuff
    canvasContext.closePath();
    canvasContext.clearRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height); // Clears the canvas
    painting = false;
    lineCoordinates = [];
};

function normalizeElevations100(pathElevation) {
    //We take the array of elevations and we map them onto a 0-100 scale
    //Simple idea for now: We just make their value be the % of the max they are
    let max = Math.max.apply(null, pathElevation);
    let min = Math.min.apply(null, pathElevation);
    //console.log("MIN:", min);
    //console.log("MAX:", max);

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
