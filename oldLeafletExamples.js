let night = false;
const locationSettings = {
	enableHighAccuracy: true, 
	maximumAge        : 30000, 
	timeout           : 27000
};

// Map Settings
const center = [43.12861, -77.630081];
const myLocationMarkerOptions = {
	weight: 3,
	color: '#fff',
	radius: 5,
	fillColor: '#009dff',
	fillOpacity: 1.0
};

// Variable storing location so no stutter when starting again
let lastLocation = null;

// Map initialization
let mymap = L.map('mapid').setView(center, 16);
let myLocationMarker = L.circleMarker(L.latLng(center), myLocationMarkerOptions);

// Mapbox map layer layer
L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
	maxZoom: 18,
	minZoom: 14,
	attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
		'<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
		'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
	id: (night? 'mapbox.dark':'mapbox.light')
}).addTo(mymap);

myLocationMarker.addTo(mymap);
