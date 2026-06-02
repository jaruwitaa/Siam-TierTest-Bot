import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://67:password@cluster0.ukp3d02.mongodb.net'; // update since i forgot lol it wont work btw i rotated the password

await mongoose.connect(MONGO_URI);
console.log('✅ MongoDB connected');

// Username collection — keyed by Discord ID
const usernameSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  mcname:    { type: String, required: true },
  uuid:      { type: String, required: true, unique: true },
  linkedAt:  { type: String }
});

// Players collection — keyed by mcname
const playerSchema = new mongoose.Schema({
  mcname:    { type: String, required: true, unique: true },
  discordId: { type: String, },
  uuid:      { type: String },

  ranks: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const queueEntrySchema = new mongoose.Schema({
  discordId: String,
  mcname:    String,
  region:    String,
  gamemode:  String,
  joined:    Number
});

const queueSchema = new mongoose.Schema({
  gamemode: { type: String, unique: true },
  region:   String,
    
  entries:  [queueEntrySchema],
    
  onlineTesters: {
    type: [String],
    default: []
  }
});

const testingSchema = new mongoose.Schema({
  discordId:       { type: String, unique: true },
  gamemode:        String,
  region:          String,
  mcname:          String,
  testerId:        String,
  ticketChannelId: String,
  startedAt:       Number
});

const cooldownSchema = new mongoose.Schema({
  discordId: String,
  gamemode:  String,
  timestamp: Number
});
cooldownSchema.index({ discordId: 1, gamemode: 1 }, { unique: true });

export const Queue    = mongoose.model('Queue',    queueSchema);
export const Testing  = mongoose.model('Testing',  testingSchema);
export const Cooldown = mongoose.model('Cooldown', cooldownSchema);
export const Username = mongoose.model('Username', usernameSchema);
export const Player   = mongoose.model('Player', playerSchema);