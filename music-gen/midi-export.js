
//Convert an input integer to variable length representation
function toVariableLengthRep(input) {
	//Make extra darn certain we we dealing with an integer
	input = parseInt(input + ""); //js type system lets us do this nasty thing...
	if(input < 0) {
		console.log("ERROR! Cannot represent negative number as variable length rep!");
		return;
	}
	if(input <= 127) {
		return input; //0-127 just pass through as is
	}
	//We are dealing with something bigger than 127, so we need to split it into 7 bit sequences
	//To do this, we will do the following in a loop:
	//extract the bottom 7 bits with a mask, place them into an 8bit thing with proper msbit, then 0 fill shift right 8 bits
	//We will support 16, 32, and 64 bit integers with this technique
	const max16 = 2**16 - 1;
	const max32 = 2**32 - 1;
	const max64 = 2**64 - 1;

	//# of rounds are determined by ceil(bits/7)
	if(input <= max16) {
		//16 bit int
		//3 rounds
		//Kill everything but bottom 16bits
		return varLengthUtil(3, input) & 0xffff;
	} else if(input <= max32) {
		//32 bit int
		//5 rounds
		//Kill everything but bottom 32bits
		return varLengthUtil(5, input) & 0xffffffff;
	} else if(input <= max64) {
		//64 bit int
		//10 rounds
		//Kill everything but bottom 64bits (does js have higher bit ints??)
		return varLengthUtil(10, input) & 0xffffffffffffffff;
	}
}

function varLengthUtil(numRounds, int) {
	let finalValue = 0;
	for(let i=0; i<numRounds; i++) {
		//Get the bottom 7 bits
		let bottom7 = int & 0x7f;
		//Place them into an 8 bit container with the proper MSBit
		if(i === 0) {
			//bottom 7bits, MSBit = 0, just fill in as is
			finalValue = bottom7;
		} else {
			//Not the bottom, MSBit = 1
			//If bottom7 was equal to 0, just leave here and do nothing and continue to the next round
			if(bottom7 !== 0) {
				let filledContainer = bottom7 | 0x80; //fill it in with the MSBit being 1
				//Now shift the filled container left by i many bytes
				let containerComponent = filledContainer << (i*8);
				//And finally add to the final value
				finalValue = containerComponent | finalValue; //We just OR the current part of the final value into place
			}

		}
		//Shift right by 7 (zero fill) and continue
		int = int >>> 7;
	}
	return finalValue;
}

function decimalToHexString(number)
{
	if (number < 0)
	{
		number = 0xFFFFFFFF + number + 1;
	}

	return number.toString(16).toUpperCase();
}

function DataViewWrapper(fileSize) {
	this.buffer = new ArrayBuffer(fileSize);
	this.view = new DataView(this.buffer);


	//Keep track of the offset we are writing to inside the dataView
	this.offset = 0;

	//Functions for writing common types to the dataview
	this.writeUint8 = function(val) {
		this.view.setUint8(this.offset, val);
		this.offset += 1;
	};

	this.writeUint16 = function(val) {
		this.view.setUint16(this.offset, val);
		this.offset += 2;
	};

	this.writeUint32 = function(val) {
		this.view.setUint32(this.offset, val);
		this.offset += 4;
	};

	this.writeString = function(string) {
		for (let i = 0; i < string.length; i += 1) {
			this.view.setUint8(this.offset + i, string.charCodeAt(i));
		}
		this.offset += string.length;
	};

	this.blob = function(type) {
		return new Blob([this.buffer], {type: type});
	};

}

