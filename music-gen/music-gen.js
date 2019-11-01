const Tone = require("tone");
//const toWav = require("audiobuffer-to-wav");
const toWav = require("./wav-export").wavFromBuffer;
const toMIDI = require("./midi-export").exportMIDI;

//NOTE: Tone.js should be included in the HTML before this file
function midi(note) {
    return new Tone.Frequency(note, "midi");
}

function playTones(midiNotes, config) {
    let totalPlayTime;
    if(!config.totalPlayTime) {
        //The duration value is to be interpreted as a note duration
        //We can get the total play time by multiplying by the number of notes
        totalPlayTime = config.noteDuration * midiNotes.length;
    } else {
        totalPlayTime = config.totalPlayTime;
    }
    //Initialization - set up synth and clear transport timeline
    Tone.Transport.stop();

    //This is where we can change the synth parameters
    let synth;
    switch(config.synth) {
        case "duo":
            synth = new Tone.DuoSynth().toMaster();
            break;
        default:
            console.log("Error! unknown synth, fall to classic.");
        case "classic":
            synth = new Tone.Synth().toMaster();
            break;
    }

    Tone.Transport._timeline.forEach(function(x) {
        Tone.Transport._timeline.remove(x);
    });

    //Convert notes into actual note objects
    let noteDurationSec = totalPlayTime / midiNotes.length;
    let noteSequence = [];
    for(let i=0; i<midiNotes.length; i++) {
        noteSequence.push(midi(midiNotes[i]));
    }

    //Setup play sequence
    let seq = new Tone.Sequence(function(time, note) {
        synth.triggerAttackRelease(note, noteDurationSec, time);
    }, noteSequence, noteDurationSec).start(0);
    seq.loop = false;

    //And play
    Tone.Transport.start();
    //Tone.Transport.clear(seq)
}

//Callback will be called with a blob of the wav of the rendered audio
function renderOffline(midiNotes, config, callback) {
    let totalPlayTime;
    if(!config.totalPlayTime) {
        //The duration value is to be interpreted as a note duration
        //We can get the total play time by multiplying by the number of notes
        totalPlayTime = config.noteDuration * midiNotes.length;
    } else {
        totalPlayTime = config.totalPlayTime;
    }
    Tone.Offline(function() {
        playTones(midiNotes, config);
    }, totalPlayTime).then(function(buffer) {
        //Do something with output buffer
        let wavBlob = toWav(buffer);
        /*let blob = new window.Blob([ new DataView(wav) ], {
            type: 'audio/wav'
        });*/

        /*let anchor = document.createElement('a');
        document.body.appendChild(anchor);
        anchor.style = 'display: none';
        let url = window.URL.createObjectURL(wavBlob);
        anchor.href = url;
        anchor.download = 'audio.wav';
        anchor.click();
        window.URL.revokeObjectURL(url);*/

        callback(wavBlob);
    })
}

module.exports = {
    playTones: playTones,
    renderOffline: renderOffline,
    toMIDI: toMIDI
};
