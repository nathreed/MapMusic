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



        setTimeout(function() {
            let player = new Tone.Player(buffer).toMaster();
            console.log("STARTING PLAYER ON OFFLINE BUFFER!");
            player.start();

        }, 10000)
    })
}

module.exports = {
    playTones: playTones,
    renderOffline: renderOffline
};
