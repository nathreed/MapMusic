module.exports = {
    wavFromBuffer: wavFromBuffer
};


function wavFromBuffer(buffer) {
    let outputState = {
        recLength: 0,
        recBuffersL: [],
        recBuffersR: [],
        sampleRate:  44100
    };
    let bufArr = [buffer.getChannelData(0), buffer.getChannelData(1)];
    record(bufArr, outputState);
    let blob = exportWAV("audio/wav", outputState);
    return blob;
}


function record(inputBuffer, state) {
    state.recBuffersL.push(inputBuffer[0]);
    state.recBuffersR.push(inputBuffer[1]);
    state.recLength += inputBuffer[0].length;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i += 1) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output, offset, input) {
    let writeOffset = offset;
    for (let i = 0; i < input.length; i += 1, writeOffset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(writeOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function encodeWAV(samples, mono = false, state) {
    const buffer = new ArrayBuffer(44 + (samples.length * 2));
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 32 + (samples.length * 2), true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, mono ? 1 : 2, true);
    /* sample rate */
    view.setUint32(24, state.sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, state.sampleRate * 4, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 4, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
}

function mergeBuffers(recBuffers, length) {
    const result = new Float32Array(length);
    let offset = 0;

    for (let i = 0; i < recBuffers.length; i += 1) {
        result.set(recBuffers[i], offset);
        offset += recBuffers[i].length;
    }
    return result;
}

function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);

    let index = 0;
    let inputIndex = 0;

    while (index < length) {
        result[index += 1] = inputL[inputIndex];
        result[index += 1] = inputR[inputIndex];
        inputIndex += 1;
    }

    return result;
}

function exportWAV(type, state) {

    const bufferL = mergeBuffers(state.recBuffersL, state.recLength);
    const bufferR = mergeBuffers(state.recBuffersR, state.recLength);
    const interleaved = interleave(bufferL, bufferR);
    const dataview = encodeWAV(interleaved, false, state);
    const audioBlob = new Blob([dataview], { type });


    return audioBlob;
}