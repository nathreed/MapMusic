# Map Music

## Mapping Elevation to Pitch
Main idea: lower elevation = lower pitch, higher elevation = higher pitch

Elevation info will be normalized on a per-line basis, let's say in the range of 0-100. 
So we will take this 0-100 number and map it onto the musical scale between C1 and C6
(midi 24-84). 

## Tools/Effects
- pitch: elevation maps to pitch and generates music (see above)
- volume: elevation maps to volume levels (easy mapping 0-100%) and modifies existing track
- pitch warp: elevation maps to pitch warp factor (similar as above) and modifies existing track
- CA$H MONEY: fun UI to determine how much money to bank transfer!

## Install/Build Instructions
1. `npm install` (one time/when dependencies are added)
2. `npm run browserify && npm run sass` (every time you change the JS. HTML and CSS don't need a rerun)


## Things We Should Add
- [x] Remove jQuery requirement
- [x] for the pitch drawing instrument we have now: user-configurable length of play maybe add linear interpolation of elevation data so that we can only sample a few  points from the user's line, helpful for shorter clips
- [x] Switch to font awesome icons
- [ ] Restyle dropdowns to match aesthetic
- [ ] controls pane on right: drop down or tabbed interface to select controls for which instrument/effect and then the controls adapt
- [ ] Make the histogram map colored
- [ ] Make mobile work
	- [ ] Media queries for CSS
	- [ ] touch events
- [ ] Load midi fonts/own synth presets
- [ ] Reorganize code
- [ ] Make check downloadable/printable (can't right now since it's embedded directly)
- [ ] Clean up build commands
- [ ] Resizeable areas
- [ ] Use Directions API for using roads to get elevation as alternative input
- [ ] Add help section for how to use
- [ ] Convert to pug/sass (?)
- [ ] Swap out audio composer/make own (?)
- [ ] Add about section for info on us (?)