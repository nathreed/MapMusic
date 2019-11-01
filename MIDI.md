# MIDI support notes

These are my notes taken while reading https://www.csie.ntu.edu.tw/~r92092/ref/midi/

CURRENT STATE: the MIDI export code in `midi-export.js` outputs playable MIDI files. I have tested them with GarageBand
and Timidity. It appears to be somewhat buggy, as the files import oddly into GarageBand but play fine in Timidity. Also,
tempo information doesn't appear to be working properly.

Press hotkey M to download midi of the current staged audio.


## File format basics
made of chunks
Chunk = 4byte chunk type ("MThd" or "MTrk" for header or track), 4byte length, length bytes

One header, one or more track

Specification allows normal binary representation of values or variable length.

We will need to be able to use both of these, because some are used in some places and some are used in others

### Variable length representation
Basically every MSBit of the byte is set to 1, and then we use the other 7 bits to store the data.
Except the last byte of our sequence whose MSBit is set to 0. 

Ex: 128 is `1000 0001 0000 0000` and 131 is `1000 0001 0000 0011`

Note that the linked page has a typo in the table, it says 100k in decimal but the hex is for 1 million

### Header
MThd chunk type, 6 byte length, then 6 bytes of data

Data:
format - 16bits/2bytes. Has formats 0,1,2 but we can probably stick with format 0 for now.
Format 2 allows multiple tracks to be played at once, maybe useful for later if we re-do the editor.

tracks - 16bit/2bytes. Number of track chunks in the file.

division - 16bit/2bytes. Default unit of delta-time. If MSBit is 0, it's "ticks per quarter note"
and if 1, it's "frames per second" followed by "ticks per frame".

We will be using the ticks per quarter note method, and I'm pretty sure we can just specify
any number for that, so let's just pick 48 to go with the MIDI default.

So our division will look like `00 30` (mode 0 for ticks/qn and then 48 ticks/qn)

### Formats

We will stick with format 0 for now - single header chunk, single track chunk
Track chunk contains all note and tempo info

For later - format 2 is one header chunk and one or more track chunks where each is an independent sequence

Actually we might as well write format 2 files and just start with one track

But for right now since I can't find a good example of format 2 files, we are writing format 0 (just one track)
because that's all I can get to load properly in MIDI sequencers/GarageBand

### Track Chunks

header: MTrk chunk type, then length, then binary data
Then delta-time followed by event. We will stick to midi_event to start (just notes)

We will also need to do meta_events because some of them are required, namely:

- end of track

### Events
delta-time always has MSBit 0 in the last byte

meta_events have a length field

and midi_events have a predefined length, so that's how you tell between them

#### MIDI channel voice messages

This is the kind of midi event that will hold the note data. We really only need to support
note on and note off. Since we are not velocity sensitive, we should send 0x40 for the velocity for note on.


**Note off**: Status byte (8 and then channel, we use channel 1) then 1 byte key (note number), then 1 byte of velocity.

Ex: (hex) `80 3c 40` = middle C off with velocity 40 on channel 1

**Note on**: Status byte (9 and then channel, ch1 as above), then 1 byte key/note, 1 byte velocity.

Ex: (hex) `90 3c 40` = middle C on with velocity 40 on channel 1

Both of these event types are 3 bytes

#### Meta events

general form: byte FF, byte for type, variable length rep for length, then length bytes of data

Important ones: 
- end of track, `FF 2F 00`
- set tempo (microsec/quarter note), `FF 51 03 tt tt tt`. 120bpm = 500,000 us/qn


#### Full File Example

Header: `MThd | 00 00 00 06 | 00 00 | 00 01 | 01 80` (format 0, 1 track, 384 ticks/beat)

Track 1: `MTrk | 00 00 00 27 | 00 FF 03 08 MapMusic | 00 FF 51 03 07 A1 20 | 00 FF 58 04 04 02  |  00 90 3c 40 | (83 00 | 80 3c 40) | 00 FF 2F 00`
(length = 0x27 bytes (39), set track title to MapMusic, set tempo to 120bpm (500k us/beat), set time signature to 4/4, note on C4 at delta-t 0, note off C4 at delta-t 384 ticks (variable rep 0x8300) )
in that order

Text is obviously written as its bytes, the ASCII is just written here as shorthand.
#### Converting Our Data to MIDI

The UI selections will govern how long one note is. We are just going to assume everything is a quarter note in the MIDI
and set the tempo accordingly to achieve the desired playback speed. This way,
the tempo can be easily changed in a MIDI sequencer later. 

With this in mind, we will use the length of one note (as determined by the UI settings)
to determine a BPM value. This will be used in the set-tempo event that gets written
to the beginning of each track. 

Since all notes will be quarter notes and we are using 384 ticks/qn, every note will 
go into the midi with a note on event at an offset and a note off event 384 ticks later. The 
next note-on event will occur at delta-t 0 after the 