import mongoose from "mongoose";



const artistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Artist name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    },
    genre: {
        type: String,
        required: [true, 'Genre is required'],
        enum: {
            values: ['rap', 'country', 'pop', 'rock', 'jazz', 'reggae', 'edm', 'classical', 'other'],
            message: 'Genre must be one of the specified categories'
        }
    },
    biography: {
        type: String,
        maxlength: [2000, 'Biography cannot exceed 2000 characters']
    },
    photos: [
        {
            url: String,
            filename: String
        }
    ],
    mp3File: {
        url: String,
        filename: String,
        originalName: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

artistSchema.pre('save', function(next){
    this.updatedAt = Date.now();
    next();
})


const Artist = mongoose.model('Artist', artistSchema);
export default Artist;