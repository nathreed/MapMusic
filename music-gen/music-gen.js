const Tone = require("tone");
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

function renderOffline(midiNotes, totalPlayTime) {
    Tone.Offline(function() {
        playTones(midiNotes, totalPlayTime); //does this work?
        /*Tone.Transport.stop();
        let synth = new Tone.Synth().toMaster();

        Tone.Transport._timeline.forEach(function(x) {
            Tone.Transport._timeline.remove(x);
        });

        synth.triggerAttackRelease("C2", "4n");*/

    }, totalPlayTime).then(function(buffer) {
        //Do something with output buffer
        console.log("OFFLINE RENDER OUTPUT:");
        console.log(buffer);
        let wavBuffer = audioBufferToWav(buffer);


        setTimeout(function() {
            let player = new Tone.Player(buffer).toMaster();
            console.log("STARTING PLAYER ON OFFLINE BUFFER!");
            player.start();

            //Trigger download of the wav
            //Adapted from https://github.com/Jam3/audiobuffer-to-wav/blob/master/demo/index.js
            let blob = new window.Blob([ new DataView(wavBuffer) ], {
                type: 'audio/wav'
            });


            let anchor = document.createElement('a');
            document.body.appendChild(anchor);
            anchor.style = 'display: none';

            let url = window.URL.createObjectURL(blob);
            anchor.href = url;
            anchor.download = 'audio.wav';
            anchor.click();
            window.URL.revokeObjectURL(url);
        }, 10000)
    })
}

module.exports = {
    playTones: playTones,
    renderOffline: renderOffline
};
