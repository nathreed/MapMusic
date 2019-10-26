const Tone = require("tone");
//const toWav = require("audiobuffer-to-wav");
const toWav = require("./wav-export").wavFromBuffer;
//NOTE: Tone.js should be included in the HTML before this file
function midi(note) {
    return new Tone.Frequency(note, "midi");
}

function playTones(midiNotes, totalPlayTime) {
    //Initialization - set up synth and clear transport timeline
    Tone.Transport.stop();
    let synth = new Tone.Synth().toMaster();

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
function renderOffline(midiNotes, totalPlayTime, callback) {
    console.log("TOTAL PLAY TIME RENDER OFFLINE", totalPlayTime);
    Tone.Offline(function() {
        playTones(midiNotes, totalPlayTime);
    }, totalPlayTime).then(function(buffer) {
        //Do something with output buffer
        console.log("OFFLINE RENDER OUTPUT:");
        console.log(buffer);

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
    renderOffline: renderOffline
};
