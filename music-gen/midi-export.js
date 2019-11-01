
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