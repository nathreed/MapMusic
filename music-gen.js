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
        console.log("seq cb");
        synth.triggerAttackRelease(note, noteDurationSec, time);
    }, noteSequence, noteDurationSec).start(0);
    seq.loop = false;

    //And play
    Tone.Transport.start();
    //Tone.Transport.clear(seq)
}