//Borrowed from the wav-export code
function writeString(view, offset, string) {
	for (let i = 0; i < string.length; i += 1) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

//This function will do the preparations, encodeMIDI function will do the actual writing
function writeMIDI(notes, noteLength, trackName) {
	//Figure out the tempo in BPM based on the note length in seconds
	//1/sec * 60
	const tempoBPMDec = (1/noteLength) * 60;
	console.log("Tempo BPM:", tempoBPMDec);

	//Obtain the midi blob and cause a file download
	const midi = encodeMIDIFormat1(notes, tempoBPMDec, trackName);

	let anchor = document.createElement('a');
	document.body.appendChild(anchor);
	anchor.style = 'display: none';
	let url = window.URL.createObjectURL(midi);
	anchor.href = url;
	anchor.download = trackName + '.mid';
	anchor.click();
	window.URL.revokeObjectURL(url);

}

function encodeMIDIFormat0(notes, tempoBPMDec, trackName) {
	//The number of bytes we need for the ArrayBuffer is calculated as follows
	//14 bytes for the header chunk
	//25 bytes for the beginning of the track setup (time signature, tempo, etc) plus length of the track name
	//For every note, we need an on command (4 bytes) and an off command (5 bytes), so 9 bytes/note
	//4 bytes for the end track event
	//truncate track name length if necessary
	if(trackName.length > 127) {
		trackName = trackName.substring(0, 128);
	}
	const arrLength = 14 + 25 + trackName.length + (notes.length * 9) + 4;
	let buffer = new ArrayBuffer(arrLength);
	//Create a DataView to write into the buffer
	const view = new DataView(buffer);

	//BEGIN WRITING OF MIDI FILE

	//Write header
	writeString(view, 0, "MThd");
	//header length
	view.setUint32(4, 6, false);
	//midi format
	view.setUint16(8, 0, false);
	//number of tracks
	view.setUint16(10, 1, false);
	//ticks per beat
	view.setUint16(12, 0x0180, false);

	//Write beginning of track and setup
	writeString(view, 14, "MTrk");
	//Calculate length of MTrk chunk
	//it's going to be 17 bytes of setup, plus the length of the name, plus 6*num of notes
	const mtrkChunkLen = 17 + trackName.length + 9*notes.length;
	view.setUint32(18, mtrkChunkLen, false);
	//Write track name event, delta-t = 0
	view.setUint32(22, 0x00ff0300 + trackName.length, false);
	//Write the name itself
	writeString(view, 26, trackName);
	const newOffset = 26 + trackName.length;
	//Write the set tempo event, delta-t = 0
	view.setUint32(newOffset, 0x00ff5103, false);
	//Convert the tempo from BPM to microsec/beat
	const usPerBeat = (1 / (tempoBPMDec / 60)) * 1e6;
	console.log("microSec per beat:", usPerBeat);
	console.log("in hex: ", decimalToHexString(usPerBeat));
	//Since this is a 24-bit value, we are going to have to write it one byte at a time
	console.log("offset for tempo value: ", newOffset + 4);
	view.setUint8(newOffset + 4, (usPerBeat >>> 16));
	view.setUint8(newOffset + 5, (usPerBeat >>> 8));
	view.setUint8(newOffset + 6, (usPerBeat & 0xff));
	//Write time signature
	//This is bytes 00 FF 58 04 04 02, we will write it as a uint32 and then a uint16
	view.setUint32(newOffset + 7, 0x00ff5804, false);
	view.setUint16(newOffset + 11, 0x0402, false);

	//Now it's time to write the notes themselves
	//This value will be incremented as the loop runs, we are initializing it here
	let currentNoteOffset = newOffset + 13;
	//For each note, write a note on command with delta-t 0, then a note-off command with delta-t 384 ticks
	for(let i=0; i<notes.length; i++) {
		//Note on command is 4 bytes 00 90 <note byte> 40
		//We will write as Uint16, then Uint8, uint8 to make it simple for us
		view.setUint16(currentNoteOffset, 0x0090, false);
		view.setUint8(currentNoteOffset + 2, notes[i]);
		view.setUint8(currentNoteOffset + 3, 0x40);
		//Note off command for 384 ticks (1 qn) later is 5 bytes 83 00 80 <note byte> 40
		//Write as Uint16 followed by 3 Uint8s
		view.setUint16(currentNoteOffset + 4, 0x8300, false);
		view.setUint8(currentNoteOffset + 6, 0x80);
		view.setUint8(currentNoteOffset + 7, notes[i]);
		view.setUint8(currentNoteOffset + 8, 0x40);

		//We are finished writing the commands, increment the offset
		currentNoteOffset += 9;
	}
	//Write the end track command at the very end
	//It is 4 bytes, write as Uint32
	view.setUint32(currentNoteOffset, 0x00ff2f00, false);

	//Return a new blob with the ArrayBuffer
	return new Blob([buffer], {type: "audio/midi"});
}

function encodeMIDIFormat1(notes, tempoBPMDec, trackName) {
	//First calculate the number of bytes we need for the ArrayBuffer
	//This will be 14 for the header, 26 bytes for track 1
	//Then for track 2, 19 bytes plus the title length
	//Plus 9 bytes for each note (4 on, 5 off)
	//Truncate track name if needed
	if(trackName.length > 127) {
		trackName = trackName.substring(0, 128);
	}

	const size = 14 + 27 + 19 + trackName.length + 9*notes.length;
	let writer = new DataViewWrapper(size);



	//Start writing the bytes for the midi file
	//First the header
	//midi header
	writer.writeString("MThd");
	//header size
	writer.writeUint32(6);
	//midi format
	writer.writeUint16(1);
	//number of tracks
	writer.writeUint16(2);
	//ticks per beat
	writer.writeUint16(0x0180);

	//Write track 1
	//This is all static, so just write it as a series of Uint32s and then any extras
	writer.writeString("MTrk");
	//length
	writer.writeUint32(0x13);
	//First part of set time signature command
	writer.writeUint32(0x00ff5804);
	//next part of time signature
	writer.writeUint16(0x0402);
	//Write a delay
	writer.writeUint16(0x1808);


	//Convert the tempo to us/beat
	const usPerBeat = (1 / (tempoBPMDec / 60)) * 1e6;
	//set tempo event
	writer.writeUint32(0x00ff5103);
	//Write the actual tempo
	writer.writeUint8(usPerBeat >>> 16);
	writer.writeUint8(usPerBeat >>> 8);
	writer.writeUint8(usPerBeat & 0xff);
	//Write end track
	writer.writeUint32(0x00ff2f00);

	//Write track 2
	//First part of notes track
	writer.writeString("MTrk");
	//length of data following will be 4 + trackName length, + 7 + 9*notes length plus an extra byte for some reason??
	const trackDataLength = 1 + 4 + trackName.length + 7 + 9*notes.length;
	//Write the length
	writer.writeUint32(trackDataLength);
	//write set name command
	writer.writeUint32(0x00ff0300 + trackName.length);
	//write actual name
	writer.writeString(trackName);
	//Write program change command
	writer.writeUint16(0x00C0);
	writer.writeUint8(0x00);

	//Write the actual notes
	for(let i=0; i<notes.length; i++) {
		//Write note on event
		writer.writeUint16(0x0090);
		writer.writeUint8(notes[i]);
		writer.writeUint8(0x40);
		//Write note off event
		writer.writeUint16(0x8300);
		writer.writeUint16(0x8000 + notes[i]);
		writer.writeUint8(0x40);
	}

	//Write the end of track event
	writer.writeUint32(0x00ff2f00);

	//We are done with the file, return the blob
	return writer.blob("audio/midi");

}

module.exports = {
	exportMIDI: writeMIDI
};